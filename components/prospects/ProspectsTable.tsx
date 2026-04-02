"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Prospect, Statut, Secteur, StepEntry, ProspectSteps, EmailRecord, EnrichmentData, FoundersSource, FoundersConfidence, RevenueSource } from "@/lib/types";
import { STATUTS, SECTEURS } from "@/lib/types";
import {
  updateProspect,
  saveProspects,
  emptySteps,
  getEmails,
  getEnrichment,
  saveEmailRecord,
  deleteEmailRecord,
  saveEnrichment,
  getAllEnrichments,
  getCaThreshold,
  saveCaThreshold,
} from "@/lib/storage";
import {
  formatDateFR,
  STATUT_COLORS,
  parseCSV,
  withRelance,
  today,
  relanceDateColor,
  STEP_ORDER,
  STEP_TO_STATUT,
  applyStepChange,
  DISQUAL_STATUTS,
  isDisqualified,
} from "@/lib/utils";
import { useProspects } from "@/lib/hooks";
import type { GmailMsg, MatchType } from "@/lib/gmail";
import ColdEmailTab from "@/components/prospects/ColdEmailTab";
import EnrichmentPanel from "@/components/prospects/EnrichmentPanel";
import ContactFinderPanel from "@/components/prospects/ContactFinderPanel";
import { findDuplicates } from "@/lib/duplicateDetection";
import type { DuplicateMatch, NewProspectData } from "@/lib/duplicateDetection";

// ── Disqualification ──────────────────────────────────────────────────────────

const DISQUAL_REASONS = [
  "Pas besoin d'améliorer son emailing",
  "CA trop faible",
  "Déjà équipé / agence en place",
  "Pas de réponse après séquence complète",
  "Mauvais contact",
  "Hors cible",
  "Autre (préciser)",
] as const;

