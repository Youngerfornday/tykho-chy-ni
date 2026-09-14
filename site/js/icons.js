// Stroke icons as SVG strings. All inherit color via currentColor.

const wrap = (size, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" `
  + 'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
  + `aria-hidden="true" focusable="false">${inner}</svg>`;

const icon = (inner) => (size = 20) => wrap(size, inner);

export const ICONS = Object.freeze({
  moon: icon('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  shield: icon('<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  siren: icon('<path d="M7 18v-5a5 5 0 0 1 10 0v5"/><path d="M5 18h14v3H5z"/><path d="M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4M2.5 12h1.5M20 12h1.5"/>'),
  ticket: icon('<path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z"/><path d="M14 6.5v2M14 11v2M14 15.5v2"/>'),
  chart: icon('<path d="M4 4v16h16"/><path d="M8 15l3.5-4.5 3 2.5L20 6"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
  pin: icon('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  west: icon('<circle cx="12" cy="12" r="9"/><path d="M12 4.5v1.5M19.5 12H18M12 19.5V18"/><path d="M5.5 12l6.5-2.8v5.6z"/>'),
  arrowLeft: icon('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>'),
  chips: icon('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  up: icon('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
  down: icon('<path d="M12 5v14"/><path d="M18 13l-6 6-6-6"/>'),
  lock: icon('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: icon('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  chevron: icon('<path d="M6 9l6 6 6-6"/>'),
  trash: icon('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  list: icon('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  search: icon('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  share: icon('<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>'),
  flag: icon('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'),
  star: icon('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>'),
  progress: icon('<path d="M4 20h16"/><path d="M6 16V11M11 16V6M16 16V9M21 16V4" stroke-width="2"/>'),
  reset: icon('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/>'),
  sparkle: icon('<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/><path d="M19 3v3M17.5 4.5h3"/>'),
  target: icon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v3M20.5 12h-3M12 20.5v-3M3.5 12h3"/>'),
});
