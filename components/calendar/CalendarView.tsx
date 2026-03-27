"use client";

import { useEffect, useState } from "react";
import type { Prospect } from "@/lib/types";
import { getProspects } from "@/lib/storage";
import {
  today,
  startOfWeek,
  endOfWeek,
  formatDateFR,
  isLate,
  STATUT_COLORS,
  toDateStr,
} from "@/lib/utils";

type View = "list" | "calendar";

export default function CalendarView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [view, setView] = useState<View>("list");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // 0-indexed
  });

  useEffect(() => {
    setProspects(getProspects());
  }, []);

  // Only prospects with a follow-up date
  const withRelance = prospects.filter((p) => !!p.prochaineRelance);

  const todayStr = today();
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const dueToday = withRelance.filter(
    (p) => p.prochaineRelance === todayStr || isLate(p.prochaineRelance)
  );
  const dueThisWeek = withRelance.filter((p) => {
    const d = p.prochaineRelance!;
    return d > todayStr && d >= weekStart && d <= weekEnd;
  });

  return (
    <div>
      {/* View toggle */}
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
        <ListView dueToday={dueToday} dueThisWeek={dueThisWeek} />
      ) : (
        <MonthCalendar
          prospects={withRelance}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
        />
      )}
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({
  dueToday,
  dueThisWeek,
}: {
  dueToday: Prospect[];
  dueThisWeek: Prospect[];
}) {
  return (
    <div className="space-y-8">
      <Section
        title="⚠ À contacter aujourd'hui (ou en retard)"
        prospects={dueToday}
        emptyMsg="Aucune relance en retard ou à faire aujourd'hui."
        highlight
      />
      <Section
        title="📅 Cette semaine (à venir)"
        prospects={dueThisWeek}
        emptyMsg="Aucune relance prévue cette semaine."
        highlight={false}
      />
    </div>
  );
}

function Section({
  title,
  prospects,
  emptyMsg,
  highlight,
}: {
  title: string;
  prospects: Prospect[];
  emptyMsg: string;
  highlight: boolean;
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
                {["Marque", "Contact", "Email", "Statut", "Relance prévue", "Notes"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => {
                const late = isLate(p.prochaineRelance);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      late && highlight ? "bg-red-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
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
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${late ? "text-red-600" : "text-slate-700"}`}>
                      {late ? "⚠ " : ""}{formatDateFR(p.prochaineRelance)}
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
}: {
  prospects: Prospect[];
  currentMonth: { year: number; month: number };
  setCurrentMonth: (m: { year: number; month: number }) => void;
}) {
  const { year, month } = currentMonth;

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

  // Build grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-first: 0=Mon … 6=Sun
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(new Date(year, month, dayNum));
    }
  }

  const todayStr = today();

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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <button
          onClick={prev}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        >
          ‹
        </button>
        <h2 className="font-semibold text-slate-900 capitalize">{monthLabel}</h2>
        <button
          onClick={next}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        >
          ›
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return (
              <div key={i} className="min-h-[90px] bg-slate-50 border-b border-r border-slate-100" />
            );
          }

          const dateStr = toDateStr(date);
          const isToday = dateStr === todayStr;
          const dayProspects = byDate[dateStr] ?? [];

          return (
            <div
              key={i}
              className={`min-h-[90px] p-1.5 border-b border-r border-slate-100 ${
                isToday ? "bg-blue-50" : ""
              }`}
            >
              {/* Day number */}
              <div
                className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-blue-600 text-white"
                    : "text-slate-400"
                }`}
              >
                {date.getDate()}
              </div>

              {/* Prospect pills */}
              <div className="space-y-0.5">
                {dayProspects.slice(0, 3).map((p) => {
                  const late = p.prochaineRelance! < todayStr;
                  return (
                    <div
                      key={p.id}
                      title={`${p.marque} — ${p.statut}${p.notes ? "\n" + p.notes : ""}`}
                      className={`truncate text-xs px-1.5 py-0.5 rounded cursor-default ${
                        late
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {p.marque}
                    </div>
                  );
                })}
                {dayProspects.length > 3 && (
                  <div className="text-xs text-slate-400 px-1">
                    +{dayProspects.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-100 inline-block" />
          Relance à venir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 inline-block" />
          En retard
        </span>
      </div>
    </div>
  );
}

function StatutBadge({ statut }: { statut: Prospect["statut"] }) {
  const { bg, text } = STATUT_COLORS[statut];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {statut}
    </span>
  );
}
