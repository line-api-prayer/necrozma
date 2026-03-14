"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import styles from "./mappings.module.css";
import Link from "next/link";

interface ProductMapping {
  id: string;
  original_name: string;
  display_name: string;
}

export default function MappingsPage() {
  const [newOriginal, setNewOriginal] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Inline edit state: { [id]: { original_name, display_name } }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState("");
  const [editDisplay, setEditDisplay] = useState("");

  const utils = api.useUtils();
  const mappingsQuery = api.mapping.list.useQuery();
  const mappings = (mappingsQuery.data as ProductMapping[] | undefined) ?? [];

  const upsertMutation = api.mapping.upsert.useMutation({
    onSuccess: async () => {
      await utils.mapping.list.invalidate();
    },
  });
  const deleteMutation = api.mapping.delete.useMutation({
    onSuccess: async () => {
      await utils.mapping.list.invalidate();
    },
  });

  // --- Add new mapping ---
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOriginal.trim() || !newDisplay.trim()) return;
    setIsAdding(true);
    try {
      await upsertMutation.mutateAsync({
        originalName: newOriginal.trim(),
        displayName: newDisplay.trim(),
      });
      setNewOriginal("");
      setNewDisplay("");
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    } finally {
      setIsAdding(false);
    }
  };

  // --- Start inline edit ---
  const startEdit = (m: ProductMapping) => {
    setEditingId(m.id);
    setEditOriginal(m.original_name);
    setEditDisplay(m.display_name);
  };

  // --- Save inline edit ---
  const saveEdit = async () => {
    if (!editOriginal.trim() || !editDisplay.trim()) return;
    try {
      await upsertMutation.mutateAsync({
        originalName: editOriginal.trim(),
        displayName: editDisplay.trim(),
      });
      setEditingId(null);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    }
  };

  // --- Cancel inline edit ---
  const cancelEdit = () => setEditingId(null);

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบการตั้งค่านี้?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "บางอย่างผิดพลาด"}`);
    }
  };

  return (
    <div className={styles.root}>
      {/* Page header */}
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin" className={styles.breadcrumbLink}>Admin</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>จัดการชื่อสินค้า (Mapping)</span>
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚙️</span>
          การตั้งค่าชื่อสินค้าสำหรับรายงาน
        </h1>
        <p className={styles.subtitle}>
          แปลงชื่อสินค้าที่ยาวจาก LINE API ให้เป็นชื่อที่สั้นและอ่านง่ายสำหรับใช้ในสรุปยอดและรายงาน PDF
        </p>
      </header>

      <div className={styles.layout}>
        {/* Left: Add form */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>＋</span>
              <h2 className={styles.cardTitle}>เพิ่มการตั้งค่า</h2>
            </div>
            <form onSubmit={handleAdd} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>ชื่อสินค้าจาก LINE API (ต้องตรงกัน)</label>
                <textarea
                  className={styles.textarea}
                  value={newOriginal}
                  onChange={(e) => setNewOriginal(e.target.value)}
                  placeholder="เช่น ใส่บาตร ชุด S  ร่ำรวย"
                  rows={2}
                  required
                />
                <span className={styles.hint}>แนะนำให้คัดลอกและวางจาก LINE โดยตรงเพื่อป้องกันปัญหาเว้นวรรค</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>ชื่อที่จะให้แสดงผล</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newDisplay}
                  onChange={(e) => setNewDisplay(e.target.value)}
                  placeholder="เช่น ใส่บาตรชุด S"
                  required
                />
              </div>
              <button type="submit" className={styles.addBtn} disabled={isAdding}>
                {isAdding ? (
                  <span className={styles.spinner} />
                ) : (
                  "บันทึกการตั้งค่า"
                )}
              </button>
            </form>
          </div>

          <div className={styles.statsCard}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{mappings.length}</span>
              <span className={styles.statLabel}>รายการทั้งหมด</span>
            </div>
          </div>
        </aside>

        {/* Right: Table */}
        <main className={styles.main}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>↔</span>
              <h2 className={styles.cardTitle}>รายการที่มีอยู่</h2>
            </div>

            {mappingsQuery.isLoading ? (
              <div className={styles.loading}>
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
              </div>
            ) : mappings.length === 0 ? (
              <div className={styles.empty}>
                <p>ยังไม่มีการตั้งค่า</p>
                <p>เพิ่มการตั้งค่าแรกของคุณโดยใช้แบบฟอร์มด้านข้าง</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>ชื่อสินค้าจาก LINE API</th>
                      <th className={styles.th}>ชื่อที่แสดงผล</th>
                      <th className={styles.th} style={{ width: "140px" }}>ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) =>
                      editingId === m.id ? (
                        // Inline edit row
                        <tr key={m.id} className={styles.editRow}>
                          <td className={styles.td}>
                            <textarea
                              className={styles.inlineTextarea}
                              value={editOriginal}
                              onChange={(e) => setEditOriginal(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                          </td>
                          <td className={styles.td}>
                            <input
                              className={styles.inlineInput}
                              value={editDisplay}
                              onChange={(e) => setEditDisplay(e.target.value)}
                            />
                          </td>
                          <td className={styles.td}>
                            <div className={styles.rowActions}>
                              <button
                                onClick={saveEdit}
                                className={styles.saveBtn}
                                disabled={upsertMutation.isPending}
                              >
                                {upsertMutation.isPending ? "…" : "บันทึก"}
                              </button>
                              <button onClick={cancelEdit} className={styles.cancelBtn}>
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        // Normal row
                        <tr key={m.id} className={styles.row}>
                          <td className={styles.td}>
                            <span className={styles.originalName}>{m.original_name}</span>
                          </td>
                          <td className={styles.td}>
                            <span className={styles.displayBadge}>{m.display_name}</span>
                          </td>
                          <td className={styles.td}>
                            <div className={styles.rowActions}>
                              <button
                                onClick={() => startEdit(m)}
                                className={styles.editBtn}
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                onClick={() => handleDelete(m.id)}
                                className={styles.deleteBtn}
                                disabled={deleteMutation.isPending}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
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
