// components/SearchModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, X, MapPin, Calendar, User as UserIcon } from "lucide-react";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "./PostCard";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostSelect?: (post: Post) => void;
}

interface SearchResult {
  type: "post" | "location" | "user";
  post?: Post;
  location?: string;
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  count?: number;
}

export function SearchModal({
  isOpen,
  onClose,
  onPostSelect,
}: SearchModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300); // 300ms 디바운싱
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<
    "all" | "posts" | "locations" | "users"
  >("all");

  // 검색 실행
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // 1. 포스트 내용 검색
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
        .or(
          `content.ilike.%${searchQuery}%,location_name.ilike.%${searchQuery}%`,
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (!postsError && posts) {
        // 좋아요 상태 확인
        let postsWithLikes = posts;
        if (user && posts.length > 0) {
          const postIds = posts.map((post) => post.id);
          const { data: userLikes } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds);

          const likedPostIds = new Set(userLikes?.map((like) => like.post_id));
          postsWithLikes = posts.map((post) => ({
            ...post,
            is_liked: likedPostIds.has(post.id),
          }));
        }

        postsWithLikes.forEach((post) => {
          searchResults.push({
            type: "post",
            post,
          });
        });
      }

      // 2. 위치 검색 (위치별 그룹화)
      const { data: locations, error: locationsError } = await supabase
        .from("posts")
        .select("location_name")
        .not("location_name", "is", null)
        .ilike("location_name", `%${searchQuery}%`)
        .order("location_name");

      if (!locationsError && locations) {
        // 중복 제거 및 카운트
        const locationCounts: { [key: string]: number } = {};
        locations.forEach((loc) => {
          if (loc.location_name) {
            locationCounts[loc.location_name] =
              (locationCounts[loc.location_name] || 0) + 1;
          }
        });

        Object.entries(locationCounts).forEach(([location, count]) => {
          searchResults.push({
            type: "location",
            location,
            count,
          });
        });
      }

      // 3. 사용자 검색
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .or(
          `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`,
        )
        .limit(10);

      if (!usersError && users) {
        users.forEach((userData) => {
          searchResults.push({
            type: "user",
            user: userData,
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error("검색 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 디바운스된 값으로 교체
  useEffect(() => {
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, user]);

  // 필터링된 결과
  const filteredResults = results.filter((result) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "posts") return result.type === "post";
    if (selectedTab === "locations") return result.type === "location";
    if (selectedTab === "users") return result.type === "user";
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">검색</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="포스트, 위치, 사용자 검색..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
              autoFocus
            />
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex border-b">
          {[
            { key: "all", label: "전체", count: results.length },
            {
              key: "posts",
              label: "포스트",
              count: results.filter((r) => r.type === "post").length,
            },
            {
              key: "locations",
              label: "위치",
              count: results.filter((r) => r.type === "location").length,
            },
            {
              key: "users",
              label: "사용자",
              count: results.filter((r) => r.type === "user").length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.key
                  ? "border-lime-500 text-lime-600 bg-lime-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">검색 중...</div>
            </div>
          ) : query.trim() === "" ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <div>검색어를 입력해주세요</div>
              </div>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <div className="text-lg mb-2">검색 결과가 없습니다</div>
                <div className="text-sm">다른 검색어를 시도해보세요</div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredResults.map((result, index) => (
                <div
                  key={index}
                  className="border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {result.type === "post" && result.post && (
                    <div
                      className="cursor-pointer"
                      onClick={() => {
                        onPostSelect?.(result.post!);
                        onClose();
                      }}
                    >
                      <PostCard post={result.post} compact />
                    </div>
                  )}

                  {result.type === "location" && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-lime-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-lime-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{result.location}</div>
                        <div className="text-sm text-gray-500">
                          {result.count}개의 포스트
                        </div>
                      </div>
                    </div>
                  )}

                  {result.type === "user" && result.user && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
                        {result.user.avatar_url ? (
                          <img
                            src={result.user.avatar_url}
                            alt={
                              result.user.display_name || result.user.username
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                            {(result.user.display_name || result.user.username)
                              ?.charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {result.user.display_name || "이름 없음"}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{result.user.username}
                        </div>
                      </div>
                    </div>
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
