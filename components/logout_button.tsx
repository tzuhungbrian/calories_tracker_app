"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  return (
    <button
      aria-label="Sign out"
      className={
        compact
          ? "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          : "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-200"
      }
      disabled={isSigningOut}
      title="Sign out"
      type="button"
      onClick={signOut}
    >
      <LogOut size={compact ? 18 : 17} />
      {compact ? null : <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>}
    </button>
  );
}