function DisqualModal({
  newStatut,
  onConfirm,
  onCancel,
}: {
  newStatut: Statut;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string>(DISQUAL_REASONS[0]);
  const [custom, setCustom] = useState("");
  const isCustom = reason === "Autre (préciser)";
  const finalReason = isCustom ? (custom.trim() || "Autre") : reason;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Raison de la disqualification ?</h3>
          <p className="text-xs text-slate-500 mt-1">Statut → <span className="font-medium text-slate-700">{newStatut}</span></p>
        </div>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DISQUAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {isCustom && (
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(finalReason); }}
            placeholder="Précisez la raison…"
            autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onConfirm(finalReason)}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Confirmer
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── DisqualDuplicateModal — blocking modal when duplicate is disqualified ──────

function DisqualDuplicateModal({
  match,
  onReactivate,
  onCreateAnyway,
  onCancel,
}: {
  match: DuplicateMatch;
  onReactivate: () => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}) {
  const { prospect: ex, matchType } = match;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold text-slate-900">⚠️ Ce prospect ressemble à un contact déjà disqualifié</p>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-1.5 text-sm">
          <p><span className="text-slate-500">Prospect existant :</span> <span className="font-semibold text-slate-800">{ex.marque || "—"}</span>{ex.email ? <span className="text-slate-500"> — {ex.email}</span> : null} <span className={`inline-block ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[ex.statut].bg} ${STATUT_COLORS[ex.statut].text}`}>{ex.statut}</span></p>
          {ex.disqualDate && <p><span className="text-slate-500">Disqualifié le :</span> <span className="font-medium text-slate-700">{formatDateFR(ex.disqualDate)}</span></p>}
          {ex.disqualReason && <p><span className="text-slate-500">Raison :</span> <span className="font-medium text-slate-700">{ex.disqualReason}</span></p>}
          <p><span className="text-slate-500">Similarité détectée :</span> <span className="font-medium text-slate-700">{matchType}</span></p>
        </div>
        <p className="text-sm text-slate-600 font-medium">Que souhaitez-vous faire ?</p>
        <div className="flex flex-col gap-2">
          <button onClick={onReactivate} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-left">
            🔄 Réactiver ce prospect — restaurer en « À contacter »
          </button>
          <button onClick={onCreateAnyway} className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors text-left">
            ➕ Créer quand même — nouvelle entrée séparée
          </button>
          <button onClick={onCancel} className="w-full px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors text-left">
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── CsvPreviewModal — shows summary + duplicate decisions before bulk import ───

type CsvDupDecision = "skip" | "reactivate" | "create";

interface CsvDupRow {
  csvRow: Record<string, string>;
  match: DuplicateMatch;
  decision: CsvDupDecision;
}

interface CsvPreviewState {
  cleanRows: Record<string, string>[];
  dupRows: CsvDupRow[];
}

function CsvPreviewModal({
  preview,
  onImport,
  onCancel,
}: {
  preview: CsvPreviewState;
  onImport: (preview: CsvPreviewState) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<CsvDupRow[]>(preview.dupRows);
  const disqualDups = rows.filter((r) => r.match.isDisqualified);
  const activeDups  = rows.filter((r) => !r.match.isDisqualified);
  const toCreate = preview.cleanRows.length + rows.filter((r) => r.decision === "create" || r.decision === "reactivate").length;

  function setDecision(idx: number, d: CsvDupDecision) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, decision: d } : r));
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base">Aperçu de l&apos;import CSV</h3>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-green-700 font-medium">✅ {preview.cleanRows.length} nouveaux</span>
            {rows.length > 0 && (
              <span className="text-amber-600 font-medium">⚠ {rows.length} doublon{rows.length > 1 ? "s" : ""}{disqualDups.length > 0 ? ` (${disqualDups.length} disqualifié${disqualDups.length > 1 ? "s" : ""})` : ""}</span>
            )}
          </div>
        </div>

        {/* Dup rows */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {rows.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">Aucun doublon détecté.</p>
          )}
          {rows.map((r, i) => {
            const ex = r.match.prospect;
            return (
              <div key={i} className={`rounded-xl border p-4 space-y-3 ${r.match.isDisqualified ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50"}`}>
                <div className="text-sm space-y-0.5">
                  <p className="font-semibold text-slate-800">{r.csvRow["Marque"] || r.csvRow["marque"] || "—"}{r.csvRow["Email"] ? <span className="font-normal text-slate-500"> — {r.csvRow["Email"]}</span> : null}</p>
                  <p className="text-xs text-slate-500">
                    Existant : <span className="font-medium text-slate-700">{ex.marque}</span>
                    {ex.email ? ` — ${ex.email}` : ""}
                    {" · "}<span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[ex.statut].bg} ${STATUT_COLORS[ex.statut].text}`}>{ex.statut}</span>
                  </p>
                  <p className="text-xs text-slate-400">Similarité : {r.match.matchType}</p>
                  {r.match.isDisqualified && ex.disqualDate && (
                    <p className="text-xs text-amber-700">Disqualifié le {formatDateFR(ex.disqualDate)}{ex.disqualReason ? ` · ${ex.disqualReason}` : ""}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.match.isDisqualified && (
                    <button
                      onClick={() => setDecision(i, "reactivate")}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${r.decision === "reactivate" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                    >
                      🔄 Réactiver
                    </button>
                  )}
                  <button
                    onClick={() => setDecision(i, "create")}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${r.decision === "create" ? "bg-slate-700 text-white border-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                  >
                    ➕ Créer quand même
                  </button>
                  <button
                    onClick={() => setDecision(i, "skip")}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${r.decision === "skip" ? "bg-slate-200 text-slate-700 border-slate-300" : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => onImport({ ...preview, dupRows: rows })}
            disabled={toCreate === 0}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Importer ({toCreate} prospect{toCreate > 1 ? "s" : ""})
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Column system ─────────────────────────────────────────────────────────────

export type ColId =
  | "contact" | "email" | "shopify" | "klaviyo" | "instagram"
  | "gapCrm" | "statut" | "relances" | "dernierContact" | "prochaineRelance"
  | "secteur" | "notes" | "chaud" | "ouvertures" | "conversation" | "ca";

interface ColDef { id: ColId; label: string; defaultVisible: boolean }

export const ALL_COLS: ColDef[] = [
  { id: "contact",          label: "Contact",             defaultVisible: true  },
  { id: "email",            label: "Email",               defaultVisible: true  },
  { id: "shopify",          label: "🛍 Shopify",          defaultVisible: true  },
  { id: "klaviyo",          label: "⚡ Klaviyo",          defaultVisible: true  },
  { id: "instagram",        label: "Instagram",           defaultVisible: true  },
  { id: "gapCrm",           label: "Gap CRM",             defaultVisible: true  },
  { id: "statut",           label: "Statut",              defaultVisible: true  },
  { id: "relances",         label: "Relances",            defaultVisible: true  },
  { id: "dernierContact",   label: "Dernier contact",     defaultVisible: true  },
  { id: "prochaineRelance", label: "Prochaine relance",   defaultVisible: true  },
  { id: "ca",               label: "CA",                  defaultVisible: true  },
  { id: "secteur",          label: "Secteur",             defaultVisible: false },
  { id: "notes",            label: "Notes",               defaultVisible: false },
  { id: "chaud",            label: "🔥 Chaud",            defaultVisible: false },
  { id: "ouvertures",       label: "Ouvertures multiples",defaultVisible: false },
  { id: "conversation",     label: "En conversation",     defaultVisible: false },
];

const COL_PREFS_KEY = "klaviopro_col_prefs";

function loadColPrefs(): { order: ColId[]; visible: ColId[] } {
  try {
    const raw = localStorage.getItem(COL_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    order:   ALL_COLS.map((c) => c.id),
    visible: ALL_COLS.filter((c) => c.defaultVisible).map((c) => c.id),
  };
}

function saveColPrefs(order: ColId[], visible: ColId[]) {
  try { localStorage.setItem(COL_PREFS_KEY, JSON.stringify({ order, visible })); } catch {}
}

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortCol = "marque" | "ca" | ColId;
type SortDir = "asc" | "desc";

const STATUT_ORDER: Record<string, number> = Object.fromEntries(
  ["À contacter","Contacté J0","Relance J+5","Relance J+12","Relance J+21","Relance J+35","Relance J+60","Client","Refus","Sans besoin","Non qualifié"].map((s, i) => [s, i])
);

function extractFollowers(ig: string | undefined): number {
  if (!ig) return -1;
  const m = ig.match(/([\d.,]+)\s*([KkMm]?)\s*abonnés/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, "."));
  const unit = m[2].toLowerCase();
  if (unit === "k") return n * 1000;
  if (unit === "m") return n * 1_000_000;
  return n;
}

function sortProspects(
  list: Prospect[],
  col: SortCol | null,
  dir: SortDir,
  enrichments: Record<string, EnrichmentData>
): Prospect[] {
  if (!col) return list;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (col === "marque") cmp = a.marque.localeCompare(b.marque, "fr");
    else if (col === "statut") cmp = (STATUT_ORDER[a.statut] ?? 99) - (STATUT_ORDER[b.statut] ?? 99);
    else if (col === "dernierContact") cmp = (a.dernierContact ?? "").localeCompare(b.dernierContact ?? "");
    else if (col === "prochaineRelance") cmp = (a.prochaineRelance ?? "9999").localeCompare(b.prochaineRelance ?? "9999");
    else if (col === "instagram") {
      cmp = extractFollowers(enrichments[a.id]?.instagram) - extractFollowers(enrichments[b.id]?.instagram);
    } else if (col === "relances") {
      const doneA = STEP_ORDER.filter((k) => a.steps[k].done).length;
      const doneB = STEP_ORDER.filter((k) => b.steps[k].done).length;
      cmp = doneA - doneB;
    } else if (col === "ca") {
      cmp = (a.annualRevenue ?? -1) - (b.annualRevenue ?? -1);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── CA formatting helpers ─────────────────────────────────────────────────────

function formatCAValue(amount: number | null, raw: string, source: string, isEstimated: boolean): string {
  if (!amount && !raw) return "—";
  if (isEstimated) {
    // raw already contains the estimate range string e.g. "150K€ - 500K€ estimé"
    return raw || "estimé";
  }
  if (amount! >= 1_000_000) {
    const m = (amount! / 1_000_000).toFixed(1).replace(".", ",");
    return `${m}M€`;
  }
  if (amount! >= 1_000) {
    return `${Math.round(amount! / 1_000)}K€`;
  }
  return `${amount}€`;
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder,
  display,
  maxWidth,
  autoFocus,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "email" | "date";
  placeholder?: string;
  display?: React.ReactNode;
  maxWidth?: string;
  autoFocus?: boolean;
}) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() { setEditing(false); onSave(draft); }

  if (editing) {
    return (
      <input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        style={maxWidth ? { maxWidth } : undefined}
        className="w-full min-w-[72px] px-1.5 py-0.5 border border-blue-400 rounded text-sm bg-white focus:outline-none"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title={value || undefined}
      className="cursor-text rounded px-1 py-0.5 hover:bg-blue-50 min-h-[22px] flex items-center text-sm group"
      style={maxWidth ? { maxWidth } : undefined}
    >
      {display ?? (
        value
          ? <span className="truncate">{value}</span>
          : <span className="text-slate-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity select-none">✎</span>
      )}
    </div>
  );
}

function SelectCell<T extends string>({
  value, options, onSave, display,
}: {
  value: T; options: readonly T[]; onSave: (v: T) => void; display?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        value={value}
        autoFocus
        onChange={(e) => { onSave(e.target.value as T); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className="border border-blue-400 rounded text-sm px-1 py-0.5 bg-white focus:outline-none w-full"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer rounded px-1 py-0.5 hover:bg-blue-50 text-sm">
      {display ?? value}
    </div>
  );
}

// ── Steps progress cell (replaces 6 individual columns) ──────────────────────

const STEP_KEYS: { key: keyof ProspectSteps; label: string }[] = [
  { key: "j0",  label: "J0"   },
  { key: "j5",  label: "J+5"  },
  { key: "j12", label: "J+12" },
  { key: "j21", label: "J+21" },
  { key: "j35", label: "J+35" },
  { key: "j60", label: "J+60" },
];

function StepsProgressCell({
  steps,
  onUpdateStep,
}: {
  steps: ProspectSteps;
  onUpdateStep: (key: keyof ProspectSteps, entry: StepEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }

  const doneCount = STEP_KEYS.filter(({ key }) => steps[key].done).length;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-1.5 py-1 rounded-lg hover:bg-slate-100 transition-colors w-full justify-center"
      >
        <div className="flex gap-0.5">
          {STEP_KEYS.map(({ key }) => (
            <div
              key={key}
              className={`w-2.5 h-1.5 rounded-sm ${steps[key].done ? "bg-blue-500" : "bg-slate-200"}`}
            />
          ))}
        </div>
        <span className="text-slate-500 tabular-nums">{doneCount}/6</span>
      </button>

      {open && mounted && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-slate-200 p-3 min-w-[230px]"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Séquence de relance</p>
          {STEP_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 py-1.5">
              <input
                type="checkbox"
                checked={steps[key].done}
                onChange={(e) => {
                  const done = e.target.checked;
                  onUpdateStep(key, { done, date: done ? (steps[key].date ?? today()) : steps[key].date });
                }}
                className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
              />
              <span className="text-sm text-slate-700 w-10 font-medium shrink-0">{label}</span>
              {steps[key].done && (
                <input
                  type="date"
                  value={steps[key].date ?? ""}
                  onChange={(e) => onUpdateStep(key, { ...steps[key], date: e.target.value || null })}
                  className="text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-400 flex-1"
                />
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── ProspectRow ───────────────────────────────────────────────────────────────

function ProspectRow({
  prospect: init,
  isSelected,
  onToggleSelect,
  onDelete,
  autoFocusField,
  onOpen,
  enrichment,
  scanStatus,
  onEnrich,
  colOrder,
  colVisible,
  caThreshold,
  onRequestDisqual,
  onFieldSaved,
  isDuplicateWarning,
}: {
  prospect: Prospect;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  autoFocusField?: string;
  onOpen: (id: string) => void;
  enrichment: EnrichmentData | null;
  scanStatus: ScanSt | undefined;
  onEnrich: (p: Prospect) => void;
  colOrder: ColId[];
  colVisible: Set<ColId>;
  caThreshold: number;
  onRequestDisqual: (prospect: Prospect, newStatut: Statut, commit: (reason: string) => void) => void;
  onFieldSaved?: (field: "marque" | "email", value: string) => void;
  isDuplicateWarning?: boolean;
}) {
  const [p, setP] = useState<Prospect>(init);
  useEffect(() => { setP(init); }, [init]);

  function save<K extends keyof Prospect>(field: K, value: Prospect[K]) {
    const updated = withRelance({ ...p, [field]: value });
    setP(updated);
    updateProspect(updated);
    if ((field === "marque" || field === "email") && value && onFieldSaved) {
      onFieldSaved(field, value as string);
    }
  }

  function saveStep(key: keyof ProspectSteps, entry: StepEntry) {
    const { steps, statut, dernierContact } = applyStepChange(p.steps, key, entry);
    const saved = withRelance({ ...p, steps, statut, dernierContact });
    setP(saved);
    updateProspect(saved);
  }

  const chaud          = p.ouverturesMultiples && p.enConversation;
  const isDisqual      = isDisqualified(p.statut);
  const { bg, text } = STATUT_COLORS[p.statut];
  const pr          = p.prochaineRelance;
  const prColor     = relanceDateColor(pr);
  const noStepsDone = STEP_ORDER.every((k) => !p.steps[k].done);

  // CA cell helpers
  const isEstimated = p.revenueSource === "estimé";
  const caDisplay = formatCAValue(p.annualRevenue, p.revenueRaw, p.revenueSource, isEstimated);
  const caLow = caThreshold > 0 && p.annualRevenue !== null && p.annualRevenue < caThreshold;

  // Cell definitions per column id
  const cells: Partial<Record<ColId, React.ReactNode>> = {
    ca: (
      <td key="ca" className="px-2 py-1.5 whitespace-nowrap min-w-[90px]">
        {caDisplay === "—" ? (
          <span className="text-slate-300 text-sm">—</span>
        ) : (
          <span
            className="text-sm text-slate-700 cursor-default"
            title={[
              p.revenueSource ? `Source : ${p.revenueSource}` : "",
              p.revenueYear   ? p.revenueYear : "",
              p.revenueRaw    ? p.revenueRaw  : "",
            ].filter(Boolean).join(" · ")}
          >
            {caDisplay}
            {caLow && (
              <span
                className="ml-1 text-red-500 text-xs"
                title={`CA trop faible pour votre seuil (${(caThreshold/1000).toFixed(0)}K€ minimum)`}
              >
                ⚠
              </span>
            )}
            {p.revenueSource && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                isEstimated
                  ? "bg-slate-100 text-slate-400"
                  : "bg-emerald-50 text-emerald-600"
              }`}>
                {isEstimated ? "estimé" : p.revenueSource}
              </span>
            )}
          </span>
        )}
      </td>
    ),
    contact: (
      <td key="contact" className="px-2 py-1.5 w-[130px] max-w-[130px]">
        <EditableCell value={p.contact} onSave={(v) => save("contact", v)} placeholder="Nom" maxWidth="120px" />
      </td>
    ),
    email: (
      <td key="email" className="px-2 py-1.5 w-[190px] max-w-[190px]">
        <EditableCell
          value={p.email} type="email" onSave={(v) => save("email", v)} placeholder="email@…" maxWidth="180px"
          display={p.email ? (
            <a href={`mailto:${p.email}`} title={p.email} className="text-blue-600 hover:underline truncate block" style={{ maxWidth: 180 }} onClick={(e) => e.stopPropagation()}>
              {p.email}
            </a>
          ) : undefined}
        />
      </td>
    ),
    shopify: (
      <td key="shopify" className="px-2 py-1.5 text-center w-[52px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="shopify" onScan={() => onEnrich(p)} />
      </td>
    ),
    klaviyo: (
      <td key="klaviyo" className="px-2 py-1.5 text-center w-[52px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="klaviyo" onScan={() => onEnrich(p)} />
      </td>
    ),
    instagram: (
      <td key="instagram" className="px-2 py-1.5 w-[130px] max-w-[130px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="instagram" onScan={() => onEnrich(p)} />
      </td>
    ),
    gapCrm: (
      <td key="gapCrm" className="px-2 py-1.5 min-w-[70px]">
        <EditableCell value={p.gapCrm} onSave={(v) => save("gapCrm", v)} placeholder="Réf." />
      </td>
    ),
    statut: (
      <td key="statut" className="px-2 py-1.5 min-w-[125px]">
        <SelectCell
          value={p.statut} options={STATUTS}
          onSave={(v) => {
            const s = v as Statut;
            if (isDisqualified(s) && !isDisqualified(p.statut)) {
              onRequestDisqual(p, s, (reason) => {
                const updated = withRelance({ ...p, statut: s, disqualReason: reason, disqualDate: today() });
                setP(updated);
                updateProspect(updated);
              });
            } else {
              save("statut", s);
            }
          }}
          display={<span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>{p.statut}</span>}
        />
      </td>
    ),
    notes: (
      <td key="notes" className="px-2 py-1.5 max-w-[150px]">
        <EditableCell value={p.notes} onSave={(v) => save("notes", v)} placeholder="Notes…" maxWidth="140px"
          display={p.notes ? <span className="truncate block text-slate-600" title={p.notes}>{p.notes}</span> : undefined}
        />
      </td>
    ),
    chaud: (
      <td key="chaud" className="px-2 py-1.5 text-center w-8">
        {chaud && <span title="Prospect chaud" className="text-sm">🔥</span>}
      </td>
    ),
    ouvertures: (
      <td key="ouvertures" className="px-2 py-1.5 text-center w-10">
        <input type="checkbox" checked={p.ouverturesMultiples} onChange={(e) => save("ouverturesMultiples", e.target.checked)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" title="Ouvertures multiples" />
      </td>
    ),
    conversation: (
      <td key="conversation" className="px-2 py-1.5 text-center w-10">
        <input type="checkbox" checked={p.enConversation} onChange={(e) => save("enConversation", e.target.checked)} className="w-3.5 h-3.5 accent-green-500 cursor-pointer" title="En conversation" />
      </td>
    ),
    relances: (
      <td key="relances" className="px-2 py-1.5 min-w-[110px]">
        <StepsProgressCell steps={p.steps} onUpdateStep={saveStep} />
      </td>
    ),
    dernierContact: (
      <td key="dernierContact" className="px-2 py-1.5 min-w-[100px]">
        <EditableCell value={p.dernierContact ?? ""} type="date" onSave={(v) => save("dernierContact", v || null)}
          display={<span className="text-slate-600 text-sm">{formatDateFR(p.dernierContact)}</span>}
        />
      </td>
    ),
    prochaineRelance: (
      <td key="prochaineRelance" className="px-2 py-1.5 whitespace-nowrap min-w-[110px]">
        {noStepsDone ? (
          <span className="text-orange-500 text-sm font-medium">⚠ À contacter</span>
        ) : pr === null ? (
          p.statut === "Relance J+60"
            ? <span className="text-green-600 text-xs">✅ Terminée</span>
            : <span className="text-slate-400 text-sm">—</span>
        ) : (
          <span className={`text-sm font-medium ${prColor}`}>{prColor === "text-red-600" ? "⚠ " : ""}{formatDateFR(pr)}</span>
        )}
      </td>
    ),
    secteur: (
      <td key="secteur" className="px-2 py-1.5 min-w-[100px]">
        <SelectCell value={p.secteur} options={SECTEURS} onSave={(v) => save("secteur", v)} />
      </td>
    ),
  };

  return (
    <tr className={`border-b border-slate-100 transition-colors ${isDisqual ? "bg-gray-100 text-gray-400" : chaud ? "bg-amber-50/60 hover:bg-amber-100/50" : "hover:bg-slate-50/60"}`}>
      {/* Select (fixed) */}
      <td className={`px-2 py-1.5 text-center w-8 sticky left-0 z-[5] ${isDisqual ? "bg-gray-100" : chaud ? "bg-amber-50" : "bg-white"}`}>
        <div className="flex items-center justify-center gap-0.5">
          {isDisqual && <span className="text-gray-400 text-xs leading-none" title="Disqualifié">🚫</span>}
          {isDuplicateWarning && !isDisqual && <span className="text-amber-500 text-xs leading-none" title="Doublon potentiel">🔄</span>}
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(p.id)} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" />
        </div>
      </td>

      {/* Marque (frozen) */}
      <td className={`px-2 py-1.5 font-medium w-[170px] max-w-[170px] sticky left-8 z-[5] ${isDisqual ? "bg-gray-100 text-gray-400" : "text-slate-900 " + (chaud ? "bg-amber-50" : "bg-white")} shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}>
        <EditableCell value={p.marque} onSave={(v) => save("marque", v)} placeholder="Marque" maxWidth="160px" autoFocus={autoFocusField === "marque"} />
      </td>

      {/* Dynamic columns */}
      {colOrder.filter((id) => colVisible.has(id)).map((id) => cells[id] ?? null)}

      {/* Actions (fixed) */}
      <td className="px-2 py-1.5 text-center w-14">
        <div className="flex items-center justify-center gap-0.5">
          <button onClick={() => onOpen(p.id)} className="text-slate-400 hover:text-blue-600 transition-colors px-1 text-base" title="Ouvrir les détails">⋯</button>
          <button onClick={() => { if (!confirm("Supprimer ?")) return; onDelete(p.id); }} className="text-slate-300 hover:text-red-500 transition-colors text-lg" title="Supprimer">×</button>
        </div>
      </td>
    </tr>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

interface Filters {
  statut: Statut | "Tous"; secteur: Secteur | "Tous";
  dcFrom: string; dcTo: string; prFrom: string; prTo: string;
  chaudsOnly: boolean;
  sansKlaviyoOnly: boolean;
  caMin: number;
}
const EMPTY_FILTERS: Filters = {
  statut: "Tous", secteur: "Tous",
  dcFrom: "", dcTo: "", prFrom: "", prTo: "",
  chaudsOnly: false, sansKlaviyoOnly: false, caMin: 0,
};

function applyFilters(
  prospects: Prospect[],
  f: Filters,
  enrichments: Record<string, EnrichmentData>
): Prospect[] {
  return prospects.filter((p) => {
    if (f.statut  !== "Tous" && p.statut  !== f.statut)  return false;
    if (f.secteur !== "Tous" && p.secteur !== f.secteur) return false;
    if (f.dcFrom && (p.dernierContact   ?? "") < f.dcFrom) return false;
    if (f.dcTo   && (p.dernierContact   ?? "") > f.dcTo)   return false;
    if (f.prFrom && (p.prochaineRelance ?? "") < f.prFrom) return false;
    if (f.prTo   && (p.prochaineRelance ?? "") > f.prTo)   return false;
    if (f.chaudsOnly && !(p.ouverturesMultiples && p.enConversation)) return false;
    if (f.sansKlaviyoOnly && enrichments[p.id]?.klaviyoDetected !== false) return false;
    if (f.caMin > 0 && (p.annualRevenue ?? 0) < f.caMin) return false;
    return true;
  });
}

// ── EnrichCell ─────────────────────────────────────────────────────────────────

type ScanSt = "scanning" | "done" | "failed";

function EnrichCell({
  enrichment, scanStatus, type, onScan,
}: {
  enrichment: EnrichmentData | null;
  scanStatus: ScanSt | undefined;
  type: "shopify" | "klaviyo" | "instagram";
  onScan: () => void;
}) {
  if (scanStatus === "scanning") {
    return <span className="text-yellow-400 text-xs animate-spin inline-block">⟳</span>;
  }
  if (enrichment) {
    if (type === "shopify") {
      return <span className="text-sm" title={enrichment.platform}>{enrichment.shopifyDetected ? "🛍✅" : "🛍❌"}</span>;
    }
    if (type === "klaviyo") {
      return <span className="text-sm" title={enrichment.klaviyo}>{enrichment.klaviyoDetected ? "⚡✅" : "⚡❌"}</span>;
    }
    // instagram
    return enrichment.instagram && enrichment.instagram !== "Non disponible"
      ? <span className="text-xs text-slate-600 truncate block max-w-[120px]" title={enrichment.instagram}>{enrichment.instagram}</span>
      : <span className="text-slate-300 text-xs">—</span>;
  }
  if (scanStatus === "failed") {
    return (
      <button onClick={onScan} title="Réessayer" className="text-red-400 hover:text-red-500 text-xs font-bold">!</button>
    );
  }
  // Not yet scanned
  return (
    <button
      onClick={onScan}
      title="Scanner"
      className="group text-slate-200 hover:text-blue-400 transition-colors text-xs"
    >
      <span className="group-hover:hidden">●</span>
      <span className="hidden group-hover:inline">⟳</span>
    </button>
  );
}

// ── Bulk bar ──────────────────────────────────────────────────────────────────

function BulkBar({
  selectedIds, onClear, onBulkStatut, onBulkSecteur, onBulkDone, onBulkDelete,
}: {
  selectedIds: Set<string>; onClear: () => void;
  onBulkStatut: (s: Statut) => void; onBulkSecteur: (s: Secteur) => void;
  onBulkDone: () => void; onBulkDelete: () => void;
}) {
  const n = selectedIds.size;
  if (n === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-600 text-white rounded-xl px-4 py-2.5 mb-3 shadow-lg">
      <span className="font-semibold text-sm">{n} sélectionné{n > 1 ? "s" : ""}</span>
      <span className="text-blue-400 text-xs">|</span>
      <label className="text-xs font-medium">Statut :</label>
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onBulkStatut(e.target.value as Statut); e.target.value = ""; } }} className="text-sm text-slate-800 bg-white rounded-lg px-2 py-1 border-0 focus:outline-none">
        <option value="">— changer —</option>
        {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="text-xs font-medium">Secteur :</label>
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onBulkSecteur(e.target.value as Secteur); e.target.value = ""; } }} className="text-sm text-slate-800 bg-white rounded-lg px-2 py-1 border-0 focus:outline-none">
        <option value="">— changer —</option>
        {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={onBulkDone} className="text-sm bg-green-500 hover:bg-green-400 px-3 py-1 rounded-lg transition-colors">✓ Relance faite</button>
      <button onClick={() => { if (!confirm(`Supprimer ${n} ?`)) return; onBulkDelete(); }} className="text-sm bg-red-500 hover:bg-red-400 px-3 py-1 rounded-lg transition-colors">🗑 Supprimer</button>
      <button onClick={onClear} className="ml-auto text-blue-200 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}

// ── ColumnPicker ──────────────────────────────────────────────────────────────

function ColumnPicker({
  colOrder, colVisible, onChange,
}: {
  colOrder: ColId[];
  colVisible: Set<ColId>;
  onChange: (order: ColId[], visible: Set<ColId>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState<ColId | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragSrc = useRef<ColId | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }

  function toggleVisible(id: ColId) {
    const next = new Set(colVisible);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(colOrder, next);
  }

  function handleDragStart(id: ColId) { dragSrc.current = id; }
  function handleDragOver(e: React.DragEvent, id: ColId) { e.preventDefault(); setDragOver(id); }
  function handleDrop(e: React.DragEvent, targetId: ColId) {
    e.preventDefault();
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) { setDragOver(null); return; }
    const next = [...colOrder];
    const from = next.indexOf(srcId);
    const to   = next.indexOf(targetId);
    next.splice(from, 1);
    next.splice(to, 0, srcId);
    setDragOver(null);
    dragSrc.current = null;
    onChange(next, colVisible);
  }

  const visibleCount = colOrder.filter((id) => colVisible.has(id)).length;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5"
      >
        Colonnes ⚙
        <span className="bg-slate-200 text-slate-600 text-xs rounded-full px-1.5 py-0.5 font-medium">
          {visibleCount + 1}
        </span>
      </button>

      {open && mounted && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-64"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Colonnes visibles</p>

          {/* Frozen Marque */}
          <div className="flex items-center gap-2 py-1.5 opacity-50 cursor-not-allowed select-none">
            <span className="text-slate-300 text-xs">⠿</span>
            <input type="checkbox" checked readOnly className="w-3.5 h-3.5" />
            <span className="text-sm text-slate-700">Marque</span>
            <span className="ml-auto text-xs text-slate-400">figée</span>
          </div>

          {colOrder.map((id) => {
            const def = ALL_COLS.find((c) => c.id === id)!;
            const isOver = dragOver === id;
            return (
              <div
                key={id}
                draggable
                onDragStart={() => handleDragStart(id)}
                onDragOver={(e) => handleDragOver(e, id)}
                onDrop={(e) => handleDrop(e, id)}
                onDragLeave={() => setDragOver(null)}
                className={`flex items-center gap-2 py-1.5 cursor-grab rounded px-1 transition-colors ${isOver ? "bg-blue-50 border-l-2 border-blue-400" : "hover:bg-slate-50"}`}
              >
                <span className="text-slate-300 text-xs select-none">⠿</span>
                <input
                  type="checkbox"
                  checked={colVisible.has(id)}
                  onChange={() => toggleVisible(id)}
                  className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                />
                <span className="text-sm text-slate-700 select-none flex-1">{def.label}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Prospect Drawer ───────────────────────────────────────────────────────────

function ProspectDrawer({ prospect: init, onClose, onContactFound }: { prospect: Prospect; onClose: () => void; onContactFound?: (msg: string) => void }) {
  const [tab, setTab]     = useState<"infos" | "emails" | "cold">("infos");
  const [p, setP]         = useState<Prospect>(init);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [coldCompose, setColdCompose] = useState<{ subject: string; body: string } | null>(null);
  const [drawerDisqualModal, setDrawerDisqualModal] = useState<{ newStatut: Statut; commit: (reason: string) => void } | null>(null);

  function handleSendViaGmail(subject: string, body: string) {
    setColdCompose({ subject, body });
    setTab("emails");
  }

  useEffect(() => {
    setEmails(getEmails(p.id));
  }, [p.id]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  function save<K extends keyof Prospect>(field: K, value: Prospect[K]) {
    const updated = withRelance({ ...p, [field]: value });
    setP(updated);
    updateProspect(updated);
  }

  function handleStatutChange(newStatut: Statut) {
    if (isDisqualified(newStatut) && !isDisqualified(p.statut)) {
      setDrawerDisqualModal({
        newStatut,
        commit: (reason) => {
          const updated = withRelance({ ...p, statut: newStatut, disqualReason: reason, disqualDate: today() });
          setP(updated);
          updateProspect(updated);
        },
      });
    } else {
      save("statut", newStatut);
    }
  }

  function saveStep(key: keyof ProspectSteps, entry: StepEntry) {
    const { steps, statut, dernierContact } = applyStepChange(p.steps, key, entry);
    const saved = withRelance({ ...p, steps, statut, dernierContact });
    setP(saved);
    updateProspect(saved);
  }

  function handleAfterSend() {
    // Auto-check next unchecked step
    const order = ["j0", "j5", "j12", "j21", "j35", "j60"] as const;
    const next = order.find((k) => !p.steps[k].done);
    if (next) saveStep(next, { done: true, date: today() });
    // Also update dernierContact
    save("dernierContact", today());
  }

  function handleReceivedDetected() {
    if (!p.enConversation) save("enConversation", true);
  }

  async function handleRefreshCA() {
    if (!p.marque && !p.website) return;
    try {
      const res = await fetch("/api/enrich-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: p.marque, domain: p.website, instagramHandle: p.instagramHandle }),
      });
      if (!res.ok) return;
      const d = await res.json() as { annualRevenue?: number | null; revenueSource?: string; revenueYear?: string; revenueRaw?: string };
      if (d.annualRevenue != null) {
        const updated = withRelance({
          ...p,
          annualRevenue: d.annualRevenue,
          revenueSource: (d.revenueSource ?? "") as Prospect["revenueSource"],
          revenueYear:   d.revenueYear ?? "",
          revenueRaw:    d.revenueRaw  ?? "",
        });
        setP(updated);
        updateProspect(updated);
      }
    } catch {}
  }

  function handleSyncFromGmail(sortedSentEmails: Array<{ date: string }>) {
    const count = Math.min(sortedSentEmails.length, STEP_ORDER.length);
    const newSteps = { ...p.steps };
    for (let i = 0; i < count; i++) {
      const key = STEP_ORDER[i];
      if (!newSteps[key].done) {
        newSteps[key] = { done: true, date: sortedSentEmails[i].date };
      }
    }
    // Derive statut + dernierContact from highest done step
    let statut: Statut = "À contacter";
    let dernierContact: string | null = null;
    for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
      if (newSteps[STEP_ORDER[i]].done) {
        statut = STEP_TO_STATUT[STEP_ORDER[i]];
        dernierContact = newSteps[STEP_ORDER[i]].date ?? today();
        break;
      }
    }
    const updated = withRelance({ ...p, steps: newSteps, statut, dernierContact });
    setP(updated);
    updateProspect(updated);
  }

  function handleApplyContact(result: { name: string; email: string; source: FoundersSource; confidence: FoundersConfidence }) {
    const updated = withRelance({
      ...p,
      contact:            result.name,
      email:              result.email || p.email,
      foundersName:       result.name,
      foundersEmail:      result.email,
      foundersSource:     result.source,
      foundersConfidence: result.confidence,
    });
    setP(updated);
    updateProspect(updated);
    onContactFound?.(`Contact appliqué : ${result.name}`);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[500px] max-w-[100vw] bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-slate-900 truncate">{p.marque || "Prospect"}</h2>
            {p.email && <p className="text-sm text-slate-500 mt-0.5 truncate">{p.email}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none ml-4 shrink-0 mt-0.5">×</button>
        </div>

        <div className="flex border-b border-slate-200 shrink-0">
          {(["infos", "emails", "cold"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "infos" ? "Infos" : t === "emails" ? `Emails (${emails.length})` : "Emails froids"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "infos"
            ? <InfosTab p={p} onSave={save} onSaveStep={saveStep} onApplyContact={handleApplyContact} onRefreshCA={handleRefreshCA} onStatutChange={handleStatutChange} />
            : tab === "emails"
            ? <EmailsTab prospect={p} emails={emails} onRefresh={() => setEmails(getEmails(p.id))} onAfterSend={handleAfterSend} onReceivedDetected={handleReceivedDetected} initialCompose={coldCompose} onConsumeCompose={() => setColdCompose(null)} onSyncFromGmail={handleSyncFromGmail} />
            : <ColdEmailTab prospect={p} onSendViaGmail={handleSendViaGmail} />}
        </div>
      </div>
      {drawerDisqualModal && (
        <DisqualModal
          newStatut={drawerDisqualModal.newStatut}
          onConfirm={(reason) => { drawerDisqualModal.commit(reason); setDrawerDisqualModal(null); }}
          onCancel={() => setDrawerDisqualModal(null)}
        />
      )}
    </>
  );
}

// ── InfosTab ──────────────────────────────────────────────────────────────────

type FieldScan = { field: "website" | "instagram"; status: "scanning" | "success" | "failed"; error?: string } | null;

function InfosTab({
  p, onSave, onSaveStep, onApplyContact, onRefreshCA, onStatutChange,
}: {
  p: Prospect;
  onSave: <K extends keyof Prospect>(f: K, v: Prospect[K]) => void;
  onSaveStep: (k: keyof ProspectSteps, e: StepEntry) => void;
  onApplyContact?: (result: { name: string; email: string; source: FoundersSource; confidence: FoundersConfidence }) => void;
  onRefreshCA?: () => Promise<void>;
  onStatutChange?: (s: Statut) => void;
}) {
  const pr          = p.prochaineRelance;
  const prColor     = relanceDateColor(pr);
  const noStepsDone = STEP_ORDER.every((k) => !p.steps[k].done);

  const [enrichData, setEnrichData] = useState<EnrichmentData | null>(() => getEnrichment(p.id));
  const [scan, setScan] = useState<FieldScan>(null);
  const [caRefreshing, setCaRefreshing] = useState(false);
  const [caRefreshed, setCaRefreshed] = useState(false);

  async function handleRefreshCA() {
    if (!onRefreshCA) return;
    setCaRefreshing(true);
    await onRefreshCA();
    setCaRefreshing(false);
    setCaRefreshed(true);
    setTimeout(() => setCaRefreshed(false), 2000);
  }

  async function reScan(field: "website" | "instagram", value: string) {
    if (!value.trim()) return;
    setScan({ field, status: "scanning" });
    try {
      const res = await fetch("/api/enrich-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          field === "website"
            ? { brandName: p.marque, domain: value, instagramHandle: p.instagramHandle }
            : { brandName: p.marque, domain: p.website, instagramHandle: value }
        ),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const d: EnrichmentData = await res.json();
      saveEnrichment(p.id, d);
      setEnrichData(d);
      setScan({ field, status: "success" });
      setTimeout(() => setScan(null), 2000);
    } catch {
      const msg = field === "website"
        ? "Scan échoué — vérifier le domaine"
        : "Scan échoué — vérifier le handle";
      setScan({ field, status: "failed", error: msg });
    }
  }

  function handleWebsiteSave(value: string) {
    onSave("website", value);
    reScan("website", value);
  }

  function handleInstagramSave(value: string) {
    const clean = value.replace(/^@/, "");
    onSave("instagramHandle", clean);
    reScan("instagram", clean);
  }

  function ScanFeedback({ field }: { field: "website" | "instagram" }) {
    if (!scan || scan.field !== field) return null;
    if (scan.status === "scanning") return (
      <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
        <span className="animate-spin inline-block">⟳</span> Analyse en cours…
      </p>
    );
    if (scan.status === "success") return <p className="text-xs text-green-600 mt-1">✅ Mis à jour</p>;
    return <p className="text-xs text-red-500 mt-1">⚠ {scan.error}</p>;
  }

  return (
    <div className="p-5 space-y-5">
      {p.ouverturesMultiples && p.enConversation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 font-medium">🔥 Prospect chaud</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <DField label="Marque">
          <input key={p.id + "-m"} type="text" defaultValue={p.marque} onBlur={(e) => onSave("marque", e.target.value)} className={DI} placeholder="Marque" />
        </DField>
        <DField label="Contact">
          <input key={p.id + "-c"} type="text" defaultValue={p.contact} onBlur={(e) => onSave("contact", e.target.value)} className={DI} placeholder="Nom" />
        </DField>
        <DField label="Email">
          <input key={p.id + "-e"} type="email" defaultValue={p.email} onBlur={(e) => onSave("email", e.target.value)} className={DI} placeholder="email@…" />
        </DField>
        <DField label="Gap CRM">
          <input key={p.id + "-g"} type="text" defaultValue={p.gapCrm} onBlur={(e) => onSave("gapCrm", e.target.value)} className={DI} placeholder="Réf." />
        </DField>
        <div>
          <DField
            label={
              <span className="flex items-center gap-1.5">
                Site web
                {scan?.field === "website" && scan.status === "scanning" && (
                  <span className="text-yellow-500 animate-spin text-xs">⟳</span>
                )}
                {scan?.field === "website" && scan.status === "success" && (
                  <span className="text-green-500 text-xs">✅</span>
                )}
              </span>
            }
          >
            <input
              key={p.id + "-w"}
              type="text"
              defaultValue={p.website}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== p.website) handleWebsiteSave(v); else if (v) onSave("website", v); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className={DI}
              placeholder="ex: maison-dore.com"
            />
          </DField>
          {scan?.field === "website" && scan.status === "failed" && (
            <p className="text-xs text-red-500 mt-1">⚠ {scan.error}</p>
          )}
        </div>
        <div>
          <DField
            label={
              <span className="flex items-center gap-1.5">
                Instagram
                {scan?.field === "instagram" && scan.status === "scanning" && (
                  <span className="text-yellow-500 animate-spin text-xs">⟳</span>
                )}
                {scan?.field === "instagram" && scan.status === "success" && (
                  <span className="text-green-500 text-xs">✅</span>
                )}
              </span>
            }
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">@</span>
              <input
                key={p.id + "-ig"}
                type="text"
                defaultValue={p.instagramHandle}
                onBlur={(e) => { const v = e.target.value.trim().replace(/^@/, ""); if (v !== p.instagramHandle) handleInstagramSave(v); else if (v) onSave("instagramHandle", v); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className={`${DI} pl-7`}
                placeholder="handle"
              />
            </div>
          </DField>
          {scan?.field === "instagram" && scan.status === "failed" && (
            <p className="text-xs text-red-500 mt-1">⚠ {scan.error}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DField label="Statut">
          <select value={p.statut} onChange={(e) => (onStatutChange ?? ((s: Statut) => onSave("statut", s)))(e.target.value as Statut)} className={DI}>
            {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </DField>
        <DField label="Secteur">
          <select value={p.secteur} onChange={(e) => onSave("secteur", e.target.value as Secteur)} className={DI}>
            {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </DField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DField label="Dernier contact">
          <input type="date" value={p.dernierContact ?? ""} onChange={(e) => onSave("dernierContact", e.target.value || null)} className={DI} />
        </DField>
        <DField label="Prochaine relance">
          <div className={`flex items-center h-[38px] px-3 text-sm font-medium rounded-lg bg-slate-50 border border-slate-200 ${noStepsDone ? "text-orange-500" : prColor}`}>
            {noStepsDone
              ? "⚠ À contacter"
              : pr === null
                ? (p.statut === "Relance J+60" ? "✅ Séquence terminée" : "—")
                : `${prColor === "text-red-600" ? "⚠ " : ""}${formatDateFR(pr)}`}
          </div>
        </DField>
      </div>

      <DField label="Notes">
        <textarea key={p.id + "-n"} defaultValue={p.notes} onBlur={(e) => onSave("notes", e.target.value)} rows={3} className={`${DI} resize-none`} placeholder="Notes…" />
      </DField>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
          <input type="checkbox" checked={p.ouverturesMultiples} onChange={(e) => onSave("ouverturesMultiples", e.target.checked)} className="w-4 h-4 accent-orange-500" />
          Ouvertures multiples
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
          <input type="checkbox" checked={p.enConversation} onChange={(e) => onSave("enConversation", e.target.checked)} className="w-4 h-4 accent-green-500" />
          En conversation
        </label>
      </div>

      {onRefreshCA && (
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">
            CA
            {p.annualRevenue != null && (
              <span className="ml-2 font-normal normal-case text-slate-600">
                {p.annualRevenue >= 1_000_000
                  ? `${(p.annualRevenue / 1_000_000).toFixed(1).replace(".", ",")} M€`
                  : `${(p.annualRevenue / 1_000).toFixed(0)} K€`}
                {p.revenueSource && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${p.revenueSource === "estimé" ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"}`}>
                    {p.revenueSource === "estimé" ? "estimé" : p.revenueSource}
                  </span>
                )}
              </span>
            )}
          </p>
          <button
            onClick={handleRefreshCA}
            disabled={caRefreshing}
            className="text-xs px-2.5 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {caRefreshing ? <span className="animate-spin inline-block">⟳</span> : caRefreshed ? "✓ Mis à jour" : "↻ Actualiser le CA"}
          </button>
        </div>
      )}

      <EnrichmentPanel prospect={p} externalData={enrichData} />

      {onApplyContact && (
        <ContactFinderPanel prospect={p} onApply={onApplyContact} />
      )}

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Séquence de relance</p>
        <div className="space-y-2">
          {STEP_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-10 shrink-0 font-medium">{label}</span>
              <input
                type="checkbox"
                checked={p.steps[key].done}
                onChange={(e) => {
                  const done = e.target.checked;
                  onSaveStep(key, { done, date: done ? (p.steps[key].date ?? today()) : p.steps[key].date });
                }}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              {p.steps[key].done && (
                <input
                  type="date"
                  value={p.steps[key].date ?? ""}
                  onChange={(e) => onSaveStep(key, { ...p.steps[key], date: e.target.value || null })}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EmailsTab (Gmail + localStorage) ─────────────────────────────────────────

const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function formatDateLong(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const mi = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${MONTHS_FR[mi] ?? m} ${y}`;
}

interface GmailStatus { connected: boolean; email: string }

interface GmailSyncProposal {
  sentCount: number;
  sortedSentEmails: Array<{ date: string }>;
}

function EmailsTab({
  prospect, emails, onRefresh, onAfterSend, onReceivedDetected, initialCompose, onConsumeCompose, onSyncFromGmail,
}: {
  prospect: Prospect;
  emails: EmailRecord[];
  onRefresh: () => void;
  onAfterSend: () => void;
  onReceivedDetected: () => void;
  initialCompose?: { subject: string; body: string } | null;
  onConsumeCompose?: () => void;
  onSyncFromGmail?: (sortedSentEmails: Array<{ date: string }>) => void;
}) {
  const [mode, setMode]               = useState<"idle" | "compose" | "received">("idle");
  const [compose, setCompose]         = useState({ subject: "", body: "" });
  const [received, setReceived]       = useState({ date: today(), subject: "", body: "" });
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailMsgs, setGmailMsgs]     = useState<GmailMsg[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [emailFilter, setEmailFilter] = useState<"tous" | "envoyés" | "reçus">("tous");
  const [sending, setSending]         = useState(false);
  const [sendError, setSendError]     = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [syncProposal, setSyncProposal] = useState<GmailSyncProposal | null>(null);

  // Pre-fill compose when triggered from cold email tab
  useEffect(() => {
    if (initialCompose) {
      setCompose({ subject: initialCompose.subject, body: initialCompose.body });
      setMode("compose");
      onConsumeCompose?.();
    }
  }, [initialCompose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check Gmail connection
  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d: GmailStatus) => setGmailStatus(d))
      .catch(() => setGmailStatus({ connected: false, email: "" }));
  }, []);

  function fetchGmailThreads() {
    if (!gmailStatus?.connected || !prospect.email) return;
    setGmailLoading(true);
    setSyncProposal(null);
    const params = new URLSearchParams({ email: prospect.email });
    if (prospect.marque) params.set("brand", prospect.marque);
    if (prospect.foundersName) params.set("contact", prospect.foundersName);
    else if (prospect.contact) params.set("contact", prospect.contact);
    fetch(`/api/gmail/threads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const msgs: GmailMsg[] = d.messages ?? [];
        setGmailMsgs(msgs);
        if (msgs.some((m) => m.direction === "reçu")) onReceivedDetected();
        // Compute sync proposal from sent emails
        if (onSyncFromGmail) {
          const sortedSent = msgs
            .filter((m) => m.direction === "envoyé")
            .sort((a, b) => a.date.localeCompare(b.date));
          if (sortedSent.length > 0) {
            // Only propose if at least one step would be newly checked
            const wouldChange = sortedSent.some(
              (_, i) => i < STEP_ORDER.length && !prospect.steps[STEP_ORDER[i]].done
            );
            if (wouldChange) {
              setSyncProposal({ sentCount: sortedSent.length, sortedSentEmails: sortedSent });
            }
          }
        }
      })
      .catch(() => setGmailMsgs([]))
      .finally(() => setGmailLoading(false));
  }

  // Fetch Gmail threads when connected + email set
  useEffect(() => {
    fetchGmailThreads();
  }, [gmailStatus, prospect.email]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    setSendError("");
    setSending(true);
    try {
      if (gmailStatus?.connected) {
        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: prospect.email, subject: compose.subject, body: compose.body }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail ?? d.error ?? "Erreur d'envoi Gmail");
        }
      } else {
        // Fallback: open mailto
        if (prospect.email) {
          window.open(`mailto:${prospect.email}?subject=${encodeURIComponent(compose.subject)}&body=${encodeURIComponent(compose.body)}`, "_blank");
        }
      }
      // Save to localStorage log
      saveEmailRecord(prospect.id, {
        id: crypto.randomUUID(),
        date: today(),
        subject: compose.subject,
        body: compose.body,
        direction: "envoyé",
      });
      onRefresh();
      onAfterSend(); // auto-check next step + dernierContact
      setMode("idle");
      setCompose({ subject: "", body: "" });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur d'envoi.");
    } finally {
      setSending(false);
    }
  }

  function handleLogReceived() {
    saveEmailRecord(prospect.id, {
      id: crypto.randomUUID(),
      date: received.date || today(),
      subject: received.subject,
      body: received.body,
      direction: "reçu",
    });
    onRefresh();
    onReceivedDetected();
    setMode("idle");
    setReceived({ date: today(), subject: "", body: "" });
  }

  // Merge Gmail + localStorage
  const allEmails: Array<{ key: string; date: string; subject: string; snippet: string; body: string; direction: "envoyé" | "reçu"; source: "gmail" | "local"; matchType?: MatchType }> = [
    ...gmailMsgs.map((m) => ({ key: "g_" + m.id, date: m.date, subject: m.subject, snippet: m.snippet, body: m.body, direction: m.direction, source: "gmail" as const, matchType: m.matchType })),
    ...emails.map((e)   => ({ key: "l_" + e.id,  date: e.date, subject: e.subject, snippet: e.body,    body: e.body, direction: e.direction, source: "local" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredEmails = emailFilter === "tous" ? allEmails
    : allEmails.filter((e) => e.direction === (emailFilter === "envoyés" ? "envoyé" : "reçu"));

  return (
    <div className="p-5 space-y-4">
      {/* Gmail status banner */}
      {gmailStatus && !gmailStatus.connected && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-500">Gmail non connecté — les échanges réels ne sont pas visibles.</p>
          <a href="/settings" className="text-xs font-medium text-blue-600 hover:underline shrink-0 ml-3">Connecter Gmail →</a>
        </div>
      )}
      {gmailStatus?.connected && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Gmail connecté · {gmailStatus.email}
          </div>
          <button
            onClick={fetchGmailThreads}
            disabled={gmailLoading}
            className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            {gmailLoading ? "…" : "Rafraîchir"}
          </button>
        </div>
      )}

      {/* Gmail sync proposal banner */}
      {syncProposal && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2.5">
          <p className="text-sm text-blue-800 font-medium">
            📧 {syncProposal.sentCount} email{syncProposal.sentCount > 1 ? "s" : ""} envoyé{syncProposal.sentCount > 1 ? "s" : ""} trouvé{syncProposal.sentCount > 1 ? "s" : ""} avec ce contact.
          </p>
          <p className="text-xs text-blue-600">
            Mettre à jour les étapes de relance automatiquement ?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSyncFromGmail!(syncProposal.sortedSentEmails);
                setSyncProposal(null);
              }}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Oui, mettre à jour
            </button>
            <button
              onClick={() => setSyncProposal(null)}
              className="text-xs px-3 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Non merci
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {mode === "idle" && (
        <div className="flex gap-2">
          <button onClick={() => setMode("compose")} className={DBTN1}>✉ Rédiger un email</button>
          <button onClick={() => setMode("received")} className={DBTN2}>+ Enregistrer un reçu</button>
        </div>
      )}

      {/* Compose */}
      {mode === "compose" && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-800">Rédiger un email</p>
            <button onClick={() => { setMode("idle"); setSendError(""); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
          </div>
          <p className="text-xs text-slate-500">
            À : <span className="font-medium text-slate-700">{prospect.email || <em>email non renseigné</em>}</span>
            {gmailStatus?.connected && <span className="ml-2 text-green-600 text-xs">via Gmail</span>}
          </p>
          <input type="text" placeholder="Objet" value={compose.subject} onChange={(e) => setCompose((d) => ({ ...d, subject: e.target.value }))} className={DI} />
          <textarea placeholder="Corps du message…" value={compose.body} onChange={(e) => setCompose((d) => ({ ...d, body: e.target.value }))} rows={5} className={`${DI} resize-none`} />
          {sendError && (
            <div className="flex items-start justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600 flex-1">{sendError}</p>
              <button
                onClick={() => { setSendError(""); handleSend(); }}
                className="text-xs font-medium text-red-600 hover:text-red-800 shrink-0 underline"
              >
                Réessayer
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={sending} className={`${DBTN1} disabled:opacity-60`}>
              {sending ? "Envoi…" : gmailStatus?.connected ? "Envoyer via Gmail →" : "Envoyer via messagerie →"}
            </button>
            <button onClick={() => { setMode("idle"); setSendError(""); }} className={DBTN2}>Annuler</button>
          </div>
        </div>
      )}

      {/* Log received */}
      {mode === "received" && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-800">Enregistrer une réponse reçue</p>
            <button onClick={() => setMode("idle")} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Date">
              <input type="date" value={received.date} onChange={(e) => setReceived((d) => ({ ...d, date: e.target.value }))} className={DI} />
            </DField>
            <DField label="Objet (optionnel)">
              <input type="text" placeholder="Objet" value={received.subject} onChange={(e) => setReceived((d) => ({ ...d, subject: e.target.value }))} className={DI} />
            </DField>
          </div>
          <textarea placeholder="Extrait du message…" value={received.body} onChange={(e) => setReceived((d) => ({ ...d, body: e.target.value }))} rows={3} className={`${DI} resize-none`} />
          <div className="flex gap-2">
            <button onClick={handleLogReceived} className={DBTN1}>Enregistrer</button>
            <button onClick={() => setMode("idle")} className={DBTN2}>Annuler</button>
          </div>
        </div>
      )}

      {/* Email list */}
      {gmailLoading && (
        <p className="text-sm text-slate-400 text-center py-6">Chargement des échanges Gmail…</p>
      )}

      {!gmailLoading && gmailStatus?.connected && !prospect.email && (
        <p className="text-xs text-slate-400 text-center py-4">Renseignez l&apos;email du prospect pour voir ses échanges.</p>
      )}

      {!gmailLoading && gmailStatus?.connected && prospect.email && allEmails.filter(e => e.source === "gmail").length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">Aucun échange trouvé avec cette marque ou ce contact.</p>
      )}

      {!gmailLoading && allEmails.length === 0 && !gmailStatus?.connected && (
        <p className="text-sm text-slate-400 text-center py-8">Aucun email enregistré.</p>
      )}

      {!gmailLoading && allEmails.length > 0 && (
        <>
          {/* Filter bar + count */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["tous", "envoyés", "reçus"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setEmailFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${
                    emailFilter === f
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              {filteredEmails.length} échange{filteredEmails.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2">
            {filteredEmails.map((email) => {
              const isExpanded = expandedKeys.has(email.key);
              const hasBody = email.body && email.body.trim().length > 0;
              const matchBadge = email.source === "gmail" && email.matchType ? {
                direct:  { label: "Email direct",  cls: "bg-blue-100 text-blue-700" },
                domain:  { label: "Même domaine",  cls: "bg-purple-100 text-purple-700" },
                contact: { label: "Nom contact",   cls: "bg-orange-100 text-orange-700" },
                brand:   { label: "Nom marque",    cls: "bg-slate-100 text-slate-600" },
              }[email.matchType] : null;
              return (
                <div
                  key={email.key}
                  className={`rounded-xl border ${
                    email.direction === "envoyé" ? "border-blue-100 bg-blue-50" : "border-green-100 bg-green-50"
                  }`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            email.direction === "envoyé" ? "bg-blue-200 text-blue-800" : "bg-green-200 text-green-800"
                          }`}>
                            {email.direction === "envoyé" ? "Envoyé →" : "← Reçu"}
                          </span>
                          <span className="text-xs text-slate-500">{formatDateLong(email.date)}</span>
                          {matchBadge && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${matchBadge.cls}`}>
                              {matchBadge.label}
                            </span>
                          )}
                        </div>
                        {email.subject && (
                          <p className="text-sm font-semibold text-slate-800 mb-1">{email.subject}</p>
                        )}
                        {!isExpanded && email.snippet && (
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{email.snippet}</p>
                        )}
                        {isExpanded && hasBody && (
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed mt-1 max-h-64 overflow-y-auto">{email.body}</pre>
                        )}
                      </div>
                      {email.source === "local" && (
                        <button
                          onClick={() => { deleteEmailRecord(prospect.id, email.key.slice(2)); onRefresh(); }}
                          className="text-slate-300 hover:text-red-400 text-lg leading-none shrink-0"
                          title="Supprimer"
                        >×</button>
                      )}
                    </div>
                    {hasBody && (
                      <button
                        onClick={() => setExpandedKeys((prev) => {
                          const n = new Set(prev);
                          n.has(email.key) ? n.delete(email.key) : n.add(email.key);
                          return n;
                        })}
                        className="mt-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isExpanded ? "▲ Réduire" : "▼ Voir le message complet"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProspectsTable() {
  const { prospects, setProspects, reload, addOne, deleteOne } = useProspects();
  const [filters, setFilters]             = useState<Filters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [newRowId, setNewRowId]           = useState<string | null>(null);
  const [drawerProspectId, setDrawerProspectId] = useState<string | null>(null);
  const [enrichments, setEnrichments]     = useState<Record<string, EnrichmentData>>({});
  const [scanStatus, setScanStatus]       = useState<Record<string, ScanSt>>({});
  const [scanProgress, setScanProgress]   = useState<{ done: number; total: number } | null>(null);
  const [toasts, setToasts]               = useState<Array<{ id: string; message: string }>>([]);
  const [mounted, setMounted]             = useState(false);
  const [sortCol, setSortCol]             = useState<SortCol | null>(null);
  const [sortDir, setSortDir]             = useState<SortDir>("asc");
  const [colOrder, setColOrder]           = useState<ColId[]>(() => ALL_COLS.map((c) => c.id));
  const [colVisible, setColVisible]       = useState<Set<ColId>>(() => new Set(ALL_COLS.filter((c) => c.defaultVisible).map((c) => c.id)));
  const [caThreshold, setCaThreshold]     = useState(150000);
  const [disqualModal, setDisqualModal] = useState<{ newStatut: Statut; commit: (reason: string) => void } | null>(null);
  const [showDisqual, setShowDisqual]   = useState(false);
  const [csvPreview, setCsvPreview]     = useState<CsvPreviewState | null>(null);
  const [manualDupModal, setManualDupModal] = useState<{ match: DuplicateMatch; prospectId: string } | null>(null);
  const [manualDupBanner, setManualDupBanner] = useState<{ match: DuplicateMatch; prospectId: string } | null>(null);
  const [duplicateRowIds, setDuplicateRowIds] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  // Load column prefs + CA threshold from localStorage (client-side only)
  useEffect(() => {
    const prefs = loadColPrefs();
    setColOrder(prefs.order);
    setColVisible(new Set(prefs.visible));
    setCaThreshold(getCaThreshold());
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // Auto-open drawer when navigated via command palette (?drawer=<id>)
  useEffect(() => {
    const id = searchParams.get("drawer");
    if (id) setDrawerProspectId(id);
  }, [searchParams]);

  // Load enrichments from localStorage
  useEffect(() => {
    setEnrichments(getAllEnrichments());
  }, [prospects]);

  // ── Toast ───────────────────────────────────────────────────────────────────

  function showToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // ── Background contact finder ────────────────────────────────────────────────

  async function findContactBackground(p: Prospect, domain: string) {
    if (!domain || p.foundersName) return;
    try {
      const res = await fetch("/api/find-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.name) return;
      const updated = withRelance({
        ...p,
        foundersName:       data.name,
        foundersEmail:      data.email ?? "",
        foundersSource:     data.source as FoundersSource,
        foundersConfidence: data.confidence as FoundersConfidence,
      });
      updateProspect(updated);
      reload();
      showToast(`Contact trouvé pour ${p.marque} : ${data.name} 🎯`);
    } catch {}
  }

  // ── Enrichment functions ────────────────────────────────────────────────────

  async function enrichOne(p: Prospect): Promise<void> {
    if (!p.marque.trim()) return;
    setScanStatus((prev) => ({ ...prev, [p.id]: "scanning" }));
    try {
      const res = await fetch("/api/enrich-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: p.marque,
          domain: p.website,
          instagramHandle: p.instagramHandle,
        }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json() as EnrichmentData & {
        annualRevenue?: number | null;
        revenueSource?: string;
        revenueYear?: string;
        revenueRaw?: string;
      };
      saveEnrichment(p.id, d);

      // Persist auto-found website / instagram / CA back to prospect
      let changed = false;
      let updated = { ...p };
      if (d.websiteFound && !p.website)         { updated = { ...updated, website: d.websiteFound };                 changed = true; }
      if (d.instagramHandleFound && !p.instagramHandle) { updated = { ...updated, instagramHandle: d.instagramHandleFound }; changed = true; }
      if (d.annualRevenue != null && !p.annualRevenue) {
        updated = {
          ...updated,
          annualRevenue: d.annualRevenue,
          revenueSource: (d.revenueSource ?? "") as Prospect["revenueSource"],
          revenueYear:   d.revenueYear ?? "",
          revenueRaw:    d.revenueRaw  ?? "",
        };
        changed = true;
      }
      if (changed) { updateProspect(updated); reload(); }

      setEnrichments((prev) => ({ ...prev, [p.id]: d }));
      setScanStatus((prev) => ({ ...prev, [p.id]: "done" }));

      // Auto-find contact if domain found and no founders data yet
      const domain = d.websiteFound || updated.website;
      if (domain && !updated.foundersName) {
        findContactBackground(updated, domain).catch(() => {});
      }
    } catch {
      setScanStatus((prev) => ({ ...prev, [p.id]: "failed" }));
    }
  }

  async function handleScanAll() {
    const toScan = prospects.filter((p) => !enrichments[p.id] && p.marque.trim());
    if (!toScan.length) return;
    setScanProgress({ done: 0, total: toScan.length });
    for (let i = 0; i < toScan.length; i++) {
      await enrichOne(toScan[i]);
      setScanProgress({ done: i + 1, total: toScan.length });
    }
    setScanProgress(null);
    // Report CA count after reload
    setTimeout(() => {
      const allP = prospects;
      const caFound = allP.filter((p) => p.annualRevenue != null).length;
      if (caFound > 0) showToast(`CA trouvé pour ${caFound} prospect${caFound > 1 ? "s" : ""}`);
    }, 500);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function handleColChange(order: ColId[], visible: Set<ColId>) {
    setColOrder(order);
    setColVisible(visible);
    saveColPrefs(order, Array.from(visible));
  }

  const filtered        = applyFilters(prospects, filters, enrichments);
  const allSorted       = sortProspects(filtered, sortCol, sortDir, enrichments);
  const visible         = allSorted.filter((p) => !isDisqualified(p.statut));
  const disqualVisible  = allSorted.filter((p) => isDisqualified(p.statut));
  const hasFilters = filters.statut !== "Tous" || filters.secteur !== "Tous" ||
    filters.dcFrom || filters.dcTo || filters.prFrom || filters.prTo ||
    filters.chaudsOnly || filters.sansKlaviyoOnly || filters.caMin > 0;

  const drawerProspect = drawerProspectId
    ? (prospects.find((p) => p.id === drawerProspectId) ?? null)
    : null;

  function handleCloseDrawer() {
    setDrawerProspectId(null);
    reload();
    setEnrichments(getAllEnrichments());
  }

  function handleRequestDisqual(_prospect: Prospect, newStatut: Statut, commit: (reason: string) => void) {
    setDisqualModal({ newStatut, commit });
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === visible.length && visible.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((p) => p.id)));
  }
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  // ── Bulk ───────────────────────────────────────────────────────────────────

  function handleBulkStatut(statut: Statut) {
    saveProspects(prospects.map((p) => selectedIds.has(p.id) ? withRelance({ ...p, statut }) : p));
    reload(); setSelectedIds(new Set());
  }
  function handleBulkSecteur(secteur: Secteur) {
    saveProspects(prospects.map((p) => selectedIds.has(p.id) ? { ...p, secteur } : p));
    reload(); setSelectedIds(new Set());
  }
  function handleBulkDone() {
    const t = today();
    saveProspects(prospects.map((p) => {
      if (!selectedIds.has(p.id)) return p;
      const steps = { ...p.steps };
      for (const k of ["j0", "j5", "j12", "j21", "j35", "j60"] as const) {
        if (!steps[k].done) { steps[k] = { done: true, date: t }; break; }
      }
      return withRelance({ ...p, steps, relanceFaite: true, dernierContact: t });
    }));
    reload(); setSelectedIds(new Set());
  }
  function handleBulkDelete() {
    saveProspects(prospects.filter((p) => !selectedIds.has(p.id)));
    reload(); setSelectedIds(new Set());
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  // Called by ProspectRow when the new row's marque or email is saved
  function handleManualDupCheck(prospectId: string, field: "marque" | "email", value: string) {
    if (!value.trim()) return;
    const currentP = prospects.find((p) => p.id === prospectId);
    if (!currentP) return;
    const data: NewProspectData = {
      marque:  field === "marque" ? value : currentP.marque,
      email:   field === "email"  ? value : currentP.email,
      website: currentP.website,
      contact: currentP.contact,
    };
    // Exclude itself from check
    const others = prospects.filter((p) => p.id !== prospectId);
    const matches = findDuplicates(data, others);
    if (!matches.length) return;
    // Prioritise disqualified match
    const disqualMatch = matches.find((m) => m.isDisqualified);
    if (disqualMatch) {
      setManualDupModal({ match: disqualMatch, prospectId });
    } else {
      setManualDupBanner({ match: matches[0], prospectId });
    }
  }

  function addProspectFromRow(row: Record<string, string>) {
    const rawStatut  = (row["Statut"]  || "À contacter").trim() as Statut;
    const rawSecteur = (row["Secteur"] || "Autre").trim() as Secteur;
    addOne({
      marque:          row["Marque"] || row["marque"] || "",
      secteur:         SECTEURS.includes(rawSecteur) ? rawSecteur : "Autre",
      contact:         row["Contact"] || "",
      email:           row["Email"]   || "",
      gapCrm:          row["Gap CRM"] || "",
      website:         row["Website"] || "",
      instagramHandle: row["Instagram"] || "",
      foundersName: "", foundersEmail: "", foundersSource: "", foundersConfidence: "",
      annualRevenue: null, revenueSource: "", revenueYear: "", revenueRaw: "",
      disqualReason: "", disqualDate: null,
      statut:          STATUTS.includes(rawStatut) ? rawStatut : "À contacter",
      notes:           row["Notes"] || "",
      steps:           emptySteps(),
      ouverturesMultiples: false, enConversation: false,
      dernierContact:  row["Dernier contact"] || null,
      relanceFaite:    false,
    });
  }

  function applyCSVImport(preview: CsvPreviewState) {
    // Import clean rows
    preview.cleanRows.forEach((row) => addProspectFromRow(row));
    // Apply duplicate decisions
    preview.dupRows.forEach((dr) => {
      if (dr.decision === "reactivate") {
        const ex = dr.match.prospect;
        const note = ex.notes ? ex.notes + `\nRéactivé le ${today()}` : `Réactivé le ${today()}`;
        updateProspect(withRelance({ ...ex, statut: "À contacter", disqualReason: "", disqualDate: null, notes: note }));
      } else if (dr.decision === "create") {
        addProspectFromRow(dr.csvRow);
      }
      // "skip" → do nothing
    });
    const count = preview.cleanRows.length + preview.dupRows.filter((r) => r.decision === "create" || r.decision === "reactivate").length;
    reload();
    setCsvPreview(null);
    showToast(`${count} prospect${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}.`);
  }

  function handleAdd() {
    const np = addOne({
      marque: "", secteur: "Autre", contact: "", email: "",
      website: "", instagramHandle: "", gapCrm: "",
      statut: "À contacter", notes: "", steps: emptySteps(),
      ouverturesMultiples: false, enConversation: false,
      dernierContact: null, relanceFaite: false,
      foundersName: "", foundersEmail: "", foundersSource: "", foundersConfidence: "",
      annualRevenue: null, revenueSource: "", revenueYear: "", revenueRaw: "",
      disqualReason: "", disqualDate: null,
    });
    setNewRowId(np.id);
    setTimeout(() => enrichOne(np), 2000);
  }

  function handleDelete(id: string) {
    deleteOne(id);
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setDuplicateRowIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      const cleanRows: Record<string, string>[] = [];
      const dupRows: CsvDupRow[] = [];

      rows.forEach((row) => {
        const marque = row["Marque"] || row["marque"] || "";
        if (!marque.trim()) return;
        const data: NewProspectData = {
          marque,
          email:   row["Email"]   || "",
          website: row["Website"] || "",
          contact: row["Contact"] || "",
        };
        const matches = findDuplicates(data, prospects);
        if (matches.length > 0) {
          // Use disqual match first, else first active match
          const match = matches.find((m) => m.isDisqualified) ?? matches[0];
          dupRows.push({ csvRow: row, match, decision: "skip" });
        } else {
          cleanRows.push(row);
        }
      });

      if (dupRows.length === 0 && cleanRows.length > 0) {
        // No duplicates — import directly
        cleanRows.forEach((row) => addProspectFromRow(row));
        reload();
        showToast(`${cleanRows.length} prospect${cleanRows.length > 1 ? "s" : ""} importé${cleanRows.length > 1 ? "s" : ""}.`);
      } else {
        setCsvPreview({ cleanRows, dupRows });
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <>
      {/* ── Filter bar (sticky) ── */}
      <div className="sticky top-0 z-20 bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-3">
        <div className="flex flex-wrap gap-2 items-end">
          <Fld label="Statut">
            <select value={filters.statut} onChange={(e) => setFilter("statut", e.target.value as Statut | "Tous")} className={SEL}>
              <option value="Tous">Tous</option>
              {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Fld>
          <Fld label="Secteur">
            <select value={filters.secteur} onChange={(e) => setFilter("secteur", e.target.value as Secteur | "Tous")} className={SEL}>
              <option value="Tous">Tous</option>
              {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Fld>
          <Fld label="Dernier contact">
            <div className="flex items-center gap-1">
              <input type="date" value={filters.dcFrom} onChange={(e) => setFilter("dcFrom", e.target.value)} className={DIF} />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={filters.dcTo}   onChange={(e) => setFilter("dcTo",   e.target.value)} className={DIF} />
            </div>
          </Fld>
          <Fld label="Prochaine relance">
            <div className="flex items-center gap-1">
              <input type="date" value={filters.prFrom} onChange={(e) => setFilter("prFrom", e.target.value)} className={DIF} />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={filters.prTo}   onChange={(e) => setFilter("prTo",   e.target.value)} className={DIF} />
            </div>
          </Fld>
          <Fld label=" ">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 h-[30px]">
              <input type="checkbox" checked={filters.chaudsOnly} onChange={(e) => setFilter("chaudsOnly", e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
              🔥 Chauds
            </label>
          </Fld>
          <Fld label=" ">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 h-[30px]" title="Opportunités sans Klaviyo">
              <input type="checkbox" checked={filters.sansKlaviyoOnly} onChange={(e) => setFilter("sansKlaviyoOnly", e.target.checked)} className="w-3.5 h-3.5 accent-purple-500" />
              ⚡ Sans Klaviyo
            </label>
          </Fld>
          <Fld label="CA minimum">
            <select
              value={filters.caMin}
              onChange={(e) => setFilter("caMin", Number(e.target.value))}
              className={SEL}
            >
              <option value={0}>Tous</option>
              <option value={150000}>150K€+</option>
              <option value={500000}>500K€+</option>
              <option value={1000000}>1M€+</option>
              <option value={2000000}>2M€+</option>
            </select>
          </Fld>
          {hasFilters && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-slate-400 hover:text-red-500 underline self-end pb-0.5">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      <BulkBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} onBulkStatut={handleBulkStatut} onBulkSecteur={handleBulkSecteur} onBulkDone={handleBulkDone} onBulkDelete={handleBulkDelete} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs text-slate-500">
          {visible.length} / {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && <span className="ml-2 text-blue-600">· {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ColumnPicker colOrder={colOrder} colVisible={colVisible} onChange={handleColChange} />
          {scanProgress ? (
            <span className="text-xs text-slate-500">
              Scan {scanProgress.done}/{scanProgress.total}…
            </span>
          ) : (
            <button
              onClick={handleScanAll}
              disabled={!!scanProgress}
              className={`${BTN2} flex items-center gap-1.5`}
              title="Scanner tous les prospects sans données d'enrichissement"
            >
              ⟳ Tout scanner
              {prospects.filter((p) => !enrichments[p.id] && p.marque.trim()).length > 0 && (
                <span className="bg-slate-200 text-slate-600 text-xs rounded-full px-1.5 py-0.5">
                  {prospects.filter((p) => !enrichments[p.id] && p.marque.trim()).length}
                </span>
              )}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => fileRef.current?.click()} className={BTN2}>📂 CSV</button>
          <button onClick={downloadTemplate} className={BTN2}>⬇ Modèle</button>
          <button onClick={handleAdd} className={BTN1}>+ Ajouter</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {/* Select all (fixed) */}
                <th className="px-2 py-2 w-8 text-center sticky left-0 z-20 bg-slate-50">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" title="Tout sélectionner" />
                </th>
                {/* Marque (frozen) */}
                <SortTH col="marque" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
                  className="sticky left-8 z-20 bg-slate-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                  Marque
                </SortTH>
                {/* Dynamic columns */}
                {colOrder.filter((id) => colVisible.has(id)).map((id) => {
                  const SORTABLE_COLS: Partial<Record<ColId, SortCol>> = {
                    statut: "statut", dernierContact: "dernierContact",
                    prochaineRelance: "prochaineRelance", instagram: "instagram",
                    relances: "relances", ca: "ca",
                  };
                  const COL_LABELS: Record<ColId, string> = {
                    contact: "Contact", email: "Email", shopify: "🛍", klaviyo: "⚡",
                    instagram: "Instagram", gapCrm: "Gap CRM", statut: "Statut", notes: "Notes",
                    chaud: "🔥", ouvertures: "✉×", conversation: "💬",
                    relances: "Relances", dernierContact: "Dernier contact",
                    prochaineRelance: "Prochaine relance", secteur: "Secteur", ca: "CA",
                  };
                  const sortColId = SORTABLE_COLS[id];
                  const center = ["shopify","klaviyo","chaud","ouvertures","conversation"].includes(id);
                  if (sortColId) {
                    return (
                      <SortTH key={id} col={sortColId} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} center={center}>
                        {COL_LABELS[id]}
                      </SortTH>
                    );
                  }
                  return <TH key={id} center={center}>{COL_LABELS[id]}</TH>;
                })}
                {/* Actions (fixed) */}
                <TH center> </TH>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={3 + colOrder.filter((id) => colVisible.has(id)).length} className="px-4 py-10 text-center text-slate-400 text-sm">
                    {hasFilters ? "Aucun prospect ne correspond aux filtres." : "Aucun prospect. Cliquez sur « + Ajouter » ou importez un CSV."}
                  </td>
                </tr>
              ) : (
                visible.map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    isSelected={selectedIds.has(p.id)}
                    onToggleSelect={toggleSelect}
                    onDelete={handleDelete}
                    autoFocusField={p.id === newRowId ? "marque" : undefined}
                    onOpen={setDrawerProspectId}
                    enrichment={enrichments[p.id] ?? null}
                    scanStatus={scanStatus[p.id]}
                    onEnrich={(p) => enrichOne(p)}
                    colOrder={colOrder}
                    colVisible={colVisible}
                    caThreshold={caThreshold}
                    onRequestDisqual={handleRequestDisqual}
                    onFieldSaved={p.id === newRowId ? (field, value) => handleManualDupCheck(p.id, field, value) : undefined}
                    isDuplicateWarning={duplicateRowIds.has(p.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disqualified prospects section */}
      {disqualVisible.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowDisqual((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors w-full text-left"
          >
            <span className="text-base">{showDisqual ? "▲" : "▼"}</span>
            <span>Prospects disqualifiés ({disqualVisible.length})</span>
          </button>
          {showDisqual && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-2 w-8 text-center sticky left-0 z-20 bg-slate-50" />
                      <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide sticky left-8 z-20 bg-slate-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Marque</th>
                      {colOrder.filter((id) => colVisible.has(id)).map((id) => {
                        const COL_LABELS: Record<ColId, string> = {
                          contact: "Contact", email: "Email", shopify: "🛍", klaviyo: "⚡",
                          instagram: "Instagram", gapCrm: "Gap CRM", statut: "Statut", notes: "Notes",
                          chaud: "🔥", ouvertures: "✉×", conversation: "💬",
                          relances: "Relances", dernierContact: "Dernier contact",
                          prochaineRelance: "Prochaine relance", secteur: "Secteur", ca: "CA",
                        };
                        return <TH key={id}>{COL_LABELS[id]}</TH>;
                      })}
                      <TH center> </TH>
                    </tr>
                  </thead>
                  <tbody>
                    {disqualVisible.map((p) => (
                      <ProspectRow
                        key={p.id}
                        prospect={p}
                        isSelected={selectedIds.has(p.id)}
                        onToggleSelect={toggleSelect}
                        onDelete={handleDelete}
                        onOpen={setDrawerProspectId}
                        enrichment={enrichments[p.id] ?? null}
                        scanStatus={scanStatus[p.id]}
                        onEnrich={(p) => enrichOne(p)}
                        colOrder={colOrder}
                        colVisible={colVisible}
                        caThreshold={caThreshold}
                        onRequestDisqual={handleRequestDisqual}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerProspect && (
        <ProspectDrawer prospect={drawerProspect} onClose={handleCloseDrawer} onContactFound={showToast} />
      )}

      {/* Disqualification modal */}
      {disqualModal && (
        <DisqualModal
          newStatut={disqualModal.newStatut}
          onConfirm={(reason) => { disqualModal.commit(reason); setDisqualModal(null); }}
          onCancel={() => setDisqualModal(null)}
        />
      )}

      {/* CSV import preview modal */}
      {csvPreview && mounted && (
        <CsvPreviewModal
          preview={csvPreview}
          onImport={applyCSVImport}
          onCancel={() => setCsvPreview(null)}
        />
      )}

      {/* Manual add — disqual duplicate modal (blocking) */}
      {manualDupModal && mounted && (
        <DisqualDuplicateModal
          match={manualDupModal.match}
          onReactivate={() => {
            const ex = manualDupModal.match.prospect;
            const note = ex.notes ? ex.notes + `\nRéactivé le ${today()}` : `Réactivé le ${today()}`;
            updateProspect(withRelance({ ...ex, statut: "À contacter", disqualReason: "", disqualDate: null, notes: note }));
            // Remove the newly created duplicate row
            handleDelete(manualDupModal.prospectId);
            reload();
            setManualDupModal(null);
          }}
          onCreateAnyway={() => {
            setDuplicateRowIds((prev) => { const n = new Set(prev); n.add(manualDupModal.prospectId); return n; });
            setManualDupModal(null);
          }}
          onCancel={() => setManualDupModal(null)}
        />
      )}

      {/* Manual add — active duplicate banner (non-blocking) */}
      {manualDupBanner && mounted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[150] max-w-lg w-full mx-4">
          <div className="bg-white border border-blue-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
            <span className="text-blue-500 text-base shrink-0 mt-0.5">ℹ️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">
                Un prospect similaire existe déjà :{" "}
                <span className="font-semibold">{manualDupBanner.match.prospect.marque}</span>
                {" — "}Statut : <span className="font-medium">{manualDupBanner.match.prospect.statut}</span>
                {" · "}<span className="text-slate-400 text-xs">{manualDupBanner.match.matchType}</span>
              </p>
              <button
                onClick={() => { setDrawerProspectId(manualDupBanner.match.prospect.id); setManualDupBanner(null); }}
                className="text-xs text-blue-600 hover:underline mt-0.5"
              >
                Voir la fiche →
              </button>
            </div>
            <button onClick={() => setManualDupBanner(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0">×</button>
          </div>
        </div>
      )}

      {/* Toasts */}
      {mounted && toasts.length > 0 && createPortal(
        <div className="fixed bottom-5 right-5 space-y-2 z-[200] pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl max-w-xs"
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TH({ children, center, title }: { children: React.ReactNode; center?: boolean; title?: string }) {
  return (
    <th title={title} className={`px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function SortTH({
  children, col, sortCol, sortDir, onSort, center, className,
}: {
  children: React.ReactNode;
  col: SortCol;
  sortCol: SortCol | null;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  center?: boolean;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors ${center ? "text-center" : "text-left"} ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={active ? "text-blue-500" : "text-slate-300"}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function DField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      {children}
    </div>
  );
}

// Filter bar styles
const SEL = "border border-slate-300 rounded-lg text-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-[30px]";
const DIF = "border border-slate-300 rounded-lg text-xs px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] h-[30px]";
const BTN1 = "px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors";
const BTN2 = "px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors";

// Drawer styles
const DI    = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const DBTN1 = "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors";
const DBTN2 = "px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors";

function downloadTemplate() {
  const header  = "Marque,Secteur,Contact,Email,Gap CRM,Statut,Notes,Dernier contact";
  const example = "Nike,Mode,Jean Dupont,jean@nike.com,CRM-001,À contacter,Premier contact prévu,";
  const blob = new Blob([[header, example].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "klaviopro_modele.csv"; a.click();
  URL.revokeObjectURL(url);
}
