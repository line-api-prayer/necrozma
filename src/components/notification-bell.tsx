"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { getSupabaseBrowserClient } from "~/lib/supabase-browser";
import Link from "next/link";
import styles from "./notification-bell.module.css";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const utils = api.useUtils();
  const notificationsQuery = api.user.notifications.useQuery();
  const markReadMutation = api.user.markNotificationRead.useMutation({
    onSuccess: () => utils.user.notifications.invalidate(),
  });
  const markAllReadMutation = api.user.markAllNotificationsRead.useMutation({
    onSuccess: () => utils.user.notifications.invalidate(),
  });

  const notifications = (notificationsQuery.data as Notification[] | undefined) ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void utils.user.notifications.invalidate();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, utils.user.notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (notification: Notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate({ id: notification.id });
    }
    setIsOpen(false);
  };

  return (
    <div className={styles.bellWrapper} ref={dropdownRef}>
      <button className={styles.bellButton} onClick={() => setIsOpen(!isOpen)}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>การแจ้งเตือน</span>
            {unreadCount > 0 && (
              <button
                className={styles.markAllBtn}
                onClick={() => markAllReadMutation.mutate()}
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>
          <div className={styles.notificationList}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>ไม่มีการแจ้งเตือน</div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  className={`${styles.notificationItem} ${!n.is_read ? styles.unread : ""}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className={styles.itemTitle}>{n.title}</span>
                  <span className={styles.itemMessage}>{n.message}</span>
                  <span className={styles.itemTime}>
                    {new Date(n.created_at).toLocaleString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
