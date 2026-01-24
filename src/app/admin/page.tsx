import { HydrateClient } from "~/trpc/server";
import styles from "./admin.module.css";

export default async function Admin() {
  // Sample data matching the screenshot
  const orders = [
    {
      id: 1,
      date: "12/01",
      orderId: "20250112-LBC01-24283",
      orderSubId: "202501127889510",
      status: "รอตรวจสอบ",
      statusType: "pending",
      customerName: "คุณมา ณัฐวา",
      customerId: "LBC0115122511",
      customerNote: "ชุดถักบาตรเพื่อสุขภาพ (ธรรม)",
      action: "view",
    },
    {
      id: 2,
      date: "12/01",
      orderId: "20250112-LYR01-24980",
      orderSubId: "202501127929136",
      status: "รอการตรวจสอบ",
      statusType: "pending",
      customerName: "พันพิทา เศรนิจ",
      customerId: "LYR0111012616",
      customerNote: "ถักบาตรและสะสมเหรียญประจำเถลิต (วันอาทิตย์)",
      action: "approve",
    },
    {
      id: 3,
      date: "12/01",
      orderId: "20250112-LBC01-25011",
      orderSubId: "202501127923007",
      status: "รอตรวจสอบ",
      statusType: "pending",
      customerName: "พุทธภูมิ แตงทอง",
      customerId: "LYR0111012616",
      customerNote: "ถักบาตรและสะสมเหรียญประจำเถลิต (วันอาทิตย์) (ชย...",
      action: "view",
    },
  ];

  return (
    <HydrateClient>
      <div className={styles.layout}>
        {/* Main Content */}
        <main className={styles.main}>
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>ฝ</div>
              <span className={styles.logoText}>ฝากใส่บาตร Admin</span>
            </div>
            <div className={styles.userSection}>
              <div className={styles.userInfo}>
                <div className={styles.userName}>ผู้ดูแลระบบ</div>
                <div className={styles.userRole}>Super Admin</div>
              </div>
              <button className={styles.logoutButton}>ออกจากระบบ</button>
            </div>
          </header>

          {/* Content */}
          <div className={styles.content}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>
                  สรุปออเดอร์ / รายการออเดอร์
                </h1>
                <p className={styles.pageSubtitle}>ภาพรวมการตรวจสอบงาน</p>
              </div>
              <div className={styles.dateFilter}>
                <span className={styles.dateLabel}>เลือกวันที่:</span>
                <input
                  type="text"
                  className={styles.dateInput}
                  defaultValue="12/01/2025"
                />
                <button className={styles.filterButton}>แสดงทั้งหมด</button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>วันที่ดำเนินการ</p>
                <p className={styles.statValue}>12 ม.ค. 2568</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>ยอดเงินรวม</p>
                <p className={styles.statValue}>฿418</p>
              </div>
              <div className={`${styles.statCard} ${styles.statCardWithIcon}`}>
                <div>
                  <p className={styles.statLabel}>รออนุมัติ</p>
                  <p className={styles.statValueGreen}>1 รายการ</p>
                </div>
                <div className={styles.checkIcon}>✓</div>
              </div>
            </div>

            {/* Orders Table */}
            <div className={styles.tableSection}>
              <div className={styles.tableHeader}>
                <h2 className={styles.tableTitle}>รายการออเดอร์ (3)</h2>
                <div className={styles.tableActions}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="ค้นหารหัสที่กำลังเฉิม..."
                  />
                  <button className={styles.exportButton}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>เลขที่คำสั่งซื้อ</th>
                    <th>สถานะ</th>
                    <th>ลูกค้า</th>
                    <th>แต้มแกน</th>
                    <th>ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.date}</td>
                      <td>
                        <span className={styles.orderId}>{order.orderId}</span>
                        <span className={styles.orderIdSub}>
                          {order.orderSubId}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            order.statusType === "pending"
                              ? styles.statusPending
                              : order.statusType === "approved"
                                ? styles.statusApproved
                                : styles.statusRejected
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <span className={styles.customerName}>
                          {order.customerName}
                        </span>
                      </td>
                      <td>
                        <span className={styles.customerName}>
                          {order.customerId}
                        </span>
                        <span className={styles.customerSub}>
                          {order.customerNote}
                        </span>
                      </td>
                      <td>
                        {order.action === "approve" ? (
                          <button
                            className={`${styles.actionButton} ${styles.approveButton}`}
                          >
                            ตรวจสอบหลักฐาน
                          </button>
                        ) : (
                          <button
                            className={`${styles.actionButton} ${styles.viewButton}`}
                          >
                            รอวิเคราะห์ช้า
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  แสดง 1 ถึง 3 จาก 3 รายการ
                </span>
                <div className={styles.paginationButtons}>
                  <button className={styles.pageButton}>ก่อนหน้า</button>
                  <button className={styles.pageButton}>ถัดไป</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </HydrateClient>
  );
}
