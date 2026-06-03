export default function HistoryLoading() {
  return (
    <div className="route-skeleton">
      {/* Page header */}
      <div className="sk-block" style={{ height: 64, borderRadius: 10 }} />
      {/* Stats row */}
      <div className="sk-kpi-row">
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
      </div>
      {/* Calendar grid */}
      <div className="sk-block" style={{ height: 420, borderRadius: 14 }} />
    </div>
  );
}
