"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { AppCtx, Spinner, ToastProvider, type ClassRow, type PeriodRow, type SettingsPayload } from "./ui";

const NAV = [
  { href: "/", label: "لوحة التحكم", icon: "📊" },
  { href: "/students", label: "سجل التلاميذ", icon: "🧒" },
  { href: "/import", label: "الاستيراد الجماعي", icon: "📥" },
  { href: "/class-eval", label: "التقييم الجماعي", icon: "📝" },
  { href: "/progress", label: "متابعة التطور", icon: "📈" },
  { href: "/ai", label: "التحليل الذكي", icon: "🤖" },
  { href: "/reports", label: "التقارير والتصدير", icon: "🖨️" },
  { href: "/backup", label: "النسخ الاحتياطي", icon: "💾" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];
const BOTTOM = ["/", "/students", "/class-eval", "/reports"];

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; fullName: string; role: "admin" | "teacher" } | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [classId, setClassIdState] = useState("");
  const [periodId, setPeriodIdState] = useState("");
  const [menu, setMenu] = useState(false);

  const reload = useCallback(async () => {
    const [c, p, s] = await Promise.all([api<ClassRow[]>("/api/classes"), api<PeriodRow[]>("/api/periods"), api<SettingsPayload>("/api/settings")]);
    setClasses(c);
    setPeriods(p);
    setSettings(s);
    setClassIdState((cur) => (cur && c.some((x) => x.id === cur) ? cur : localStorage.getItem("tq.class") && c.some((x) => x.id === localStorage.getItem("tq.class")) ? localStorage.getItem("tq.class")! : c[0]?.id ?? ""));
    setPeriodIdState((cur) => cur || localStorage.getItem("tq.period") || p.find((x) => x.isCurrent)?.id || "");
  }, []);

  useEffect(() => {
    api<{ needsSetup: boolean; user: typeof user }>("/api/auth")
      .then(async (s) => {
        if (!s.user) return router.replace("/login");
        setUser(s.user);
        await reload();
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router, reload]);

  useEffect(() => setMenu(false), [path]);

  if (!ready || !user) return <Spinner text="جارٍ التحقق من الجلسة…" />;

  const setClassId = (v: string) => {
    setClassIdState(v);
    localStorage.setItem("tq.class", v);
  };
  const setPeriodId = (v: string) => {
    setPeriodIdState(v);
    localStorage.setItem("tq.period", v);
  };
  const logout = async () => {
    await api("/api/auth", { json: { action: "logout" } });
    router.replace("/login");
  };
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <AppCtx.Provider value={{ user, classes, periods, settings, classId, periodId, setClassId, setPeriodId, reload }}>
      <ToastProvider>
        <div className="min-h-screen md:flex">
          <aside className="no-print hidden w-60 shrink-0 border-l border-slate-200 bg-white md:block">
            <div className="sticky top-0 flex h-screen flex-col p-3">
              <div className="mb-4 rounded-xl bg-[#0f4c81] p-3 text-white">
                <div className="text-sm font-extrabold">{settings?.name || "التقييم التربوي"}</div>
                <div className="text-xs opacity-80">{settings?.academicYear}</div>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${active(n.href) ? "bg-[#0f4c81]/10 text-[#0f4c81]" : "text-slate-600 hover:bg-slate-100"}`}>
                    <span>{n.icon}</span>
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="border-t pt-3 text-xs text-slate-500">
                <div className="font-bold text-slate-700">{user.fullName}</div>
                <div>{user.role === "admin" ? "مدير" : "معلم"}</div>
                <button onClick={logout} className="mt-2 text-red-600 hover:underline">
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b bg-white/95 px-3 py-2 backdrop-blur md:hidden">
              <button onClick={() => setMenu(true)} className="rounded-lg border px-3 py-1.5 text-lg" aria-label="القائمة">
                ☰
              </button>
              <div className="text-sm font-extrabold text-[#0f4c81]">{settings?.name || "التقييم التربوي"}</div>
              <span className="w-10" />
            </header>
            {menu && (
              <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenu(false)}>
                <div className="mr-auto h-full w-72 bg-white p-3" onClick={(e) => e.stopPropagation()} style={{ marginInlineStart: 0, marginInlineEnd: "auto" }}>
                  <div className="mb-3 text-sm font-bold">{user.fullName}</div>
                  {NAV.map((n) => (
                    <Link key={n.href} href={n.href} className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${active(n.href) ? "bg-[#0f4c81]/10 text-[#0f4c81]" : "text-slate-700"}`}>
                      <span>{n.icon}</span>
                      {n.label}
                    </Link>
                  ))}
                  <button onClick={logout} className="mt-3 px-3 text-sm text-red-600">
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            )}
            <main className="mx-auto max-w-6xl p-3 pb-24 sm:p-5 md:pb-8">{children}</main>
            <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white md:hidden">
              {NAV.filter((n) => BOTTOM.includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} className={`flex flex-col items-center py-2 text-[11px] font-semibold ${active(n.href) ? "text-[#0f4c81]" : "text-slate-500"}`}>
                  <span className="text-lg">{n.icon}</span>
                  {n.label.split(" ")[0]}
                </Link>
              ))}
              <button onClick={() => setMenu(true)} className="flex flex-col items-center py-2 text-[11px] font-semibold text-slate-500">
                <span className="text-lg">⋯</span>المزيد
              </button>
            </nav>
          </div>
        </div>
      </ToastProvider>
    </AppCtx.Provider>
  );
}
