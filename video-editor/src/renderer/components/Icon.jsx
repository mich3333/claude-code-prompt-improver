const PATHS = {
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  start: 'M6 5h2v14H6zM20 5v14L9 12z',
  end: 'M16 5h2v14h-2zM4 5v14l11-7z',
  back: 'M11 6v12l-8-6zM20 6v12l-8-6z',
  fwd: 'M13 6v12l8-6zM4 6v12l8-6z',
  split: 'M11 2h2v20h-2zM4 7h5v10H4zM15 7h5v10h-5z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
  undo: 'M8 7V3L2 9l6 6v-4h6a4 4 0 0 1 0 8h-3v2h3a6 6 0 0 0 0-12z',
  redo: 'M16 7V3l6 6-6 6v-4h-6a4 4 0 0 0 0 8h3v2h-3a6 6 0 0 1 0-12z',
  text: 'M4 4h16v4h-2V6h-5v12h2v2H9v-2h2V6H6v2H4z',
  music: 'M9 4v11.3A3.5 3.5 0 1 0 11 18V8h8V4z',
  film: 'M3 4h18v16H3zm2 2v2h2V6zm12 0v2h2V6zM5 11v2h2v-2zm12 0v2h2v-2zM5 16v2h2v-2zm12 0v2h2v-2zM9 6v12h6V6z',
  export: 'M11 3h2v10.2l3.6-3.6 1.4 1.4L12 17l-6-6 1.4-1.4 3.6 3.6zM4 19h16v2H4z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
  fit: 'M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4z',
  copy: 'M8 3h12v12h-2V5H8zM4 7h12v14H4z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z',
  alert: 'M11 7h2v6h-2zm0 8h2v2h-2zM12 2 1 21h22z',
  info: 'M11 10h2v7h-2zm0-4h2v2h-2zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
};

export function Icon({ name, size = 16 }) {
  return (
    <span className="icon" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={PATHS[name]} fillRule={name === 'info' || name === 'alert' ? 'evenodd' : undefined} />
      </svg>
    </span>
  );
}
