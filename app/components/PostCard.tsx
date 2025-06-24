"use client";

import { useState, useEffect } from "react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Heart,
  MessageCircle,
  MapPin,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PostManagementModal } from "./PostManagementModal";
import {
  createLikeNotification,
  createCommentNotification,
} from "@/lib/notifications";
import { renderTextWithHashtags } from "./HashtagSystem";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface PostCardProps {
  post: Post;
  onUpdate?: () => void;
  compact?: boolean;
  onHashtagClick?: (hashtag: string) => void; // 해시태그 클릭 핸들러 추가
}

export function PostCard({
  post,
  onUpdate,
  compact = false,
  onHashtagClick,
}: PostCardProps) {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);

  // 댓글 목록 불러오기
  const loadComments = async () => {
    if (!showComments) return;

    setLoadingComments(true);
    try {
      const { data: commentsData, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          user:users(id, username, display_name, avatar_url)
        `,
        )
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(commentsData || []);
    } catch (error) {
      console.error("댓글 로드 실패:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  // 댓글 섹션 토글 시 댓글 로드
  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, post.id]);

  // 좋아요 토글
  const toggleLike = async () => {
    if (!user || isLiking) return;

    setIsLiking(true);
    try {
      if (post.is_liked) {
        // 좋아요 취소
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", post.id);

        if (error) throw error;
      } else {
        // 좋아요 추가
        const { error } = await supabase.from("likes").insert({
          user_id: user.id,
          post_id: post.id,
        });

        if (error) throw error;

        // 좋아요 알림 생성 (포스트 작성자에게)
        if (post.user_id !== user.id) {
          await createLikeNotification(
            post.user_id,
            user.id,
            post.id,
            user.display_name || user.username,
          );
        }
      }

      // 포스트 업데이트
      onUpdate?.();
    } catch (error) {
      console.error("좋아요 처리 실패:", error);
    } finally {
      setIsLiking(false);
    }
  };

  // 댓글 작성
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isCommenting) return;

    setIsCommenting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        user_id: user.id,
        post_id: post.id,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");

      // 댓글 목록 다시 로드
      await loadComments();

      // 댓글 알림 생성 (포스트 작성자에게)
      if (post.user_id !== user.id) {
        await createCommentNotification(
          post.user_id,
          user.id,
          post.id,
          user.display_name || user.username,
        );
      }

      // 포스트 업데이트 (댓글 수 반영)
      onUpdate?.();
    } catch (error) {
      console.error("댓글 작성 실패:", error);
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setIsCommenting(false);
    }
  };

  // 댓글 삭제
  const deleteComment = async (commentId: string) => {
    if (!user) return;

    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id); // 자신의 댓글만 삭제 가능

      if (error) throw error;

      // 댓글 목록 다시 로드
      await loadComments();

      // 포스트 업데이트 (댓글 수 반영)
      onUpdate?.();
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
      alert("댓글 삭제에 실패했습니다.");
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: ko,
  });

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border ${compact ? "p-3" : "p-4"} space-y-3`}
    >
      {/* 사용자 정보 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`bg-gray-300 rounded-full flex-shrink-0 overflow-hidden ${compact ? "w-8 h-8" : "w-10 h-10"}`}
          >
            {post.user?.avatar_url ? (
              <OptimizedImage
                src={post.user.avatar_url}
                alt={post.user.display_name || post.user.username}
                width={compact ? 32 : 40}
                height={compact ? 32 : 40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-lime-100 flex items-center justify-center text-lime-600 font-semibold">
                {(post.user?.display_name || post.user?.username)
                  ?.charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className={`font-semibold ${compact ? "text-sm" : ""}`}>
              {post.user?.display_name || "사용자"}
            </div>
            <div className={`text-gray-500 ${compact ? "text-xs" : "text-sm"}`}>
              @{post.user?.username} · {timeAgo}
            </div>
          </div>
        </div>
        {!compact && user && post.user_id === user.id && (
          <button
            onClick={() => setShowManagementModal(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="포스트 관리"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* 위치 정보 */}
      {post.location_name && (
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className={`${compact ? "w-3 h-3" : "w-4 h-4"}`} />
          <span className={`${compact ? "text-xs" : "text-sm"}`}>
            {post.location_name}
          </span>
        </div>
      )}

      {/* 포스트 내용 (해시태그 렌더링 포함) */}
      {post.content && (
        <div className={compact ? "text-sm" : ""}>
          <div className="whitespace-pre-wrap">
            {renderTextWithHashtags(post.content, onHashtagClick)}
          </div>
        </div>
      )}

      {/* 이미지들 */}
      {post.images && post.images.length > 0 && (
        <div
          className={`${
            post.images.length === 1
              ? "grid grid-cols-1"
              : "grid grid-cols-2 gap-2"
          }`}
        >
          {post.images
            .sort((a, b) => a.image_order - b.image_order)
            .slice(0, compact ? 2 : 4) // compact 모드에서는 2개만
            .map((image, index) => (
              <div key={image.id} className="relative">
                <OptimizedImage
                  src={image.image_url}
                  alt={`포스트 이미지 ${index + 1}`}
                  // className={`w-full object-cover rounded-lg ${
                  //   post.images!.length === 1 ? "max-h-64" : "h-32"
                  // }`}
                  priority={index < 2} // 첫 2개 이미지는 우선 로드
                />

                {/* 더 많은 이미지가 있을 때 표시 */}
                {!compact && index === 3 && post.images!.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <span className="text-white font-semibold">
                      +{post.images!.length - 4}
                    </span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* 인터랙션 버튼들 */}
      {!compact && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLike}
              disabled={isLiking}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                post.is_liked
                  ? "text-red-500 bg-red-50 hover:bg-red-100"
                  : "text-gray-600 hover:bg-gray-100"
              } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Heart
                className={`w-4 h-4 ${post.is_liked ? "fill-current" : ""}`}
              />
              <span className="text-sm font-medium">
                {typeof post.likes_count === "number" ? post.likes_count : 0}
              </span>
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {typeof post.comments_count === "number"
                  ? post.comments_count
                  : 0}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 댓글 섹션 */}
      {!compact && showComments && (
        <div className="space-y-3 pt-3 border-t">
          {/* 댓글 작성 */}
          {user && (
            <form onSubmit={handleComment} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0 overflow-hidden">
                {user.avatar_url ? (
                  <OptimizedImage
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-lime-100 flex items-center justify-center text-lime-600 font-semibold text-xs">
                    {(user.display_name || user.username)
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 작성하세요..."
                  className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                  rows={2}
                  disabled={isCommenting}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isCommenting}
                    className="px-4 py-1 bg-lime-500 text-white rounded-lg text-sm font-medium hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCommenting ? "작성 중..." : "댓글"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 댓글 목록 */}
          <div className="space-y-3">
            {loadingComments ? (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">
                  댓글을 불러오는 중...
                </div>
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0 overflow-hidden">
                    {comment.user?.avatar_url ? (
                      <OptimizedImage
                        src={comment.user.avatar_url}
                        alt={comment.user.display_name || comment.user.username}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs">
                        {(comment.user?.display_name || comment.user?.username)
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-sm">
                          {comment.user?.display_name || "사용자"}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                          {/* 자신의 댓글인 경우 삭제 버튼 표시 */}
                          {user && comment.user_id === user.id && (
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="댓글 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">
                  아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact 모드에서의 간단한 인터랙션 */}
      {compact && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart
                className={`w-3 h-3 ${post.is_liked ? "fill-current text-red-500" : ""}`}
              />
              {typeof post.likes_count === "number" ? post.likes_count : 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {typeof post.comments_count === "number"
                ? post.comments_count
                : 0}
            </span>
          </div>
          <button
            onClick={toggleLike}
            disabled={isLiking}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              post.is_liked
                ? "text-red-500 bg-red-50"
                : "text-gray-600 hover:bg-gray-100"
            } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {post.is_liked ? "좋아요 취소" : "좋아요"}
          </button>
        </div>
      )}

      {/* 포스트 관리 모달 */}
      <PostManagementModal
        isOpen={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        post={post}
        onPostUpdated={() => {
          setShowManagementModal(false);
          onUpdate?.();
        }}
        onPostDeleted={() => {
          setShowManagementModal(false);
          onUpdate?.();
        }}
      />
    </div>
  );
}
