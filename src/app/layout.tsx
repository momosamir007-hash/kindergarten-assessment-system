import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام التقييم والملاحظة النمائية للطفولة المبكرة",
  description: "تقييم أطفال ما قبل التمدرس، دفاتر الملاحظة النمائية، والتقارير التربوية الشاملة",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "التقييم التربوي" },
};
export const viewport: Viewport = {
  themeColor: "#0f4c81",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
