"use client";

import { useEffect, useRef, useState } from "react";
import type { Prospect, Statut, Secteur, StepEntry, ProspectSteps } from "@/lib/types";
import { STATUTS, SECTEURS } from "@/lib/types";
import {
  getProspects,
  addProspect,
  updateProspect,
  deleteProspect,
  saveProspects,
  emptySteps,
} from "@/lib/storage";
import {
  formatDateFR,
  STATUT_COLORS,
  parseCSV,
  withRelance,
  today,
  calcNextRelanceFromSteps,
  relanceDateColor,
} from "@/lib/utils";

// ── Inline cell helpers ───────────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder = "—",
  display,
  autoFocus,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "email" | "date";
  placeholder?: string;
  display?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

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
        className="w-full min-w-[80px] px-2 py-1 border border-blue-400 rounded text-sm bg-white focus:outline-none"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-text rounded px-1 py-0.5 hover:bg-blue-50 min-h-[26px] flex items-center text-sm"
    >
      {display ?? (value ? <span>{value}</span> : <span className="text-slate-300 text-xs italic">éditer</span>)}
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

function StepCell({ step, onUpdate }: { step: StepEntry; onUpdate: (s: StepEntry) => void }) {
  function toggle() {
    const nowDone = !step.done;
    onUpdate({ done: nowDone, date: nowDone ? (step.date ?? today()) : step.date });
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <input type="checkbox" checked={step.done} onChange={toggle} className="w-4 h-4 accent-blue-600 cursor-pointer" />
      {step.done && (
        <input
          type="date"
          value={step.date ?? ""}
          onChange={(e) => onUpdate({ ...step, date: e.target.value || null })}
          className="text-xs border border-slate-200 rounded px-1 py-0.5 w-[105px] focus:outline-none focus:border-blue-400"
        />
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

const STEP_KEYS: { key: keyof ProspectSteps; label: string }[] = [
  { key: "j0",  label: "J0"   },
  { key: "j5",  label: "J+5"  },
  { key: "j12", label: "J+12" },
  { key: "j21", label: "J+21" },
  { key: "j35", label: "J+35" },
  { key: "j60", label: "J+60" },
];

function ProspectRow({
  prospect: init,
  isSelected,
  onToggleSelect,
  onDelete,
  autoFocusField,
}: {
  prospect: Prospect;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  autoFocusField?: string;
}) {
  const [p, setP] = useState<Prospect>(init);
  useEffect(() => { setP(init); }, [init.id]);

  function save<K extends keyof Prospect>(field: K, value: Prospect[K]) {
    const updated = withRelance({ ...p, [field]: value });
    setP(updated);
    updateProspect(updated);
  }

  function saveStep(key: keyof ProspectSteps, entry: StepEntry) {
    const updated = { ...p, steps: { ...p.steps, [key]: entry } };
    setP(updated);
    updateProspect(updated);
  }

  const chaud = p.ouverturesMultiples && p.enConversation;
  const { bg, text } = STATUT_COLORS[p.statut];

  // Dynamic prochaine relance from steps
  const nextDate = calcNextRelanceFromSteps(p.steps);
  const nextColor = relanceDateColor(nextDate);

  return (
    <tr className={`border-b border-slate-100 transition-colors ${chaud ? "bg-amber-50 hover:bg-amber-100/60" : "hover:bg-slate-50/50"}`}>
      {/* Select */}
      <td className="px-2 py-2 text-center w-8">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(p.id)}
          className="w-4 h-4 accent-blue-600 cursor-pointer"
        />
      </td>

      {/* 🔥 */}
      <td className="px-1 py-2 text-center w-6">
        {chaud && <span title="Prospect chaud">🔥</span>}
      </td>

      {/* Marque */}
      <td className="px-2 py-2 font-medium text-slate-900 min-w-[100px]">
        <EditableCell value={p.marque} onSave={(v) => save("marque", v)} placeholder="Marque" autoFocus={autoFocusField === "marque"} />
      </td>

      {/* Secteur */}
      <td className="px-2 py-2 min-w-[100px]">
        <SelectCell value={p.secteur} options={SECTEURS} onSave={(v) => save("secteur", v)} />
      </td>

      {/* Contact */}
      <td className="px-2 py-2 min-w-[100px]">
        <EditableCell value={p.contact} onSave={(v) => save("contact", v)} placeholder="Nom" />
      </td>

      {/* Email */}
      <td className="px-2 py-2 min-w-[130px]">
        <EditableCell
          value={p.email}
          type="email"
          onSave={(v) => save("email", v)}
          placeholder="email@…"
          display={p.email ? (
            <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline truncate block max-w-[150px]" onClick={(e) => e.stopPropagation()}>
              {p.email}
            </a>
          ) : undefined}
        />
      </td>

      {/* Gap CRM */}
      <td className="px-2 py-2 min-w-[80px]">
        <EditableCell value={p.gapCrm} onSave={(v) => save("gapCrm", v)} placeholder="Réf." />
      </td>

      {/* Statut */}
      <td className="px-2 py-2 min-w-[125px]">
        <SelectCell
          value={p.statut}
          options={STATUTS}
          onSave={(v) => save("statut", v as Statut)}
          display={<span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>{p.statut}</span>}
        />
      </td>

      {/* Notes */}
      <td className="px-2 py-2 min-w-[120px] max-w-[160px]">
        <EditableCell
          value={p.notes}
          onSave={(v) => save("notes", v)}
          placeholder="Notes…"
          display={p.notes ? <span className="truncate block max-w-[150px] text-slate-600">{p.notes}</span> : undefined}
        />
      </td>

      {/* Ouvertures multiples */}
      <td className="px-2 py-2 text-center w-12">
        <input
          type="checkbox"
          checked={p.ouverturesMultiples}
          onChange={(e) => save("ouverturesMultiples", e.target.checked)}
          className="w-4 h-4 accent-orange-500 cursor-pointer"
          title="Ouvertures multiples"
        />
      </td>

      {/* En conversation */}
      <td className="px-2 py-2 text-center w-12">
        <input
          type="checkbox"
          checked={p.enConversation}
          onChange={(e) => save("enConversation", e.target.checked)}
          className="w-4 h-4 accent-green-500 cursor-pointer"
          title="En conversation"
        />
      </td>

      {/* Step columns */}
      {STEP_KEYS.map(({ key }) => (
        <td key={key} className="px-2 py-2 text-center min-w-[80px]">
          <StepCell step={p.steps[key]} onUpdate={(s) => saveStep(key, s)} />
        </td>
      ))}

      {/* Dernier contact */}
      <td className="px-2 py-2 min-w-[105px]">
        <EditableCell
          value={p.dernierContact ?? ""}
          type="date"
          onSave={(v) => save("dernierContact", v || null)}
          display={<span className="text-slate-600">{formatDateFR(p.dernierContact)}</span>}
        />
      </td>

      {/* Prochaine relance — dynamic from steps */}
      <td className="px-2 py-2 whitespace-nowrap min-w-[105px]">
        {nextDate === null ? (
          <span className="text-slate-400 text-xs">✅ Terminé</span>
        ) : (
          <span className={`text-sm font-medium ${nextColor}`}>
            {nextColor === "text-red-600" ? "⚠ " : ""}
            {formatDateFR(nextDate)}
          </span>
        )}
      </td>

      {/* Delete */}
      <td className="px-2 py-2 text-center">
        <button
          onClick={() => { if (!confirm("Supprimer ce prospect ?")) return; onDelete(p.id); }}
          className="text-slate-300 hover:text-red-500 transition-colors text-lg"
          title="Supprimer"
        >×</button>
      </td>
    </tr>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

interface Filters {
  statut: Statut | "Tous";
  secteur: Secteur | "Tous";
  dcFrom: string;
  dcTo: string;
  prFrom: string;
  prTo: string;
  chaudsOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  statut: "Tous", secteur: "Tous",
  dcFrom: "", dcTo: "", prFrom: "", prTo: "",
  chaudsOnly: false,
};

function applyFilters(prospects: Prospect[], f: Filters): Prospect[] {
  return prospects.filter((p) => {
    if (f.statut  !== "Tous" && p.statut  !== f.statut)  return false;
    if (f.secteur !== "Tous" && p.secteur !== f.secteur) return false;
    if (f.dcFrom && (p.dernierContact   ?? "") < f.dcFrom) return false;
    if (f.dcTo   && (p.dernierContact   ?? "") > f.dcTo)   return false;
    if (f.prFrom && (p.prochaineRelance ?? "") < f.prFrom) return false;
    if (f.prTo   && (p.prochaineRelance ?? "") > f.prTo)   return false;
    if (f.chaudsOnly && !(p.ouverturesMultiples && p.enConversation)) return false;
    return true;
  });
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

function BulkBar({
  selectedIds,
  onClear,
  onBulkStatut,
  onBulkSecteur,
  onBulkDone,
  onBulkDelete,
}: {
  selectedIds: Set<string>;
  onClear: () => void;
  onBulkStatut: (s: Statut) => void;
  onBulkSecteur: (s: Secteur) => void;
  onBulkDone: () => void;
  onBulkDelete: () => void;
}) {
  const n = selectedIds.size;
  if (n === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 shadow-lg">
      <span className="font-semibold text-sm">{n} sélectionné{n > 1 ? "s" : ""}</span>

      <span className="text-blue-400 text-xs">|</span>

      <label className="text-xs font-medium">Statut :</label>
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) { onBulkStatut(e.target.value as Statut); e.target.value = ""; } }}
        className="text-sm text-slate-800 bg-white rounded-lg px-2 py-1 border-0 focus:outline-none"
      >
        <option value="">— changer —</option>
        {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label className="text-xs font-medium">Secteur :</label>
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) { onBulkSecteur(e.target.value as Secteur); e.target.value = ""; } }}
        className="text-sm text-slate-800 bg-white rounded-lg px-2 py-1 border-0 focus:outline-none"
      >
        <option value="">— changer —</option>
        {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <button
        onClick={onBulkDone}
        className="text-sm bg-green-500 hover:bg-green-400 text-white px-3 py-1 rounded-lg transition-colors"
      >
        ✓ Relance faite
      </button>

      <button
        onClick={() => { if (!confirm(`Supprimer ${n} prospect${n > 1 ? "s" : ""} ?`)) return; onBulkDelete(); }}
        className="text-sm bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded-lg transition-colors"
      >
        🗑 Supprimer
      </button>

      <button onClick={onClear} className="ml-auto text-blue-200 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProspectsTable() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newRowId, setNewRowId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setProspects(getProspects()); }, []);

  function reload() { setProspects(getProspects()); }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const visible = applyFilters(prospects, filters);
  const hasFilters = filters.statut !== "Tous" || filters.secteur !== "Tous" ||
    filters.dcFrom || filters.dcTo || filters.prFrom || filters.prTo || filters.chaudsOnly;

  // ── Selection ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visible.length && visible.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map((p) => p.id)));
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  // ── Bulk actions ───────────────────────────────────────────────────────────

  function handleBulkStatut(statut: Statut) {
    const ids = selectedIds;
    const updated = getProspects().map((p) =>
      ids.has(p.id) ? withRelance({ ...p, statut }) : p
    );
    saveProspects(updated);
    reload();
    setSelectedIds(new Set());
  }

  function handleBulkSecteur(secteur: Secteur) {
    const ids = selectedIds;
    const updated = getProspects().map((p) =>
      ids.has(p.id) ? { ...p, secteur } : p
    );
    saveProspects(updated);
    reload();
    setSelectedIds(new Set());
  }

  function handleBulkDone() {
    const ids = selectedIds;
    const todayStr = today();
    const updated = getProspects().map((p) => {
      if (!ids.has(p.id)) return p;
      // Find first unchecked step and check it with today
      const steps = { ...p.steps };
      const order = ["j0", "j5", "j12", "j21", "j35", "j60"] as const;
      for (const key of order) {
        if (!steps[key].done) {
          steps[key] = { done: true, date: todayStr };
          break;
        }
      }
      return withRelance({ ...p, steps, relanceFaite: true, dernierContact: todayStr });
    });
    saveProspects(updated);
    reload();
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    const ids = selectedIds;
    saveProspects(getProspects().filter((p) => !ids.has(p.id)));
    reload();
    setSelectedIds(new Set());
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function handleAdd() {
    const np = addProspect({
      marque: "", secteur: "Autre", contact: "", email: "", gapCrm: "",
      statut: "À contacter", notes: "", steps: emptySteps(),
      ouverturesMultiples: false, enConversation: false,
      dernierContact: null, relanceFaite: false,
    });
    setProspects((prev) => [np, ...prev]);
    setNewRowId(np.id);
  }

  function handleDelete(id: string) {
    deleteProspect(id);
    setProspects((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
        const rawStatut = (row["Statut"] || "À contacter").trim() as Statut;
        const rawSecteur = (row["Secteur"] || "Autre").trim() as Secteur;
        addProspect({
          marque,
          secteur: SECTEURS.includes(rawSecteur) ? rawSecteur : "Autre",
          contact: row["Contact"] || "",
          email: row["Email"] || "",
          gapCrm: row["Gap CRM"] || "",
          statut: STATUTS.includes(rawStatut) ? rawStatut : "À contacter",
          notes: row["Notes"] || "",
          steps: emptySteps(),
          ouverturesMultiples: false,
          enConversation: false,
          dernierContact: row["Dernier contact"] || null,
          relanceFaite: false,
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
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
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
              <input type="date" value={filters.dcFrom} onChange={(e) => setFilter("dcFrom", e.target.value)} className={DI} />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={filters.dcTo}   onChange={(e) => setFilter("dcTo",   e.target.value)} className={DI} />
            </div>
          </Fld>

          <Fld label="Prochaine relance">
            <div className="flex items-center gap-1">
              <input type="date" value={filters.prFrom} onChange={(e) => setFilter("prFrom", e.target.value)} className={DI} />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={filters.prTo}   onChange={(e) => setFilter("prTo",   e.target.value)} className={DI} />
            </div>
          </Fld>

          <Fld label=" ">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 h-[34px]">
              <input
                type="checkbox"
                checked={filters.chaudsOnly}
                onChange={(e) => setFilter("chaudsOnly", e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              🔥 Prospects chauds
            </label>
          </Fld>

          {hasFilters && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-slate-400 hover:text-red-500 underline self-end pb-1">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      <BulkBar
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
        onBulkStatut={handleBulkStatut}
        onBulkSecteur={handleBulkSecteur}
        onBulkDone={handleBulkDone}
        onBulkDelete={handleBulkDelete}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm text-slate-500">
          {visible.length} / {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && <span className="ml-2 text-blue-600">· {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => fileRef.current?.click()} className={BTN2}>📂 Importer CSV</button>
          <button onClick={downloadTemplate} className={BTN2}>⬇ Modèle CSV</button>
          <button onClick={handleAdd} className={BTN1}>+ Ajouter</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {/* Select all */}
                <th className="px-2 py-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                    title="Tout sélectionner"
                  />
                </th>
                <TH> </TH>
                <TH>Marque</TH>
                <TH>Secteur</TH>
                <TH>Contact</TH>
                <TH>Email</TH>
                <TH>Gap CRM</TH>
                <TH>Statut</TH>
                <TH>Notes</TH>
                <TH center title="Ouvertures multiples">✉×</TH>
                <TH center title="En conversation">💬</TH>
                {STEP_KEYS.map(({ key, label }) => <TH key={key} center>{label}</TH>)}
                <TH>Dernier contact</TH>
                <TH>Prochaine relance</TH>
                <TH center> </TH>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {hasFilters
                      ? "Aucun prospect ne correspond aux filtres."
                      : "Aucun prospect. Cliquez sur « + Ajouter » ou importez un CSV."}
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
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TH({ children, center, title }: { children: React.ReactNode; center?: boolean; title?: string }) {
  return (
    <th title={title} className={`px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const SEL = "border border-slate-300 rounded-lg text-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const DI  = "border border-slate-300 rounded-lg text-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-[128px]";
const BTN1 = "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors";
const BTN2 = "px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors";

function downloadTemplate() {
  const header = "Marque,Secteur,Contact,Email,Gap CRM,Statut,Notes,Dernier contact";
  const example = "Nike,Mode,Jean Dupont,jean@nike.com,CRM-001,À contacter,Premier contact prévu,";
  const blob = new Blob([[header, example].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "klaviopro_modele.csv"; a.click();
  URL.revokeObjectURL(url);
}
