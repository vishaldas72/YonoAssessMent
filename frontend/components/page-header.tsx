import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-border/60 bg-bg-subtle/40 backdrop-blur-xl sticky top-0 z-10",
        className,
      )}
    >
      <div className="max-w-6xl mx-auto px-8 py-7 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-title text-fg">{title}</h1>
          {description && (
            <p className="text-sm text-fg-muted mt-1.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-6xl mx-auto px-8 py-10", className)}>{children}</div>
  );
}
