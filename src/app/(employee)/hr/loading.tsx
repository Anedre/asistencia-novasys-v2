export default function HrLoading() {
  return (
    <div className="route-skeleton">
      <div className="sk-block" style={{ height: 64, borderRadius: 10 }} />
      <div className="sk-block" style={{ height: 48, borderRadius: 10 }} />
      <div className="sk-row">
        <div className="sk-block sk-panel" />
        <div className="sk-block sk-panel" />
      </div>
      <div className="sk-row">
        <div className="sk-block sk-panel" />
        <div className="sk-block sk-panel" />
      </div>
    </div>
  );
}
