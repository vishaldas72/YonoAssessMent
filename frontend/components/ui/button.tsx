import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-bg hover:bg-brand-hover disabled:bg-border disabled:text-fg-subtle",
  secondary:
    "bg-bg-card border border-border text-fg hover:bg-bg-hover hover:border-border-strong disabled:opacity-50",
  ghost:
    "bg-transparent text-fg hover:bg-bg-card disabled:opacity-50",
  danger:
    "bg-transparent text-danger border border-danger/60 hover:bg-danger/10 disabled:opacity-50",
  success:
    "bg-success text-bg hover:opacity-90 disabled:bg-border disabled:text-fg-subtle",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-bg",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
