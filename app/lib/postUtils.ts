// lib/postUtils.ts - 포스트 로딩 유틸리티
import { supabase, Post } from "./supabase";

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

    // 4. 좋아요 수 가져오기
    const { data: likesData } = await supabase
      .from("likes")
      .select("post_id")
      .in("post_id", postIds);

    // 5. 댓글 수 가져오기
    const { data: commentsData } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", postIds);

    // 6. 사용자 좋아요 상태 확인 (로그인된 경우)
    let userLikes: any[] = [];
    if (user) {
      const { data } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
      userLikes = data || [];
    }

    // 7. 데이터 통합
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

    // 8. 최종 포스트 데이터 구성
    const postsWithCounts = postsData.map((post) => ({
      ...post,
      likes_count: likeCounts[post.id] || 0,
      comments_count: commentCounts[post.id] || 0,
      is_liked: likedPostIds.has(post.id),
    }));

    return postsWithCounts;
  } catch (error) {
    console.error("포스트 로딩 실패:", error);
    return [];
  }
}
