import type { InlineChatFeatureStatus } from "./featureStatus";
import styles from "./InlineChatBanner.module.css";

interface InlineChatBannerProps {
  status: InlineChatFeatureStatus;
}

export function InlineChatBanner({ status }: InlineChatBannerProps) {
  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.headerIcon}
          aria-hidden
        >
          {/* currentColor, so the icon cannot drift from the text beside it */}
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 7v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.8" fill="currentColor" />
        </svg>
        <div className={styles.headerText}>
          <span className={styles.title}>Quick heads up</span>
          <span className={styles.body}>
            The answers are scripted — there is no model behind this page. Everything else is
            the real component, so the list below is what you can actually try.
          </span>
        </div>
      </div>

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
    <div className={styles.column}>
      <span className={styles.columnLabel}>{label}</span>
      {/* The items get a box of their own so a long list can flow into two
          sub-columns. "Works" is fifteen lines and the other two are two and
          four; without this the card is mostly empty space to the right of a
          single tall list. */}
      <div className={styles.items}>
        {items.map((item) => (
          <span key={item} className={styles.item}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
