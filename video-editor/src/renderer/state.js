// App-wide singletons and React bindings for them.

import { useSyncExternalStore } from 'react';
import { Store } from './store.js';
import { Player } from './player.js';

export const store = new Store();
export const player = new Player(store);

store.subscribe((reason) => {
  if (reason === 'project') player.sync();
  else player.requestDraw();
});

// Re-render on any project/selection/history change.
export function useStore() {
  useSyncExternalStore((cb) => store.subscribe(cb), () => store.version);
  return store;
}

// Re-render on playhead movement and play/pause. Keep this to small components.
export function usePlayer() {
  useSyncExternalStore((cb) => player.onTime(cb), () => player.version);
  return player;
}

// Tiny observable for UI-only state (dialogs, overlays).
function atom(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const ui = {
  exportOpen: atom(false),
  captionsOpen: atom(false),
  dropActive: atom(false),
};

export function useAtom(a) {
  return useSyncExternalStore(a.subscribe, a.get);
}

// Registered by the timeline so actions can fit it to the window.
export const timelineApi = { zoomToFit() {} };

export function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT') return !['range', 'checkbox', 'button', 'color'].includes(a.type);
  return a.isContentEditable;
}
