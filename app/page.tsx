"use client";

import React, { useState, useEffect, Suspense } from "react";

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <main className="flex flex-col items-center justify-center min-h-screen p-4 gap-6">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
    <p className="text-lg">페이지 로딩 중...</p>
  </main>
);

// 실제 홈 컴포넌트 (useSearchParams를 사용하는 부분)
const HomeContent = () => {


  return (
    <main>
      
  </main>
  );
};

// 메인 홈 컴포넌트 (Suspense로 감싸기)
const Home = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HomeContent />
    </Suspense>
  );
};

export default Home;
