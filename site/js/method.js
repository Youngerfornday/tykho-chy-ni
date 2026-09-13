import { h, replaceChildren } from './dom.js';
import { clock, day, pct, shortName } from './format.js';

const DATASET_URL = 'https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset';
const LIVE_URL = 'https://ubilling.net.ua/aerialalerts/';

function brierBars(bt) {
  const worst = Math.max(bt.brier_model, bt.brier_base);
  const bar = (label, value, cls) => h('div', { class: 'brier__row' },
    h('span', { class: 'brier__label', text: label }),
    h('span', { class: 'brier__track' }, h('span', { class: `brier__fill ${cls}`, style: { width: `${(value / worst) * 100}%` } })),
    h('span', { class: 'brier__value', text: value.toFixed(3) }));
  return h('div', { class: 'brier', role: 'img', 'aria-label': `Похибка Брієра: модель ${bt.brier_model}, проста частота ${bt.brier_base}` },
    bar('Модель', bt.brier_model, 'brier__fill--model'), bar('Проста частота', bt.brier_base, 'brier__fill--base'));
}

export function renderMethod(textTarget, notesTarget, data) {
  const bt = data.backtest;
  const gain = Math.round((1 - bt.brier_model / bt.brier_base) * 100);
  const verdict = bt.model_beats_base
    ? `Модель помиляється на ${gain}% менше, ніж проста частота тривог. Перевага скромна: головне знання тут — звичний ритм атак, а поточна ситуація лише уточнює його.`
    : 'Цього разу модель не обіграла просту частоту тривог, тож до відсотків варто ставитися ще обережніше.';

  replaceChildren(textTarget,
    h('ol', { class: 'steps' },
      h('li', null, h('strong', { text: 'Історія. ' }), `Беремо ${data.data.nights_used} останніх ночей: офіційний датасет тривог і волонтерський там, де вони збігаються.`),
      h('li', null, h('strong', { text: 'Ситуація зараз. ' }), 'Скільки областей під тривогою саме цієї хвилини і чи під тривогою сама область.'),
      h('li', null, h('strong', { text: 'Схожі ночі. ' }), 'Дивимось ті самі години в минулому. Більше ваги ночам зі схожою кількістю тривог, свіжим (вага падає вдвічі кожні 14 днів) і тим, де область була в тому ж стані.'),
      h('li', null, h('strong', { text: 'Обережність. ' }), 'Змішуємо зі звичною частотою, щоб кілька ночей не перекосили прогноз, і рахуємо діапазон повторними вибірками.')),
    h('h3', { class: 'method__sub', text: 'Похибка на минулих ночах' }),
    brierBars(bt),
    h('p', { class: 'method__verdict', text: verdict }),
    h('p', { class: 'method__small', text: `Лише неочевидні випадки (область ще не під тривогою): ${bt.brier_model_open.toFixed(3)} проти ${bt.brier_base_open.toFixed(3)}. Менше — краще.` }));

  const excluded = data.data.excluded_volunteer.map((e) => `${shortName(e.region)} (збіг ${pct(e.agreement)})`);
  const d = data.data;
  replaceChildren(notesTarget,
    h('h3', { class: 'method__sub', text: 'Дані та застереження' }),
    h('ul', { class: 'notes' },
      h('li', null, 'Офіційні дані до ', h('b', { text: day(new Date(d.official_until)) }), ', волонтерські до ', h('b', { text: day(new Date(d.volunteer_until)) }), '. ',
        h('a', { href: DATASET_URL, rel: 'noopener', text: 'Датасет тривог' }), '.'),
      excluded.length ? h('li', null, `Волонтерські дані відкинуто, бо вони розходяться з офіційними: ${excluded.join(', ')}. Для цих областей використовуємо лише офіційні.`) : null,
      h('li', null, d.live_ok
        ? ['Поточний стан тривог: ', h('a', { href: LIVE_URL, rel: 'noopener', text: 'ubilling.net.ua' }), `, станом на ${clock(d.live_as_of)}.`]
        : 'Поточний стан тривог зараз недоступний, тому прогноз спирається лише на історію.'),
      h('li', null, '«Тривога в області» означає тривогу хоча б у частині області (район чи громада).'),
      h('li', null, 'Луганська область і Крим під постійною тривогою, їх не прогнозуємо.'),
      h('li', null, 'Коефіцієнти дорівнюють 1/p без маржі та обмежені діапазоном 1.01–50. Жодних ставок на гроші.')));
}
