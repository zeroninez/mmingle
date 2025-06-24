// app/lib/cache-utils.ts - 새로 생성할 파일
"use client";

/**
 * 브라우저 캐시 관련 유틸리티 함수들
 * 일반 브라우저에서 발생하는 캐시 문제를 해결하기 위한 함수들
 */

export interface CacheClearOptions {
  localStorage?: boolean;
  sessionStorage?: boolean;
  indexedDB?: boolean;
  serviceWorker?: boolean;
  cookies?: boolean;
}

/**
 * 브라우저 캐시를 선택적으로 클리어하는 함수
 */
export async function clearBrowserCache(options: CacheClearOptions = {}) {
  const {
    localStorage: clearLocalStorage = true,
    sessionStorage: clearSessionStorage = true,
    indexedDB: clearIndexedDB = true,
    serviceWorker: clearServiceWorker = true,
    cookies: clearCookies = false, // 기본적으로 쿠키는 클리어하지 않음
  } = options;

  console.log("🧹 브라우저 캐시 클리어 시작");

  try {
    // 1. localStorage 클리어
    if (
      clearLocalStorage &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      // mmingle 관련 데이터만 선택적으로 클리어
      const keys = Object.keys(window.localStorage);
      const mmingleKeys = keys.filter(
        (key) =>
          key.includes("mmingle") ||
          key.includes("supabase") ||
          key.includes("auth") ||
          key.startsWith("sb-"),
      );

      mmingleKeys.forEach((key) => {
        window.localStorage.removeItem(key);
        console.log(`📦 localStorage 제거: ${key}`);
      });
    }

    // 2. sessionStorage 클리어
    if (
      clearSessionStorage &&
      typeof window !== "undefined" &&
      window.sessionStorage
    ) {
      window.sessionStorage.clear();
      console.log("📦 sessionStorage 클리어 완료");
    }

    // 3. IndexedDB 클리어
    if (
      clearIndexedDB &&
      typeof window !== "undefined" &&
      "indexedDB" in window
    ) {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(async (db) => {
            if (
              db.name &&
              (db.name.includes("mmingle") || db.name.includes("supabase"))
            ) {
              const deleteRequest = indexedDB.deleteDatabase(db.name);
              return new Promise((resolve, reject) => {
                deleteRequest.onsuccess = () => {
                  console.log(`🗄️ IndexedDB 제거: ${db.name}`);
                  resolve(void 0);
                };
                deleteRequest.onerror = () => reject(deleteRequest.error);
              });
            }
          }),
        );
      } catch (error) {
        console.warn("IndexedDB 클리어 중 오류:", error);
      }
    }

    // 4. Service Worker 클리어
    if (
      clearServiceWorker &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            await registration.unregister();
            console.log("🔧 Service Worker 등록 해제");
          }),
        );

        // Cache API 클리어
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(async (cacheName) => {
              await caches.delete(cacheName);
              console.log(`💾 Cache 제거: ${cacheName}`);
            }),
          );
        }
      } catch (error) {
        console.warn("Service Worker 클리어 중 오류:", error);
      }
    }

    // 5. 쿠키 클리어 (선택적)
    if (clearCookies && typeof document !== "undefined") {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
      console.log("🍪 쿠키 클리어 완료");
    }

    console.log("✅ 브라우저 캐시 클리어 완료");
    return true;
  } catch (error) {
    console.error("❌ 브라우저 캐시 클리어 실패:", error);
    return false;
  }
}

/**
 * Supabase Auth 관련 캐시만 선택적으로 클리어
 */
export function clearAuthCache() {
  if (typeof window === "undefined") return;

  try {
    // localStorage에서 Supabase auth 관련 데이터 제거
    const keys = Object.keys(window.localStorage);
    const authKeys = keys.filter(
      (key) =>
        key.startsWith("sb-") ||
        key.includes("supabase.auth.token") ||
        key.includes("mmingle-auth"),
    );

    authKeys.forEach((key) => {
      window.localStorage.removeItem(key);
      console.log(`🔑 Auth 캐시 제거: ${key}`);
    });

    // sessionStorage도 클리어
    window.sessionStorage.clear();

    console.log("✅ Auth 캐시 클리어 완료");
  } catch (error) {
    console.error("❌ Auth 캐시 클리어 실패:", error);
  }
}

/**
 * 페이지 새로고침과 함께 캐시 클리어
 */
export async function forceRefreshWithCacheClear() {
  await clearBrowserCache({
    localStorage: true,
    sessionStorage: true,
    indexedDB: false, // IndexedDB는 유지
    serviceWorker: true,
    cookies: false, // 쿠키는 유지
  });

  // 강제 새로고침 (캐시 무시)
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * 앱 시작 시 오래된 캐시 데이터 정리
 */
export function cleanupOldCache() {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(window.localStorage);
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000; // 1주일

    keys.forEach((key) => {
      if (key.includes("timestamp") || key.includes("cache")) {
        try {
          const item = window.localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && now - data.timestamp > oneWeek) {
              window.localStorage.removeItem(key);
              console.log(`🗑️ 오래된 캐시 제거: ${key}`);
            }
          }
        } catch (error) {
          // 파싱 실패한 항목은 제거
          window.localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn("오래된 캐시 정리 중 오류:", error);
  }
}

/**
 * 브라우저별 캐시 호환성 체크
 */
export function checkCacheCompatibility() {
  const features = {
    localStorage: typeof window !== "undefined" && "localStorage" in window,
    sessionStorage: typeof window !== "undefined" && "sessionStorage" in window,
    indexedDB: typeof window !== "undefined" && "indexedDB" in window,
    serviceWorker:
      typeof window !== "undefined" && "serviceWorker" in navigator,
    cacheAPI: typeof window !== "undefined" && "caches" in window,
  };

  console.log("🔍 브라우저 캐시 기능 지원:", features);
  return features;
}
