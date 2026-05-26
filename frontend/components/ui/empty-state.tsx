import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card/40 backdrop-blur-sm",
        "px-8 py-12 text-center flex flex-col items-center gap-3",
        className,
      )}
    >
      <div className="h-12 w-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mb-1">
        <Icon className="h-5 w-5 text-fg-muted" />
      </div>
      <div>
        <div className="font-medium text-fg">{title}</div>
        {description && (
          <div className="text-sm text-fg-muted mt-1 max-w-sm">{description}</div>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
