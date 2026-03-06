"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import styles from "./mappings.module.css";
import Link from "next/link";

export default function MappingsPage() {
  const [originalName, setOriginalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isUpserting, setIsUpserting] = useState(false);

  const utils = api.useUtils();
  const mappingsQuery = api.mapping.list.useQuery();
  const upsertMutation = api.mapping.upsert.useMutation({
    onSuccess: async () => {
      await utils.mapping.list.invalidate();
      setOriginalName("");
      setDisplayName("");
    },
  });
  const deleteMutation = api.mapping.delete.useMutation({
    onSuccess: async () => {
      await utils.mapping.list.invalidate();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalName || !displayName) return;
    setIsUpserting(true);
    try {
      await upsertMutation.mutateAsync({ originalName, displayName });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Someting went wrong"}`);
    } finally {
      setIsUpserting(false);
    }
  };

  const handleEdit = (mapping: { original_name: string; display_name: string }) => {
    setOriginalName(mapping.original_name);
    setDisplayName(mapping.display_name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mapping?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Someting went wrong"}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">Admin</Link> &gt; Product Mappings
        </div>
        <h1 className={styles.title}>Product Display Mappings</h1>
        <p className={styles.subtitle}>
          Map long LINE product names to shorter names for summaries and messages.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Add / Edit Mapping</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Original Product Name (from LINE)</label>
              <input
                type="text"
                value={originalName}
                onChange={(e) => setOriginalName(e.target.value)}
                placeholder="e.g. ใส่บาตร ชุด S ร่ำรวย"
                required
              />
            </div>
            <div className={styles.field}>
              <label>Display Name (Simplified)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. ใส่บาตรชุด S"
                required
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isUpserting}
            >
              {isUpserting ? "Saving..." : "Save Mapping"}
            </button>
            {originalName && (
               <button
               type="button"
               className={styles.cancelBtn}
               onClick={() => {
                 setOriginalName("");
                 setDisplayName("");
               }}
             >
               Clear
             </button>
            )}
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Existing Mappings</h2>
          {mappingsQuery.isLoading ? (
            <p>Loading mappings...</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Original Name</th>
                    <th>Display Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingsQuery.data?.map((m) => (
                    <tr key={m.id}>
                      <td>{m.original_name}</td>
                      <td>{m.display_name}</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            onClick={() => handleEdit(m)}
                            className={styles.editBtn}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className={styles.deleteBtn}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {mappingsQuery.data?.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.empty}>
                        No mappings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
