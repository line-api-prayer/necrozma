"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { type OrderWithItems } from "~/server/lib/line/types";
import styles from "./page.module.css";

export default function StaffPage() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0]!;
  const [selectedDate, setSelectedDate] = useState(today);

  const ordersQuery = api.order.list.useQuery({ date: selectedDate || undefined });
  const orders = useMemo(
    () => (ordersQuery.data ?? []) as OrderWithItems[],
    [ordersQuery.data],
  );

  const summary = useMemo(() => {
    const totalAmount = orders.reduce(
      (sum, o) => sum + Number(o.totalPrice),
      0,
    );
    return {
      displayDate: selectedDate
        ? new Date(selectedDate).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "ทั้งหมด",
      totalAmount,
      total: orders.length,
    };
  }, [orders, selectedDate]);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>รายการงานประจำวัน</h1>
          <p className={styles.subtitle}>
            เลือกวันที่เพื่อดูรายการย้อนหลัง
          </p>
        </div>
        <div className={styles.dateWrap}>
          <input
            type="date"
            className={styles.dateInput}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {selectedDate && (
            <button
              className={styles.showAll}
              onClick={() => setSelectedDate("")}
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryGrid}>
          <div>
            <p className={styles.summaryLabel}>วันดำเนินการ</p>
            <p className={styles.summaryValue}>{summary.displayDate}</p>
          </div>
          <div>
            <p className={styles.summaryLabel}>ยอดเงินรวม</p>
            <p className={styles.summaryValue}>
              ฿{summary.totalAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className={styles.summaryLabel}>จำนวนออเดอร์</p>
            <p className={styles.summaryValueGreen}>{summary.total}</p>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>
            รายการออเดอร์ ({orders.length})
          </h3>
        </div>

        {orders.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>เลขที่คำสั่งซื้อ</th>
                <th>ลูกค้า</th>
                <th>แพ็กเกจ</th>
                <th>ยอดเงิน</th>
                <th>สถานะ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isRejected =
                  !!order.rejectionReason &&
                  order.internalStatus === "PENDING";
                return (
                  <tr
                    key={order.id}
                    className={isRejected ? styles.rejectedRow : undefined}
                  >
                    <td>
                      {new Date(order.orderDate).toLocaleDateString("th-TH", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td>
                      <div className={styles.orderNo}>
                        {order.lineOrderNo}
                      </div>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      {order.items[0] && (
                        <>
                          <div>{order.items[0].name}</div>
                          <div className={styles.refNo}>
                            {order.items[0].sku ?? ""}
                          </div>
                        </>
                      )}
                    </td>
                    <td>฿{Number(order.totalPrice).toLocaleString()}</td>
                    <td>
                      <Badge
                        status={order.internalStatus}
                        hasRejection={isRejected}
                      />
                    </td>
                    <td>
                      {order.internalStatus === "PENDING" ? (
                        <button
                          className={
                            isRejected
                              ? styles.rejectedButton
                              : styles.uploadButton
                          }
                          onClick={() =>
                            router.push(
                              `/staff/order/${order.lineOrderNo}`,
                            )
                          }
                        >
                          {isRejected
                            ? "ดูสิ่งที่ต้องแก้"
                            : "อัพโหลดหลักฐาน"}
                        </button>
                      ) : (
                        <span className={styles.disabledLabel}>
                          {order.internalStatus === "COMPLETED"
                            ? "เสร็จสิ้น"
                            : "รอตรวจสอบ"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>
            {ordersQuery.isLoading
              ? "กำลังโหลด..."
              : "ไม่พบออเดอร์ในวันที่เลือก"}
          </div>
        )}
      </div>
    </div>
  );
}
