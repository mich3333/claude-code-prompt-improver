// Sonner-style toasts: enter from below and restack smoothly; click to dismiss.

import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_OUT, exit, move } from '../motion.js';
import { dismiss, toastStore } from '../toast.js';
import { Icon } from './Icon.jsx';

const ICONS = { success: 'check', error: 'alert', warn: 'alert', info: 'info' };

export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <ol className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.li
            key={t.id}
            layout
            className={`toast ${t.type}`}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: 0.97, transition: exit }}
            transition={move}
            onClick={() => dismiss(t.id)}
          >
            <Icon name={ICONS[t.type] ?? 'info'} />
            <span>{t.message}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
