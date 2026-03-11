// CHANGED IN STEP 9: New Toast system — shared component, ToastProvider, and useToast hook
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const borderColor =
    type === "success"
      ? "border-l-green-500"
      : type === "error"
        ? "border-l-red-500"
        : "border-l-blue-500";

  const role = type === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`flex min-w-[280px] max-w-sm items-start gap-3 rounded-lg border border-white/10 border-l-4 ${borderColor} bg-slate-900 px-4 py-3 shadow-lg`}
    >
      <p className="flex-1 text-sm text-slate-200">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-1 shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-white"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="fixed bottom-4 z-50 flex flex-col gap-2 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 md:items-end items-center"
        >
          {toasts.map((t) => (
            <Toast
              key={t.id}
              message={t.message}
              type={t.type}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
