// lib/notifications.ts
import { supabase } from "./supabase";

export interface CreateNotificationParams {
  userId: string; // 알림을 받을 사용자
  fromUserId: string; // 알림을 보내는 사용자
  type: "like" | "comment" | "follow";
  postId?: string; // 포스트 관련 알림인 경우
  message: string; // 알림 메시지
}

export async function createNotification({
  userId,
  fromUserId,
  type,
  postId,
  message,
}: CreateNotificationParams) {
  // 자기 자신에게는 알림을 보내지 않음
  if (userId === fromUserId) {
    return;
  }

  try {
    // 중복 알림 방지 (같은 유형의 알림이 최근에 있었는지 확인)
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("from_user_id", fromUserId)
      .eq("type", type)
      .eq("post_id", postId)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()); // 5분 이내

    if (existingNotifications && existingNotifications.length > 0) {
      // 5분 이내 같은 알림이 있으면 생성하지 않음
      return;
    }

    // 알림 생성
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      from_user_id: fromUserId,
      type,
      post_id: postId,
      message,
      is_read: false,
    });

    if (error) {
      console.error("알림 생성 실패:", error);
    }
  } catch (error) {
    console.error("알림 생성 중 오류:", error);
  }
}

// 좋아요 알림 생성
export async function createLikeNotification(
  postOwnerId: string,
  fromUserId: string,
  postId: string,
  fromUserName: string,
) {
  await createNotification({
    userId: postOwnerId,
    fromUserId,
    type: "like",
    postId,
    message: `님이 포스트를 좋아합니다.`,
  });
}

// 댓글 알림 생성
export async function createCommentNotification(
  postOwnerId: string,
  fromUserId: string,
  postId: string,
  fromUserName: string,
) {
  await createNotification({
    userId: postOwnerId,
    fromUserId,
    type: "comment",
    postId,
    message: `님이 포스트에 댓글을 남겼습니다.`,
  });
}

// 팔로우 알림 생성
export async function createFollowNotification(
  followedUserId: string,
  fromUserId: string,
  fromUserName: string,
) {
  await createNotification({
    userId: followedUserId,
    fromUserId,
    type: "follow",
    message: `님이 팔로우를 시작했습니다.`,
  });
}
