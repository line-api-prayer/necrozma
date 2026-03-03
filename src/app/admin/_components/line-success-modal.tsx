"use client";

import styles from "./line-success-modal.module.css";

export function LineSuccessModal({
  customerName,
  onClose,
}: {
  customerName: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.iconWrap}>
          <svg
            className={styles.checkIcon}
            width="40"
            height="40"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <div className={styles.lineTag}>LINE</div>
        </div>

        <h3 className={styles.title}>อนุมัติงานสำเร็จ</h3>
        <p className={styles.message}>
          ระบบได้ส่งข้อความแจ้งเตือนสถานะ
          <br />
          ทาง <span className={styles.lineLabel}>LINE OA</span> ไปยัง
          <br />
          <span className={styles.customerLabel}>
            &ldquo;{customerName}&rdquo;
          </span>
          <br />
          เรียบร้อยแล้ว
        </p>

        <button className={styles.okButton} onClick={onClose}>
          รับทราบ
        </button>
      </div>
    </div>
  );
}
