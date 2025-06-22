"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map } from "@/components/Map";
import { PostCard } from "@/components/PostCard";
import { UserProfile } from "@/components/UserProfile";
import { SearchModal } from "@/components/SearchModal";
import { NotificationSystem } from "@/components/NotificationSystem";
import { TrendingHashtags, HashtagPosts } from "@/components/HashtagSystem";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, List, User, LogOut, ChevronDown, Search } from "lucide-react";

type ViewMode = "map" | "list" | "profile";

// 로딩 컴포넌트
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-lg">로딩 중...</div>
    </div>
  );
}

// 메인 홈페이지 컴포넌트 (Suspense로 감쌀 부분)
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  // URL에서 현재 모드와 사용자 읽기
  const currentMode = (searchParams.get("mode") as ViewMode) || "map";
  const profileUserId = searchParams.get("user") || undefined;
  const [viewMode, setViewModeState] = useState<ViewMode>(currentMode);

  // 모드 변경 함수 (URL 업데이트 포함)
  const setViewMode = (newMode: ViewMode, userId?: string) => {
    setViewModeState(newMode);
    const params = new URLSearchParams(searchParams.toString());

    if (newMode === "map") {
      // 기본 모드이므로 파라미터 제거
      params.delete("mode");
      params.delete("user");
    } else if (newMode === "profile" && userId) {
      // 다른 사용자 프로필
      params.set("mode", newMode);
      params.set("user", userId);
    } else if (newMode === "profile") {
      // 내 프로필
      params.set("mode", newMode);
      params.delete("user");
    } else {
      params.set("mode", newMode);
      params.delete("user");
    }

    const newUrl = params.toString() ? `/?${params.toString()}` : "/";
    router.replace(newUrl, { scroll: false });
  };

  // 사용자 프로필 보기 함수
  const viewUserProfile = (userId: string) => {
    setViewMode("profile", userId);
  };

  // URL 파라미터 변경 시 모드 업데이트
  useEffect(() => {
    const urlMode = (searchParams.get("mode") as ViewMode) || "map";
    setViewModeState(urlMode);
  }, [searchParams]);

  // 뷰 모드 변경 시 포스트 다시 로드
  useEffect(() => {
    if (!authLoading && user && viewMode === "list") {
      loadRecentPosts();
    }
  }, [viewMode, authLoading, user]);

  // 포스트 작성 완료 시 호출되는 함수
  const handlePostCreated = () => {
    // 현재 목록 모드라면 포스트 다시 로드
    if (viewMode === "list") {
      loadRecentPosts();
    }
  };

  // 최근 포스트 로드 (카운팅 수정)
  const loadRecentPosts = async () => {
    setLoading(true);
    try {
      // 1. 기본 포스트 데이터 가져오기
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          user:users(id, username, display_name, avatar_url),
          images:post_images(id, image_url, image_order)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map((post) => post.id);

      // 2. 좋아요 수 가져오기
      const { data: likesData } = await supabase
        .from("likes")
        .select("post_id")
        .in("post_id", postIds);

      // 3. 댓글 수 가져오기
      const { data: commentsData } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      // 4. 사용자 좋아요 상태 확인 (로그인된 경우)
      let userLikes: any[] = [];
      if (user) {
        const { data } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);
        userLikes = data || [];
      }

      // 5. 데이터 통합
      const likedPostIds = new Set(userLikes.map((like) => like.post_id));

      const likeCounts =
        likesData?.reduce(
          (acc, like) => {
            acc[like.post_id] = (acc[like.post_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ) || {};

      const commentCounts =
        commentsData?.reduce(
          (acc, comment) => {
            acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ) || {};

      // 6. 최종 포스트 데이터 구성
      const postsWithCounts = postsData.map((post) => ({
        ...post,
        likes_count: likeCounts[post.id] || 0,
        comments_count: commentCounts[post.id] || 0,
        is_liked: likedPostIds.has(post.id),
      }));

      setPosts(postsWithCounts);
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

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showUserMenu]);

  // 해시태그 클릭 핸들러
  const handleHashtagClick = (hashtag: string) => {
    setSelectedHashtag(hashtag);
  };

  if (authLoading) {
    return <PageLoadingFallback />;
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
              className="w-full px-4 py-2 bg-lime-500 text-white rounded-lg font-medium hover:bg-lime-600"
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
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <header className=" px-4 py-3 flex w-full h-fit items-start md:items-center justify-between">
        <div className="w-fit h-fit flex flex-col md:flex-row md:items-center items-start gap-2">
          <h1 className="text-xl font-bold">mmingle</h1>
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
              <span className="">지도</span>
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
              <span className="">목록</span>
            </button>
            <button
              onClick={() => setViewMode("profile")}
              className={`p-2 rounded-md flex items-center gap-1 text-sm font-medium transition-colors ${
                viewMode === "profile"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <User className="w-4 h-4" />
              <span className="">프로필</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 검색 버튼 */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="검색"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 알림 시스템 */}
          <NotificationSystem
            onPostClick={(postId) => {
              // 포스트 클릭 시 지도로 이동하고 해당 포스트 찾기
              setViewMode("map");
              // 목록도 새로고침
              if (viewMode === "list") {
                loadRecentPosts();
              }
            }}
          />

          {/* 사용자 메뉴 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
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
              <span className="hidden sm:inline">
                {user.display_name || user.username}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* 드롭다운 메뉴 */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="font-medium text-sm">
                    {user.display_name || "이름 없음"}
                  </div>
                  <div className="text-xs text-gray-500">@{user.username}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setViewMode("profile");
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />내 프로필
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        router.push("/auth/signin");
                      } catch (error) {
                        console.error("로그아웃 실패:", error);
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 relative">
        {viewMode === "map" ? (
          <Map onLocationSelect={() => {}} />
        ) : viewMode === "profile" ? (
          <UserProfile />
        ) : (
          <div className="h-full overflow-y-auto ">
            <div className="max-w-6xl mx-auto py-6 px-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 메인 포스트 목록 */}
                <div className="lg:col-span-3 space-y-6">
                  {loading ? (
                    <div className="text-center">
                      <div className="text-gray-500">
                        포스트를 불러오는 중...
                      </div>
                    </div>
                  ) : posts.length > 0 ? (
                    posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onUpdate={loadRecentPosts}
                        onHashtagClick={handleHashtagClick}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white rounded-lg border">
                      <div className="text-gray-500 mb-2">
                        아직 포스트가 없습니다.
                      </div>
                      <div className="text-sm text-gray-400">
                        지도에서 위치를 클릭해서 첫 번째 포스트를 작성해보세요!
                      </div>
                    </div>
                  )}
                </div>

                {/* 사이드바 - 트렌딩 해시태그 */}
                <div className="lg:col-span-1">
                  <div className="sticky top-6 space-y-4">
                    <TrendingHashtags
                      onHashtagClick={handleHashtagClick}
                      limit={10}
                    />

                    {/* 추가 위젯들을 여기에 넣을 수 있음 */}
                    <div className="bg-white rounded-lg border p-4">
                      <h3 className="font-semibold mb-3">팁</h3>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>• 지도에서 위치를 클릭해서 포스트를 작성하세요</p>
                        <p>• #해시태그를 사용해서 포스트를 분류하세요</p>
                        <p>• 다른 사용자들과 소통해보세요</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 검색 모달 */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onPostSelect={(post) => {
          // 포스트 선택 시 지도로 이동하고 해당 위치로 포커스
          setViewMode("map");
          // 목록도 새로고침
          loadRecentPosts();
        }}
      />
    </div>
  );
}

// 메인 컴포넌트 - Suspense로 감싸기
export default function HomePage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
