import { Suspense } from "react";
import GmailSettings from "@/components/settings/GmailSettings";
import ApiKeysSettings from "@/components/settings/ApiKeysSettings";
import CaThresholdSettings from "@/components/settings/CaThresholdSettings";

export const metadata = { title: "Paramètres — KlavioPro" };

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-slate-500 mt-1 text-sm">Intégrations et configuration de KlavioPro.</p>
      </div>

      <Suspense fallback={<div className="text-sm text-slate-400">Chargement…</div>}>
        <GmailSettings />
      </Suspense>

      <ApiKeysSettings />

      <CaThresholdSettings />
    </div>
  );
}
