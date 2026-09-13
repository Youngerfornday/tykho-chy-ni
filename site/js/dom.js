// Tiny element builders: text is always set as text, never parsed as HTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(node, attrs, children) {
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'text') node.textContent = value;
    else if (key === 'on') Object.entries(value).forEach(([evt, fn]) => node.addEventListener(evt, fn));
    else if (key === 'style' && typeof value === 'object') {
      Object.entries(value).forEach(([prop, v]) => (prop.startsWith('--') ? node.style.setProperty(prop, v) : (node.style[prop] = v)));
    }
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  children.flat().forEach((child) => {
    if (child == null || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export const h = (tag, attrs, ...children) => apply(document.createElement(tag), attrs, children);
export const s = (tag, attrs, ...children) => apply(document.createElementNS(SVG_NS, tag), attrs, children);

// Icons come from our own module (static strings), never from data.
export function icon(markup, className = 'icon') {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = markup;
  return span;
}

export function replaceChildren(target, ...children) {
  target.replaceChildren(...children.flat().filter(Boolean));
  return target;
}
