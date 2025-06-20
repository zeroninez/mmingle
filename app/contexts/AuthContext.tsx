"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, User } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    username: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// username을 이메일 형태로 변환하는 함수
const usernameToEmail = (username: string) => `${username}@app.local`;

// 이메일에서 username 추출하는 함수
const emailToUsername = (email: string) => email.replace("@app.local", "");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 사용자 상태 확인
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        // users 테이블에서 추가 정보 가져오기
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setUser(userData);
      }
      setLoading(false);
    };

    getUser();

    // 인증 상태 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (
    username: string,
    password: string,
    displayName: string,
  ) => {
    // 1. username 중복 확인
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      throw new Error("이미 사용 중인 아이디입니다.");
    }

    // 2. Supabase Auth에 계정 생성 (username을 email 형태로 변환)
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      // 3. users 테이블에 사용자 정보 저장
      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        email: email,
        username: username,
        display_name: displayName,
      });

      if (profileError) throw profileError;
    }
  };

  const signIn = async (username: string, password: string) => {
    // username을 email 형태로 변환해서 로그인
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error("로그인이 필요합니다.");

    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id);

    if (error) throw error;

    setUser({ ...user, ...updates });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
