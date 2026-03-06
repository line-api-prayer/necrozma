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
    if (!confirm("Delete this mapping?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    }
  };

  return (
    <div className={styles.root}>
      {/* Page header */}
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin" className={styles.breadcrumbLink}>Admin</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>Product Mappings</span>
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚙️</span>
          Product Display Mappings
        </h1>
        <p className={styles.subtitle}>
          Map long LINE API product names to short, readable display names used in summaries and PDF reports.
        </p>
      </header>

      <div className={styles.layout}>
        {/* Left: Add form */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>＋</span>
              <h2 className={styles.cardTitle}>Add Mapping</h2>
            </div>
            <form onSubmit={handleAdd} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>LINE API Name (exact)</label>
                <textarea
                  className={styles.textarea}
                  value={newOriginal}
                  onChange={(e) => setNewOriginal(e.target.value)}
                  placeholder="e.g. ใส่บาตร ชุด S  ร่ำรวย"
                  rows={2}
                  required
                />
                <span className={styles.hint}>Copy-paste from LINE to avoid spacing issues</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newDisplay}
                  onChange={(e) => setNewDisplay(e.target.value)}
                  placeholder="e.g. ใส่บาตรชุด S"
                  required
                />
              </div>
              <button type="submit" className={styles.addBtn} disabled={isAdding}>
                {isAdding ? (
                  <span className={styles.spinner} />
                ) : (
                  "Save Mapping"
                )}
              </button>
            </form>
          </div>

          <div className={styles.statsCard}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{mappings.length}</span>
              <span className={styles.statLabel}>Total Mappings</span>
            </div>
          </div>
        </aside>

        {/* Right: Table */}
        <main className={styles.main}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>↔</span>
              <h2 className={styles.cardTitle}>Existing Mappings</h2>
            </div>

            {mappingsQuery.isLoading ? (
              <div className={styles.loading}>
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
              </div>
            ) : mappings.length === 0 ? (
              <div className={styles.empty}>
                <p>No mappings yet.</p>
                <p>Add your first mapping using the form.</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>LINE API Name</th>
                      <th className={styles.th}>Display Name</th>
                      <th className={styles.th} style={{ width: "140px" }}>Actions</th>
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
                                {upsertMutation.isPending ? "…" : "Save"}
                              </button>
                              <button onClick={cancelEdit} className={styles.cancelBtn}>
                                Cancel
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
                                ✏️ Edit
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
