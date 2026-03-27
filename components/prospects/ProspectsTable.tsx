"use client";

import { useEffect, useRef, useState } from "react";
import type { Prospect, Statut } from "@/lib/types";
import { STATUTS } from "@/lib/types";
import {
  getProspects,
  addProspect,
  updateProspect,
  deleteProspect,
} from "@/lib/storage";
import { formatDateFR, isLate, STATUT_COLORS, parseCSV, withRelance } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type FormData = Omit<Prospect, "id" | "createdAt" | "prochaineRelance">;

const EMPTY_FORM: FormData = {
  marque: "",
  contact: "",
  email: "",
  gapCrm: "",
  statut: "À contacter",
  notes: "",
  dernierContact: null,
};

// ── Modal ────────────────────────────────────────────────────────────────────

function ProspectModal({
  initial,
  onSave,
  onClose,
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial);

  function set(field: keyof FormData, value: string | null) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">
            {initial.marque ? "Modifier le prospect" : "Nouveau prospect"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marque *">
              <input
                className={INPUT}
                value={form.marque}
                onChange={(e) => set("marque", e.target.value)}
                placeholder="Ex: Nike"
              />
            </Field>
            <Field label="Contact">
              <input
                className={INPUT}
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="Prénom Nom"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input
                className={INPUT}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="prenom@marque.com"
              />
            </Field>
            <Field label="Gap CRM">
              <input
                className={INPUT}
                value={form.gapCrm}
                onChange={(e) => set("gapCrm", e.target.value)}
                placeholder="Référence CRM"
              />
            </Field>
          </div>

          <Field label="Statut">
            <select
              className={INPUT}
              value={form.statut}
              onChange={(e) => set("statut", e.target.value as Statut)}
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="Dernier contact">
            <input
              className={INPUT}
              type="date"
              value={form.dernierContact ?? ""}
              onChange={(e) =>
                set("dernierContact", e.target.value || null)
              }
            />
          </Field>

          <Field label="Notes">
            <textarea
              className={`${INPUT} resize-none`}
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Informations complémentaires..."
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (!form.marque.trim()) return alert("La marque est obligatoire.");
              onSave(form);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";

// ── Main table ────────────────────────────────────────────────────────────────

export default function ProspectsTable() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filter, setFilter] = useState<Statut | "Tous">("Tous");
  const [modal, setModal] = useState<{
    open: boolean;
    editId: string | null;
    form: FormData;
  }>({ open: false, editId: null, form: EMPTY_FORM });

  const fileRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    setProspects(getProspects());
  }, []);

  function refresh() {
    setProspects(getProspects());
  }

  // Filter
  const visible =
    filter === "Tous"
      ? prospects
      : prospects.filter((p) => p.statut === filter);

  // Modal helpers
  function openAdd() {
    setModal({ open: true, editId: null, form: EMPTY_FORM });
  }
  function openEdit(p: Prospect) {
    setModal({
      open: true,
      editId: p.id,
      form: {
        marque: p.marque,
        contact: p.contact,
        email: p.email,
        gapCrm: p.gapCrm,
        statut: p.statut,
        notes: p.notes,
        dernierContact: p.dernierContact,
      },
    });
  }
  function closeModal() {
    setModal({ open: false, editId: null, form: EMPTY_FORM });
  }

  function handleSave(data: FormData) {
    if (modal.editId) {
      const existing = prospects.find((p) => p.id === modal.editId)!;
      updateProspect({ ...existing, ...data });
    } else {
      addProspect(data);
    }
    refresh();
    closeModal();
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer ce prospect ?")) return;
    deleteProspect(id);
    refresh();
  }

  // CSV import
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      let imported = 0;
      rows.forEach((row) => {
        const marque =
          row["Marque"] || row["marque"] || row["MARQUE"] || "";
        if (!marque.trim()) return;
        const rawStatut = (
          row["Statut"] || row["statut"] || "À contacter"
        ).trim() as Statut;
        const statut = STATUTS.includes(rawStatut) ? rawStatut : "À contacter";
        addProspect({
          marque,
          contact: row["Contact"] || row["contact"] || "",
          email: row["Email"] || row["email"] || "",
          gapCrm: row["Gap CRM"] || row["Gap_CRM"] || row["GapCRM"] || "",
          statut,
          notes: row["Notes"] || row["notes"] || "",
          dernierContact:
            row["Dernier contact"] || row["dernierContact"] || null,
        });
        imported++;
      });
      refresh();
      alert(`${imported} prospect(s) importé(s).`);
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Statut | "Tous")}
          className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Tous">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="text-sm text-slate-500">
          {visible.length} prospect{visible.length !== 1 ? "s" : ""}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* CSV import */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSV}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            📂 Importer CSV
          </button>

          {/* CSV template download */}
          <button
            onClick={downloadTemplate}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            ⬇ Modèle CSV
          </button>

          {/* Add */}
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  "Marque",
                  "Contact",
                  "Email",
                  "Gap CRM",
                  "Statut",
                  "Notes",
                  "Dernier contact",
                  "Prochaine relance",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    {filter === "Tous"
                      ? "Aucun prospect. Cliquez sur « + Ajouter » ou importez un CSV."
                      : `Aucun prospect avec le statut « ${filter} ».`}
                  </td>
                </tr>
              ) : (
                visible.map((p) => {
                  const late = isLate(p.prochaineRelance);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {p.marque || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {p.contact || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {p.email ? (
                          <a
                            href={`mailto:${p.email}`}
                            className="hover:text-blue-600 underline underline-offset-2"
                          >
                            {p.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {p.gapCrm || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatutBadge statut={p.statut} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {p.notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDateFR(p.dernierContact)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.prochaineRelance ? (
                          <span
                            className={`font-medium ${
                              late ? "text-red-600" : "text-slate-700"
                            }`}
                          >
                            {late && "⚠ "}
                            {formatDateFR(p.prochaineRelance)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-slate-400 hover:text-blue-600 px-1"
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-red-600 px-1"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <ProspectModal
          initial={modal.form}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: Statut }) {
  const { bg, text } = STATUT_COLORS[statut];
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {statut}
    </span>
  );
}

function downloadTemplate() {
  const header = "Marque,Contact,Email,Gap CRM,Statut,Notes,Dernier contact";
  const example = 'Nike,Jean Dupont,jean@nike.com,CRM-001,À contacter,Premier contact prévu,';
  const csv = [header, example].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "klaviopro_modele.csv";
  a.click();
  URL.revokeObjectURL(url);
}
