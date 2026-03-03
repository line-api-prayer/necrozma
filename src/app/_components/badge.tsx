import styles from "./badge.module.css";

const statusMap: Record<string, { label: string; className: string }> = {
  PENDING: { label: "รอหลักฐาน", className: styles.pending! },
  UPLOADED: { label: "รอตรวจสอบ", className: styles.uploaded! },
  COMPLETED: { label: "เสร็จสิ้น", className: styles.completed! },
};

export function Badge({
  status,
  hasRejection,
}: {
  status: string;
  hasRejection?: boolean;
}) {
  if (hasRejection && status === "PENDING") {
    return (
      <span className={`${styles.badge} ${styles.rejected}`}>แจ้งแก้ไข</span>
    );
  }

  const config = statusMap[status] ?? { label: status, className: "" };
  return <span className={`${styles.badge} ${config.className}`}>{config.label}</span>;
}
