"use client";

import { useEffect, useRef } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

export const Layout = ({ children }) => {
  const ref = useRef(null);

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
