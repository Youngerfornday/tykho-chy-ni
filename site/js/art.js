// Decorative night scene over Kyiv: sky, stars, real moon phase, skyline,
// air-defense searchlights and a rooftop cat that wakes up when it gets loud.

const NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 1440;
const BASE = 520;
const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const NEW_MOON_ILLUMINATION = 0.04;
const BEAM_MIN_INTENSITY = 0.15;
const EYES_OPEN_INTENSITY = 0.5;
const STAR_COUNT = 140;
const STAR_SEED = 0x7c1d2a;
const WINDOW_SEED = 0x4b1f09;

const C = {
  bg: '#141921', skyTop: '#1a2130', panel: '#2A2D31', far: '#161d28', mid: '#181f2b',
  front: '#0e1218', muted: '#989ba0', gold: '#E6B20E', light: '#E5CD40', red: '#D45B50', pale: '#EEE9E3',
};

const MOON = { cx: 880, cy: 104, r: 30 };

const FRONT_BLOCKS = [
  [0, 64, 62, 'flat'], [60, 46, 88, 'antenna'], [104, 86, 50, 'pitched'], [188, 56, 98, 'stepped'],
  [242, 78, 66, 'tank'], [318, 42, 112, 'antenna'], [358, 92, 56, 'flat'], [448, 62, 82, 'stepped'],
  [508, 54, 48, 'pitched'], [560, 92, 96, 'flat'], [880, 50, 62, 'flat'], [928, 40, 78, 'tank'],
  [1118, 58, 92, 'antenna'], [1174, 44, 128, 'flat'], [1216, 70, 84, 'stepped'], [1284, 48, 150, 'antenna'],
  [1330, 64, 104, 'flat'], [1392, 50, 70, 'tank'],
];

const MID_TOWERS = [
  [372, 34, 140], [520, 40, 150], [600, 30, 128], [905, 36, 120], [1130, 40, 176],
  [1200, 34, 196], [1262, 44, 210], [1350, 38, 184], [1410, 40, 160],
];

const BEAMS = [
  { x: 430, y: 470, from: -34, to: -6, dur: 14, delay: -3 },
  { x: 930, y: 455, from: -12, to: 18, dur: 18, delay: -9 },
  { x: 1290, y: 400, from: 6, to: 34, dur: 16, delay: -5 },
];

const CAT = { x: 626, y: 422 };

let mountCount = 0;

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const fmt = (n) => Math.round(n * 10) / 10;

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  children.forEach((child) => node.appendChild(child));
  return node;
}

function withVars(node, vars) {
  Object.entries(vars).forEach(([k, v]) => node.style.setProperty(k, v));
  return node;
}

function gradient(id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }) {
  return el('linearGradient', { id, ...attrs },
    stops.map(([offset, color, opacity]) => el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity })));
}

/**
 * @param {Date} date
 * @returns {{ fraction: number, illumination: number, waxing: boolean }}
 */
export function moonPhase(date) {
  const days = (date.getTime() - REF_NEW_MOON_MS) / 86400000;
  const fraction = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  return { fraction, illumination, waxing: fraction < 0.5 };
}

// Lit part: outer limb arc plus terminator ellipse arc. Northern hemisphere view.
function litPath({ cx, cy, r }, fraction) {
  const k = Math.cos(2 * Math.PI * fraction);
  const rx = fmt(r * Math.abs(k));
  const crescent = k > 0;
  const waxing = fraction < 0.5;
  const outerSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r}A${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r}Z`;
}

function buildMoon(date, id) {
  const { fraction, illumination } = moonPhase(date);
  const { cx, cy, r } = MOON;
  const glow = el('circle', { cx, cy, r: r * 3.4, fill: `url(#${id}-glow)`, opacity: fmt(0.25 + 0.75 * illumination) });
  const disk = el('circle', { cx, cy, r, fill: C.panel, 'fill-opacity': 0.45 });
  if (illumination < NEW_MOON_ILLUMINATION) {
    return el('g', {}, [disk, el('circle', { cx, cy, r, fill: 'none', stroke: C.muted, 'stroke-opacity': 0.35, 'stroke-width': 1 })]);
  }
  const d = litPath(MOON, fraction);
  const craters = [[-9, -8, 5], [8, 6, 7], [-4, 13, 4], [12, -12, 3.5]].map(([dx, dy, cr]) =>
    el('circle', { cx: cx + dx, cy: cy + dy, r: cr, fill: C.muted, 'fill-opacity': 0.2 }));
  return el('g', {}, [
    glow, disk,
    el('clipPath', { id: `${id}-lit` }, [el('path', { d })]),
    el('path', { d, fill: C.pale, 'fill-opacity': 0.92 }),
    el('g', { 'clip-path': `url(#${id}-lit)` }, craters),
  ]);
}

