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
  // appleWebApp: {
  //   capable: true,
  //   statusBarStyle: "black-translucent",
  //   title: APP_INFO.title,
  //   // startUpImage: [],
  // },
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
      <body className={`${pretendard}`}>
        <Layout>{children}</Layout>
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
