"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Heart, MessageCircle, MapPin, MoreHorizontal } from "lucide-react";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PostCardProps {
  post: Post;
  onUpdate?: () => void;
  compact?: boolean;
}

export function PostCard({ post, onUpdate, compact = false }: PostCardProps) {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

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
      onUpdate?.();
    } catch (error) {
      console.error("댓글 작성 실패:", error);
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setIsCommenting(false);
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
              <Image
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
            <p className={`font-medium ${compact ? "text-sm" : ""}`}>
              {post.user?.display_name || post.user?.username}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span>
                {post.location_name ||
                  `${post.latitude.toFixed(4)}, ${post.longitude.toFixed(4)}`}
              </span>
              <span>•</span>
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>

        {!compact && (
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* 포스트 내용 */}
      <div className={`${compact ? "text-sm" : ""}`}>
        <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* 이미지 갤러리 */}
      {post.images && post.images.length > 0 && (
        <div
          className={`${post.images.length === 1 ? "" : "grid grid-cols-2 gap-2"}`}
        >
          {post.images
            .sort((a, b) => a.image_order - b.image_order)
            .slice(0, compact ? 2 : 4) // compact 모드에서는 2개만
            .map((image, index) => (
              <div key={image.id} className="relative">
                <Image
                  src={image.image_url}
                  alt={`포스트 이미지 ${index + 1}`}
                  width={300}
                  height={200}
                  className={`w-full object-cover rounded-lg ${
                    post.images!.length === 1 ? "max-h-64" : "h-32"
                  }`}
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
                  <Image
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
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              댓글 목록은 추후 구현 예정입니다.
            </p>
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
    </div>
  );
}
