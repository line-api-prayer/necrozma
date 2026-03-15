"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { getSupabaseBrowserClient } from "~/lib/supabase-browser";
import { Badge } from "~/components/badge";
import { type OrderWithItems } from "~/server/lib/line/types";
import styles from "./page.module.css";

function StaffPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split("T")[0]!;
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? today);
  const [search, setSearch] = useState("");

  const ordersQuery = api.order.list.useQuery({ date: selectedDate || undefined });
  const missingOrdersQuery = api.order.listMissingServiceRequests.useQuery();
  const mappingsQuery = api.mapping.list.useQuery();
  const allOrders = useMemo(
    () => (ordersQuery.data ?? []) as OrderWithItems[],
    [ordersQuery.data],
  );
  const missingOrders = useMemo(
    () => (missingOrdersQuery.data ?? []) as OrderWithItems[],
    [missingOrdersQuery.data],
  );

  const getDisplayName = (originalName: string) => {
    const mappings = mappingsQuery.data;
    if (!mappings) return originalName;
    const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
    const target = normalize(originalName);
    const mapping = mappings.find((m) => normalize(m.original_name) === target);
    return mapping ? mapping.display_name : originalName;
  };

  const orders = useMemo(() => {
    if (!search) return allOrders;
    const q = search.toLowerCase();
    return allOrders.filter(
      (o) =>
        o.lineOrderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q),
    );
  }, [allOrders, search]);

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

  useEffect(() => {
    const nextDate = searchParams.get("date") ?? today;
    setSelectedDate(nextDate);
  }, [searchParams, today]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("staff-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload: { new: { internal_status?: string; rejection_reason?: string } }) => {
          if (
            (payload.new.internal_status === "PENDING" &&
              payload.new.rejection_reason) ||
            payload.new.internal_status === "COMPLETED"
          ) {
            void ordersQuery.refetch();
            void missingOrdersQuery.refetch();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [missingOrdersQuery, ordersQuery]);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>รายการงานประจำวัน</h1>
          <p className={styles.subtitle}>
            โฟกัสที่วันดำเนินงานและคำขอพรของลูกค้า
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
          <div>
            <p className={styles.summaryLabel}>ข้อมูลยังไม่ครบ</p>
            <p className={styles.summaryValueAmber}>{missingOrders.length}</p>
          </div>
        </div>
      </div>

      {missingOrders.length > 0 && (
        <div className={styles.missingCard}>
          <div className={styles.missingHeader}>
            <div>
              <h3 className={styles.missingTitle}>ออเดอร์ที่ยังรอวันดำเนินงานหรือคำขอพร</h3>
              <p className={styles.missingSubtitle}>ติดตามลูกค้าให้กรอกข้อมูลก่อนเข้าคิวงาน</p>
            </div>
          </div>
          <div className={styles.missingList}>
            {missingOrders.map((order) => (
              <div key={order.id} className={styles.missingItem}>
                <div>
                  <p className={styles.missingOrderNo}>{order.lineOrderNo}</p>
                  <p className={styles.missingCustomer}>{order.customerName}</p>
                </div>
                <div className={styles.missingMeta}>
                  <span>{order.requestedServiceDate ? "มีวันนัดแล้ว" : "ยังไม่มีวันนัด"}</span>
                  <span>{order.prayerText?.trim() ? "มีคำขอพร" : "ยังไม่มีคำขอพร"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>
            รายการออเดอร์ ({orders.length})
          </h3>
          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ค้นหาเลขที่คำสั่งซื้อ หรือชื่อลูกค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {orders.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>วันดำเนินงาน</th>
                <th>เลขที่คำสั่งซื้อ</th>
                <th>ลูกค้า</th>
                <th>แพ็กเกจ</th>
                <th>คำขอพร</th>
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
                      <div className={styles.dateCell}>
                        <div className={styles.primaryDate}>
                          {order.requestedServiceDate
                            ? new Date(order.requestedServiceDate).toLocaleDateString("th-TH", {
                                day: "2-digit",
                                month: "2-digit",
                              })
                            : "รอลูกค้ากรอก"}
                        </div>
                        <div className={styles.secondaryDate}>
                          สั่งซื้อ {new Date(order.orderDate).toLocaleDateString("th-TH", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                      </div>
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
                          <div>{getDisplayName(order.items[0].name)}</div>
                          <div className={styles.refNo}>
                            {order.items[0].sku ?? ""}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const prayerText = order.prayerText?.trim();
                        return (
                          <p className={styles.prayerText}>
                            {prayerText && prayerText.length > 0
                              ? prayerText
                              : "รอลูกค้ากรอกคำขอพร"}
                          </p>
                        );
                      })()}
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

export default function StaffPage() {
  return (
    <Suspense fallback={<div className={styles.empty}>กำลังโหลด...</div>}>
      <StaffPageContent />
    </Suspense>
  );
}
