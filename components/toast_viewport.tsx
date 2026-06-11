"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useEffect } from "react";

export type ToastTone = "success" | "error" | "info" | "sync";

export type AppToast = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type ToastInput = Omit<AppToast, "id"> & { id?: string };

type ToastViewportProps = {
  toasts: AppToast[];
  onDismiss: (id: string) => void;
};

const toneStyles: Record<ToastTone, { card: string; icon: string; Icon: typeof CheckCircle2 }> = {
  success: {
    card: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
    Icon: CheckCircle2
  },
  error: {
    card: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
    icon: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
    Icon: AlertCircle
  },
  info: {
    card: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
    Icon: Info
  },
  sync: {
    card: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    Icon: Loader2
  }
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(
        () => onDismiss(toast.id),
        toast.tone === "error" ? 9000 : 4200
      )
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onDismiss, toasts]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[70] grid gap-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:w-96">
      {toasts.map((toast) => {
        const tone = toneStyles[toast.tone];
        const Icon = tone.Icon;
        const isSyncing = toast.tone === "sync";

        return (
          <div
            key={toast.id}
            className={`animate-enter-soft pointer-events-auto rounded-2xl border p-3 shadow-lg backdrop-blur-xl ${tone.card}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
                <Icon className={isSyncing ? "animate-spin" : ""} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-sm opacity-80">{toast.message}</p> : null}
                {toast.actionLabel && toast.onAction ? (
                  <button
                    className="mt-3 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-900"
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      onDismiss(toast.id);
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notification"
                className="rounded-lg p-1.5 opacity-60 transition hover:bg-white/60 hover:opacity-100 dark:hover:bg-slate-900"
                type="button"
                onClick={() => onDismiss(toast.id)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
