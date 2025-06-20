"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Map } from "@/components/Map";
import { PostCard } from "@/components/PostCard";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, List, Plus } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // 최근 포스트 로드
  const loadRecentPosts = async () => {
    setLoading(true);
    try {
      const { data: postsData, error } = await supabase
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
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // 좋아요 상태 확인 (로그인된 사용자만)
      let postsWithLikes = postsData || [];
      if (user && postsData) {
        const postIds = postsData.map((post) => post.id);
        const { data: userLikes } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        const likedPostIds = new Set(userLikes?.map((like) => like.post_id));

        postsWithLikes = postsData.map((post) => ({
          ...post,
          is_liked: likedPostIds.has(post.id),
        }));
      }

      setPosts(postsWithLikes);
    } catch (error) {
      console.error("포스트 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadRecentPosts();
    }
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-3xl font-bold mb-4">지도 SNS</h1>
          <p className="text-gray-600 mb-6">
            위치 기반으로 포스트를 공유하고 다른 사람들과 소통해보세요.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => (window.location.href = "/auth/signin")}
              className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600"
            >
              로그인
            </button>
            <button
              onClick={() => (window.location.href = "/auth/signup")}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">지도 SNS</h1>

        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("map")}
              className={`p-2 rounded-md flex items-center gap-1 text-sm font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <MapPin className="w-4 h-4" />
              지도
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md flex items-center gap-1 text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <List className="w-4 h-4" />
              목록
            </button>
          </div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {user.display_name}님 (@{user.username})
            </span>
            <button
              onClick={async () => {
                try {
                  await signOut();
                  router.push("/auth/signin");
                } catch (error) {
                  console.error("로그아웃 실패:", error);
                }
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 relative">
        {viewMode === "map" ? (
          <Map onLocationSelect={() => {}} />
        ) : (
          <div className="h-full overflow-y-auto bg-gray-50">
            <div className="max-w-2xl mx-auto py-6 px-4">
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">포스트를 불러오는 중...</div>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      아직 포스트가 없습니다.
                    </div>
                    <button
                      onClick={() => setViewMode("map")}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />첫 포스트 작성하기
                    </button>
                  </div>
                ) : (
                  posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onUpdate={loadRecentPosts}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 플로팅 액션 버튼 (지도 모드일 때만) */}
      {viewMode === "map" && (
        <div className="absolute bottom-6 right-6">
          <div className="bg-white rounded-lg shadow-lg p-3 text-sm text-gray-600">
            지도를 클릭해서 포스트를 작성하세요
          </div>
        </div>
      )}
    </div>
  );
}
