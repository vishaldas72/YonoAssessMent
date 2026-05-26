"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/**
 * Wraps the page with the sidebar — except on the workflow editor route which
 * needs the full viewport for the React Flow canvas.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const fullBleed = /^\/workflows\/[^/]+\/edit/.test(pathname);

  if (fullBleed) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
