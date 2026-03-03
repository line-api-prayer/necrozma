"use client";

import { useState } from "react";
import { Badge } from "~/app/_components/badge";
import { type OrderWithItems } from "~/server/lib/line/types";
import styles from "./order-table.module.css";

type StatusFilter = "ALL" | "PENDING" | "UPLOADED" | "COMPLETED";

export function OrderTable({
  orders,
  onReview,
}: {
  orders: OrderWithItems[];
  onReview: (order: OrderWithItems) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.internalStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.lineOrderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "ทั้งหมด" },
    { key: "PENDING", label: "รอหลักฐาน" },
    { key: "UPLOADED", label: "รอตรวจสอบ" },
    { key: "COMPLETED", label: "เสร็จสิ้น" },
  ];

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          รายการออเดอร์ ({filtered.length})
        </h2>
        <div className={styles.actions}>
          <div className={styles.statusFilters}>
            {filters.map((f) => (
              <button
                key={f.key}
                className={
                  statusFilter === f.key
                    ? styles.filterChipActive
                    : styles.filterChip
                }
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="ค้นหาเลขที่คำสั่งซื้อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>เลขที่คำสั่งซื้อ</th>
              <th>สถานะ</th>
              <th>ลูกค้า</th>
              <th>แพ็กเกจ</th>
              <th>ยอดเงิน</th>
              <th>ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>
                  {new Date(order.orderDate).toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </td>
                <td>
                  <span className={styles.orderNo}>{order.lineOrderNo}</span>
                  {order.items[0] && (
                    <span className={styles.refNo}>{order.items[0].sku ?? ""}</span>
                  )}
                </td>
                <td>
                  <Badge
                    status={order.internalStatus}
                    hasRejection={!!order.rejectionReason}
                  />
                </td>
                <td>
                  <span className={styles.customerName}>
                    {order.customerName}
                  </span>
                </td>
                <td>
                  <div className={styles.packageInfo}>
                    {order.items[0] && (
                      <>
                        <span className={styles.packageCode}>
                          {order.items[0].sku ?? "-"}
                        </span>
                        <span className={styles.packageName}>
                          {order.items[0].name}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td>฿{Number(order.totalPrice).toLocaleString()}</td>
                <td>
                  {order.internalStatus === "UPLOADED" ? (
                    <button
                      className={styles.reviewButton}
                      onClick={() => onReview(order)}
                    >
                      ตรวจสอบหลักฐาน
                    </button>
                  ) : order.internalStatus === "COMPLETED" ? (
                    <span className={styles.completedLabel}>เสร็จสิ้น</span>
                  ) : (
                    <span className={styles.waitLabel}>รออัพโหลด</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.empty}>ไม่พบข้อมูลออเดอร์</div>
      )}

      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>
          แสดง {filtered.length > 0 ? 1 : 0} ถึง {filtered.length} จาก{" "}
          {filtered.length} รายการ
        </span>
      </div>
    </div>
  );
}
