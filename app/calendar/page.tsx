import CalendarView from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendrier des relances</h1>
        <p className="text-slate-500 text-sm mt-1">
          Visualisez et gérez vos relances à venir
        </p>
      </div>
      <CalendarView />
    </div>
  );
}
