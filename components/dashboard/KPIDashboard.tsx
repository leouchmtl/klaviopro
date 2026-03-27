"use client";

import { useEffect, useState } from "react";
import type { KPIMonth } from "@/lib/types";
import { getKPIMonth, upsertKPIMonth, getProspects } from "@/lib/storage";

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

// Build last N months for the chart
function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(
      `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return result;
}

export default function KPIDashboard() {
  const [mois, setMois] = useState(currentMois);
  const [kpi, setKpi] = useState<KPIMonth>({
    mois,
    emailsEnvoyes: 0,
    tauxOuverture: 0,
    tauxReponse: 0,
  });
  const [saved, setSaved] = useState(false);
  const [totalProspects, setTotalProspects] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [chartData, setChartData] = useState<
    { mois: string; label: string; emailsEnvoyes: number; tauxOuverture: number; tauxReponse: number }[]
  >([]);

  useEffect(() => {
    const loaded = getKPIMonth(mois);
    setKpi(loaded);
    setSaved(false);

    const prospects = getProspects();
    setTotalProspects(prospects.length);
    setTotalClients(prospects.filter((p) => p.statut === "Client").length);

    // Chart: last 6 months
    const months = lastNMonths(6);
    setChartData(
      months.map((m) => {
        const data = getKPIMonth(m);
        return {
          mois: m,
          label: new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
            .toLocaleDateString("fr-FR", { month: "short" }),
          emailsEnvoyes: data.emailsEnvoyes,
          tauxOuverture: data.tauxOuverture,
          tauxReponse: data.tauxReponse,
        };
      })
    );
  }, [mois]);

  const tauxConversion =
    totalProspects > 0 ? Math.round((totalClients / totalProspects) * 100) : 0;

  function handleChange(field: keyof KPIMonth, raw: string) {
    const value = Math.max(0, Number(raw) || 0);
    setKpi((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    upsertKPIMonth(kpi);
    setSaved(true);
    // refresh chart
    const months = lastNMonths(6);
    setChartData(
      months.map((m) => {
        const data = getKPIMonth(m);
        return {
          mois: m,
          label: new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
            .toLocaleDateString("fr-FR", { month: "short" }),
          emailsEnvoyes: data.emailsEnvoyes,
          tauxOuverture: data.tauxOuverture,
          tauxReponse: data.tauxReponse,
        };
      })
    );
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
            Revenir au mois en cours
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Emails envoyés"
          value={kpi.emailsEnvoyes}
          unit=""
          color="text-blue-600"
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

      {/* Manual input form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-5">
          Saisie manuelle —{" "}
          <span className="font-normal text-slate-500 capitalize">
            {monthLabel(mois)}
          </span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <InputField
            label="Emails envoyés"
            value={kpi.emailsEnvoyes}
            onChange={(v) => handleChange("emailsEnvoyes", v)}
            min={0}
            unit=""
          />
          <InputField
            label="Taux d'ouverture (%)"
            value={kpi.tauxOuverture}
            onChange={(v) => handleChange("tauxOuverture", v)}
            min={0}
            max={100}
            unit="%"
          />
          <InputField
            label="Taux de réponse (%)"
            value={kpi.tauxReponse}
            onChange={(v) => handleChange("tauxReponse", v)}
            min={0}
            max={100}
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
          {saved && (
            <span className="text-sm text-green-600">✓ Enregistré</span>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Le taux de conversion est calculé automatiquement depuis vos prospects (
          {totalClients} client{totalClients !== 1 ? "s" : ""} sur {totalProspects} prospects).
        </p>
      </div>

      {/* Chart — emails envoyés par mois (bar) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-6">
          Emails envoyés — 6 derniers mois
        </h2>
        <div className="flex items-end gap-3 h-40">
          {chartData.map((d) => {
            const pct = maxEmails > 0 ? (d.emailsEnvoyes / maxEmails) * 100 : 0;
            const isCurrentMois = d.mois === mois;
            return (
              <div key={d.mois} className="flex flex-col items-center flex-1 h-full">
                <span className="text-xs text-slate-500 mb-1">
                  {d.emailsEnvoyes || ""}
                </span>
                <div className="w-full flex items-end flex-1">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isCurrentMois ? "bg-blue-600" : "bg-blue-200"
                    }`}
                    style={{ height: `${Math.max(pct, d.emailsEnvoyes > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 mt-1 capitalize">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart — taux (line-like bars) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-6">
          Taux d'ouverture &amp; réponse — 6 derniers mois
        </h2>
        <div className="space-y-3">
          {chartData.map((d) => (
            <div key={d.mois} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-8 capitalize shrink-0">
                {d.label}
              </span>
              <div className="flex-1 space-y-1">
                <RateBar
                  value={d.tauxOuverture}
                  color="bg-orange-400"
                  label="Ouv."
                  current={d.mois === mois}
                />
                <RateBar
                  value={d.tauxReponse}
                  color="bg-green-400"
                  label="Rép."
                  current={d.mois === mois}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-orange-400 inline-block" />
            Ouverture
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-green-400 inline-block" />
            Réponse
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  unit,
  color,
  subtitle,
  auto,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  subtitle?: string;
  auto?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
        {auto && (
          <span className="ml-1 text-slate-400 normal-case tracking-normal font-normal">
            (auto)
          </span>
        )}
      </p>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
        <span className="text-lg font-semibold">{unit}</span>
      </p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  min: number;
  max?: number;
  unit: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function RateBar({
  value,
  color,
  label,
  current,
}: {
  value: number;
  color: string;
  label: string;
  current: boolean;
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
