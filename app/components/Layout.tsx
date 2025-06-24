"use client";

import { useEffect, useRef } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

export const Layout = ({ children }) => {
  const ref = useRef(null);

  useEffect(() => {
    // 기존 사용자를 위한 자동 토큰 정리
    const oldToken = localStorage.getItem("mmingle-auth-token");
    if (oldToken) {
      localStorage.removeItem("mmingle-auth-token");
      localStorage.removeItem("mmingle-auth-token.0");
      localStorage.removeItem("mmingle-auth-token.1");
      console.log("🔄 자동 토큰 마이그레이션 완료");
    }
  }, []);

  return (
    <AuthProvider>
      <div
        ref={ref}
        style={{
          position: "relative",
          width: " 100%",
          height: "100%",
          touchAction: "auto",
        }}
      >
        {children}
      </div>
    </AuthProvider>
  );
};
