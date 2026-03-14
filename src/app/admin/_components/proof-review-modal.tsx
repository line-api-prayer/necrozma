"use client";

import { useState } from "react";
import Image from "next/image";
import { type OrderWithItems } from "~/server/lib/line/types";
import { RejectModal } from "./reject-modal";
import styles from "./proof-review-modal.module.css";

export function ProofReviewModal({
  order,
  onClose,
  onApprove,
  onReject,
  isApproving,
}: {
  order: OrderWithItems | null;
  onClose: () => void;
  onApprove: (orderId: string) => void;
  onReject: (orderId: string, reason: string) => void;
  isApproving: boolean;
}) {
  const [showReject, setShowReject] = useState(false);

  if (!order) return null;

  const photo = order.evidence.find((e) => e.type === "photo");
  const video = order.evidence.find((e) => e.type === "video");

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} />
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <div>
              <h3 className={styles.modalTitle}>
                ตรวจสอบหลักฐานการดำเนินงาน
              </h3>
              <p className={styles.modalSubtitle}>
                กรุณาตรวจสอบรูปภาพหรือวิดีโอก่อนทำการอนุมัติ
              </p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.sidebar}>
              <div className={styles.fieldGroup}>
                <p className={styles.fieldLabel}>ข้อมูลคำสั่งซื้อ</p>
                <p className={styles.fieldValueBold}>{order.lineOrderNo}</p>
              </div>
              <div className={styles.fieldGroup}>
                <p className={styles.fieldLabel}>ลูกค้า</p>
                <p className={styles.fieldValue}>{order.customerName}</p>
              </div>
              <div className={styles.fieldGroup}>
                <p className={styles.fieldLabel}>แพ็กเกจ</p>
                {order.items.map((item) => (
                  <div key={item.id}>
                    <p className={styles.fieldValueGreen}>
                      {item.sku ?? "-"}
                    </p>
                    <p className={styles.fieldValue}>{item.name}</p>
                  </div>
                ))}
                <p className={styles.fieldValueBold}>
                  ฿{Number(order.totalPrice).toLocaleString()}
                </p>
              </div>
              <div className={styles.fieldGroup}>
                <p className={styles.fieldLabel}>เวลาที่ส่งงาน</p>
                <p className={styles.fieldValue}>
                  {order.evidence[0]
                    ? new Date(order.evidence[0].createdAt).toLocaleString(
                        "th-TH",
                      )
                    : "-"}
                </p>
              </div>
              {video && (
                <div className={styles.fieldGroup}>
                  <p className={styles.fieldLabel}>วิดีโอหลักฐาน</p>
                  <a
                    href={video.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb", fontSize: "0.875rem" }}
                  >
                    ดูวิดีโอ
                  </a>
                </div>
              )}
            </div>

            <div className={styles.evidenceArea}>
              {photo ? (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <Image
                    src={photo.publicUrl}
                    alt="Evidence"
                    fill
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                </div>
              ) : (
                <div className={styles.noEvidence}>
                  <svg
                    width="64"
                    height="64"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                    style={{ opacity: 0.3 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>ไม่พบหลักฐานรูปภาพ</p>
                </div>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              <button onClick={onClose}>ปิดหน้าต่าง</button>
            </div>
            <div className={styles.footerRight}>
              <button
                className={styles.rejectButton}
                onClick={() => setShowReject(true)}
                disabled={isApproving}
              >
                ส่งกลับแก้ไข
              </button>
              <button
                className={styles.approveButton}
                onClick={() => onApprove(order.id)}
                disabled={isApproving}
              >
                {isApproving ? "กำลังอนุมัติ..." : "อนุมัติงาน"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showReject && (
        <RejectModal
          onClose={() => setShowReject(false)}
          onConfirm={(reason) => {
            onReject(order.id, reason);
            setShowReject(false);
          }}
        />
      )}
    </>
  );
}
