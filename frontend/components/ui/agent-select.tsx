"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Agent } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

export function AgentSelect({
  agents,
  value,
  onChange,
  placeholder = "Select an agent…",
}: {
  agents: Agent[];
  value: string;
  onChange: (agentId: string) => void;
  placeholder?: string;
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

  const selected = agents.find((a) => a.id === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-bg-subtle px-2.5 text-sm text-fg",
          "flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60",
          "hover:border-border-strong transition-colors",
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {selected ? (
            <>
              <Avatar name={selected.name} size="sm" />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-fg-subtle">{placeholder}</span>
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
            "absolute z-50 mt-1.5 w-full max-h-[320px] overflow-y-auto",
            "rounded-lg border border-border bg-bg-elevated shadow-card-hover",
            "py-1 animate-fade-in",
          )}
          role="listbox"
        >
          {agents.length === 0 && (
            <div className="px-3 py-2 text-xs text-fg-muted">No agents yet.</div>
          )}
          {agents.map((a) => {
            const isSelected = a.id === value;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "w-full text-left px-2.5 py-2 flex items-center gap-2.5",
                  "transition-colors",
                  isSelected ? "bg-brand-subtle" : "hover:bg-bg-hover focus:bg-bg-hover",
                  "focus:outline-none",
                )}
              >
                <Avatar name={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm truncate",
                      isSelected ? "text-brand font-medium" : "text-fg",
                    )}
                  >
                    {a.name}
                  </div>
                  {a.model && (
                    <div className="text-[10px] text-fg-subtle truncate font-mono">
                      {a.model}
                    </div>
                  )}
                </div>
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isSelected ? "text-brand" : "text-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
