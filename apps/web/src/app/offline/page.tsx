export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background:
          "radial-gradient(circle at top, rgba(31, 75, 45, 0.24), transparent 48%), #0b110d",
        color: "#f3f4f6",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          borderRadius: 24,
          padding: "28px 24px",
          background: "rgba(15, 23, 18, 0.92)",
          border: "1px solid rgba(132, 204, 22, 0.18)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.32)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#86efac",
            fontFamily: "IBM Plex Mono, monospace",
          }}
        >
          Offline
        </p>
        <h1
          style={{
            margin: "12px 0 8px",
            fontSize: 32,
            lineHeight: 1.05,
            fontWeight: 400,
            fontFamily: "P22 Mackinac Pro, Georgia, serif",
          }}
        >
          You’re offline.
        </h1>
        <p style={{ margin: 0, color: "rgba(243, 244, 246, 0.76)", lineHeight: 1.6 }}>
          The app shell is available, but live field data needs a network connection.
          Once a field has been opened online, recently synced snapshots stay available in
          the active preview shell while connectivity drops.
        </p>
      </section>
    </main>
  );
}
