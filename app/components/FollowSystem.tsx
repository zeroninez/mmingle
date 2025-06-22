// components/FollowSystem.tsx
"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserMinus, Users, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { createFollowNotification } from "@/lib/notifications";

interface FollowSystemProps {
  targetUserId: string;
  targetUserName: string;
  compact?: boolean;
}

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isFollowingMe: boolean;
}

export function FollowSystem({
  targetUserId,
  targetUserName,
  compact = false,
}: FollowSystemProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    isFollowingMe: false,
  });
  const [loading, setLoading] = useState(false);

  // 팔로우 통계 로드
  const loadFollowStats = async () => {
    try {
      // 팔로워 수
      const { count: followersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId);

      // 팔로잉 수
      const { count: followingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId);

      let isFollowing = false;
      let isFollowingMe = false;

      if (user && user.id !== targetUserId) {
        // 내가 이 사용자를 팔로우하고 있는지
        const { data: followingData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .single();

        isFollowing = !!followingData;

        // 이 사용자가 나를 팔로우하고 있는지
        const { data: followerData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", targetUserId)
          .eq("following_id", user.id)
          .single();

        isFollowingMe = !!followerData;
      }

      setStats({
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        isFollowing,
        isFollowingMe,
      });
    } catch (error) {
      console.error("팔로우 통계 로드 실패:", error);
    }
  };

  // 팔로우 토글
  const toggleFollow = async () => {
    if (!user || loading || user.id === targetUserId) return;

    setLoading(true);
    try {
      if (stats.isFollowing) {
        // 언팔로우
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);

        if (error) throw error;

        setStats((prev) => ({
          ...prev,
          isFollowing: false,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
      } else {
        // 팔로우
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });

        if (error) throw error;

        // 팔로우 알림 생성
        await createFollowNotification(
          targetUserId,
          user.id,
          user.display_name || user.username,
        );

        setStats((prev) => ({
          ...prev,
          isFollowing: true,
          followersCount: prev.followersCount + 1,
        }));
      }
    } catch (error) {
      console.error("팔로우 토글 실패:", error);
      alert("팔로우 처리에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowStats();
  }, [targetUserId, user]);

  // 자기 자신인 경우 팔로우 버튼 숨김
  if (!user || user.id === targetUserId) {
    return (
      <div className={`flex items-center gap-4 ${compact ? "text-sm" : ""}`}>
        <div className="flex items-center gap-1">
          <Users
            className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-gray-500`}
          />
          <span className="font-medium">{stats.followersCount}</span>
          <span className="text-gray-500">팔로워</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart
            className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-gray-500`}
          />
          <span className="font-medium">{stats.followingCount}</span>
          <span className="text-gray-500">팔로잉</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? "text-sm" : ""}`}>
      {/* 팔로우 통계 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Users
            className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-gray-500`}
          />
          <span className="font-medium">{stats.followersCount}</span>
          <span className="text-gray-500">팔로워</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart
            className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-gray-500`}
          />
          <span className="font-medium">{stats.followingCount}</span>
          <span className="text-gray-500">팔로잉</span>
        </div>
      </div>

      {/* 팔로우 버튼 */}
      <button
        onClick={toggleFollow}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? "text-sm px-3 py-1" : ""
        } ${
          stats.isFollowing
            ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
            : "bg-lime-500 text-white hover:bg-lime-600"
        }`}
      >
        {stats.isFollowing ? (
          <>
            <UserMinus className={`${compact ? "w-3 h-3" : "w-4 h-4"}`} />
            {loading ? "처리 중..." : "언팔로우"}
          </>
        ) : (
          <>
            <UserPlus className={`${compact ? "w-3 h-3" : "w-4 h-4"}`} />
            {loading ? "처리 중..." : "팔로우"}
          </>
        )}
      </button>

      {/* 상호 팔로우 표시 */}
      {stats.isFollowingMe && (
        <div
          className={`px-2 py-1 bg-blue-100 text-blue-700 rounded-full ${compact ? "text-xs" : "text-sm"}`}
        >
          맞팔로우
        </div>
      )}
    </div>
  );
}

// 팔로워/팔로잉 목록 모달
interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
  title: string;
}

export function FollowListModal({
  isOpen,
  onClose,
  userId,
  type,
  title,
}: FollowListModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    if (!isOpen) return;

    setLoading(true);
    try {
      let query;

      if (type === "followers") {
        // 팔로워 목록
        query = supabase
          .from("follows")
          .select(
            `
            follower:users!follows_follower_id_fkey(
              id, username, display_name, avatar_url, bio
            )
          `,
          )
          .eq("following_id", userId);
      } else {
        // 팔로잉 목록
        query = supabase
          .from("follows")
          .select(
            `
            following:users!follows_following_id_fkey(
              id, username, display_name, avatar_url, bio
            )
          `,
          )
          .eq("follower_id", userId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const userList =
        data?.map((item) =>
          type === "followers" ? item.follower : item.following,
        ) || [];

      setUsers(userList);
    } catch (error) {
      console.error("사용자 목록 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [isOpen, userId, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[70vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            ×
          </button>
        </div>

        {/* 사용자 목록 */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <div>
                  아직 {type === "followers" ? "팔로워" : "팔로잉"}가 없습니다
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {users.map((userData) => (
                <div
                  key={userData.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg"
                >
                  {/* 프로필 이미지 */}
                  <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                    {userData.avatar_url ? (
                      <img
                        src={userData.avatar_url}
                        alt={userData.display_name || userData.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                        {(userData.display_name || userData.username)
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* 사용자 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {userData.display_name || "이름 없음"}
                    </div>
                    <div className="text-sm text-gray-500">
                      @{userData.username}
                    </div>
                    {userData.bio && (
                      <div className="text-sm text-gray-600 truncate">
                        {userData.bio}
                      </div>
                    )}
                  </div>

                  {/* 팔로우 버튼 */}
                  {user && userData.id !== user.id && (
                    <FollowSystem
                      targetUserId={userData.id}
                      targetUserName={
                        userData.display_name || userData.username
                      }
                      compact
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
