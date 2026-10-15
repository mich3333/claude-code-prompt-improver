// Global toast queue (call toast() from anywhere; <Toaster/> renders it).

const subs = new Set();
let toasts = [];
let nextId = 1;

const emit = () => subs.forEach((fn) => fn());

export function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message, type = 'info', ms = 4500) {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }].slice(-4); // keep the stack short
  emit();
  setTimeout(() => dismiss(id), ms);
  return id;
}

export const toastStore = {
  get: () => toasts,
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
