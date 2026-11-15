import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import TabBar from "@/components/tab-bar";
import { SESSION_COOKIE } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "CliMate A",
  description: "내 일정에 맞춘 날씨 알림",
  appleWebApp: {
    capable: true,
    title: "CliMate A",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The tab bar is for signed-in testers; the start screen stands on its own.
  const signedIn = (await cookies()).has(SESSION_COOKIE);
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
        {signedIn && <TabBar />}
      </body>
    </html>
  );
}
