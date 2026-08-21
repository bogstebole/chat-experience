import type { InlineChatFeatureStatus } from "./featureStatus";
import styles from "./InlineChatBanner.module.css";

interface InlineChatBannerProps {
  status: InlineChatFeatureStatus;
}

export function InlineChatBanner({ status }: InlineChatBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        backgroundColor: "rgba(0,0,0,0.03)",
        borderRadius: 24,
        padding: "12px 8px 8px",
        width: "100%",
        maxWidth: 540,
        boxSizing: "border-box",
        fontSize: 12,
        lineHeight: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          paddingInline: 4,
          paddingBottom: 8,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <circle cx="8" cy="8" r="7" stroke="#111111" strokeWidth="1.2" />
          <path d="M8 7v4" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.8" fill="#111111" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: "16px",
              letterSpacing: "-0.02em",
              color: "#111111",
            }}
          >
            Quick heads up
          </span>
          <span
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', system-ui, sans-serif",
              fontSize: 12,
              lineHeight: "18px",
              color: "rgba(17,17,17,0.7)",
            }}
          >
            Chat runs on predefined responses for now, full AI is on the way. A few things work, a
            few don&apos;t yet.
          </span>
        </div>
      </div>

      {/* Status columns */}
      <div className={styles.columns}>
        <Column label="Works" items={status.works} />
        <Column label="Not working" items={status.notWorking} />
        <Column label="Soon" items={status.soon} />
      </div>
    </div>
  );
}

function Column({ label, items }: { label: string; items: string[] }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 8,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontSize: 12,
          lineHeight: "150%",
          color: "rgba(17,17,17,0.5)",
        }}
      >
        {label}
      </span>
      {items.map((item) => (
        <span
          key={item}
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', system-ui, sans-serif",
            fontSize: 12,
            lineHeight: "16px",
            color: "rgba(17,17,17,0.7)",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