function buildStars() {
  const rnd = mulberry32(STAR_SEED);
  const candidates = Array.from({ length: STAR_COUNT + 60 }, () => ({
    x: fmt(rnd() * VIEW_W), y: fmt(6 + Math.pow(rnd(), 1.35) * 380),
    r: fmt(0.4 + Math.pow(rnd(), 2) * 1.2), o: fmt(0.35 + rnd() * 0.6),
    dur: fmt(3 + rnd() * 6), delay: fmt(-rnd() * 9),
  }));
  const stars = candidates
    .filter((s) => Math.hypot(s.x - MOON.cx, s.y - MOON.cy) > MOON.r * 2.4)
    .slice(0, STAR_COUNT);
  return el('g', {}, stars.map((s) => {
    const dot = el('circle', { cx: s.x, cy: s.y, r: s.r, fill: C.pale, 'fill-opacity': s.o });
    const parts = s.r > 1.35
      ? [dot, el('path', { d: `M${s.x - 4} ${s.y}H${s.x + 4}M${s.x} ${s.y - 4}V${s.y + 4}`, stroke: C.pale, 'stroke-width': 0.5, 'stroke-opacity': 0.55 })]
      : [dot];
    return withVars(el('g', { class: 'ns-star' }, parts), { '--ns-dur': `${s.dur}s`, '--ns-delay': `${s.delay}s` });
  }));
}

function blockPath([x, w, h, roof]) {
  const t = BASE - h;
  const r = x + w;
  const b = BASE + 10;
  switch (roof) {
    case 'antenna': {
      const mx = fmt(x + w * 0.62);
      return `M${x} ${b}V${t}H${mx}V${t - 24}H${fmt(mx + 1.4)}V${t}H${r}V${b}Z`;
    }
    case 'stepped':
      return `M${x} ${b}V${t + 14}H${fmt(x + w * 0.25)}V${t}H${fmt(x + w * 0.75)}V${t + 14}H${r}V${b}Z`;
    case 'pitched':
      return `M${x} ${b}V${t + 10}L${fmt(x + w / 2)} ${t}L${r} ${t + 10}V${b}Z`;
    case 'tank':
      return `M${x} ${b}V${t}H${fmt(x + w * 0.2)}V${t - 8}H${fmt(x + w * 0.42)}V${t}H${r}V${b}Z`;
    default:
      return `M${x} ${b}V${t}H${x + 3}V${t - 2}H${r - 3}V${t}H${r}V${b}Z`;
  }
}

function onionDome(x, by, w, h) {
  return `M${fmt(x - w * 0.7)} ${by}C${fmt(x - w * 1.15)} ${fmt(by - h * 0.35)} ${fmt(x - w * 0.6)} ${fmt(by - h * 0.72)} ${x} ${by - h}`
    + `C${fmt(x + w * 0.6)} ${fmt(by - h * 0.72)} ${fmt(x + w * 1.15)} ${fmt(by - h * 0.35)} ${fmt(x + w * 0.7)} ${by}Z`;
}

function cross(x, top, size) {
  return `M${fmt(x - 0.7)} ${top + size * 2}V${top}H${fmt(x + 0.7)}V${top + size * 2}Z`
    + `M${fmt(x - size * 0.7)} ${fmt(top + size * 0.6)}H${fmt(x + size * 0.7)}V${fmt(top + size * 0.6 + 1.1)}H${fmt(x - size * 0.7)}Z`;
}

const DOMES = [[740, 414, 10, 24], [707, 424, 6, 14], [773, 424, 6, 14], [836, 350, 8, 18]];

function landmarkPaths() {
  const lavra = [
    'M640 530L640 480C700 470 780 464 900 474L900 530Z',
    'M690 472V440H702V432H778V440H790V472Z',
    'M733 432V414H747V432Z M702 432V424H712V432Z M768 432V424H778V432Z',
    'M814 476V428H816V424H856V428H858V476Z',
    'M820 424V392H822V389H850V392H852V424Z',
    'M825 389V362H827V359H845V362H847V389Z',
    'M830 359V350H842V359Z',
    ...DOMES.map(([x, by, w, h]) => onionDome(x, by, w, h)),
    cross(740, 378, 6), cross(707, 402, 4), cross(773, 402, 4), 'M835.3 334V314H836.7V334Z',
  ];
  const motherland = [
    'M960 530L960 482C990 474 1010 470 1040 469C1075 470 1100 474 1120 482L1120 530Z',
    'M1012 470L1018 436L1026 432L1030 404L1050 404L1054 432L1062 436L1068 470Z',
    'M1031 404C1032.5 388 1034 372 1035.5 358L1044.5 358C1046 372 1047.5 388 1049 404Z',
    'M1036 352.6a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z',
    'M1043.5 360L1055.5 337L1059 339L1047 363Z',
    'M1056 340L1063 286L1064.6 286.3L1058.4 340.6Z M1052.5 341.5L1061 338L1061.6 339.8L1053.1 343.3Z',
    'M1036.5 360L1024.5 339.5L1021.3 341.8L1033 363Z',
    'M1012 338a7 9 0 1 0 14 0a7 9 0 1 0 -14 0Z',
  ];
  return [...lavra, ...motherland];
}

