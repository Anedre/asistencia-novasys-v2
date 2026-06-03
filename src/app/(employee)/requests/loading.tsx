export default function RequestsLoading() {
  return (
    <div className="route-skeleton">
      <div className="sk-block" style={{ height: 64, borderRadius: 10 }} />
      <div className="sk-kpi-row">
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
      </div>
      <div className="sk-block" style={{ height: 380, borderRadius: 14 }} />
    </div>
  );
}
