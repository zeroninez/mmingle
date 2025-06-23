"use client";

import { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map } from "@/components/Map";
import { PostCard } from "@/components/PostCard";
import { UserProfile } from "@/components/UserProfile";
import { SearchModal } from "@/components/SearchModal";
import { NotificationSystem } from "@/components/NotificationSystem";
import { TrendingHashtags, HashtagPosts } from "@/components/HashtagSystem";
import { OptimizedImage } from "@/components/OptimizedImage";
import { supabase, Post } from "@/lib/supabase";
import { getOptimizedPosts, getPostStats } from "@/lib/queries";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin,
  List,
  User,
  LogOut,
  ChevronDown,
  Search,
  Loader2,
} from "lucide-react";

type ViewMode = "map" | "list" | "profile";

// 로딩 컴포넌트
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
        <div className="text-lg text-gray-600">로딩 중...</div>
      </div>
    </div>
  );
}

// 메인 홈페이지 컴포넌트 (Suspense로 감쌀 부분)
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();

  // 포스트 관련 상태 (무한 스크롤 지원)
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // UI 상태
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 검색 디바운싱
  const debouncedSearch = useDebounce(searchQuery, 300);

  // URL에서 현재 모드와 사용자 읽기
  const currentMode = (searchParams.get("mode") as ViewMode) || "map";
  const profileUserId = searchParams.get("user") || undefined;
  const [viewMode, setViewModeState] = useState<ViewMode>(currentMode);

  // 무한 스크롤 (list 모드에서만 사용)
  const lastElementRef = useInfiniteScroll(
    hasMore && viewMode === "list",
    loading,
    loadMore,
  );

  // 더 많은 포스트 로드
  function loadMore() {
    if (!loading && hasMore && viewMode === "list") {
      const nextPage = page + 1;
      setPage(nextPage);
      loadRecentPosts(nextPage, false);
    }
  }

  // 모드 변경 함수 (URL 업데이트 포함) - useCallback으로 메모이제이션
  const setViewMode = useCallback(
    (newMode: ViewMode, userId?: string) => {
      setViewModeState(newMode);
      const params = new URLSearchParams(searchParams.toString());

      if (newMode === "map") {
        params.delete("mode");
        params.delete("user");
      } else if (newMode === "profile" && userId) {
        params.set("mode", newMode);
        params.set("user", userId);
      } else if (newMode === "profile") {
        params.set("mode", newMode);
        params.delete("user");
      } else {
        params.set("mode", newMode);
        params.delete("user");
      }

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.replace(newUrl, { scroll: false });

      // 뷰 모드 변경 시 상태 초기화
      if (newMode === "list") {
        setPosts([]);
        setPage(0);
        setHasMore(true);
        setError(null);
      }
    },
    [router, searchParams],
  );

  // 사용자 프로필 보기 함수 - useCallback으로 메모이제이션
  const viewUserProfile = useCallback(
    (userId: string) => {
      setViewMode("profile", userId);
    },
    [setViewMode],
  );

  // URL 파라미터 변경 시 모드 업데이트
  useEffect(() => {
    const urlMode = (searchParams.get("mode") as ViewMode) || "map";
    setViewModeState(urlMode);
  }, [searchParams]);

  // 뷰 모드 변경 시 포스트 다시 로드
  useEffect(() => {
    if (!authLoading && user && viewMode === "list") {
      loadRecentPosts(0, true);
    }
  }, [viewMode, authLoading, user]);

  // 검색어 변경 시 포스트 다시 로드 (디바운싱)
  useEffect(() => {
    if (viewMode === "list" && debouncedSearch !== searchQuery) {
      if (debouncedSearch.trim()) {
        searchPosts(debouncedSearch);
      } else {
        loadRecentPosts(0, true);
      }
    }
  }, [debouncedSearch, viewMode]);

  // 검색 함수
  const searchPosts = async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          user:users(id, username, display_name, avatar_url),
          images:post_images(id, image_url, image_order)
        `,
        )
        .or(`content.ilike.%${query}%,location_name.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map((post) => post.id);
        const { likesCounts, commentsCounts } = await getPostStats(postIds);

        let userLikes: string[] = [];
        if (user) {
          const { data: likesData } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds);
          userLikes = likesData?.map((like) => like.post_id) || [];
        }

        const postsWithStats = postsData.map((post) => ({
          ...post,
          likes_count: likesCounts[post.id] || 0,
          comments_count: commentsCounts[post.id] || 0,
          is_liked: userLikes.includes(post.id),
        }));

        setPosts(postsWithStats);
        setHasMore(false); // 검색 결과는 무한 스크롤 비활성화
      } else {
        setPosts([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("검색 실패:", error);
      setError("검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 포스트 작성 완료 시 호출되는 함수 - useCallback으로 메모이제이션
  const handlePostCreated = useCallback(() => {
    if (viewMode === "list") {
      loadRecentPosts(0, true);
    }
  }, [viewMode]);

  // 최적화된 포스트 로드 함수
  const loadRecentPosts = useCallback(
    async (pageNum = 0, reset = true) => {
      if (loading && !reset) return;

      setLoading(true);
      if (reset) {
        setError(null);
        setPage(0);
        setHasMore(true);
      }

      try {
        // 최적화된 쿼리 사용
        const { data: postsData, error } = await getOptimizedPosts(pageNum, 10);

        if (error) throw error;

        if (postsData && postsData.length > 0) {
          // 포스트 통계 별도 조회 (성능 최적화)
          const postIds = postsData.map((post) => post.id);
          const { likesCounts, commentsCounts } = await getPostStats(postIds);

          // 사용자 좋아요 상태 확인
          let userLikes: string[] = [];
          if (user) {
            const { data: likesData } = await supabase
              .from("likes")
              .select("post_id")
              .eq("user_id", user.id)
              .in("post_id", postIds);
            userLikes = likesData?.map((like) => like.post_id) || [];
          }

          // 최종 포스트 데이터 구성
          const postsWithStats = postsData.map((post) => ({
            ...post,
            likes_count: likesCounts[post.id] || 0,
            comments_count: commentsCounts[post.id] || 0,
            is_liked: userLikes.includes(post.id),
          }));

          if (reset) {
            //@ts-ignore
            setPosts(postsWithStats);
          } else {
            //@ts-ignore
            setPosts((prev) => [...prev, ...postsWithStats]);
          }

          setHasMore(postsWithStats.length === 10);
        } else {
          if (reset) setPosts([]);
          setHasMore(false);
        }
      } catch (error) {
        console.error("포스트 로드 실패:", error);
        setError("포스트를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [user, loading],
  );

  // 초기 로드
  useEffect(() => {
    if (!authLoading && user) {
      loadRecentPosts(0, true);
    }
  }, [authLoading, user, loadRecentPosts]);

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showUserMenu]);

  // 해시태그 클릭 핸들러 - useCallback으로 메모이제이션
  const handleHashtagClick = useCallback(
    (hashtag: string) => {
      setSelectedHashtag(hashtag);
      setSearchQuery(`#${hashtag}`);
      if (viewMode !== "list") {
        setViewMode("list");
      }
    },
    [viewMode, setViewMode],
  );

  // 로그아웃 핸들러 - useCallback으로 메모이제이션
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.push("/auth/signin");
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  }, [signOut, router]);

  // 메모이제이션된 사용자 아바타
  const userAvatar = useMemo(
    () => (
      <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
        {user?.avatar_url ? (
          <OptimizedImage
            src={user.avatar_url}
            alt={user.display_name || user.username}
            width={32}
            height={32}
            className="w-full h-full object-cover"
            priority={true}
          />
        ) : (
          <div className="w-full h-full bg-lime-100 flex items-center justify-center text-lime-600 font-semibold text-xs">
            {(user?.display_name || user?.username)?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    ),
    [user?.avatar_url, user?.display_name, user?.username],
  );

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
      <header className="px-4 py-3 flex w-full h-fit items-start md:items-center justify-between">
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
              <span>지도</span>
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
              <span>목록</span>
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
              <span>프로필</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 검색 입력 (list 모드에서만 표시) */}
          {viewMode === "list" && (
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="포스트 검색..."
                className="pl-9 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-sm"
              />
            </div>
          )}

          {/* 검색 버튼 (모바일용) */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
            title="검색"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 알림 시스템 */}
          <NotificationSystem
            onPostClick={(postId) => {
              setViewMode("map");
              if (viewMode === "list") {
                loadRecentPosts(0, true);
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
              {userAvatar}
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
                    onClick={handleSignOut}
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
          <div className="h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto py-6 px-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 메인 포스트 목록 */}
                <div className="lg:col-span-3 space-y-6">
                  {/* 에러 메시지 */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                      {error}
                      <button
                        onClick={() => loadRecentPosts(0, true)}
                        className="ml-2 underline hover:no-underline"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}

                  {/* 검색 결과 표시 */}
                  {debouncedSearch.trim() && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">
                      <strong>{debouncedSearch}</strong>에 대한 검색 결과 (
                      {posts.length}개)
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          loadRecentPosts(0, true);
                        }}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        × 검색 해제
                      </button>
                    </div>
                  )}

                  {loading && posts.length === 0 ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-lime-500 mx-auto mb-2" />
                      <div className="text-gray-500">
                        포스트를 불러오는 중...
                      </div>
                    </div>
                  ) : posts.length > 0 ? (
                    <>
                      {posts.map((post, index) => (
                        <div
                          key={post.id}
                          ref={
                            index === posts.length - 1 ? lastElementRef : null
                          }
                        >
                          <PostCard
                            post={post}
                            onUpdate={() => loadRecentPosts(0, true)}
                            onHashtagClick={handleHashtagClick}
                          />
                        </div>
                      ))}

                      {/* 무한 스크롤 로딩 */}
                      {loading && posts.length > 0 && (
                        <div className="text-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-lime-500 mx-auto" />
                        </div>
                      )}

                      {/* 더 이상 로드할 데이터가 없을 때 */}
                      {!hasMore && !debouncedSearch.trim() && (
                        <div className="text-center py-8 text-gray-500">
                          모든 포스트를 불러왔습니다.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-lg border">
                      <div className="text-gray-500 mb-2">
                        {debouncedSearch.trim()
                          ? `"${debouncedSearch}"에 대한 검색 결과가 없습니다.`
                          : "아직 포스트가 없습니다."}
                      </div>
                      {!debouncedSearch.trim() && (
                        <div className="text-sm text-gray-400">
                          지도에서 위치를 클릭해서 첫 번째 포스트를
                          작성해보세요!
                        </div>
                      )}
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

                    {/* 추가 위젯들 */}
                    <div className="bg-white rounded-lg border p-4">
                      <h3 className="font-semibold mb-3">팁</h3>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>• 지도에서 위치를 클릭해서 포스트를 작성하세요</p>
                        <p>• #해시태그를 사용해서 포스트를 분류하세요</p>
                        <p>• 다른 사용자들과 소통해보세요</p>
                        <p>• 검색창에서 내용이나 위치를 검색하세요</p>
                      </div>
                    </div>

                    {/* 성능 정보 (개발 환경에서만) */}
                    {process.env.NODE_ENV === "development" && (
                      <div className="bg-gray-50 rounded-lg border p-4">
                        <h3 className="font-semibold mb-2 text-sm">
                          성능 정보
                        </h3>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>포스트 수: {posts.length}</p>
                          <p>페이지: {page + 1}</p>
                          <p>더 로드 가능: {hasMore ? "예" : "아니오"}</p>
                          <p>검색 중: {debouncedSearch ? "예" : "아니오"}</p>
                        </div>
                      </div>
                    )}
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
          setViewMode("map");
          loadRecentPosts(0, true);
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
