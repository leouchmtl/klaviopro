"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Prospect, Statut, Secteur, StepEntry, ProspectSteps, EmailRecord, EnrichmentData, FoundersSource, FoundersConfidence } from "@/lib/types";
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
} from "@/lib/utils";
import { useProspects } from "@/lib/hooks";
import type { GmailMsg, MatchType } from "@/lib/gmail";
import ColdEmailTab from "@/components/prospects/ColdEmailTab";
import EnrichmentPanel from "@/components/prospects/EnrichmentPanel";
import ContactFinderPanel from "@/components/prospects/ContactFinderPanel";

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
}) {
  const [p, setP] = useState<Prospect>(init);
  useEffect(() => { setP(init); }, [init]);

  function save<K extends keyof Prospect>(field: K, value: Prospect[K]) {
    const updated = withRelance({ ...p, [field]: value });
    setP(updated);
    updateProspect(updated);
  }

  function saveStep(key: keyof ProspectSteps, entry: StepEntry) {
    const { steps, statut, dernierContact } = applyStepChange(p.steps, key, entry);
    const saved = withRelance({ ...p, steps, statut, dernierContact });
    setP(saved);
    updateProspect(saved);
  }

  const chaud = p.ouverturesMultiples && p.enConversation;
  const { bg, text } = STATUT_COLORS[p.statut];
  const pr           = p.prochaineRelance;
  const prColor      = relanceDateColor(pr);
  const noStepsDone  = STEP_ORDER.every((k) => !p.steps[k].done);

  return (
    <tr className={`border-b border-slate-100 transition-colors ${chaud ? "bg-amber-50/60 hover:bg-amber-100/50" : "hover:bg-slate-50/60"}`}>
      {/* Select */}
      <td className="px-2 py-1.5 text-center w-8">
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(p.id)} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" />
      </td>

      {/* 🔥 */}
      <td className="px-1 py-1.5 text-center w-6">
        {chaud && <span title="Prospect chaud" className="text-sm">🔥</span>}
      </td>

      {/* Marque */}
      <td className="px-2 py-1.5 font-medium text-slate-900 w-[170px] max-w-[170px]">
        <EditableCell value={p.marque} onSave={(v) => save("marque", v)} placeholder="Marque" maxWidth="160px" autoFocus={autoFocusField === "marque"} />
      </td>

      {/* Secteur */}
      <td className="px-2 py-1.5 min-w-[100px]">
        <SelectCell value={p.secteur} options={SECTEURS} onSave={(v) => save("secteur", v)} />
      </td>

      {/* Contact */}
      <td className="px-2 py-1.5 w-[130px] max-w-[130px]">
        <EditableCell value={p.contact} onSave={(v) => save("contact", v)} placeholder="Nom" maxWidth="120px" />
      </td>

      {/* Email */}
      <td className="px-2 py-1.5 w-[190px] max-w-[190px]">
        <EditableCell
          value={p.email}
          type="email"
          onSave={(v) => save("email", v)}
          placeholder="email@…"
          maxWidth="180px"
          display={p.email ? (
            <a
              href={`mailto:${p.email}`}
              title={p.email}
              className="text-blue-600 hover:underline truncate block"
              style={{ maxWidth: 180 }}
              onClick={(e) => e.stopPropagation()}
            >
              {p.email}
            </a>
          ) : undefined}
        />
      </td>

      {/* Shopify */}
      <td className="px-2 py-1.5 text-center w-[52px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="shopify" onScan={() => onEnrich(p)} />
      </td>

      {/* Klaviyo */}
      <td className="px-2 py-1.5 text-center w-[52px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="klaviyo" onScan={() => onEnrich(p)} />
      </td>

      {/* Instagram */}
      <td className="px-2 py-1.5 w-[130px] max-w-[130px]">
        <EnrichCell enrichment={enrichment} scanStatus={scanStatus} type="instagram" onScan={() => onEnrich(p)} />
      </td>

      {/* Gap CRM */}
      <td className="px-2 py-1.5 min-w-[70px]">
        <EditableCell value={p.gapCrm} onSave={(v) => save("gapCrm", v)} placeholder="Réf." />
      </td>

      {/* Statut */}
      <td className="px-2 py-1.5 min-w-[125px]">
        <SelectCell
          value={p.statut}
          options={STATUTS}
          onSave={(v) => save("statut", v as Statut)}
          display={<span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>{p.statut}</span>}
        />
      </td>

      {/* Notes */}
      <td className="px-2 py-1.5 max-w-[150px]">
        <EditableCell
          value={p.notes}
          onSave={(v) => save("notes", v)}
          placeholder="Notes…"
          maxWidth="140px"
          display={p.notes ? <span className="truncate block text-slate-600" title={p.notes}>{p.notes}</span> : undefined}
        />
      </td>

      {/* Ouvertures multiples */}
      <td className="px-2 py-1.5 text-center w-10">
        <input type="checkbox" checked={p.ouverturesMultiples} onChange={(e) => save("ouverturesMultiples", e.target.checked)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" title="Ouvertures multiples" />
      </td>

      {/* En conversation */}
      <td className="px-2 py-1.5 text-center w-10">
        <input type="checkbox" checked={p.enConversation} onChange={(e) => save("enConversation", e.target.checked)} className="w-3.5 h-3.5 accent-green-500 cursor-pointer" title="En conversation" />
      </td>

      {/* Relances progress */}
      <td className="px-2 py-1.5 min-w-[110px]">
        <StepsProgressCell steps={p.steps} onUpdateStep={saveStep} />
      </td>

      {/* Dernier contact */}
      <td className="px-2 py-1.5 min-w-[100px]">
        <EditableCell
          value={p.dernierContact ?? ""}
          type="date"
          onSave={(v) => save("dernierContact", v || null)}
          display={<span className="text-slate-600 text-sm">{formatDateFR(p.dernierContact)}</span>}
        />
      </td>

      {/* Prochaine relance */}
      <td className="px-2 py-1.5 whitespace-nowrap min-w-[110px]">
        {noStepsDone ? (
          <span className="text-orange-500 text-sm font-medium">⚠ À contacter</span>
        ) : pr === null ? (
          p.statut === "Relance J+60"
            ? <span className="text-green-600 text-xs">✅ Terminée</span>
            : <span className="text-slate-400 text-sm">—</span>
        ) : (
          <span className={`text-sm font-medium ${prColor}`}>
            {prColor === "text-red-600" ? "⚠ " : ""}
            {formatDateFR(pr)}
          </span>
        )}
      </td>

      {/* Actions */}
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
  shopifyOnly: boolean;
  sansKlaviyoOnly: boolean;
}
const EMPTY_FILTERS: Filters = {
  statut: "Tous", secteur: "Tous",
  dcFrom: "", dcTo: "", prFrom: "", prTo: "",
  chaudsOnly: false, shopifyOnly: false, sansKlaviyoOnly: false,
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
    if (f.shopifyOnly    && !enrichments[p.id]?.shopifyDetected)               return false;
    if (f.sansKlaviyoOnly && enrichments[p.id]?.klaviyoDetected !== false)     return false;
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

// ── Prospect Drawer ───────────────────────────────────────────────────────────

function ProspectDrawer({ prospect: init, onClose, onContactFound }: { prospect: Prospect; onClose: () => void; onContactFound?: (msg: string) => void }) {
  const [tab, setTab]     = useState<"infos" | "emails" | "cold">("infos");
  const [p, setP]         = useState<Prospect>(init);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [coldCompose, setColdCompose] = useState<{ subject: string; body: string } | null>(null);

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
            ? <InfosTab p={p} onSave={save} onSaveStep={saveStep} onApplyContact={handleApplyContact} />
            : tab === "emails"
            ? <EmailsTab prospect={p} emails={emails} onRefresh={() => setEmails(getEmails(p.id))} onAfterSend={handleAfterSend} onReceivedDetected={handleReceivedDetected} initialCompose={coldCompose} onConsumeCompose={() => setColdCompose(null)} />
            : <ColdEmailTab prospect={p} onSendViaGmail={handleSendViaGmail} />}
        </div>
      </div>
    </>
  );
}

