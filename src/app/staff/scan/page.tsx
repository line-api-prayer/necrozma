"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function ScanPage() {
  const router = useRouter();
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: { clear: () => any } | null = null;

    const startScanner = async () => {
      // Dynamically import html5-qrcode to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");

      if (!scannerRef.current) return;

      const qr = new Html5Qrcode("qr-reader");
      html5QrRef.current = qr;
      scanner = qr;

      try {
        await qr.start(
          { facingMode: useFrontCamera ? "user" : "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Extract order number from URL or use raw text
            const regex = /\/staff\/order\/(.+)/;
            const match = regex.exec(decodedText);
            const orderNo = match ? match[1] : decodedText;
            void qr.stop();
            router.push(`/staff/order/${orderNo}`);
          },
          () => {
            // Scan failure callback — ignore, keep scanning
          },
        );
      } catch (err) {
        console.error("Camera error:", err);
        setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้อง");
      }
    };

    void startScanner();

    return () => {
      if (scanner) {
        void scanner.clear();
      }
    };
  }, [router, useFrontCamera]);

  const handleManualGo = () => {
    if (!manualInput.trim()) return;
    router.push(`/staff/order/${manualInput.trim()}`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>สแกน QR Code</h1>
      <p className={styles.subtitle}>
        สแกน QR Code บนใบสั่งซื้อเพื่อเปิดหน้าอัพโหลดหลักฐาน
      </p>

      <button
        className={styles.cameraToggle}
        onClick={() => setUseFrontCamera(!useFrontCamera)}
      >
        {useFrontCamera ? "สลับเป็นกล้องหลัง" : "สลับเป็นกล้องหน้า"}
      </button>

      <div className={styles.scannerWrap}>
        <div id="qr-reader" ref={scannerRef} style={{ width: "100%" }} />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.manualWrap}>
        <p className={styles.manualTitle}>หรือพิมพ์เลขที่คำสั่งซื้อ</p>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            placeholder="เลขที่คำสั่งซื้อ..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualGo()}
          />
          <button className={styles.goButton} onClick={handleManualGo}>
            ไป
          </button>
        </div>
      </div>
    </div>
  );
}
