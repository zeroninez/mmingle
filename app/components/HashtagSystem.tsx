// components/HashtagSystem.tsx
"use client";

import { useState, useEffect } from "react";
import { Hash, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

// 해시태그 추출 유틸리티
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w가-힣]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
}

// 텍스트에서 해시태그를 링크로 변환
export function renderTextWithHashtags(
  text: string,
  onHashtagClick?: (hashtag: string) => void,
): React.ReactNode {
  if (!text) return text;

  const hashtagRegex = /(#[\w가-힣]+)/g;
  const parts = text.split(hashtagRegex);

  return parts.map((part, index) => {
    if (part.match(hashtagRegex)) {
      const hashtag = part.slice(1);
      return (
        <button
          key={index}
          onClick={() => onHashtagClick?.(hashtag)}
          className="text-lime-600 hover:text-lime-700 font-medium hover:underline"
        >
          {part}
        </button>
      );
    }
    return part;
  });
}

// 해시태그 입력 도우미
interface HashtagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function HashtagInput({
  value,
  onChange,
  placeholder = "내용을 입력하세요... (#해시태그 사용 가능)",
  className = "",
}: HashtagInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentWord, setCurrentWord] = useState("");

  // 인기 해시태그 불러오기
  const loadPopularHashtags = async (query: string = "") => {
    try {
      let dbQuery = supabase
        .from("hashtags")
        .select("name, usage_count")
        .order("usage_count", { ascending: false })
        .limit(10);

      if (query) {
        dbQuery = dbQuery.ilike("name", `%${query}%`);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;

      setSuggestions(data?.map((h) => h.name) || []);
    } catch (error) {
      console.error("해시태그 제안 로드 실패:", error);
    }
  };

  // 텍스트 변경 처리
  const handleChange = (newValue: string) => {
    onChange(newValue);

    // 현재 커서 위치에서 해시태그 입력 중인지 확인
    const cursorPos = newValue.length; // 간단히 끝 위치로 가정
    const beforeCursor = newValue.slice(0, cursorPos);
    const words = beforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("#") && lastWord.length > 1) {
      setCurrentWord(lastWord.slice(1));
      setShowSuggestions(true);
      loadPopularHashtags(lastWord.slice(1));
    } else {
      setShowSuggestions(false);
      setCurrentWord("");
    }
  };

  // 해시태그 제안 클릭
  const handleSuggestionClick = (hashtag: string) => {
    const words = value.split(/\s/);
    words[words.length - 1] = `#${hashtag}`;
    onChange(words.join(" ") + " ");
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!showSuggestions) {
      loadPopularHashtags();
    }
  }, []);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 resize-none ${className}`}
        rows={4}
      />

      {/* 해시태그 제안 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
          {suggestions.map((hashtag) => (
            <button
              key={hashtag}
              onClick={() => handleSuggestionClick(hashtag)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
            >
              <Hash className="w-4 h-4 text-lime-500" />
              <span>#{hashtag}</span>
            </button>
          ))}
        </div>
      )}

      {/* 추출된 해시태그 미리보기 */}
      {value && (
        <div className="mt-2">
          {extractHashtags(value).length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-sm text-gray-500">해시태그:</span>
              {extractHashtags(value).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-lime-100 text-lime-700 rounded-full text-xs"
                >
                  <Hash className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 트렌딩 해시태그 컴포넌트
interface TrendingHashtagsProps {
  onHashtagClick?: (hashtag: string) => void;
  limit?: number;
}

export function TrendingHashtags({
  onHashtagClick,
  limit = 10,
}: TrendingHashtagsProps) {
  const [hashtags, setHashtags] = useState<
    Array<{
      name: string;
      usage_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const loadTrendingHashtags = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hashtags")
        .select("name, usage_count")
        .order("usage_count", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setHashtags(data || []);
    } catch (error) {
      console.error("트렌딩 해시태그 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrendingHashtags();
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-lime-500" />
          <h3 className="font-semibold">트렌딩 해시태그</h3>
        </div>
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (hashtags.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-lime-500" />
          <h3 className="font-semibold">트렌딩 해시태그</h3>
        </div>
        <div className="text-sm text-gray-500">아직 해시태그가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-lime-500" />
        <h3 className="font-semibold">트렌딩 해시태그</h3>
      </div>

      <div className="space-y-2">
        {hashtags.map((hashtag, index) => (
          <button
            key={hashtag.name}
            onClick={() => onHashtagClick?.(hashtag.name)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-mono w-6">
                {index + 1}.
              </span>
              <Hash className="w-4 h-4 text-lime-500" />
              <span className="font-medium">#{hashtag.name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {hashtag.usage_count}개 포스트
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// 해시태그 관련 포스트 목록
interface HashtagPostsProps {
  hashtag: string;
  onClose?: () => void;
}

export function HashtagPosts({ hashtag, onClose }: HashtagPostsProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHashtagPosts = async () => {
    setLoading(true);
    try {
      // post_hashtags 테이블을 통해 해당 해시태그가 있는 포스트들 조회
      const { data, error } = await supabase
        .from("post_hashtags")
        .select(
          `
          post:posts(
            *,
            user:users(id, username, display_name, avatar_url),
            images:post_images(id, image_url, image_order),
            likes_count:likes(count),
            comments_count:comments(count)
          )
        `,
        )
        .eq("hashtag_name", hashtag)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postData = data?.map((item) => item.post).filter(Boolean) || [];
      setPosts(postData);
    } catch (error) {
      console.error("해시태그 포스트 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHashtagPosts();
  }, [hashtag]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-lime-500" />
            <h2 className="text-lg font-semibold">#{hashtag}</h2>
            <span className="text-sm text-gray-500">
              {posts.length}개 포스트
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              ×
            </button>
          )}
        </div>

        {/* 포스트 목록 */}
        <div className="max-h-96 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="text-center">
                <Hash className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <div>#{hashtag} 해시태그가 포함된 포스트가 없습니다</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border rounded-lg">
                  {/* PostCard 컴포넌트 사용 - 여기서는 import 필요 */}
                  <div className="p-4">
                    <div className="text-sm text-gray-600 mb-2">
                      @{post.user?.username} • {post.location_name}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {renderTextWithHashtags(post.content, (tag) => {
                        // 다른 해시태그 클릭 시 해당 해시태그로 이동
                        if (tag !== hashtag) {
                          loadHashtagPosts();
                        }
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 해시태그 데이터베이스 유틸리티
export async function savePostHashtags(postId: string, content: string) {
  try {
    const hashtags = extractHashtags(content);

    if (hashtags.length === 0) return;

    // 기존 해시태그 연결 삭제
    await supabase.from("post_hashtags").delete().eq("post_id", postId);

    // 새 해시태그들 처리
    for (const hashtag of hashtags) {
      // 해시태그 테이블에 upsert
      const { error: hashtagError } = await supabase
        .from("hashtags")
        .upsert({ name: hashtag }, { onConflict: "name" });

      if (hashtagError) throw hashtagError;

      // 포스트-해시태그 연결 테이블에 추가
      const { error: linkError } = await supabase.from("post_hashtags").insert({
        post_id: postId,
        hashtag_name: hashtag,
      });

      if (linkError) throw linkError;
    }

    // 해시태그 사용 횟수 업데이트
    await updateHashtagUsageCounts(hashtags);
  } catch (error) {
    console.error("해시태그 저장 실패:", error);
  }
}

async function updateHashtagUsageCounts(hashtags: string[]) {
  for (const hashtag of hashtags) {
    const { count } = await supabase
      .from("post_hashtags")
      .select("*", { count: "exact", head: true })
      .eq("hashtag_name", hashtag);

    await supabase
      .from("hashtags")
      .update({ usage_count: count || 0 })
      .eq("name", hashtag);
  }
}
