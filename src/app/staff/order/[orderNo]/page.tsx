"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import styles from "./page.module.css";

export default function OrderDetailPage() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const orderQuery = api.order.getByOrderNo.useQuery({
    orderNo: params.orderNo,
  });
  const getUploadUrl = api.evidence.getUploadUrl.useMutation();
  const confirmUpload = api.evidence.confirmUpload.useMutation();

  const order = orderQuery.data;

  const handleSubmit = async () => {
    if (!order || !imageFile) return;
    setIsUploading(true);

    try {
      // Upload photo (required)
      const photoUrl = await getUploadUrl.mutateAsync({
        orderId: order.id,
        type: "photo",
        contentType: imageFile.type,
      });

      await fetch(photoUrl.signedUrl, {
        method: "PUT",
        body: imageFile,
        headers: { "Content-Type": imageFile.type },
      });

      await confirmUpload.mutateAsync({
        orderId: order.id,
        type: "photo",
        storagePath: photoUrl.path,
      });

      // Upload video (optional)
      if (videoFile) {
        const videoUrl = await getUploadUrl.mutateAsync({
          orderId: order.id,
          type: "video",
          contentType: videoFile.type,
        });

        await fetch(videoUrl.signedUrl, {
          method: "PUT",
          body: videoFile,
          headers: { "Content-Type": videoFile.type },
        });

        await confirmUpload.mutateAsync({
          orderId: order.id,
          type: "video",
          storagePath: videoUrl.path,
        });
      }

      router.push("/staff");
    } catch (e) {
      alert(
        `เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (orderQuery.isLoading) {
    return <div className={styles.loading}>กำลังโหลด...</div>;
  }

  if (orderQuery.error ?? !order) {
    return (
      <div className={styles.error}>
        ไม่พบออเดอร์ {params.orderNo}
      </div>
    );
  }

  const isRejected =
    !!order.rejectionReason && order.internalStatus === "PENDING";
  const canUpload = order.internalStatus === "PENDING";

  return (
    <div className={styles.container}>
      <Link href="/staff" className={styles.backLink}>
        &larr; กลับรายการงาน
      </Link>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>ข้อมูลออเดอร์</h1>
        </div>

        <div className={styles.cardBody}>
          {isRejected && (
            <div className={styles.rejectionAlert}>
              <svg
                className={styles.rejectionIcon}
                width="20"
                height="20"
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
              <div>
                <p className={styles.rejectionTitle}>
                  งานนี้ถูกส่งกลับแก้ไข
                </p>
                <p className={styles.rejectionText}>
                  {order.rejectionReason}
                </p>
                <p className={styles.rejectionHint}>
                  กรุณาตรวจสอบและอัพโหลดหลักฐานใหม่
                </p>
              </div>
            </div>
          )}

          <div className={styles.orderSummary}>
            <div>
              {order.items[0] && (
                <>
                  <p className={styles.summaryName}>
                    {order.items[0].name}
                  </p>
                  <p className={styles.summarySku}>
                    {order.items[0].sku ?? ""}
                  </p>
                </>
              )}
              <p className={styles.summaryOrderNo}>
                Order No: {order.lineOrderNo}
              </p>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>เลขที่คำสั่งซื้อ</span>
            <div className={styles.fieldValue}>{order.lineOrderNo}</div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>ชื่อลูกค้า</span>
            <div className={styles.fieldValue}>{order.customerName}</div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>แพ็กเกจ</span>
            <div className={styles.fieldValue}>
              {order.items.map((item) => item.name).join(", ")}
            </div>
          </div>

          {canUpload && (
            <>
              <h2 className={styles.sectionTitle}>อัพโหลดหลักฐาน</h2>

              <div className={styles.uploadArea}>
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={(e) =>
                    setImageFile(e.target.files?.[0] ?? null)
                  }
                />
                <label
                  htmlFor="photo-upload"
                  className={
                    imageFile
                      ? styles.uploadLabelSuccess
                      : styles.uploadLabel
                  }
                >
                  {imageFile ? (
                    <>
                      <p className={styles.uploadTextSuccess}>
                        {imageFile.name}
                      </p>
                      <p className={styles.uploadHint}>
                        คลิกเพื่อเปลี่ยนรูป
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        width="32"
                        height="32"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="#9ca3af"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className={styles.uploadText}>
                        อัพโหลดรูปการดำเนินการ{" "}
                        <span className={styles.required}>*</span>
                      </p>
                    </>
                  )}
                </label>
              </div>

              <div className={styles.uploadArea}>
                <input
                  type="file"
                  id="video-upload"
                  accept="video/*"
                  className={styles.fileInput}
                  onChange={(e) =>
                    setVideoFile(e.target.files?.[0] ?? null)
                  }
                />
                <label
                  htmlFor="video-upload"
                  className={
                    videoFile
                      ? styles.uploadLabelSuccess
                      : styles.uploadLabel
                  }
                >
                  {videoFile ? (
                    <>
                      <p className={styles.uploadTextSuccess}>
                        {videoFile.name}
                      </p>
                      <p className={styles.uploadHint}>
                        คลิกเพื่อเปลี่ยนวิดีโอ
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        width="32"
                        height="32"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="#9ca3af"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <p className={styles.uploadText}>
                        อัพโหลดวิดีโอการดำเนินการ
                      </p>
                      <p className={styles.uploadHint}>
                        (สำหรับบางแพ็กเกจเท่านั้น)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </>
          )}
        </div>

        {canUpload && (
          <div className={styles.footer}>
            <button
              className={styles.submitButton}
              disabled={!imageFile || isUploading}
              onClick={handleSubmit}
            >
              {isUploading
                ? "กำลังอัพโหลด..."
                : isRejected
                  ? "ส่งหลักฐานใหม่"
                  : "ส่งหลักฐาน"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
