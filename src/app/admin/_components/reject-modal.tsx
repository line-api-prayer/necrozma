"use client";

import { useState } from "react";
import styles from "./reject-modal.module.css";

export function RejectModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลที่ต้องแก้ไข");
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.icon}>
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>ส่งกลับแก้ไข</h3>
            <p className={styles.subtitle}>
              กรุณาระบุสิ่งที่ต้องแก้ไข เพื่อแจ้งให้พนักงานทราบ
            </p>
          </div>
        </div>

        <div>
          <label className={styles.label}>
            รายละเอียดการแก้ไข <span className={styles.required}>*</span>
          </label>
          <textarea
            className={error ? styles.textareaError : styles.textarea}
            placeholder="เช่น รูปภาพไม่ชัดเจน, มุมภาพไม่ถูกต้อง, วิดีโอสั้นเกินไป..."
            value={reason}
            rows={4}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            ยกเลิก
          </button>
          <button className={styles.confirmButton} onClick={handleSubmit}>
            ยืนยันส่งกลับ
          </button>
        </div>
      </div>
    </div>
  );
}
