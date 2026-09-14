// App shell: top bar (balance, level), sky strip status with countdown, bottom tab bar.

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { LEVEL_EMBLEMS } from '../badges.js';
import { chips } from '../bet/labels.js';
import { countdownText, lineStatus } from './notes.js';
import { ROUTES } from './deepLink.js';

const TAB_META = {
  line: { text: 'Лінія', icon: 'list' },
  coupon: { text: 'Купон', icon: 'ticket' },
  bets: { text: 'Мої ставки', icon: 'chips' },
  progress: { text: 'Прогрес', icon: 'progress' },
};

const $ = (id) => document.getElementById(id);

export function emblemFor(level, size = 28) {
  const draw = LEVEL_EMBLEMS?.[level - 1];
  return draw ? draw({ size }) : null;
}

function buildTabs(navigate) {
  const list = $('tabbar-list');
  const tabs = ROUTES.map((id) => {
    const meta = TAB_META[id];
    return h('button', {
      type: 'button', role: 'tab', id: `tab-${id}`, class: 'tabbar__tab', 'aria-controls': `screen-${id}`, 'aria-selected': 'false',
      on: { click: () => navigate(id) },
    },
    icon(ICONS[meta.icon](22), 'tabbar__icon'),
    h('span', { class: 'tabbar__label', text: meta.text }),
    id === 'coupon' ? h('span', { class: 'tabbar__count', id: 'tab-coupon-count', hidden: true }) : null);
  });
  replaceChildren(list, tabs);
  list.addEventListener('keydown', (e) => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    next.focus();
    navigate(ROUTES[tabs.indexOf(next)]);
  });
  return tabs;
}

function buildSideTabs(navigate) {
  const list = $('sidetabs');
  const tabs = ['coupon', 'bets'].map((id) => h('button', {
    type: 'button', role: 'tab', class: 'sidetabs__tab', 'aria-controls': `screen-${id}`, 'aria-selected': 'false', 'data-route': id,
    on: { click: () => navigate(id) },
  }, TAB_META[id].text, id === 'coupon' ? h('span', { class: 'sidetabs__count', id: 'side-coupon-count', hidden: true }) : null));
  replaceChildren(list, tabs);
  return tabs;
}

export function mountShell(store, { navigate }) {
  replaceChildren($('wordmark-icon'), icon(ICONS.moon(20)));
  replaceChildren($('back-icon'), icon(ICONS.arrowLeft(18)));
  const tabs = buildTabs(navigate);
  const sideTabs = buildSideTabs(navigate);
  const balance = $('balance');
  const balanceValue = h('span', { class: 'balance__value', text: '' });
  replaceChildren(balance, icon(ICONS.chips(18)), balanceValue, h('span', { class: 'visually-hidden', text: ' фішок' }));
  balance.addEventListener('click', () => navigate('bets'));
  const levelBtn = $('level');
  levelBtn.addEventListener('click', () => navigate('progress'));
  const label = $('line-label');
  const clockEl = $('line-clock');

  let lastBalance = null;
  let lastLevel = null;

  function update(state) {
    const { wallet, slip } = state;
    balanceValue.textContent = chips(wallet.balance);
    if (lastBalance !== null && wallet.balance !== lastBalance) {
      balance.classList.remove('balance--bump');
      void balance.offsetWidth;
      balance.classList.add('balance--bump');
    }
    lastBalance = wallet.balance;

    const { level } = store.progress();
    if (level.level !== lastLevel) {
      const art = emblemFor(level.level, 28);
      replaceChildren(levelBtn, art ? icon(art, 'level__emblem') : null, h('span', { class: 'level__name', text: level.name }));
      levelBtn.setAttribute('aria-label', `Рівень ${level.level}: ${level.name}. Відкрити прогрес`);
      lastLevel = level.level;
    }

    [$('tab-coupon-count'), $('side-coupon-count')].forEach((count) => {
      count.textContent = String(slip.selections.length);
      count.hidden = slip.selections.length === 0;
    });
    const couponName = slip.selections.length ? `Купон, подій: ${slip.selections.length}` : 'Купон';
    tabs[1].setAttribute('aria-label', couponName);
    sideTabs[0].setAttribute('aria-label', couponName);
  }

  function setRoute(route) {
    tabs.forEach((tab, i) => {
      const active = ROUTES[i] === route;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const side = route === 'bets' ? 'bets' : 'coupon';
    sideTabs.forEach((tab) => {
      const active = tab.dataset.route === side;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  let lastText = '';
  function tick(nowSeconds) {
    const status = lineStatus(store.state.line, nowSeconds);
    if (status.text !== lastText) {
      label.textContent = status.text;
      lastText = status.text;
      $('sky').dataset.open = String(status.open);
    }
    clockEl.textContent = status.open ? countdownText(status.seconds) : '';
    clockEl.hidden = !status.open;
  }

  return { update, setRoute, tick };
}
