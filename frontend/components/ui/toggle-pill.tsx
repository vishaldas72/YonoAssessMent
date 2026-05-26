"use client";

import { cn } from "@/lib/cn";

type Tone = "brand" | "success";

export function TogglePill({
  on,
  onClick,
  children,
  tone = "brand",
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: Tone;
}) {
  const toneClasses =
    tone === "success"
      ? on
        ? "border-success/60 bg-success-subtle text-success"
        : "border-border bg-transparent text-fg hover:border-border-strong"
      : on
        ? "border-brand/60 bg-brand-subtle text-brand"
        : "border-border bg-transparent text-fg hover:border-border-strong";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        toneClasses,
      )}
    >
      {children}
    </button>
  );
}
