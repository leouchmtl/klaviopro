"use client";

import { useEffect, useState } from "react";
import { getCaThreshold, saveCaThreshold } from "@/lib/storage";

const PRESETS = [
  { label: "Sans seuil", value: 0 },
  { label: "150 000 €", value: 150000 },
  { label: "500 000 €", value: 500000 },
  { label: "1 000 000 €", value: 1000000 },
  { label: "2 000 000 €", value: 2000000 },
];

export default function CaThresholdSettings() {
  const [threshold, setThreshold] = useState(150000);
  const [draft, setDraft]         = useState("150000");
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    const v = getCaThreshold();
    setThreshold(v);
    setDraft(String(v));
  }, []);

  function handleSave() {
    const v = parseInt(draft.replace(/\s/g, "")) || 0;
    setThreshold(v);
    saveCaThreshold(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handlePreset(v: number) {
    setThreshold(v);
    setDraft(String(v));
    saveCaThreshold(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900">Seuil CA minimum</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Les prospects dont le chiffre d&apos;affaires est inférieur à ce seuil affichent un badge
          <span className="mx-1 text-red-500 font-bold">⚠</span>dans la colonne CA.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePreset(p.value)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                threshold === p.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom value */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="10000"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            className="border border-slate-300 rounded-lg text-sm px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex : 150000"
          />
          <span className="text-sm text-slate-500">€</span>
          <button
            onClick={handleSave}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {saved ? "✓ Enregistré" : "Enregistrer"}
          </button>
        </div>

        {threshold > 0 && (
          <p className="text-xs text-slate-400">
            Seuil actuel : <span className="font-medium text-slate-600">
              {threshold >= 1_000_000
                ? `${(threshold / 1_000_000).toFixed(1).replace(".", ",")} M€`
                : `${(threshold / 1_000).toFixed(0)} K€`}
            </span> — le badge ⚠ s&apos;affiche en dessous de cette valeur.
          </p>
        )}
      </div>
    </div>
  );
}
