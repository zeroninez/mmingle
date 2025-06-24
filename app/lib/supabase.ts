// app/lib/supabase.ts - 수정된 버전
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저 호환성을 위한 설정 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "mmingle-auth-token", // 고유한 키로 변경
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce", // PKCE 플로우 사용
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

// 타입 정의는 그대로 유지
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
