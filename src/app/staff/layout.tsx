"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "~/server/lib/auth-client";
import { NotificationBell } from "~/components/notification-bell";
import styles from "./layout.module.css";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = authClient.useSession();
  const isAdmin = session.data?.user?.role === "admin";
  const userId = session.data?.user?.id;

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
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>ฝ</div>
          <span className={styles.brandText}>ฝากใส่บาตร</span>
        </div>
        <nav className={styles.nav}>
          {isAdmin && (
            <Link href="/admin" className={styles.navLink} style={{ color: "#2563eb", fontWeight: "bold" }}>
              ⚙️ โหมด Admin
            </Link>
          )}
          <Link href="/staff" className={styles.navLink}>
            รายการงาน
          </Link>
          <Link href="/staff/scan" className={styles.navLink}>
            สแกน QR
          </Link>
          {userId && <NotificationBell userId={userId} />}
          <button onClick={handleLogout} className={styles.logoutButton}>
            ออกจากระบบ
          </button>
        </nav>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
