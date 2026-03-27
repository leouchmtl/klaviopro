"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getProspects } from "@/lib/storage";
import { STATUT_COLORS } from "@/lib/utils";
import type { Prospect } from "@/lib/types";

function search(q: string): Prospect[] {
  if (!q.trim()) return [];
  const lq = q.toLowerCase();
  return getProspects()
    .filter(
      (p) =>
        p.marque.toLowerCase().includes(lq) ||
        p.contact.toLowerCase().includes(lq) ||
        p.email.toLowerCase().includes(lq) ||
        p.secteur.toLowerCase().includes(lq) ||
        p.notes.toLowerCase().includes(lq)
    )
    .slice(0, 8);
}

export default function CommandPalette() {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Prospect[]>([]);
  const [active, setActive]     = useState(0);
  const [mounted, setMounted]   = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const router                  = useRouter();

  useEffect(() => { setMounted(true); }, []);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus input + reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Live search
  useEffect(() => {
    setResults(search(query));
    setActive(0);
  }, [query]);

  function close() { setOpen(false); }

  function pick(p: Prospect) {
    close();
    router.push(`/prospects?drawer=${p.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && results[active]) pick(results[active]);
  }

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un prospect…"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
          />
          <kbd className="text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="py-1.5 max-h-80 overflow-y-auto">
            {results.map((p, i) => {
              const { bg, text } = STATUT_COLORS[p.statut];
              return (
                <li
                  key={p.id}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    i === active ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-900 truncate block">
                      {p.marque || <span className="text-slate-400 italic">Sans nom</span>}
                    </span>
                    {(p.contact || p.email) && (
                      <span className="text-xs text-slate-400 truncate block">
                        {[p.contact, p.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${bg} ${text}`}>
                    {p.statut}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{p.secteur}</span>
                </li>
              );
            })}
          </ul>
        ) : query.trim() ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Aucun résultat pour «&nbsp;{query}&nbsp;»
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Tapez pour rechercher parmi vos prospects
          </div>
        )}

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            <span><kbd className="font-mono">↑↓</kbd> naviguer</span>
            <span><kbd className="font-mono">↵</kbd> ouvrir</span>
            <span><kbd className="font-mono">Esc</kbd> fermer</span>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Topbar trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 min-w-[220px] group"
        title="Rechercher (⌘K)"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono leading-none">
          ⌘K
        </kbd>
      </button>

      {/* Portal modal */}
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
