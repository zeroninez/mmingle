// components/UserProfile.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  User,
  Edit3,
  Camera,
  Save,
  X,
  MapPin,
  Calendar,
  Heart,
  MessageCircle,
} from "lucide-react";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "./PostCard";
import { FollowSystem, FollowListModal } from "./FollowSystem";

interface UserStats {
  postsCount: number;
  likesReceived: number;
  commentsReceived: number;
  followersCount?: number;
  followingCount?: number;
}

interface UserProfileProps {
  userId?: string; // 다른 사용자 프로필 조회용
  onClose?: () => void; // 모달로 사용할 때
}

export function UserProfile({ userId, onClose }: UserProfileProps) {
  const { user: currentUser, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    postsCount: 0,
    likesReceived: 0,
    commentsReceived: 0,
  });
  const [showFollowModal, setShowFollowModal] = useState<{
    type: "followers" | "following";
    title: string;
  } | null>(null);

  // 프로필 편집 상태
  const [editData, setEditData] = useState({
    display_name: "",
    bio: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 조회할 사용자 (다른 사용자 프로필 조회 시 userId 사용, 아니면 현재 사용자)
  const targetUser = userId ? null : currentUser; // 일단 현재 사용자만 지원
  const isOwnProfile = !userId || (currentUser && userId === currentUser.id);

  useEffect(() => {
    if (currentUser) {
      setEditData({
        display_name: currentUser.display_name || "",
        bio: currentUser.bio || "",
      });
      loadUserData();
    }
  }, [currentUser]);

  // 사용자 데이터 로드
  const loadUserData = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // 사용자 포스트 로드
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          *,
          user:users(id, username, display_name, avatar_url),
          images:post_images(id, image_url, image_order),
          likes_count:likes(count),
          comments_count:comments(count)
        `,
        )
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // 좋아요 상태 확인
      let postsWithLikes = posts || [];
      if (posts) {
        const postIds = posts.map((post) => post.id);
        const { data: userLikes } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", currentUser.id)
          .in("post_id", postIds);

        const likedPostIds = new Set(userLikes?.map((like) => like.post_id));
        postsWithLikes = posts.map((post) => ({
          ...post,
          is_liked: likedPostIds.has(post.id),
        }));
      }

      setUserPosts(postsWithLikes);

      // 사용자 통계 계산
      const stats: UserStats = {
        postsCount: posts?.length || 0,
        likesReceived: 0,
        commentsReceived: 0,
        followersCount: 0,
        followingCount: 0,
      };

      if (posts && posts.length > 0) {
        // 받은 좋아요 수 계산
        const { data: totalLikes } = await supabase
          .from("likes")
          .select("id", { count: "exact" })
          .in(
            "post_id",
            posts.map((p) => p.id),
          );

        // 받은 댓글 수 계산
        const { data: totalComments } = await supabase
          .from("comments")
          .select("id", { count: "exact" })
          .in(
            "post_id",
            posts.map((p) => p.id),
          );

        stats.likesReceived = totalLikes?.length || 0;
        stats.commentsReceived = totalComments?.length || 0;
      }

      // 팔로우 통계 로드
      const { count: followersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUser.id);

      const { count: followingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", currentUser.id);

      stats.followersCount = followersCount || 0;
      stats.followingCount = followingCount || 0;

      setUserStats(stats);
    } catch (error) {
      console.error("사용자 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 프로필 이미지 업로드
  const handleAvatarUpload = async (file: File) => {
    if (!currentUser || !isOwnProfile) return;

    setUploading(true);
    try {
      // 파일 확장자 확인
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.id}/avatar.${fileExt}`; // 폴더 구조로 변경

      console.log("업로드 시작:", fileName);

      // 이전 아바타 파일 삭제 (선택사항)
      if (currentUser.avatar_url) {
        try {
          const oldFileName = currentUser.avatar_url.split("/").pop();
          await supabase.storage
            .from("avatars")
            .remove([`${currentUser.id}/avatar.${fileExt}`]);
        } catch (deleteError) {
          console.log("이전 파일 삭제 무시:", deleteError);
        }
      }

      // Supabase Storage에 업로드
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true, // 같은 이름 파일이 있으면 덮어쓰기
        });

      if (uploadError) {
        console.error("Storage 업로드 에러:", uploadError);
        throw uploadError;
      }

      console.log("업로드 성공:", uploadData);

      // 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      console.log("Public URL:", urlData.publicUrl);

      // 사용자 프로필 업데이트
      await updateProfile({ avatar_url: urlData.publicUrl });

      alert("프로필 이미지가 업데이트되었습니다!");
    } catch (error) {
      console.error("이미지 업로드 실패:", error);

      let errorMessage = "이미지 업로드에 실패했습니다.";

      if (error.message?.includes("row-level security")) {
        errorMessage = "권한 오류입니다. Storage 설정을 확인해주세요.";
      } else if (error.message?.includes("Unauthorized")) {
        errorMessage = "업로드 권한이 없습니다. 로그인 상태를 확인해주세요.";
      } else if (error.message) {
        errorMessage = `오류: ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // 프로필 정보 저장
  const handleSaveProfile = async () => {
    if (!currentUser || !isOwnProfile) return;

    setLoading(true);
    try {
      await updateProfile(editData);
      setIsEditing(false);
      alert("프로필이 업데이트되었습니다!");
    } catch (error) {
      console.error("프로필 업데이트 실패:", error);
      alert("프로필 업데이트에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로그인이 필요합니다.</div>
      </div>
    );
  }

  const profileContent = (
    <div className="max-w-4xl mx-auto">
      {/* 프로필 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* 프로필 이미지 */}
          <div className="relative">
            <div className="w-24 h-24 bg-gray-300 rounded-full overflow-hidden">
              {currentUser.avatar_url ? (
                <Image
                  src={currentUser.avatar_url}
                  alt={currentUser.display_name || currentUser.username}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-lime-100 flex items-center justify-center text-lime-600 font-bold text-2xl">
                  {(currentUser.display_name || currentUser.username)
                    ?.charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            {isOwnProfile && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-lime-500 text-white rounded-full flex items-center justify-center hover:bg-lime-600 shadow-lg disabled:opacity-50"
                title="프로필 이미지 변경"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
              }}
              className="hidden"
            />
          </div>

          {/* 프로필 정보 */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    표시 이름
                  </label>
                  <input
                    type="text"
                    value={editData.display_name}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        display_name: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                    placeholder="표시할 이름"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    소개
                  </label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) =>
                      setEditData((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 resize-none"
                    rows={3}
                    placeholder="자신을 소개해보세요..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="px-4 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        display_name: currentUser.display_name || "",
                        bio: currentUser.bio || "",
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">
                    {currentUser.display_name || "이름 없음"}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                      title="프로필 편집"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-gray-600 mb-3">@{currentUser.username}</p>

                {currentUser.bio && (
                  <p className="text-gray-800 mb-3">{currentUser.bio}</p>
                )}

                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(currentUser.created_at).toLocaleDateString(
                      "ko-KR",
                      {
                        year: "numeric",
                        month: "long",
                      },
                    )}
                    부터 시작
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 팔로우 시스템 (다른 사용자 프로필인 경우) */}
        {!isOwnProfile && (
          <div className="mt-4 pt-4 border-t">
            <FollowSystem
              targetUserId={targetUser?.id || ""}
              targetUserName={
                targetUser?.display_name || targetUser?.username || ""
              }
            />
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <button
            onClick={() => {}} // 포스트는 클릭 불가
            className="text-center cursor-default"
          >
            <div className="text-2xl font-bold text-gray-800">
              {userStats.postsCount}
            </div>
            <div className="text-sm text-gray-500">포스트</div>
          </button>

          <button
            onClick={() =>
              setShowFollowModal({ type: "followers", title: "팔로워" })
            }
            className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-blue-500">
              {userStats.followersCount || 0}
            </div>
            <div className="text-sm text-gray-500">팔로워</div>
          </button>

          <button
            onClick={() =>
              setShowFollowModal({ type: "following", title: "팔로잉" })
            }
            className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-green-500">
              {userStats.followingCount || 0}
            </div>
            <div className="text-sm text-gray-500">팔로잉</div>
          </button>
        </div>
      </div>

      {/* 사용자 포스트 */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">내 포스트</h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">포스트를 불러오는 중...</div>
          </div>
        ) : userPosts.length > 0 ? (
          <div className="grid gap-4">
            {userPosts.map((post) => (
              <PostCard key={post.id} post={post} onUpdate={loadUserData} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-gray-500 mb-2">
              아직 작성한 포스트가 없습니다.
            </div>
            <div className="text-sm text-gray-400">
              지도에서 위치를 클릭해서 첫 번째 포스트를 작성해보세요!
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 모달로 사용하는 경우
  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-50 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">프로필</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">{profileContent}</div>
        </div>

        {/* 팔로우 목록 모달 */}
        {showFollowModal && (
          <FollowListModal
            isOpen={true}
            onClose={() => setShowFollowModal(null)}
            userId={currentUser?.id || ""}
            type={showFollowModal.type}
            title={showFollowModal.title}
          />
        )}
      </div>
    );
  }

  // 페이지로 사용하는 경우
  return (
    <div className="h-full py-6 px-4">
      {profileContent}

      {/* 팔로우 목록 모달 */}
      {showFollowModal && (
        <FollowListModal
          isOpen={true}
          onClose={() => setShowFollowModal(null)}
          userId={currentUser?.id || ""}
          type={showFollowModal.type}
          title={showFollowModal.title}
        />
      )}
    </div>
  );
}
