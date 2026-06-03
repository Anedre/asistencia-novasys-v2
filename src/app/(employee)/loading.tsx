/**
 * Instant loading skeleton for any employee route.
 * Shown immediately while the page's data is being fetched.
 *
 * Next.js shows this <Suspense fallback> as soon as the user navigates,
 * giving instant feedback instead of a blank screen.
 */
export default function EmployeeLoading() {
  return (
    <div className="route-skeleton">
      {/* Hero block */}
      <div className="sk-block sk-hero" />

      {/* KPI strip */}
      <div className="sk-kpi-row">
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
        <div className="sk-block sk-kpi" />
      </div>

      {/* Two columns */}
      <div className="sk-row">
        <div className="sk-block sk-panel" />
        <div className="sk-block sk-panel" />
      </div>
    </div>
  );
}
