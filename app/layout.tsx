// app/layout.tsx - 수정된 버전
import "./styles/globals.css";
import { pretendard } from "@/app/theme/fonts";
import { Metadata, Viewport } from "next";
import { APP_INFO } from "@/app/constants/metadata";
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import { Layout } from "@/components";

export const metadata: Metadata = {
  title: {
    default: APP_INFO.title,
    template: APP_INFO.titleTemplate,
  },
  description: APP_INFO.description,
  keywords: APP_INFO.keywords,
  authors: APP_INFO.authors,
  creator: "SEJIN OH",
  publisher: "SEJIN OH",
  manifest: "/manifest.json",
  generator: "SEJIN OH",
  applicationName: APP_INFO.name,
  category: "webapp",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_INFO.name,
    title: {
      default: APP_INFO.title,
      template: APP_INFO.titleTemplate,
    },
    description: APP_INFO.description,
  },
  referrer: "origin-when-cross-origin",
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icons/apple-touch-icon.png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
    other: {
      rel: "mask-icon",
      url: "/icons/safari-pinned-tab.svg",
      color: "#FFFFFF",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  themeColor: "#FFFFFF",
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 캐시 문제 해결을 위한 메타 태그 추가 */}
        <meta
          httpEquiv="Cache-Control"
          content="no-cache, no-store, must-revalidate"
        />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* PWA 업데이트 알림을 위한 메타 태그 */}
        <meta
          name="version"
          content={process.env.npm_package_version || "1.0.0"}
        />
        {/* 브라우저별 호환성을 위한 메타 태그 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${pretendard}`}>
        <Layout>{children}</Layout>
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />

        {/* 캐시 문제 감지 및 해결을 위한 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 브라우저 캐시 문제 감지 및 해결
              (function() {
                const APP_VERSION = '${process.env.npm_package_version || "1.0.0"}';
                const STORAGE_KEY = 'mmingle-app-version';
                
                function checkAppVersion() {
                  try {
                    const storedVersion = localStorage.getItem(STORAGE_KEY);
                    if (storedVersion && storedVersion !== APP_VERSION) {
                      console.log('🔄 앱 버전 변경 감지:', storedVersion, '->', APP_VERSION);
                      // 버전이 변경되었으면 캐시 클리어
                      clearOldCache();
                    }
                    localStorage.setItem(STORAGE_KEY, APP_VERSION);
                  } catch (error) {
                    console.warn('버전 체크 실패:', error);
                  }
                }
                
                function clearOldCache() {
                  try {
                    // localStorage에서 mmingle 관련 데이터만 선택적으로 제거
                    const keys = Object.keys(localStorage);
                    const mmingleKeys = keys.filter(key => 
                      key.includes('supabase') || 
                      key.includes('auth') ||
                      key.startsWith('sb-') ||
                      (key.includes('mmingle') && key !== STORAGE_KEY)
                    );
                    
                    mmingleKeys.forEach(key => {
                      localStorage.removeItem(key);
                      console.log('🗑️ 오래된 캐시 제거:', key);
                    });
                    
                    // sessionStorage 클리어
                    sessionStorage.clear();
                    
                    console.log('✅ 오래된 캐시 정리 완료');
                  } catch (error) {
                    console.warn('캐시 정리 실패:', error);
                  }
                }
                
                // Service Worker 업데이트 감지
                function handleServiceWorkerUpdate() {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                      console.log('🔄 Service Worker 업데이트 감지');
                      window.location.reload();
                    });
                    
                    // 새로운 Service Worker가 waiting 상태일 때
                    navigator.serviceWorker.ready.then((registration) => {
                      if (registration.waiting) {
                        console.log('⏳ 새로운 Service Worker 대기 중');
                        // 자동으로 새 버전 활성화
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                      }
                    });
                  }
                }
                
                // DOM 로드 완료 후 실행
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    checkAppVersion();
                    handleServiceWorkerUpdate();
                  });
                } else {
                  checkAppVersion();
                  handleServiceWorkerUpdate();
                }
                
                // 페이지 언로드 시 임시 데이터 정리
                window.addEventListener('beforeunload', function() {
                  try {
                    // 임시 데이터나 민감한 정보 정리
                    const tempKeys = Object.keys(sessionStorage).filter(key => 
                      key.includes('temp') || key.includes('cache')
                    );
                    tempKeys.forEach(key => sessionStorage.removeItem(key));
                  } catch (error) {
                    // 무시
                  }
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
