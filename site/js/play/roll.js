// Split-flap digit roll for an odds value that just changed. Reduced-motion safe.

const DIGITS = '0123456789';
const ROLL_MS = 520;
const TICK_MS = 45;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function rollDigits(el) {
  const finalText = el.textContent;
  if (reducedMotion() || !/\d/.test(finalText)) return;
  const started = performance.now();
  el.classList.add('is-rolling');
  const timer = window.setInterval(() => {
    const settled = performance.now() - started >= ROLL_MS || !el.isConnected;
    el.textContent = settled ? finalText : finalText.replace(/\d/g, () => DIGITS[Math.floor(Math.random() * 10)]);
    if (settled) {
      el.classList.remove('is-rolling');
      window.clearInterval(timer);
    }
  }, TICK_MS);
}

/**
 * Remembers the last text shown per key and rolls elements whose value changed.
 * @param {Map<string, string>} memory
 * @param {Array<{ key: string, el: Element, roll: boolean }>} entries
 */
export function rollChanged(memory, entries) {
  entries.forEach(({ key, el, roll }) => {
    const text = el.textContent;
    const previous = memory.get(key);
    if (roll && previous !== undefined && previous !== text) rollDigits(el);
    memory.set(key, text);
  });
}
