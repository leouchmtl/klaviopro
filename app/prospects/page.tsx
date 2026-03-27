import { Suspense } from "react";
import ProspectsTable from "@/components/prospects/ProspectsTable";

export default function ProspectsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Prospects</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gérez vos contacts et suivez l'avancement des relances
        </p>
      </div>
      <Suspense>
        <ProspectsTable />
      </Suspense>
    </div>
  );
}
