"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { getSupabaseBrowserClient } from "~/lib/supabase-browser";
import { authClient } from "~/server/lib/auth-client";
import { type OrderWithItems } from "~/server/lib/line/types";
import { StatsCards } from "./_components/stats-cards";
import { OrderTable } from "./_components/order-table";
import { ProofReviewModal } from "./_components/proof-review-modal";
import { LineSuccessModal } from "./_components/line-success-modal";
import { DailySummaryButton } from "./_components/daily-summary-button";
import styles from "./admin.module.css";

export default function Admin() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0]!;
  const [selectedDate, setSelectedDate] = useState(today);
  const [reviewOrder, setReviewOrder] = useState<OrderWithItems | null>(null);
  const [approvedCustomer, setApprovedCustomer] = useState<string | null>(null);

  const ordersQuery = api.order.list.useQuery({ date: selectedDate });
  const summaryQuery = api.order.getDailySummary.useQuery({
    date: selectedDate,
  });
  const syncMutation = api.order.syncFromLine.useMutation({
    onSuccess: () => {
      void ordersQuery.refetch();
      void summaryQuery.refetch();
    },
  });
  const approveMutation = api.review.approve.useMutation({
    onSuccess: (data) => {
      setReviewOrder(null);
      setApprovedCustomer(data.customerName);
      void ordersQuery.refetch();
      void summaryQuery.refetch();
    },
  });
  const rejectMutation = api.review.reject.useMutation({
    onSuccess: () => {
      setReviewOrder(null);
      void ordersQuery.refetch();
      void summaryQuery.refetch();
    },
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload: { new: { internal_status?: string } }) => {
          if (payload.new.internal_status === "UPLOADED") {
            void ordersQuery.refetch();
            void summaryQuery.refetch();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ordersQuery, summaryQuery]);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>ฝ</div>
            <span className={styles.logoText}>ฝากใส่บาตร Admin</span>
          </div>
          <div className={styles.userSection}>
            <Link href="/admin/users" className={styles.filterButton} style={{ textDecoration: "none" }}>
              👥 จัดการ User
            </Link>
            <Link href="/admin/mappings" className={styles.filterButton} style={{ textDecoration: "none" }}>
              ⚙️ จัดการ Mapping
            </Link>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className={styles.filterButton}
            >
              {syncMutation.isPending ? "กำลังซิงค์..." : "ซิงค์ LINE Shop"}
            </button>
            <div className={styles.userInfo}>
              <div className={styles.userName}>ผู้ดูแลระบบ</div>
              <div className={styles.userRole}>Super Admin</div>
            </div>
            <button onClick={handleLogout} className={styles.logoutButton}>
              ออกจากระบบ
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>
                สรุปออเดอร์ / รายการออเดอร์
              </h1>
              <p className={styles.pageSubtitle}>ภาพรวมการตรวจสอบงาน</p>
            </div>
            <div className={styles.dateFilter}>
              <DailySummaryButton date={selectedDate} />
              <span className={styles.dateLabel}>เลือกวันที่:</span>
              <input
                type="date"
                className={styles.dateInput}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate !== today && (
                <button
                  className={styles.filterButton}
                  onClick={() => setSelectedDate(today)}
                >
                  วันนี้
                </button>
              )}
            </div>
          </div>

          {summaryQuery.data && <StatsCards summary={summaryQuery.data} />}

          <OrderTable
            orders={(ordersQuery.data ?? []) as OrderWithItems[]}
            onReview={setReviewOrder}
          />
        </div>
      </main>

      {reviewOrder && (
        <ProofReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onApprove={(id) => approveMutation.mutate({ orderId: id })}
          onReject={(id, reason) =>
            rejectMutation.mutate({ orderId: id, reason })
          }
          isApproving={approveMutation.isPending}
        />
      )}

      {approvedCustomer && (
        <LineSuccessModal
          customerName={approvedCustomer}
          onClose={() => setApprovedCustomer(null)}
        />
      )}
    </div>
  );
}
