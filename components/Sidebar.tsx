"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/prospects", label: "Prospects",       icon: "👥" },
  { href: "/calendar",  label: "Calendrier",      icon: "📅" },
  { href: "/dashboard", label: "Tableau de bord", icon: "📊" },
];

const STORAGE_KEY = "klaviopro_sidebar_collapsed";

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  // Avoid layout shift before JS runs
  if (!mounted) {
    return <aside className="w-56 shrink-0 bg-slate-900 min-h-screen" />;
  }

  return (
    <aside
      className={`${
        collapsed ? "w-14" : "w-56"
      } shrink-0 bg-slate-900 flex flex-col min-h-screen transition-all duration-200`}
    >
      {/* Header */}
      <div
        className={`flex items-center border-b border-slate-700 px-3 py-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <span className="text-white font-bold text-base tracking-tight truncate">
            ⚡ KlavioPro
          </span>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Développer" : "Réduire"}
          className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-slate-700 flex-shrink-0 text-lg leading-none"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base flex-shrink-0">{icon}</span>
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          v1.0 · localStorage
        </div>
      )}
    </aside>
  );
}
