import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "FlexFlow product dashboard preview";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        background: "linear-gradient(135deg, #09090b 0%, #18181b 55%, #312e81 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        padding: "64px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "32px",
          padding: "48px",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            FF
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "28px", fontWeight: 700 }}>FlexFlow</span>

            <span style={{ fontSize: "18px", color: "#c4c4c7" }}>
              RBAC and team collaboration SaaS
            </span>
          </div>
        </div>

        <div>
          <h1
            style={{
              margin: 0,
              maxWidth: "820px",
              fontSize: "72px",
              lineHeight: 1,
              letterSpacing: "-0.06em",
              fontWeight: 700,
            }}
          >
            Plan, assign, track, and ship faster.
          </h1>

          <p
            style={{
              marginTop: "28px",
              maxWidth: "740px",
              fontSize: "26px",
              lineHeight: 1.4,
              color: "#d4d4d8",
            }}
          >
            Projects, issues, RBAC, analytics, and real-time collaboration in one polished
            workspace.
          </p>
        </div>

        <div style={{ display: "flex", gap: "18px" }}>
          {["Kanban", "RBAC", "Analytics", "Team"].map((item) => (
            <div
              key={item}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.16)",
                padding: "12px 20px",
                fontSize: "18px",
                color: "#e4e4e7",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size
  );
}
