// contexts/AuthContext.tsx
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // 강제로 로딩 상태를 5초 후에 해제 (무한 로딩 방지)
    const forceStopLoading = () => {
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn("⚠️ 강제 로딩 해제 (5초 타임아웃)");
          setLoading(false);
        }
      }, 5000);
    };

    const getUser = async () => {
      try {
        console.log("🔄 사용자 정보 조회 시작");

        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("❌ Auth 에러:", authError);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (authUser && mounted) {
          console.log("👤 인증된 사용자 발견:", authUser.id);

          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();

          if (userError) {
            console.error("❌ 사용자 데이터 조회 에러:", userError);
            // 에러가 있어도 로딩은 해제
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
          } else {
            console.log("✅ 사용자 데이터 조회 성공");
            if (mounted) {
              setUser(userData);
              setLoading(false);
            }
          }
        } else {
          console.log("🚫 인증되지 않은 상태");
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("💥 예상치 못한 에러:", error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // 타임아웃 시작
    forceStopLoading();

    // 사용자 정보 조회
    getUser();

    // 인증 상태 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("🔄 Auth 상태 변화:", event);

      // 타임아웃 클리어
      if (timeoutId) clearTimeout(timeoutId);

      try {
        if (session?.user) {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (userError) {
            console.error(
              "❌ Auth 상태 변화 시 사용자 데이터 에러:",
              userError,
            );
            setUser(null);
          } else {
            setUser(userData);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("💥 Auth 상태 변화 처리 에러:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (
    username: string,
    password: string,
    displayName: string,
  ) => {
    // 1. username 중복 확인
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existingUser) {
      throw new Error("이미 사용 중인 아이디입니다.");
    }

    // 2. Supabase Auth에 계정 생성
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
    setUser(null);
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
