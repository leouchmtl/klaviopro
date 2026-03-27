"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/prospects", label: "Prospects", icon: "👥" },
  { href: "/calendar",  label: "Calendrier",  icon: "📅" },
  { href: "/dashboard", label: "Tableau de bord", icon: "📊" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-slate-900 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg tracking-tight">
          ⚡ KlavioPro
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        v1.0 · localStorage
      </div>
    </aside>
  );
}
