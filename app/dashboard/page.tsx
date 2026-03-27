import KPIDashboard from "@/components/dashboard/KPIDashboard";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 text-sm mt-1">
          Suivez vos indicateurs de performance mensuels
        </p>
      </div>
      <KPIDashboard />
    </div>
  );
}
