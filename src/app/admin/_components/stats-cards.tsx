import { type DailySummary } from "~/server/lib/line/types";
import styles from "./stats-cards.module.css";

export function StatsCards({ summary }: { summary: DailySummary }) {
  const displayDate = new Date(summary.date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <p className={styles.label}>วันที่ดำเนินการ</p>
        <p className={styles.value}>{displayDate}</p>
      </div>
      <div className={styles.card}>
        <p className={styles.label}>ยอดเงินรวม</p>
        <p className={styles.value}>
          ฿{summary.totalRevenue.toLocaleString()}
        </p>
      </div>
      <div className={styles.cardWithIcon}>
        <div>
          <p className={styles.label}>รออนุมัติ</p>
          <p className={styles.valueGreen}>{summary.uploadedCount} รายการ</p>
        </div>
        <div className={styles.checkIcon}>
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
      <div className={styles.card}>
        <p className={styles.label}>รอข้อมูลลูกค้า</p>
        <p className={styles.value}>{summary.missingServiceRequestCount}</p>
      </div>
    </div>
  );
}