const CAT_BODY = [
  'M-11 0C-13 -10 -10 -20 -6 -24L6 -24C10 -20 13 -10 11 0Z',
  'M-8 -30C-8 -34 -7 -37 -7 -37L-6 -44L-2 -38.2C-0.7 -38.5 0.7 -38.5 2 -38.2L6 -44L7 -37C7 -37 8 -34 8 -30C8 -25 4 -22 0 -22C-4 -22 -8 -25 -8 -30Z',
];
const CAT_TAIL = 'M8 -2C16 -1 21 -7 19 -16C18 -21 20 -25 23 -25';

function buildCat(id) {
  const at = `translate(${CAT.x} ${CAT.y})`;
  const tail = el('g', { transform: at }, [
    el('g', { class: 'ns-tail' }, [
      el('path', { d: CAT_TAIL, fill: 'none', stroke: C.panel, 'stroke-width': 5, 'stroke-linecap': 'round' }),
      el('path', { d: CAT_TAIL, fill: 'none', stroke: C.front, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    ]),
  ]);
  const eyesClosed = el('g', { class: 'ns-eyes', fill: 'none', stroke: C.muted, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, [
    el('path', { d: 'M-4.7 -31Q-3 -29.6 -1.3 -31' }), el('path', { d: 'M1.3 -31Q3 -29.6 4.7 -31' }),
  ]);
  const eyesOpen = el('g', { class: 'ns-eyes ns-eyes-open', fill: C.gold, filter: `url(#${id}-eye-glow)` }, [
    el('ellipse', { cx: -3, cy: -31, rx: 1.7, ry: 1.3 }), el('ellipse', { cx: 3, cy: -31, rx: 1.7, ry: 1.3 }),
  ]);
  const eyes = el('g', { transform: at }, [eyesClosed, eyesOpen]);
  return { tail, eyes, eyesClosed, eyesOpen, body: CAT_BODY.map((d) => ({ d, transform: at })) };
}

function buildWindows(blocks, { seed, probability, opacityRange, flickerShare, size }) {
  const rnd = mulberry32(seed);
  const [oMin, oMax] = opacityRange;
  const rects = blocks.flatMap(([x, w, h]) => {
    const cols = Math.max(1, Math.floor((w - 10) / 8));
    const rows = Math.max(0, Math.floor((h - 22) / 10));
    return Array.from({ length: rows * cols }, (_, i) => ({
      x: x + 5 + (i % cols) * 8, y: BASE - h + 16 + Math.floor(i / cols) * 10, roll: rnd(), o: rnd(), f: rnd(), d: rnd(),
    })).filter((cell) => cell.roll < probability);
  });
  return el('g', { fill: C.light }, rects.map((cell) => {
    const rect = el('rect', { x: cell.x, y: cell.y, width: size[0], height: size[1], 'fill-opacity': fmt(oMin + cell.o * (oMax - oMin)) });
    if (cell.f >= flickerShare) return rect;
    rect.setAttribute('class', 'ns-flicker');
    return withVars(rect, { '--ns-dur': `${fmt(9 + cell.d * 14)}s`, '--ns-delay': `${fmt(-cell.d * 20)}s` });
  }));
}

function buildBeams(id) {
  return el('g', { class: 'ns-beams' }, BEAMS.map((b) =>
    el('g', { transform: `translate(${b.x} ${b.y})` }, [
      withVars(el('path', { class: 'ns-beam', d: 'M-0.8 0L-24 -470L24 -470L0.8 0Z', fill: `url(#${id}-beam)`, filter: `url(#${id}-soft)` }), {
        '--ns-from': `${b.from}deg`, '--ns-to': `${b.to}deg`, '--ns-dur': `${b.dur}s`, '--ns-delay': `${b.delay}s`,
      }),
    ])));
}

function buildDefs(id) {
  return el('defs', {}, [
    gradient(`${id}-sky`, [[0, C.skyTop, 1], [1, C.bg, 1]]),
    gradient(`${id}-haze`, [[0, C.panel, 0], [0.7, C.panel, 0.38], [1, C.panel, 0.1]]),
    gradient(`${id}-red`, [[0, C.red, 0], [1, C.red, 1]]),
    gradient(`${id}-beam`, [[0, C.pale, 0], [0.7, C.muted, 0.55], [1, C.light, 0.8]]),
    el('radialGradient', { id: `${id}-glow` }, [
      el('stop', { offset: 0, 'stop-color': C.pale, 'stop-opacity': 0.22 }),
      el('stop', { offset: 1, 'stop-color': C.pale, 'stop-opacity': 0 }),
    ]),
    el('filter', { id: `${id}-soft`, x: '-50%', y: '-5%', width: '200%', height: '110%' }, [el('feGaussianBlur', { stdDeviation: 2.5 })]),
    el('filter', { id: `${id}-eye-glow`, x: '-200%', y: '-200%', width: '500%', height: '500%' }, [
      el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1.4, result: 'b' }),
      el('feMerge', {}, [el('feMergeNode', { in: 'b' }), el('feMergeNode', { in: 'SourceGraphic' })]),
    ]),
  ]);
}

function applyIntensity(refs, value) {
  const i = clamp01(value);
  refs.beams.style.opacity = i < BEAM_MIN_INTENSITY ? '0' : String(fmt((0.05 + 0.25 * i) * 100) / 100);
  refs.redTint.style.opacity = String(Math.round(0.18 * i * 1000) / 1000);
  const awake = i >= EYES_OPEN_INTENSITY;
  refs.eyesOpen.style.opacity = awake ? '1' : '0';
  refs.eyesClosed.style.opacity = awake ? '0' : '1';
}

/**
 * @param {HTMLElement} root
 * @param {{ date?: Date, intensity?: number }} options intensity is 0..1
 * @returns {{ setIntensity: (value: number) => void }}
 */
export function mountNightScene(root, { date, intensity } = {}) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  mountCount += 1;
  const id = `ns${mountCount}`;
  const cat = buildCat(id);
  const silhouette = [
    ...FRONT_BLOCKS.map((block) => ({ d: blockPath(block) })),
    ...landmarkPaths().map((d) => ({ d })),
    ...cat.body,
  ];
  const shapes = (attrs) => el('g', attrs, silhouette.map((s) => el('path', s.transform ? { d: s.d, transform: s.transform } : { d: s.d })));
  const redTint = el('rect', { x: 0, y: 300, width: VIEW_W, height: 220, fill: `url(#${id}-red)` });
  const beams = buildBeams(id);
  const glints = el('g', { fill: 'none', stroke: C.gold, 'stroke-width': 1.1, 'stroke-opacity': 0.38, 'stroke-linecap': 'round' },
    DOMES.map(([x, by, w, h]) => el('path', {
      d: `M${fmt(x - w * 0.55)} ${by - 2}C${fmt(x - w * 0.8)} ${fmt(by - h * 0.4)} ${fmt(x - w * 0.35)} ${fmt(by - h * 0.72)} ${fmt(x - w * 0.05)} ${fmt(by - h * 0.9)}`,
    })));

  const svg = el('svg', {
    class: 'night-scene', viewBox: `0 0 ${VIEW_W} ${BASE}`, preserveAspectRatio: 'xMidYMax slice',
    'aria-hidden': 'true', focusable: 'false',
  }, [
    buildDefs(id),
    el('rect', { x: 0, y: 0, width: VIEW_W, height: BASE, fill: `url(#${id}-sky)` }),
    buildStars(),
    buildMoon(when, id),
    el('rect', { x: 0, y: 300, width: VIEW_W, height: 220, fill: `url(#${id}-haze)` }),
    redTint,
    el('path', { d: 'M0 488C180 470 360 476 560 462C760 448 900 440 1080 446C1240 452 1330 438 1440 444V530H0Z', fill: C.far }),
    el('g', { fill: C.mid }, MID_TOWERS.map(([x, w, h]) => el('path', { d: blockPath([x, w, h, 'flat']) }))),
    buildWindows(MID_TOWERS, { seed: WINDOW_SEED + 1, probability: 0.1, opacityRange: [0.12, 0.24], flickerShare: 0, size: [2.5, 3] }),
    beams,
    cat.tail,
    shapes({ fill: C.panel, stroke: C.panel, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    shapes({ fill: C.front }),
    buildWindows(FRONT_BLOCKS, { seed: WINDOW_SEED, probability: 0.14, opacityRange: [0.35, 0.7], flickerShare: 0.2, size: [3, 4] }),
    glints,
    cat.eyes,
  ]);

  const refs = { beams, redTint, eyesOpen: cat.eyesOpen, eyesClosed: cat.eyesClosed };
  applyIntensity(refs, intensity);
  root.appendChild(svg);
  return { setIntensity: (v) => applyIntensity(refs, v) };
}
