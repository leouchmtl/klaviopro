"use client";

import { useEffect, useState } from "react";

interface ApiKeysStatus {
  hunter: boolean;
  apollo: boolean;
}

const KEYS_INFO = [
  {
    key: "hunter" as const,
    label: "Hunter.io",
    envVar: "HUNTER_API_KEY",
    url: "https://hunter.io/api-keys",
    description: "Recherche d'emails par domaine — jusqu'à 25 req/mois gratuits",
  },
  {
    key: "apollo" as const,
    label: "Apollo.io",
    envVar: "APOLLO_API_KEY",
    url: "https://app.apollo.io/settings/integrations/api",
    description: "Base de données de contacts B2B — plan gratuit disponible",
  },
];

export default function ApiKeysSettings() {
  const [status, setStatus] = useState<ApiKeysStatus | null>(null);

  useEffect(() => {
    fetch("/api/check-api-keys")
      .then((r) => r.json())
      .then((d: ApiKeysStatus) => setStatus(d))
      .catch(() => setStatus({ hunter: false, apollo: false }));
  }, []);

  if (!status) {
    return <p className="text-sm text-slate-400">Vérification des clés API…</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900">Clés API — Recherche de contacts</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Ces clés permettent à KlavioPro de retrouver automatiquement le fondateur/dirigeant
          d&apos;une marque. Ajoutez-les dans votre fichier <code className="bg-slate-100 px-1 rounded text-xs">.env.local</code>.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {KEYS_INFO.map(({ key, label, envVar, url, description }) => (
          <div key={key} className="px-5 py-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-800 text-sm">{label}</p>
                {status[key] ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    ✓ Connecté
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Non configuré
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              {!status[key] && (
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {envVar}=votre_clé
                </p>
              )}
            </div>
            {!status[key] && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline shrink-0 mt-0.5"
              >
                Obtenir une clé →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-400">
          Sans ces clés, la recherche de contacts fonctionne via les mentions légales et les pages À propos (gratuit, sans limite).
        </p>
      </div>
    </div>
  );
}
