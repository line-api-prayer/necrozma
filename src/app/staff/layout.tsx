import Link from "next/link";
import styles from "./layout.module.css";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>ฝ</div>
          <span className={styles.brandText}>ฝากใส่บาตร</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/staff" className={styles.navLink}>
            รายการงาน
          </Link>
          <Link href="/staff/scan" className={styles.navLink}>
            สแกน QR
          </Link>
        </nav>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