// ── InfosTab ──────────────────────────────────────────────────────────────────

type FieldScan = { field: "website" | "instagram"; status: "scanning" | "success" | "failed"; error?: string } | null;

function InfosTab({
  p, onSave, onSaveStep, onApplyContact,
}: {
  p: Prospect;
  onSave: <K extends keyof Prospect>(f: K, v: Prospect[K]) => void;
  onSaveStep: (k: keyof ProspectSteps, e: StepEntry) => void;
  onApplyContact?: (result: { name: string; email: string; source: FoundersSource; confidence: FoundersConfidence }) => void;
}) {
  const pr          = p.prochaineRelance;
  const prColor     = relanceDateColor(pr);
  const noStepsDone = STEP_ORDER.every((k) => !p.steps[k].done);

  const [enrichData, setEnrichData] = useState<EnrichmentData | null>(() => getEnrichment(p.id));
  const [scan, setScan] = useState<FieldScan>(null);

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
          <select value={p.statut} onChange={(e) => onSave("statut", e.target.value as Statut)} className={DI}>
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

function EmailsTab({
  prospect, emails, onRefresh, onAfterSend, onReceivedDetected, initialCompose, onConsumeCompose,
}: {
  prospect: Prospect;
  emails: EmailRecord[];
  onRefresh: () => void;
  onAfterSend: () => void;
  onReceivedDetected: () => void;
  initialCompose?: { subject: string; body: string } | null;
  onConsumeCompose?: () => void;
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
  useEffect(() => { setMounted(true); }, []);
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
      const d: EnrichmentData = await res.json();
      saveEnrichment(p.id, d);

      // Persist auto-found website / instagram back to prospect
      let changed = false;
      let updated = { ...p };
      if (d.websiteFound && !p.website) { updated = { ...updated, website: d.websiteFound }; changed = true; }
      if (d.instagramHandleFound && !p.instagramHandle) { updated = { ...updated, instagramHandle: d.instagramHandleFound }; changed = true; }
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
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const visible    = applyFilters(prospects, filters, enrichments);
  const hasFilters = filters.statut !== "Tous" || filters.secteur !== "Tous" ||
    filters.dcFrom || filters.dcTo || filters.prFrom || filters.prTo ||
    filters.chaudsOnly || filters.shopifyOnly || filters.sansKlaviyoOnly;

  const drawerProspect = drawerProspectId
    ? (prospects.find((p) => p.id === drawerProspectId) ?? null)
    : null;

  function handleCloseDrawer() {
    setDrawerProspectId(null);
    reload();
    setEnrichments(getAllEnrichments());
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

  function handleAdd() {
    const np = addOne({
      marque: "", secteur: "Autre", contact: "", email: "",
      website: "", instagramHandle: "", gapCrm: "",
      statut: "À contacter", notes: "", steps: emptySteps(),
      ouverturesMultiples: false, enConversation: false,
      dernierContact: null, relanceFaite: false,
      foundersName: "", foundersEmail: "", foundersSource: "", foundersConfidence: "",
    });
    setNewRowId(np.id);
    // Auto-enrich in background (will be a no-op if marque is still empty)
    setTimeout(() => enrichOne(np), 2000);
  }

  function handleDelete(id: string) {
    deleteOne(id);
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      let n = 0;
      rows.forEach((row) => {
        const marque = row["Marque"] || row["marque"] || "";
        if (!marque.trim()) return;
        const rawStatut  = (row["Statut"]  || "À contacter").trim() as Statut;
        const rawSecteur = (row["Secteur"] || "Autre").trim() as Secteur;
        addOne({
          marque,
          secteur:    SECTEURS.includes(rawSecteur) ? rawSecteur : "Autre",
          contact:    row["Contact"] || "",
          email:      row["Email"]   || "",
          gapCrm:          row["Gap CRM"] || "",
          website:         row["Website"] || "",
          instagramHandle: row["Instagram"] || "",
          foundersName: "", foundersEmail: "", foundersSource: "", foundersConfidence: "",
          statut:     STATUTS.includes(rawStatut) ? rawStatut : "À contacter",
          notes:      row["Notes"] || "",
          steps:      emptySteps(),
          ouverturesMultiples: false, enConversation: false,
          dernierContact: row["Dernier contact"] || null,
          relanceFaite:   false,
        });
        n++;
      });
      reload();
      alert(`${n} prospect(s) importé(s).`);
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
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 h-[30px]">
              <input type="checkbox" checked={filters.shopifyOnly} onChange={(e) => setFilter("shopifyOnly", e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              🛍 Shopify
            </label>
          </Fld>
          <Fld label=" ">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 h-[30px]" title="Opportunités sans Klaviyo">
              <input type="checkbox" checked={filters.sansKlaviyoOnly} onChange={(e) => setFilter("sansKlaviyoOnly", e.target.checked)} className="w-3.5 h-3.5 accent-purple-500" />
              ⚡ Sans Klaviyo
            </label>
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
                <th className="px-2 py-2 w-8 text-center">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" title="Tout sélectionner" />
                </th>
                <TH> </TH>
                <TH>Marque</TH>
                <TH>Secteur</TH>
                <TH>Contact</TH>
                <TH>Email</TH>
                <TH center title="Shopify">🛍</TH>
                <TH center title="Klaviyo">⚡</TH>
                <TH>Instagram</TH>
                <TH>Gap CRM</TH>
                <TH>Statut</TH>
                <TH>Notes</TH>
                <TH center title="Ouvertures multiples">✉×</TH>
                <TH center title="En conversation">💬</TH>
                <TH center>Relances</TH>
                <TH>Dernier contact</TH>
                <TH>Prochaine relance</TH>
                <TH center> </TH>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-10 text-center text-slate-400 text-sm">
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
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {drawerProspect && (
        <ProspectDrawer prospect={drawerProspect} onClose={handleCloseDrawer} onContactFound={showToast} />
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
