// Small DOM helpers.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  start: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
  end: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
  back: '<path d="M11 6v12l-8-6zM20 6v12l-8-6z"/>',
  fwd: '<path d="M13 6v12l8-6zM4 6v12l8-6z"/>',
  split: '<path d="M11 2h2v20h-2z"/><path d="M4 7h5v10H4zM15 7h5v10h-5z" opacity=".55"/>',
  trash: '<path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z"/>',
  undo: '<path d="M8 7V3L2 9l6 6v-4h6a4 4 0 0 1 0 8h-3v2h3a6 6 0 0 0 0-12z"/>',
  redo: '<path d="M16 7V3l6 6-6 6v-4h-6a4 4 0 0 0 0 8h3v2h-3a6 6 0 0 1 0-12z"/>',
  text: '<path d="M4 4h16v4h-2V6h-5v12h2v2H9v-2h2V6H6v2H4z"/>',
  music: '<path d="M9 4v11.3A3.5 3.5 0 1 0 11 18V8h8V4z"/>',
  film: '<path d="M3 4h18v16H3zm2 2v2h2V6zm12 0v2h2V6zM5 11v2h2v-2zm12 0v2h2v-2zM5 16v2h2v-2zm12 0v2h2v-2zM9 6v12h6V6z"/>',
  export: '<path d="M11 3h2v10.2l3.6-3.6 1.4 1.4L12 17l-6-6 1.4-1.4 3.6 3.6zM4 19h16v2H4z"/>',
  plus: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>',
  zoomin: '<path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM9 7h2v2h2v2h-2v2H9v-2H7V9h2z"/>',
  fit: '<path d="M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4z"/>',
  copy: '<path d="M8 3h12v12h-2V5H8zM4 7h12v14H4z"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
  return span;
}

export function toast(message, type = 'info', ms = 4500) {
  const host = document.getElementById('toasts');
  const node = el('div', { class: `toast ${type}`, role: 'status' }, message);
  host.append(node);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 300);
  }, ms);
}

export function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT') return !['range', 'checkbox', 'button', 'color'].includes(a.type);
  return a.isContentEditable;
}
