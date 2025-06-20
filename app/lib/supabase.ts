import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 타입 정의
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
