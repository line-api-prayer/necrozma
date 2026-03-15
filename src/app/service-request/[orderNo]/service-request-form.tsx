"use client";

import { useActionState } from "react";
import {
  submitServiceRequest,
  type ServiceRequestFormState,
} from "./actions";
import styles from "./page.module.css";

const initialServiceRequestState: ServiceRequestFormState = {
  status: "idle",
  message: "",
};

type ServiceRequestFormProps = {
  orderNo: string;
  token: string;
  customerName: string;
  packageSummary: string;
  requestedServiceDate: string | null;
  prayerText: string | null;
  isLocked: boolean;
};

export function ServiceRequestForm({
  orderNo,
  token,
  customerName,
  packageSummary,
  requestedServiceDate,
  prayerText,
  isLocked,
}: ServiceRequestFormProps) {
  const [state, formAction, pending] = useActionState<ServiceRequestFormState, FormData>(
    submitServiceRequest,
    initialServiceRequestState,
  );

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>Saibaat Service Request</div>
      <h1 className={styles.title}>แจ้งวันดำเนินงานและคำขอพร</h1>
      <p className={styles.subtitle}>
        รบกวนตรวจสอบข้อมูลคำสั่งซื้อ และแจ้งวันดำเนินงานพร้อมคำขอพรให้ครบถ้วนนะคะ
      </p>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Order No</span>
          <span className={styles.summaryValue}>{orderNo}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>ลูกค้า</span>
          <span className={styles.summaryValue}>{customerName}</span>
        </div>
        <div className={styles.summaryItemWide}>
          <span className={styles.summaryLabel}>รายการ</span>
          <span className={styles.summaryValue}>{packageSummary}</span>
        </div>
      </div>

      {isLocked ? (
        <div className={styles.lockedNotice}>
          คำสั่งซื้อนี้อยู่ในขั้นตอนดำเนินงานแล้ว หากต้องการแก้ไขข้อมูล รบกวนติดต่อเจ้าหน้าที่นะคะ
        </div>
      ) : (
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="orderNo" value={orderNo} />
          <input type="hidden" name="token" value={token} />

          <label className={styles.field}>
            <span className={styles.fieldLabel}>วันดำเนินงาน</span>
            <input
              className={styles.input}
              type="date"
              name="requestedServiceDate"
              defaultValue={requestedServiceDate ?? ""}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>คำขอพร</span>
            <textarea
              className={styles.textarea}
              name="prayerText"
              rows={8}
              defaultValue={prayerText ?? ""}
              placeholder="เช่น ขอให้สุขภาพแข็งแรง การงานราบรื่น และครอบครัวมีความสุขค่ะ"
              required
            />
          </label>

          {state.status !== "idle" && (
            <p
              className={
                state.status === "success" ? styles.successMessage : styles.errorMessage
              }
            >
              {state.message}
            </p>
          )}

          <button type="submit" className={styles.submitButton} disabled={pending}>
            {pending ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูล"}
          </button>
        </form>
      )}
    </section>
  );
}
