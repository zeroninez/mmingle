// lib/supabase.ts - 근본적인 토큰 문제 해결
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🔧 근본 문제 해결: 기본 토큰 시스템 사용
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // ❌ storageKey: "mmingle-auth-token", // 이 줄 제거!
    // ✅ 기본 키 사용: sb-{projectId}-auth-token
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
});

// 토큰 진단 함수 (개발용)
export function diagnoseTokenIssue() {
  if (typeof window === "undefined") return;

  console.log("🔍 토큰 진단 시작...");

  // 현재 localStorage의 모든 auth 관련 키 확인
  const keys = Object.keys(localStorage);
  const authKeys = keys.filter(
    (key) =>
      key.includes("auth") || key.includes("supabase") || key.startsWith("sb-"),
  );

  console.log("📋 현재 저장된 토큰들:", authKeys);

  authKeys.forEach((key) => {
    const value = localStorage.getItem(key);
    try {
      const parsed = JSON.parse(value || "{}");
      console.log(`🔑 ${key}:`, {
        hasAccessToken: !!parsed.access_token,
        hasRefreshToken: !!parsed.refresh_token,
        expiresAt: parsed.expires_at
          ? new Date(parsed.expires_at * 1000).toLocaleString()
          : "N/A",
        isExpired: parsed.expires_at
          ? parsed.expires_at * 1000 < Date.now()
          : "N/A",
      });
    } catch (e) {
      console.log(`🔑 ${key}: (파싱 불가)`);
    }
  });

  // 현재 Supabase 세션 상태
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    console.log("🎫 현재 Supabase 세션:", {
      hasSession: !!session,
      userId: session?.user?.id,
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toLocaleString()
        : "N/A",
      error: error?.message,
    });
  });
}

// 기존 문제 토큰 정리 (마이그레이션용)
export function cleanupProblematicTokens() {
  if (typeof window === "undefined") return;

  const problematicKeys = [
    "mmingle-auth-token",
    "mmingle-auth-token.0",
    "mmingle-auth-token.1",
  ];

  let cleaned = false;
  problematicKeys.forEach((key) => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🗑️ 문제 토큰 제거: ${key}`);
      cleaned = true;
    }
  });

  if (cleaned) {
    console.log("✅ 문제 토큰 정리 완료");
    return true;
  }
  return false;
}

// 타입 정의들 (기존과 동일)
export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  latitude: number;
  longitude: number;
  location_name?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  images?: PostImage[];
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export interface PostImage {
  id: string;
  post_id: string;
  image_url: string;
  image_order: number;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  parent_comment_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User;
  replies?: Comment[];
  likes_count?: number;
  is_liked?: boolean;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

// 전역 디버그 도구 (개발 환경)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).supabaseDebug = {
    diagnose: diagnoseTokenIssue,
    cleanup: cleanupProblematicTokens,
    getSession: () => supabase.auth.getSession(),
    getUser: () => supabase.auth.getUser(),
    refreshSession: () => supabase.auth.refreshSession(),
  };

  console.log("🛠️ Supabase 디버그 도구 준비 완료 (개발 환경)");
  console.log("사용법: supabaseDebug.diagnose()");
}
