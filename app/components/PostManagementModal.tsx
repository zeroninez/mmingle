// components/PostManagementModal.tsx
"use client";

import { useState } from "react";
import { X, Trash2, Edit3, AlertTriangle } from "lucide-react";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PostManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onPostUpdated?: () => void;
  onPostDeleted?: () => void;
}

export function PostManagementModal({
  isOpen,
  onClose,
  post,
  onPostUpdated,
  onPostDeleted,
}: PostManagementModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"menu" | "edit" | "delete">("menu");
  const [loading, setLoading] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editLocationName, setEditLocationName] = useState(
    post.location_name || "",
  );

  // 포스트 수정
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({
          content: editContent.trim(),
          location_name: editLocationName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id)
        .eq("user_id", user.id); // 자신의 포스트만 수정 가능

      if (error) throw error;

      alert("포스트가 수정되었습니다.");
      onPostUpdated?.();
      onClose();
    } catch (error) {
      console.error("포스트 수정 실패:", error);
      alert("포스트 수정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 포스트 삭제
  const handleDelete = async () => {
    if (!user || loading) return;

    setLoading(true);
    try {
      // 1. 먼저 관련된 이미지들을 Storage에서 삭제
      if (post.images && post.images.length > 0) {
        const imagePaths = post.images.map((img) => {
          // URL에서 파일 경로 추출 (예: post-images/filename.jpg)
          const url = new URL(img.image_url);
          return url.pathname.split("/").slice(-2).join("/"); // 마지막 두 부분 (폴더/파일명)
        });

        const { error: storageError } = await supabase.storage
          .from("post-images")
          .remove(imagePaths);

        if (storageError) {
          console.error("이미지 삭제 실패:", storageError);
          // 이미지 삭제 실패해도 포스트는 삭제 진행
        }
      }

      // 2. 포스트 삭제 (CASCADE로 연관된 데이터들도 자동 삭제됨)
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id); // 자신의 포스트만 삭제 가능

      if (error) throw error;

      alert("포스트가 삭제되었습니다.");
      onPostDeleted?.();
      onClose();
    } catch (error) {
      console.error("포스트 삭제 실패:", error);
      alert("포스트 삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // 권한 확인 - 자신의 포스트가 아니면 접근 불가
  if (!user || post.user_id !== user.id) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-sm w-full p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">접근 권한 없음</h3>
          <p className="text-gray-600 mb-4">
            자신의 포스트만 수정하거나 삭제할 수 있습니다.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {mode === "menu" && "포스트 관리"}
            {mode === "edit" && "포스트 수정"}
            {mode === "delete" && "포스트 삭제"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메뉴 모드 */}
        {mode === "menu" && (
          <div className="p-4 space-y-3">
            <button
              onClick={() => setMode("edit")}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium">포스트 수정</div>
                <div className="text-sm text-gray-500">
                  내용이나 위치명을 수정합니다
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("delete")}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50 rounded-lg transition-colors text-red-600"
            >
              <Trash2 className="w-5 h-5" />
              <div>
                <div className="font-medium">포스트 삭제</div>
                <div className="text-sm text-red-400">
                  포스트를 영구적으로 삭제합니다
                </div>
              </div>
            </button>
          </div>
        )}

        {/* 수정 모드 */}
        {mode === "edit" && (
          <form onSubmit={handleUpdate} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                내용
              </label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="포스트 내용을 입력하세요..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 resize-none"
                rows={4}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                위치명 (선택사항)
              </label>
              <input
                type="text"
                value={editLocationName}
                onChange={(e) => setEditLocationName(e.target.value)}
                placeholder="위치명을 입력하세요 (예: 서울역, 홍대입구역)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !editContent.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "수정 중..." : "수정하기"}
              </button>
            </div>
          </form>
        )}

        {/* 삭제 확인 모드 */}
        {mode === "delete" && (
          <div className="p-4">
            <div className="text-center mb-6">
              <Trash2 className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                정말로 삭제하시겠습니까?
              </h3>
              <p className="text-gray-600">
                이 작업은 되돌릴 수 없습니다. 포스트와 관련된 모든
                데이터(좋아요, 댓글, 이미지)가 영구적으로 삭제됩니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMode("menu")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
