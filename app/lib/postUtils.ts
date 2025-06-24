// lib/postUtils.ts - 최적화된 포스트 로딩 유틸리티
import { supabase, Post } from "./supabase";

// 배치 크기 제한
const MAX_BATCH_SIZE = 50; // 한 번에 최대 50개 포스트만 처리
const MAX_URL_LENGTH = 2000; // URL 길이 제한

// 배열을 청크로 나누는 유틸리티
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// URL 길이를 확인하여 안전한 배치 크기 계산
function getSafeBatchSize(postIds: string[]): number {
  const baseUrl = `${process.env.SUPABASE_URL}/rest/v1/comments?select=post_id&post_id=in.(`;
  const avgIdLength = 36; // UUID 길이
  const safeCount = Math.floor(
    (MAX_URL_LENGTH - baseUrl.length - 10) / (avgIdLength + 1),
  );
  return Math.min(safeCount, MAX_BATCH_SIZE, postIds.length);
}

export async function loadPostsWithCounts(
  user: any,
  options: {
    limit?: number;
    bounds?: { ne: any; sw: any };
    order?: { column: string; ascending: boolean };
  } = {},
): Promise<Post[]> {
  try {
    // 1. 기본 포스트 데이터 가져오기
    let query = supabase.from("posts").select(`
        *,
        user:users(id, username, display_name, avatar_url),
        images:post_images(id, image_url, image_order)
      `);

    // 2. 지역 필터링 (지도용)
    if (options.bounds) {
      const { ne, sw } = options.bounds;
      query = query
        .gte("latitude", sw.lat())
        .lte("latitude", ne.lat())
        .gte("longitude", sw.lng())
        .lte("longitude", ne.lng());
    }

    // 3. 정렬 및 제한
    if (options.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending,
      });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data: postsData, error } = await query;

    if (error) throw error;
    if (!postsData || postsData.length === 0) return [];

    const postIds = postsData.map((post) => post.id);

    // 4. 안전한 배치 크기로 좋아요/댓글 수 가져오기
    const safeBatchSize = getSafeBatchSize(postIds);
    const postIdChunks = chunkArray(postIds, safeBatchSize);

    console.log(
      `📊 처리할 포스트: ${postIds.length}개, 배치 크기: ${safeBatchSize}`,
    );

    // 5. 병렬로 좋아요 수 가져오기 (청킹)
    const likesPromises = postIdChunks.map((chunk) =>
      supabase.from("likes").select("post_id").in("post_id", chunk),
    );

    // 6. 병렬로 댓글 수 가져오기 (청킹)
    const commentsPromises = postIdChunks.map((chunk) =>
      supabase.from("comments").select("post_id").in("post_id", chunk),
    );

    // 7. 모든 요청을 병렬로 실행 (단, 한 번에 너무 많이 실행하지 않도록 제한)
    const batchPromises = [];

    // 좋아요 데이터 가져오기
    for (let i = 0; i < likesPromises.length; i += 3) {
      // 3개씩 배치로 실행
      const batch = likesPromises.slice(i, i + 3);
      batchPromises.push(Promise.all(batch));

      // 너무 빠른 요청을 방지하기 위한 짧은 지연
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const likesResults = await Promise.all(batchPromises);
    const allLikesData = likesResults
      .flat()
      .flatMap((result) => result.data || []);

    // 댓글 데이터 가져오기
    const commentsBatchPromises = [];
    for (let i = 0; i < commentsPromises.length; i += 3) {
      // 3개씩 배치로 실행
      const batch = commentsPromises.slice(i, i + 3);
      commentsBatchPromises.push(Promise.all(batch));

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const commentsResults = await Promise.all(commentsBatchPromises);
    const allCommentsData = commentsResults
      .flat()
      .flatMap((result) => result.data || []);

    // 8. 사용자 좋아요 상태 확인 (로그인된 경우)
    let userLikes: any[] = [];
    if (user) {
      const userLikesPromises = postIdChunks.map((chunk) =>
        supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", chunk),
      );

      const userLikesResults = await Promise.all(userLikesPromises);
      userLikes = userLikesResults.flatMap((result) => result.data || []);
    }

    // 9. 데이터 통합
    const likedPostIds = new Set(userLikes.map((like) => like.post_id));

    const likeCounts = allLikesData.reduce(
      (acc, like) => {
        acc[like.post_id] = (acc[like.post_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const commentCounts = allCommentsData.reduce(
      (acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 10. 최종 포스트 데이터 구성
    const postsWithCounts = postsData.map((post) => ({
      ...post,
      likes_count: likeCounts[post.id] || 0,
      comments_count: commentCounts[post.id] || 0,
      is_liked: likedPostIds.has(post.id),
    }));

    console.log(`✅ 포스트 로딩 완료: ${postsWithCounts.length}개`);
    return postsWithCounts;
  } catch (error) {
    console.error("포스트 로딩 실패:", error);
    return [];
  }
}

// 단일 포스트의 카운트만 가져오는 최적화된 함수
export async function getPostCounts(postId: string): Promise<{
  likes_count: number;
  comments_count: number;
}> {
  try {
    const [likesResult, commentsResult] = await Promise.all([
      supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId),
    ]);

    return {
      likes_count: likesResult.count || 0,
      comments_count: commentsResult.count || 0,
    };
  } catch (error) {
    console.error("포스트 카운트 가져오기 실패:", error);
    return { likes_count: 0, comments_count: 0 };
  }
}

// 캐시를 활용한 최적화 (선택사항)
const countsCache = new Map<
  string,
  {
    data: { likes_count: number; comments_count: number };
    timestamp: number;
  }
>();
const CACHE_DURATION = 30000; // 30초

export async function getCachedPostCounts(postId: string): Promise<{
  likes_count: number;
  comments_count: number;
}> {
  const now = Date.now();
  const cached = countsCache.get(postId);

  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const counts = await getPostCounts(postId);
  countsCache.set(postId, { data: counts, timestamp: now });

  return counts;
}
