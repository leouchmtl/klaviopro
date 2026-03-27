"use client";

import { useEffect, useState } from "react";
import type { KPIMonth } from "@/lib/types";
import {
  getKPIMonth,
  upsertKPIMonth,
  getProspects,
  countCheckedStepsByMonth,
} from "@/lib/storage";

function monthLabel(mois: string): string {
  const [y, m] = mois.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function currentMois(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMois(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMois(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

interface ChartEntry {
  mois: string;
  label: string;
  emailsEnvoyes: number;
  tauxOuverture: number;
  tauxReponse: number;
}

export default function KPIDashboard() {
  const [mois, setMois] = useState(currentMois);
  const [kpi, setKpi] = useState<KPIMonth>({ mois, tauxOuverture: 0, tauxReponse: 0 });
  const [saved, setSaved] = useState(false);
  const [totalProspects, setTotalProspects] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [emailsEnvoyes, setEmailsEnvoyes] = useState(0); // auto from steps
  const [chartData, setChartData] = useState<ChartEntry[]>([]);

  function loadAll(m: string) {
    const loaded = getKPIMonth(m);
    setKpi(loaded);
    setSaved(false);

    const prospects = getProspects();
    setTotalProspects(prospects.length);
    setTotalClients(prospects.filter((p) => p.statut === "Client").length);

    // Auto-count checked steps for selected month
    setEmailsEnvoyes(countCheckedStepsByMonth(m));

    // Chart: last 6 months
    const months = lastNMonths(6);
    setChartData(
      months.map((mo) => {
        const data = getKPIMonth(mo);
        return {
          mois: mo,
          label: new Date(
            Number(mo.split("-")[0]),
            Number(mo.split("-")[1]) - 1,
            1
          ).toLocaleDateString("fr-FR", { month: "short" }),
          emailsEnvoyes: countCheckedStepsByMonth(mo),
          tauxOuverture: data.tauxOuverture,
          tauxReponse: data.tauxReponse,
        };
      })
    );
  }

  useEffect(() => { loadAll(mois); }, [mois]);

  const tauxConversion =
    totalProspects > 0 ? Math.round((totalClients / totalProspects) * 100) : 0;

  function handleChange(field: keyof Omit<KPIMonth, "mois">, raw: string) {
    const value = Math.max(0, Math.min(100, Number(raw) || 0));
    setKpi((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    upsertKPIMonth(kpi);
    setSaved(true);
    loadAll(mois);
  }

  const maxEmails = Math.max(...chartData.map((d) => d.emailsEnvoyes), 1);

  return (
    <div className="space-y-8">
      {/* Month selector */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMois(prevMois(mois))}
          className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 text-sm"
        >
          ‹ Mois précédent
        </button>
        <span className="font-semibold text-slate-800 capitalize min-w-[160px] text-center">
          {monthLabel(mois)}
        </span>
        <button
          onClick={() => setMois(nextMois(mois))}
          className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 text-sm"
        >
          Mois suivant ›
        </button>
        {mois !== currentMois() && (
          <button
            onClick={() => setMois(currentMois())}
            className="px-3 py-2 text-sm text-blue-600 hover:underline"
          >
            Mois en cours
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Emails envoyés"
          value={emailsEnvoyes}
          unit=""
          color="text-blue-600"
          subtitle="Cases cochées ce mois"
          auto
        />
        <KPICard
          label="Taux d'ouverture"
          value={kpi.tauxOuverture}
          unit="%"
          color="text-orange-600"
        />
        <KPICard
          label="Taux de réponse"
          value={kpi.tauxReponse}
          unit="%"
          color="text-green-600"
        />
        <KPICard
          label="Taux de conversion"
          value={tauxConversion}
          unit="%"
          color="text-purple-600"
          subtitle={`${totalClients} client${totalClients !== 1 ? "s" : ""} / ${totalProspects} prospects`}
          auto
        />
      </div>

      {/* Manual input form — taux only */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-1">
          Saisie manuelle —{" "}
          <span className="font-normal text-slate-500 capitalize">{monthLabel(mois)}</span>
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Le nombre d'emails envoyés est calculé automatiquement depuis les cases cochées dans le tableau des prospects.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-sm">
          <InputField
            label="Taux d'ouverture (%)"
            value={kpi.tauxOuverture}
            onChange={(v) => handleChange("tauxOuverture", v)}
            unit="%"
          />
          <InputField
            label="Taux de réponse (%)"
            value={kpi.tauxReponse}
            onChange={(v) => handleChange("tauxReponse", v)}
            unit="%"
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Enregistrer
          </button>
          {saved && <span className="text-sm text-green-600">✓ Enregistré</span>}
        </div>
      </div>

      {/* Chart — emails envoyés par mois */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-2">
          Emails envoyés — 6 derniers mois
        </h2>
        <p className="text-xs text-slate-400 mb-6">Nombre de cases cochées par mois dans les prospects.</p>
        <div className="flex items-end gap-3 h-40">
          {chartData.map((d) => {
            const pct = (d.emailsEnvoyes / maxEmails) * 100;
            const isCurrent = d.mois === mois;
            return (
              <div key={d.mois} className="flex flex-col items-center flex-1 h-full">
                <span className="text-xs text-slate-500 mb-1">{d.emailsEnvoyes || ""}</span>
                <div className="w-full flex items-end flex-1">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${isCurrent ? "bg-blue-600" : "bg-blue-200"}`}
                    style={{ height: `${Math.max(pct, d.emailsEnvoyes > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 mt-1 capitalize">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart — taux */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-6">
          Taux d'ouverture &amp; réponse — 6 derniers mois
        </h2>
        <div className="space-y-3">
          {chartData.map((d) => (
            <div key={d.mois} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-8 capitalize shrink-0">{d.label}</span>
              <div className="flex-1 space-y-1">
                <RateBar value={d.tauxOuverture} color="bg-orange-400" label="Ouv." current={d.mois === mois} />
                <RateBar value={d.tauxReponse} color="bg-green-400" label="Rép." current={d.mois === mois} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-orange-400 inline-block" />Ouverture</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-green-400 inline-block" />Réponse</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ label, value, unit, color, subtitle, auto }: {
  label: string; value: number; unit: string; color: string; subtitle?: string; auto?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
        {auto && <span className="ml-1 text-slate-400 normal-case font-normal">(auto)</span>}
      </p>
      <p className={`text-3xl font-bold ${color}`}>
        {value}<span className="text-lg font-semibold">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function InputField({ label, value, onChange, unit }: {
  label: string; value: number; onChange: (v: string) => void; unit: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={100}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{unit}</span>
        )}
      </div>
    </div>
  );
}

function RateBar({ value, color, label, current }: {
  value: number; color: string; label: string; current: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-8 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${color} ${current ? "opacity-100" : "opacity-60"}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}
