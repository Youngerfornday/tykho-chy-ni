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
});
