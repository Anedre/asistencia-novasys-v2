export default function MessagesLoading() {
  return (
    <div className="route-skeleton" style={{ marginTop: 0, paddingTop: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 12,
          height: "calc(100vh - 120px)",
        }}
      >
        <div className="sk-block" style={{ height: "100%", borderRadius: 14 }} />
        <div className="sk-block" style={{ height: "100%", borderRadius: 14 }} />
      </div>
    </div>
  );
}
