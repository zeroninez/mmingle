// components/NotificationSystem.tsx
"use client";

import { useState, useEffect } from "react";
import { Bell, X, Heart, MessageCircle, User, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: "like" | "comment" | "follow";
  message: string;
  is_read: boolean;
  created_at: string;
  post_id?: string;
  from_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  post?: {
    id: string;
    content: string;
    location_name?: string;
  };
}

interface NotificationSystemProps {
  onPostClick?: (postId: string) => void;
}

export function NotificationSystem({ onPostClick }: NotificationSystemProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 알림 로드
  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          from_user:users!notifications_from_user_id_fkey(id, username, display_name, avatar_url),
          post:posts(id, content, location_name)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    } catch (error) {
      console.error("알림 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      // 로컬 상태 업데이트
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("알림 읽음 처리 실패:", error);
    }
  };

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("전체 읽음 처리 실패:", error);
    }
  };

  // 알림 삭제
  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      const deletedNotification = notifications.find(
        (n) => n.id === notificationId,
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("알림 삭제 실패:", error);
    }
  };

  // 실시간 알림 구독
  useEffect(() => {
    if (!user) return;

    loadNotifications();

    // Supabase Realtime 구독
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // 새 알림이 들어오면 전체 목록 다시 로드
          await loadNotifications();

          // 브라우저 알림 표시 (권한이 있는 경우)
          if (Notification.permission === "granted") {
            const notification = payload.new as any;
            new Notification("새 알림", {
              body: notification.message,
              icon: "/icon-192x192.png", // PWA 아이콘 경로
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="w-4 h-4 text-red-500" />;
      case "comment":
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case "follow":
        return <User className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      {/* 알림 버튼 */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="알림"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 드롭다운 */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">알림</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-lime-600 hover:text-lime-700 font-medium"
                >
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">로딩 중...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <div className="text-sm text-gray-500">알림이 없습니다</div>
                </div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.is_read ? "bg-lime-50" : ""
                  }`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.post_id) {
                      onPostClick?.(notification.post_id);
                      setShowDropdown(false);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* 알림 아이콘 */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* 사용자 아바타 */}
                    <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                      {notification.from_user?.avatar_url ? (
                        <img
                          src={notification.from_user.avatar_url}
                          alt={
                            notification.from_user.display_name ||
                            notification.from_user.username
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs">
                          {(
                            notification.from_user?.display_name ||
                            notification.from_user?.username
                          )
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* 알림 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">
                          {notification.from_user?.display_name ||
                            notification.from_user?.username}
                        </span>
                        <span className="text-gray-600">
                          {notification.message}
                        </span>
                      </div>

                      {/* 포스트 미리보기 */}
                      {notification.post && (
                        <div className="mt-1 text-xs text-gray-500 truncate">
                          {notification.post.content?.slice(0, 30)}...
                          {notification.post.location_name && (
                            <span> • {notification.post.location_name}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            {
                              addSuffix: true,
                              locale: ko,
                            },
                          )}
                        </div>

                        {/* 읽음 표시 및 삭제 버튼 */}
                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-lime-500 rounded-full"></div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
