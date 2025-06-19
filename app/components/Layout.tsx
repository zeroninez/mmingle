"use client";

import { useEffect, useRef } from "react";

export const Layout = ({ children }) => {
  const ref = useRef(null);

  return (
    <>
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
    </>
  );
};
