"use client";

import { useState } from "react";
import type { Prospect, FoundersSource, FoundersConfidence } from "@/lib/types";

interface FoundResult {
  name: string;
  email: string;
  source: FoundersSource;
  confidence: FoundersConfidence;
}

const SOURCE_LABELS: Record<string, string> = {
  mentions_légales: "Mentions légales",
  about_page:       "Page À propos",
  hunter:           "Hunter.io",
  apollo:           "Apollo.io",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  élevée:  "bg-green-100 text-green-800",
  moyenne: "bg-yellow-100 text-yellow-800",
  faible:  "bg-slate-100 text-slate-600",
};

export default function ContactFinderPanel({
  prospect,
  onApply,
}: {
  prospect: Prospect;
  onApply: (result: FoundResult) => void;
}) {
  const hasData = !!prospect.foundersName;
  const [loading, setLoading] = useState(false);
  const [found, setFound]     = useState<FoundResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError]     = useState("");

  async function handleFind() {
    const domain = prospect.website;
    if (!domain) {
      setError("Renseignez le site web du prospect d'abord.");
      return;
    }
    setError("");
    setNotFound(false);
    setFound(null);
    setLoading(true);
    try {
      const res = await fetch("/api/find-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data: FoundResult = await res.json();
      if (!data.name) { setNotFound(true); return; }
      setFound(data);
    } catch {
      setError("Recherche échouée. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!found) return;
    onApply(found);
    setFound(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Contact dirigeant
        </p>
        <button
          onClick={handleFind}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors font-medium"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin inline-block">⟳</span>
              Recherche…
            </span>
          ) : hasData ? "Rafraîchir" : "Trouver le contact"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Current founder data */}
      {hasData && !found && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-sm font-semibold text-slate-800">{prospect.foundersName}</p>
          {prospect.foundersEmail && (
            <p className="text-xs text-slate-600">{prospect.foundersEmail}</p>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            {prospect.foundersSource && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                {SOURCE_LABELS[prospect.foundersSource] ?? prospect.foundersSource}
              </span>
            )}
            {prospect.foundersConfidence && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[prospect.foundersConfidence] ?? "bg-slate-100 text-slate-600"}`}>
                Confiance : {prospect.foundersConfidence}
              </span>
            )}
          </div>
        </div>
      )}

      {/* New result with confirmation */}
      {found && (
        <div className="border border-indigo-300 bg-indigo-50 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-indigo-600 font-medium mb-1">Contact trouvé</p>
          <p className="text-sm font-semibold text-slate-800">{found.name}</p>
          {found.email && <p className="text-xs text-slate-600">{found.email}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
              {SOURCE_LABELS[found.source] ?? found.source}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[found.confidence] ?? ""}`}>
              Confiance : {found.confidence}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Utiliser ce contact ?{" "}
            <span className="text-slate-400 text-xs">
              (remplacera les champs Contact et Email)
            </span>
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApply}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Oui, utiliser
            </button>
            <button
              onClick={() => setFound(null)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              Non, garder l&apos;actuel
            </button>
          </div>
        </div>
      )}

      {notFound && !found && (
        <p className="text-xs text-slate-400 py-1">Aucun contact dirigeant trouvé.</p>
      )}

      {!hasData && !found && !notFound && !loading && !error && (
        <p className="text-xs text-slate-400">
          Recherche automatique dans les mentions légales, page À propos, et bases de données (Hunter, Skrapp, Apollo si configurés).
        </p>
      )}
    </div>
  );
}
