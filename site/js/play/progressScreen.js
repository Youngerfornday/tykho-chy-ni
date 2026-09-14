// "Прогрес": level, skill against the line, streaks, achievements, missions, reset.

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { BADGES } from '../badges.js';
import { chips } from '../bet/labels.js';
import { emblemFor } from './shell.js';
import { missionsBlock } from './missionsView.js';

const unlockFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long' });
const signedPp = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.round(Math.abs(v))} п.п.`;

export function levelCard(progress, { compact = false } = {}) {
  const { level, xp } = progress;
  const art = emblemFor(level.level, compact ? 44 : 72);
  const toNext = level.next ? `${chips(xp)} / ${chips(level.next.xp)} XP` : `${chips(xp)} XP · максимум`;
  const xpLine = `Рівень ${level.level} · ${toNext}${level.next && !compact ? ` · далі ${level.next.name}` : ''}`;
  return h('div', { class: `lvl${compact ? ' lvl--compact' : ''}` },
    art ? icon(art, 'lvl__emblem') : null,
    h('div', { class: 'lvl__text' },
      h('span', { class: 'lvl__name', text: level.name }),
      h('span', { class: 'lvl__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(level.progress * 100)), 'aria-label': 'Досвід до наступного рівня' },
        h('span', { class: 'lvl__fill', style: { transform: `scaleX(${Math.min(1, level.progress).toFixed(3)})` } })),
      h('span', { class: 'lvl__xp', text: xpLine })));
}

function skillCard(skill) {
  const pctText = (v) => `${Math.round(v * 100)}%`;
  const roi = skill.roi == null ? '—' : `${skill.roi > 0 ? '+' : ''}${Math.round(skill.roi * 100)}%`;
  const verdict = !skill.enough
    ? `Зарано судити: ${skill.n} з 10 розрахованих ставок.`
    : skill.edgePp >= 5 ? 'Ви влучаєте частіше, ніж обіцяли коефіцієнти. Це і є перевага над лінією.'
      : skill.edgePp <= -5 ? 'Поки що коефіцієнти обіцяли більше, ніж вийшло. Спробуйте менші ризики.'
        : 'Ви йдете врівень з лінією: приблизно те, що обіцяли коефіцієнти.';
  return h('section', { class: 'card card--skill', 'aria-labelledby': 'skill-title' },
    h('h3', { id: 'skill-title', class: 'card__title', text: 'Ти проти лінії' }),
    h('div', { class: 'vs' },
      h('div', { class: 'vs__col' }, h('span', { class: 'vs__label', text: 'Влучність' }), h('span', { class: 'vs__value', text: skill.n ? pctText(skill.actual) : '—' })),
      h('div', { class: 'vs__col' }, h('span', { class: 'vs__label', text: 'Обіцяли коефіцієнти' }), h('span', { class: 'vs__value vs__value--muted', text: skill.n ? pctText(skill.expected) : '—' })),
      h('div', { class: 'vs__col' }, h('span', { class: 'vs__label', text: 'Різниця' }), h('span', { class: `vs__value${skill.enough && skill.edgePp >= 5 ? ' vs__value--good' : ''}`, text: skill.n ? signedPp(skill.edgePp) : '—' }))),
    h('p', { class: 'card__text', text: verdict }),
    h('p', { class: 'card__meta', text: `Розраховано ставок: ${skill.n} · ROI ${roi}` }));
}

function streakCard(streaks) {
  return h('section', { class: 'card card--streak', 'aria-labelledby': 'streak-title' },
    h('h3', { id: 'streak-title', class: 'card__title', text: 'Прибуткові ночі поспіль' }),
    h('div', { class: 'vs' },
      h('div', { class: 'vs__col' }, h('span', { class: 'vs__label', text: 'Зараз' }), h('span', { class: 'vs__value', text: String(streaks.current) })),
      h('div', { class: 'vs__col' }, h('span', { class: 'vs__label', text: 'Рекорд' }), h('span', { class: 'vs__value', text: String(streaks.best) }))),
    h('p', { class: 'card__meta', text: 'Ніч без ставок серію не перериває.' }));
}

function achievementTile(a) {
  const unlocked = Boolean(a.unlockedAt);
  const draw = BADGES?.[a.id];
  const art = draw ? draw({ size: 64, locked: !unlocked }) : null;
  return h('li', { class: `ach${unlocked ? ' ach--on' : ''}` },
    art ? icon(art, 'ach__art') : null,
    h('span', { class: 'ach__title', text: a.title }),
    h('span', { class: 'ach__desc', text: unlocked ? `Відкрито ${unlockFmt.format(new Date(a.unlockedAt * 1000))}` : a.desc }),
    h('span', { class: 'ach__reward', text: `+${chips(a.reward)}` }),
    h('span', { class: 'visually-hidden', text: unlocked ? 'Відкрито' : 'Заблоковано' }));
}

function resetBlock(store) {
  let armed = false;
  const btn = h('button', { type: 'button', class: 'linkbtn', on: { click: () => {
    if (armed) { armed = false; store.reset(); return; }
    armed = true;
    btn.classList.add('linkbtn--danger');
    replaceChildren(btn, icon(ICONS.reset(14)), 'Точно? Натисніть ще раз, щоб стерти історію');
    window.setTimeout(() => { if (armed) { armed = false; btn.classList.remove('linkbtn--danger'); replaceChildren(btn, icon(ICONS.reset(14)), 'Почати з нуля'); } }, 6000);
  } } }, icon(ICONS.reset(14)), 'Почати з нуля');
  return h('div', { class: 'reset' }, btn, h('p', { class: 'reset__hint', text: 'Стирає ставки, фішки, досягнення та рівень у цьому браузері.' }));
}

export function createProgressScreen(root, store) {
  const head = h('div', { class: 'screen__head' },
    h('h2', { id: 'screen-progress-title', class: 'screen__title', tabindex: '-1', text: 'Прогрес' }));
  const body = h('div', { class: 'progress' });
  replaceChildren(root, head, body);
  let lastKey = null;

  function render(state) {
    if (state.wallet === lastKey?.wallet && state.profile === lastKey?.profile && state.line?.anchor === lastKey?.anchor) return;
    lastKey = { wallet: state.wallet, profile: state.profile, anchor: state.line?.anchor };
    const p = store.progress();
    const unlocked = p.achievements.filter((a) => a.unlockedAt).length;
    replaceChildren(body,
      levelCard(p),
      skillCard(p.skill),
      streakCard(p.streaks),
      h('section', { class: 'achs', 'aria-labelledby': 'ach-title' },
        h('div', { class: 'achs__head' },
          h('h3', { id: 'ach-title', class: 'card__title', text: 'Досягнення' }),
          h('span', { class: 'achs__count', text: `${unlocked} з ${p.achievements.length}` })),
        h('ul', { class: 'achs__grid' }, p.achievements.map(achievementTile))),
      missionsBlock(p.missions, 'list', { level: 'h3' }),
      resetBlock(store));
  }
  return { render };
}
