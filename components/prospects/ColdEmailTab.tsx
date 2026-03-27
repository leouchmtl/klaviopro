"use client";

import { useEffect, useState } from "react";
import type { Prospect } from "@/lib/types";
import { STEP_ORDER } from "@/lib/utils";
import {
  GAP_LABELS,
  generateEmailVariants,
  suggestVariantIndex,
} from "@/lib/emailGenerator";
import type { EmailVariant, RelanceStep } from "@/lib/emailGenerator";
import { getColdEmails, saveColdEmails } from "@/lib/storage";

const GAP_OPTIONS = [
  { value: "welcome_flow",    label: "Absence de séquence de bienvenue" },
  { value: "signup_form",     label: "Absence de formulaire d'inscription" },
  { value: "abandoned_cart",  label: "Absence de flow abandon panier" },
  { value: "post_purchase",   label: "Absence de flow post-achat" },
  { value: "no_segmentation", label: "Absence de segmentation" },
  { value: "low_open_rates",  label: "Taux d'ouverture faibles" },
  { value: "custom",          label: "Autre (texte libre)…" },
];

const STEP_KEY_TO_LABEL: Record<string, RelanceStep> = {
  j0:  "J0",
  j5:  "J+5",
  j12: "J+12",
  j21: "J+21",
  j35: "J+35",
  j60: "J+60",
};

const ANGLE_COLORS: Record<string, string> = {
  j0:  "bg-blue-100 text-blue-800",
  j5:  "bg-yellow-100 text-yellow-800",
  j12: "bg-orange-100 text-orange-800",
  j21: "bg-amber-100 text-amber-800",
  j35: "bg-purple-100 text-purple-800",
  j60: "bg-red-100 text-red-800",
};

const DI = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white";

function detectStep(prospect: Prospect): RelanceStep {
  const nextKey = STEP_ORDER.find((k) => !prospect.steps[k].done);
  return STEP_KEY_TO_LABEL[nextKey ?? "j0"] ?? "J0";
}

export default function ColdEmailTab({
  prospect,
  onSendViaGmail,
}: {
  prospect: Prospect;
  onSendViaGmail: (subject: string, body: string) => void;
}) {
  const currentStep = detectStep(prospect);

  const [brand,     setBrand]   = useState(prospect.marque  ?? "");
  const [contact,   setContact] = useState(prospect.contact ?? "");
  const [gapKey,    setGapKey]  = useState(prospect.gapCrm  || "welcome_flow");
  const [customGap, setCustom]  = useState("");
  const [variants,  setVariants]= useState<EmailVariant[]>([]);
  const [activeIdx, setActive]  = useState(suggestVariantIndex(currentStep));
  const [copied,    setCopied]  = useState<string | null>(null);

  // Load saved variants from localStorage
  useEffect(() => {
    const saved = getColdEmails(prospect.id);
    if (saved) {
      setBrand(saved.brand);
      setContact(saved.contact);
      setGapKey(saved.gap in GAP_LABELS || saved.gap === "custom" ? saved.gap : "custom");
      if (!(saved.gap in GAP_LABELS)) setCustom(saved.gap);
      setVariants(saved.variants);
      // Always auto-select the step-matching variant on load
      setActive(suggestVariantIndex(currentStep));
    }
  }, [prospect.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function effectiveGap() {
    return gapKey === "custom" ? customGap : gapKey;
  }

  function generate() {
    const gap = effectiveGap();
    const v = generateEmailVariants(brand, contact, gap);
    const suggested = suggestVariantIndex(currentStep);
    setVariants(v);
    setActive(suggested);
    saveColdEmails(prospect.id, { brand, contact, gap, variants: v });
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const active = variants[activeIdx] ?? null;

  return (
    <div className="p-5 space-y-5">
      {/* Step context banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-blue-500 text-sm">📍</span>
        <span className="text-sm text-blue-800">
          Vous en êtes à l&apos;étape{" "}
          <span className="font-semibold">{currentStep}</span> avec ce prospect.
          {variants.length > 0 && (
            <span className="text-blue-600"> Template correspondant sélectionné.</span>
          )}
        </span>
      </div>

      {/* Input fields */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paramètres</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nom de la marque</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="ex: Maison Doré"
              className={DI}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nom du contact</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="ex: Sophie"
              className={DI}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Gap CRM identifié</label>
          <select value={gapKey} onChange={(e) => setGapKey(e.target.value)} className={DI}>
            {GAP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {gapKey === "custom" && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Décrivez le gap</label>
            <input
              type="text"
              value={customGap}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="ex: l'absence d'upsell post-achat"
              className={DI}
            />
          </div>
        )}

        <button
          onClick={generate}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {variants.length > 0 ? "Regénérer les variantes" : "Générer les 6 templates"}
        </button>
      </div>

      {/* Variant cards */}
      {variants.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Templates par étape</p>

          {/* Step selector pills */}
          <div className="flex flex-wrap gap-1.5">
            {variants.map((v, i) => {
              const isSuggested = i === suggestVariantIndex(currentStep);
              return (
                <button
                  key={v.angleKey}
                  onClick={() => setActive(i)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    i === activeIdx
                      ? (ANGLE_COLORS[v.angleKey] ?? "bg-slate-200 text-slate-700") +
                        " ring-2 ring-offset-1 ring-blue-400"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  title={isSuggested ? "Template recommandé pour cette étape" : undefined}
                >
                  {isSuggested && <span className="mr-1">★</span>}
                  {v.angle}
                </button>
              );
            })}
          </div>

          {/* Active variant card */}
          {active && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Subject */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <p className="text-xs text-slate-400 mb-0.5">Objet</p>
                <p className="text-sm font-semibold text-slate-900">{active.subject}</p>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <p className="text-xs text-slate-400 mb-1.5">Corps</p>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {active.body}
                </pre>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => copy(active.body, "body")}
                  className="flex-1 min-w-[110px] text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                >
                  {copied === "body" ? "✓ Copié !" : "Copier le corps"}
                </button>
                <button
                  onClick={() => copy(`Objet : ${active.subject}\n\n${active.body}`, "all")}
                  className="flex-1 min-w-[110px] text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                >
                  {copied === "all" ? "✓ Copié !" : "Copier tout"}
                </button>
                <button
                  onClick={() => onSendViaGmail(active.subject, active.body)}
                  className="flex-1 min-w-[110px] text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium"
                >
                  Envoyer via Gmail
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
