"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ModelCatalog, ModelInfo } from "@/lib/api";
import { cn } from "@/lib/cn";

export function ModelSelect({
  catalog,
  value,
  onChange,
}: {
  catalog: ModelCatalog | null;
  value: string;
  onChange: (modelName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const selected = catalog?.models.find((m) => m.name === value);

  // Group models by provider, active provider first
  const groups: { provider: string; models: ModelInfo[]; active: boolean }[] =
    (() => {
      if (!catalog) return [];
      const map = new Map<string, ModelInfo[]>();
      for (const m of catalog.models) {
        const arr = map.get(m.provider) || [];
        arr.push(m);
        map.set(m.provider, arr);
      }
      const order = [
        catalog.active_provider,
        ...Array.from(map.keys()).filter((p) => p !== catalog.active_provider),
      ];
      return order
        .filter((p) => map.has(p))
        .map((p) => ({
          provider: p,
          models: map.get(p)!,
          active: p === catalog.active_provider,
        }));
    })();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-bg-subtle px-3 text-sm text-fg",
          "flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60",
          "hover:border-border-strong transition-colors",
        )}
      >
        <span className="truncate text-left flex-1">
          {selected ? (
            <>
              <span>{selected.label}</span>
              <span className="text-fg-subtle ml-2 text-xs">
                · {selected.provider}
              </span>
            </>
          ) : value ? (
            <span className="font-mono text-xs">{value}</span>
          ) : (
            <span className="text-fg-subtle">Select a model…</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-fg-subtle shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-full max-h-[420px] overflow-y-auto",
            "rounded-lg border border-border bg-bg-elevated shadow-card-hover",
            "py-1 animate-fade-in",
          )}
          role="listbox"
        >
          {groups.length === 0 && (
            <div className="px-3 py-2 text-xs text-fg-muted">
              Loading models…
            </div>
          )}
          {groups.map((g) => (
            <div key={g.provider} className="py-1">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-subtle">
                  {g.provider}
                </span>
                {g.active ? (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-success">
                    active
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">
                    requires LLM_PROVIDER={g.provider}
                  </span>
                )}
              </div>
              {g.models.map((m) => {
                const isSelected = m.name === value;
                const free = m.input_per_1m + m.output_per_1m === 0;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => {
                      onChange(m.name);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-start gap-2.5",
                      "transition-colors",
                      isSelected
                        ? "bg-brand-subtle"
                        : "hover:bg-bg-hover focus:bg-bg-hover",
                      "focus:outline-none",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 mt-0.5 shrink-0",
                        isSelected ? "text-brand" : "text-transparent",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm truncate",
                            isSelected ? "text-brand font-medium" : "text-fg",
                          )}
                        >
                          {m.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] tabular-nums shrink-0 font-mono",
                            free ? "text-success" : "text-fg-subtle",
                          )}
                        >
                          {free
                            ? "free"
                            : `$${m.input_per_1m.toFixed(2)} / $${m.output_per_1m.toFixed(2)}`}
                        </span>
                      </div>
                      {m.notes && (
                        <div className="text-[11px] text-fg-muted mt-0.5 leading-snug">
                          {m.notes}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
