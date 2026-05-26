import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-border bg-bg-subtle px-3 text-sm text-fg",
      "placeholder:text-fg-subtle",
      "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[80px] w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-fg",
      "placeholder:text-fg-subtle resize-y",
      "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-border bg-bg-subtle px-3 text-sm text-fg appearance-none",
      "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238a93a0%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
      "bg-no-repeat bg-[right_0.6rem_center] pr-9",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5",
        className,
      )}
      {...props}
    />
  );
}
