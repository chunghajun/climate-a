import type { Metadata, Viewport } from "next";
import TabBar from "@/components/tab-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CliMate",
  description: "내 일정에 맞춘 날씨 알림",
  appleWebApp: {
    capable: true,
    title: "CliMate",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
