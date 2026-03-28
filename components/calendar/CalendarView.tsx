"use client";

import { useState } from "react";
import type { Prospect } from "@/lib/types";
import { useProspects } from "@/lib/hooks";
import {
  today,
  startOfWeek,
  endOfWeek,
  formatDateFR,
  isLate,
  isToday,
  STATUT_COLORS,
  toDateStr,
  STEP_ORDER,
  applyStepChange,
  withRelance,
} from "@/lib/utils";

type View = "list" | "calendar";

// Color helpers based on done/late/today
function itemColor(done: boolean, prochaineRelance: string | null) {
  if (done) return { row: "bg-green-50", text: "text-green-700", dot: "bg-green-400" };
  if (isLate(prochaineRelance)) return { row: "bg-red-50", text: "text-red-600", dot: "bg-red-400" };
  if (isToday(prochaineRelance)) return { row: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400" };
  return { row: "", text: "text-slate-700", dot: "bg-blue-400" };
}

export default function CalendarView() {
  const { prospects, updateOne } = useProspects();
  const [view, setView] = useState<View>("list");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  function toggleDone(p: Prospect) {
    if (p.relanceFaite) {
      // Uncheck: clear relanceFaite only (step stays done)
      updateOne({ ...p, relanceFaite: false });
      return;
    }
    // Check: advance to next unchecked step + mark relanceFaite
    const nextKey = STEP_ORDER.find((k) => !p.steps[k].done);
    if (nextKey) {
      const { steps, statut, dernierContact } = applyStepChange(
        p.steps, nextKey, { done: true, date: today() }
      );
      updateOne(withRelance({ ...p, steps, statut, dernierContact, relanceFaite: true }));
    } else {
      updateOne({ ...p, relanceFaite: true });
    }
  }

  const withPR = prospects.filter((p) => !!p.prochaineRelance);
  const todayStr = today();
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const dueToday = withPR.filter(
    (p) => p.prochaineRelance === todayStr || isLate(p.prochaineRelance)
  );
  const dueThisWeek = withPR.filter((p) => {
    const d = p.prochaineRelance!;
    return d > todayStr && d >= weekStart && d <= weekEnd;
  });

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["list", "calendar"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              view === v
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {v === "list" ? "📋 Liste" : "🗓 Calendrier"}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <ListView dueToday={dueToday} dueThisWeek={dueThisWeek} onToggle={toggleDone} />
      ) : (
        <MonthCalendar
          prospects={withPR}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          onToggle={toggleDone}
        />
      )}
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({
  dueToday,
  dueThisWeek,
  onToggle,
}: {
  dueToday: Prospect[];
  dueThisWeek: Prospect[];
  onToggle: (p: Prospect) => void;
}) {
  return (
    <div className="space-y-8">
      <Section
        title="⚠ À contacter aujourd'hui (ou en retard)"
        prospects={dueToday}
        emptyMsg="Aucune relance en retard ou à faire aujourd'hui. ✓"
        onToggle={onToggle}
      />
      <Section
        title="📅 Cette semaine (à venir)"
        prospects={dueThisWeek}
        emptyMsg="Aucune relance prévue cette semaine."
        onToggle={onToggle}
      />
    </div>
  );
}

function Section({
  title,
  prospects,
  emptyMsg,
  onToggle,
}: {
  title: string;
  prospects: Prospect[];
  emptyMsg: string;
  onToggle: (p: Prospect) => void;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 mb-3">{title}</h2>
      {prospects.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{emptyMsg}</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["", "Marque", "Contact", "Email", "Statut", "Relance prévue", "Notes"].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => {
                const { row, text } = itemColor(p.relanceFaite, p.prochaineRelance);
                return (
                  <tr key={p.id} className={`border-b border-slate-100 last:border-0 transition-colors ${row}`}>
                    {/* Checkbox */}
                    <td className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={p.relanceFaite}
                        onChange={() => onToggle(p)}
                        className="w-4 h-4 accent-green-500 cursor-pointer"
                      />
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${p.relanceFaite ? "line-through text-slate-400" : "text-slate-900"}`}>
                      {p.marque}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {p.contact || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="hover:text-blue-600 underline">
                          {p.email}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatutBadge statut={p.statut} />
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${text}`}>
                      {formatDateFR(p.prochaineRelance)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {p.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Monthly calendar ─────────────────────────────────────────────────────────

function MonthCalendar({
  prospects,
  currentMonth,
  setCurrentMonth,
  onToggle,
}: {
  prospects: Prospect[];
  currentMonth: { year: number; month: number };
  setCurrentMonth: (m: { year: number; month: number }) => void;
  onToggle: (p: Prospect) => void;
}) {
  const { year, month } = currentMonth;
  const todayStr = today();

  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  function prev() {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
  }
  function next() {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startPad + 1;
    cells.push(
      dayNum < 1 || dayNum > lastDay.getDate()
        ? null
        : new Date(year, month, dayNum)
    );
  }

  // Map date → prospects
  const byDate: Record<string, Prospect[]> = {};
  prospects.forEach((p) => {
    const d = p.prochaineRelance!;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 text-lg">‹</button>
        <h2 className="font-semibold text-slate-900 capitalize">{monthLabel}</h2>
        <button onClick={next} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 text-lg">›</button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} className="min-h-[100px] bg-slate-50 border-b border-r border-slate-100" />;
          }

          const dateStr = toDateStr(date);
          const isTodayCell = dateStr === todayStr;
          const dayProspects = byDate[dateStr] ?? [];

          return (
            <div
              key={i}
              className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 ${isTodayCell ? "bg-blue-50" : ""}`}
            >
              <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isTodayCell ? "bg-blue-600 text-white" : "text-slate-400"
              }`}>
                {date.getDate()}
              </div>

              <div className="space-y-1">
                {dayProspects.slice(0, 3).map((p) => {
                  const { dot } = itemColor(p.relanceFaite, p.prochaineRelance);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded cursor-pointer ${
                        p.relanceFaite
                          ? "bg-green-100 text-green-700"
                          : isLate(p.prochaineRelance)
                          ? "bg-red-100 text-red-700"
                          : isToday(p.prochaineRelance)
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                      title={`${p.marque} — ${p.statut}`}
                    >
                      <input
                        type="checkbox"
                        checked={p.relanceFaite}
                        onChange={() => onToggle(p)}
                        className="w-3 h-3 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="truncate">{p.marque}</span>
                    </label>
                  );
                })}
                {dayProspects.length > 3 && (
                  <div className="text-xs text-slate-400 px-1">+{dayProspects.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-5 px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
        {[
          { color: "bg-green-100 text-green-700", label: "Fait ✓" },
          { color: "bg-orange-100 text-orange-700", label: "Aujourd'hui" },
          { color: "bg-red-100 text-red-700", label: "En retard" },
          { color: "bg-blue-100 text-blue-700", label: "À venir" },
        ].map(({ color, label }) => (
          <span key={label} className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${color}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatutBadge({ statut }: { statut: Prospect["statut"] }) {
  const { bg, text } = STATUT_COLORS[statut];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {statut}
    </span>
  );
}
