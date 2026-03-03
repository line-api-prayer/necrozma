"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "~/server/lib/auth-client";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        setLoading(false);
        return;
      }

      // Redirect based on role
      const session = await authClient.getSession();
      const role = session.data?.user?.role;

      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/staff");
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandWrap}>
          <div className={styles.brandIcon}>ฝ</div>
          <h1 className={styles.brandName}>ฝากใส่บาตร</h1>
          <p className={styles.brandSub}>เข้าสู่ระบบเพื่อดำเนินการ</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
