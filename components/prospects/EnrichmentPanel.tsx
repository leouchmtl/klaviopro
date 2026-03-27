"use client";

import { useState } from "react";
import type { Prospect, EnrichmentData } from "@/lib/types";
import { getEnrichment, saveEnrichment } from "@/lib/storage";

export default function EnrichmentPanel({ prospect }: { prospect: Prospect }) {
  const [data, setData] = useState<EnrichmentData | null>(() =>
    getEnrichment(prospect.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function enrich() {
    if (!prospect.website && !prospect.instagramHandle) {
      setError("Renseignez le site web ou le handle Instagram dans les infos.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/enrich-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: prospect.website,
          instagramHandle: prospect.instagramHandle,
        }),
      });
      if (!res.ok) throw new Error("fetch_failed");
      const d: EnrichmentData = await res.json();
      setData(d);
      saveEnrichment(prospect.id, d);
    } catch {
      setError("Impossible de récupérer les données. Vérifiez le domaine.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Enrichissement automatique
        </p>
        <button
          onClick={enrich}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors font-medium"
        >
          {loading ? "Analyse…" : data ? "Mettre à jour" : "Enrichir le profil"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!data && !loading && !error && (
        <p className="text-xs text-slate-400">
          Analysez automatiquement la plateforme e-commerce, la présence Klaviyo
          et le compte Instagram à partir du site web et du handle.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <span className="animate-spin">⟳</span>
          Analyse en cours…
        </div>
      )}

      {data && !loading && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Plateforme</p>
              <p className="text-sm font-medium text-slate-700">{data.platform}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Klaviyo</p>
              <p className={`text-sm font-medium ${data.klaviyoDetected ? "text-green-700" : "text-slate-700"}`}>
                {data.klaviyo}
              </p>
            </div>
          </div>

          {data.instagram && data.instagram !== "Non disponible" && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Instagram</p>
              <p className="text-sm text-slate-700">{data.instagram}</p>
            </div>
          )}

          {data.description && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Description du site</p>
              <p className="text-xs text-slate-600 leading-relaxed">{data.description}</p>
            </div>
          )}

          <p className="text-xs text-slate-400 border-t border-slate-200 pt-2">
            Mis à jour le{" "}
            {new Date(data.updatedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
