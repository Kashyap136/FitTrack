'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TONE_STYLES = {
  success: 'border-[#12805c] bg-[#e4f6ee] text-[#0b4a35]',
  error: 'border-[#d92d20] bg-[#fdecea] text-[#7a1c14]',
  info: 'border-line bg-surface text-ink',
  pr: 'border-accent-deep bg-accent text-accent-ink',
};

/**
 * Lightweight toast stack used for success / error feedback.
 * Toasts are announced politely for screen readers.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = 'info', duration = 4200, title } = {}) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current.slice(-3), { id, message, tone, title }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      notify: push,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error', duration: 6000 }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
      celebrate: (message, options) => push(message, { ...options, tone: 'pr', duration: 7000 }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_8px_24px_-12px_rgba(17,19,16,0.45)] ${
              TONE_STYLES[toast.tone] || TONE_STYLES.info
            }`}
          >
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              <p className={`text-sm leading-snug ${toast.title ? 'mt-0.5 opacity-90' : ''}`}>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 -mt-1 rounded-md p-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}