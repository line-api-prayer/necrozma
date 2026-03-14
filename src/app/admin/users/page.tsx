"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import styles from "./users.module.css";
import Link from "next/link";
import Image from "next/image";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "user";
  image: string | null;
  banned: boolean | null;
}

export default function UsersPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editBanned, setEditBanned] = useState(false);

  const utils = api.useUtils();
  const usersQuery = api.user.list.useQuery();
  const users = (usersQuery.data as User[] | undefined) ?? [];

  const updateMutation = api.user.update.useMutation({
    onSuccess: async () => {
      await utils.user.list.invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = api.user.delete.useMutation({
    onSuccess: async () => {
      await utils.user.list.invalidate();
    },
  });

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name ?? "");
    setEditRole(user.role);
    setEditBanned(!!user.banned);
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        name: editName,
        role: editRole,
        banned: editBanned,
      });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    }
  };

  const handleQuickApprove = async (user: User) => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        banned: false,
      });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin" className={styles.breadcrumbLink}>Admin</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>จัดการผู้ใช้งาน</span>
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>👥</span>
          จัดการผู้ใช้งาน
        </h1>
        <p className={styles.subtitle}>
          จัดการสิทธิ์และข้อมูลผู้ใช้งานในระบบ (แอดมิน/พนักงาน)
        </p>
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>👤</span>
              <h2 className={styles.cardTitle}>รายชื่อผู้ใช้งานในระบบ</h2>
            </div>

            {usersQuery.isLoading ? (
              <div className={styles.loading}>
                <div className={styles.loadingDot} />
                <div className={styles.loadingDot} />
                <div className={styles.loadingDot} />
              </div>
            ) : users.length === 0 ? (
              <div className={styles.empty}>
                <p>ไม่พบผู้ใช้งานรายอื่นในระบบ</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>ผู้ใช้งาน</th>
                      <th className={styles.th}>ระดับสิทธิ์</th>
                      <th className={styles.th}>ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      editingId === user.id ? (
                        <tr key={user.id} className={styles.editRow}>
                          <td className={styles.td}>
                            <div className={styles.userCell}>
                              <div className={styles.avatar}>
                                {user.image ? (
                                  <Image src={user.image} alt="" width={40} height={40} className={styles.avatarImg} unoptimized />
                                ) : (
                                  (user.name?.[0] ?? user.email[0])?.toUpperCase()
                                )}
                              </div>
                              <input 
                                className={styles.inlineInput}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="ชื่อผู้ใช้งาน"
                                autoFocus
                              />
                            </div>
                          </td>
                          <td className={styles.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <select 
                                className={styles.inlineSelect}
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as "admin" | "user")}
                              >
                                <option value="user">พนักงาน (Staff)</option>
                                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                              </select>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
                                <input 
                                  type="checkbox" 
                                  checked={editBanned} 
                                  onChange={(e) => setEditBanned(e.target.checked)}
                                />
                                ระงับการใช้งาน (Banned)
                              </label>
                            </div>
                          </td>
                          <td className={styles.td}>
                            <div className={styles.rowActions}>
                              <button onClick={handleSave} className={styles.saveBtn} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                              </button>
                              <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={user.id} className={styles.row}>
                          <td className={styles.td}>
                            <div className={styles.userCell}>
                              <div className={styles.avatar}>
                                {user.image ? (
                                  <Image src={user.image} alt="" width={40} height={40} className={styles.avatarImg} unoptimized />
                                ) : (
                                  (user.name?.[0] ?? user.email[0])?.toUpperCase()
                                )}
                              </div>
                              <div>
                                <span className={styles.userName}>{user.name ?? "ไม่มีชื่อ"}</span>
                                <span className={styles.userEmail}>{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className={`${styles.roleBadge} ${user.role === "admin" ? styles.roleAdmin : styles.roleUser}`}>
                                {user.role === "admin" ? "Admin" : "Staff"}
                              </span>
                              {user.banned && (
                                <span className={styles.roleAdmin} style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>
                                  รออนุมัติ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={styles.td}>
                            <div className={styles.rowActions}>
                              {user.banned ? (
                                <button 
                                  onClick={() => handleQuickApprove(user)} 
                                  className={styles.saveBtn}
                                  style={{ backgroundColor: "#22c55e" }}
                                  disabled={updateMutation.isPending}
                                >
                                  ✅ อนุมัติ
                                </button>
                              ) : (
                                <button onClick={() => startEdit(user)} className={styles.editBtn}>
                                  ✏️ แก้ไข
                                </button>
                              )}
                              <button onClick={() => handleDelete(user.id)} className={styles.deleteBtn} disabled={deleteMutation.isPending}>
                                🗑 ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
