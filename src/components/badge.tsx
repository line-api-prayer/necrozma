import styles from "./badge.module.css";

const statusMap: Record<string, { label: string; className: string }> = {
  // Internal statuses
  PENDING: { label: "รอหลักฐาน", className: styles.pending! },
  UPLOADED: { label: "รอตรวจสอบ", className: styles.uploaded! },
  COMPLETED: { label: "เสร็จสิ้น", className: styles.completed! },
  
  // LINE MyShop statuses (orderStatus)
  FINALIZED: { label: "ตรวจสอบแล้ว", className: styles.completed! },
  LINE_COMPLETED: { label: "สำเร็จแล้ว", className: styles.completed! }, // renamed to avoid conflict
  EXPIRED: { label: "หมดอายุ", className: styles.rejected! },
  CANCELED: { label: "ยกเลิก", className: styles.rejected! },

  // LINE MyShop payment statuses (paymentStatus)
  NO_PAYMENT: { label: "ยังไม่ชำระ", className: styles.pending! },
  PENDING_PAYMENT: { label: "รอชำระ", className: styles.pending! }, // some APIs send PENDING or PENDING_PAYMENT
  PAID: { label: "ชำระเงินแล้ว", className: styles.completed! },
  REFUND: { label: "คืนเงิน", className: styles.rejected! },
  PENDING_REFUND: { label: "รอคืนเงิน", className: styles.pending! },
  FAILED_REFUND: { label: "คืนเงินล้มเหลว", className: styles.rejected! },
  FAILED_AFTER_PAID: { label: "ล้มเหลวหลังชำระ", className: styles.rejected! },
  REJECTED_REFUND: { label: "ปฏิเสธคืนเงิน", className: styles.rejected! },
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
