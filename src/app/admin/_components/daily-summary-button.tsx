"use client";

import { api } from "~/trpc/react";

export function DailySummaryButton({ date }: { date: string }) {
  const generateMutation = api.report.generate.useMutation();
  const sendMutation = api.report.sendToLine.useMutation();

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({ date });
      alert(
        `รายงานสร้างเรียบร้อย!\nสรุปออเดอร์: ${result.pdfUrl}\nCertificate: ${result.certificatePdfUrl}\nแดชบอร์ดพนักงาน: ${result.dashboardUrl}`,
      );
    } catch (e) {
      alert(`เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const handleSendLine = async () => {
    try {
      await sendMutation.mutateAsync({ date });
      alert("ส่งรายงานผ่าน LINE เรียบร้อย!");
    } catch (e) {
      alert(`เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        onClick={handleGenerate}
        disabled={generateMutation.isPending}
        style={{
          padding: "0.5rem 1rem",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          background: "white",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        {generateMutation.isPending ? "กำลังสร้าง..." : "สร้างรายงาน"}
      </button>
      <button
        onClick={handleSendLine}
        disabled={sendMutation.isPending}
        style={{
          padding: "0.5rem 1rem",
          border: "none",
          borderRadius: "6px",
          background: "#06c755",
          color: "white",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        {sendMutation.isPending ? "กำลังส่ง..." : "ส่ง LINE"}
      </button>
    </div>
  );
}
