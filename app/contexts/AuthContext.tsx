// app/contexts/AuthContext.tsx - 수정된 버전
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
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
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  // 안전한 상태 업데이트 함수
  const safeSetUser = useCallback((userData: User | null) => {
    if (mountedRef.current) {
      setUser(userData);
    }
  }, []);

  const safeSetLoading = useCallback((loadingState: boolean) => {
    if (mountedRef.current) {
      setLoading(loadingState);
    }
  }, []);

  // 사용자 데이터 가져오기 함수
  const fetchUserData = useCallback(
    async (authUser: SupabaseUser): Promise<User | null> => {
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (userError) {
          console.error("❌ 사용자 데이터 조회 에러:", userError);
          return null;
        }

        console.log("✅ 사용자 데이터 조회 성공");
        return userData;
      } catch (error) {
        console.error("💥 사용자 데이터 가져오기 에러:", error);
        return null;
      }
    },
    [],
  );

  // 초기화 함수
  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      console.log("🔄 Auth 초기화 시작");

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("❌ Auth 에러:", authError);
        safeSetUser(null);
        return;
      }

      if (authUser) {
        console.log("👤 인증된 사용자 발견:", authUser.id);
        const userData = await fetchUserData(authUser);
        safeSetUser(userData);
      } else {
        console.log("🚫 인증되지 않은 상태");
        safeSetUser(null);
      }
    } catch (error) {
      console.error("💥 Auth 초기화 에러:", error);
      safeSetUser(null);
    } finally {
      safeSetLoading(false);
      setInitialized(true);
      initializingRef.current = false;
    }
  }, [fetchUserData, safeSetUser, safeSetLoading]);

  useEffect(() => {
    mountedRef.current = true;

    // 초기화 시작
    initializeAuth();

    // 인증 상태 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      console.log("🔄 Auth 상태 변화:", event);

      try {
        if (session?.user) {
          const userData = await fetchUserData(session.user);
          safeSetUser(userData);
        } else {
          safeSetUser(null);
        }
      } catch (error) {
        console.error("💥 Auth 상태 변화 처리 에러:", error);
        safeSetUser(null);
      } finally {
        if (initialized) {
          safeSetLoading(false);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, [initializeAuth, fetchUserData, safeSetUser, safeSetLoading, initialized]);

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
    safeSetUser(null);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error("로그인이 필요합니다.");

    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id);

    if (error) throw error;

    safeSetUser({ ...user, ...updates });
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
