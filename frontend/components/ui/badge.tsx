import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-border/40 text-fg-muted border border-border",
  brand: "bg-brand-subtle text-brand border border-brand/30",
  success: "bg-success-subtle text-success border border-success/30",
  warning: "bg-warning-subtle text-warning border border-warning/30",
  danger: "bg-danger-subtle text-danger border border-danger/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function statusTone(status: string): Tone {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "pending") return "brand";
  return "neutral";
}
