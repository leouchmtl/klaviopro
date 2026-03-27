"use client";

import CommandPalette from "@/components/search/CommandPalette";

export default function Topbar() {
  return (
    <header className="h-12 shrink-0 flex items-center px-5 bg-white border-b border-slate-200 gap-4">
      <CommandPalette />
    </header>
  );
}
