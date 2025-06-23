// lib/queries.ts
import { supabase } from "./supabase";

// 포스트 조회 최적화 (페이지네이션 + 필수 데이터만)
export const getOptimizedPosts = async (
  page = 0,
  limit = 10,
  userId?: string,
) => {
  const offset = page * limit;

  let query = supabase
    .from("posts")
    .select(
      `
      id, 
      content, 
      latitude, 
      longitude, 
      location_name, 
      created_at,
      user_id,
      user:users(
        id, 
        username, 
        display_name, 
        avatar_url
      ),
      images:post_images(
        id, 
        image_url, 
        image_order
      )
    `,
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  return query;
};

// 좋아요/댓글 수 최적화 (별도 쿼리로 분리)
export const getPostStats = async (postIds: string[]) => {
  const [likesData, commentsData] = await Promise.all([
    supabase.from("likes").select("post_id").in("post_id", postIds),
    supabase.from("comments").select("post_id").in("post_id", postIds),
  ]);

  const likesCounts =
    likesData.data?.reduce(
      (acc, like) => {
        acc[like.post_id] = (acc[like.post_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  const commentsCounts =
    commentsData.data?.reduce(
      (acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  return { likesCounts, commentsCounts };
};
