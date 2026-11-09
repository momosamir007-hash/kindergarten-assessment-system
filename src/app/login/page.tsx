"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { School, LogIn, UserPlus, Lock, User } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [f, setF] = useState({
    username: "",
    password: "",
    fullName: "",
    institutionName: "",
    academicYear: "",
    city: "",
    className: "",
    level: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean; user: unknown }>("/api/auth").then((s) => {
      if (s.user) router.replace("/");
      else setNeedsSetup(s.needsSetup);
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth", { json: { action: needsSetup ? "register" : "login", ...f } });
      router.replace("/");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "حدث خطأ في المصادقة");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  if (needsSetup === null)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#0f4c81]" />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#f8fafc]">
      <div className="w-full max-w-md space-y-4">
        <form
          onSubmit={submit}
          className="rounded-3xl bg-white border border-slate-200/90 p-7 md:p-8 shadow-sm space-y-4"
        >
          <div className="text-center space-y-2 mb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f4c81] to-[#1e6bb8] text-white shadow-xs">
              <School size={28} />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">
              نظام التقييم التربوي
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {needsSetup
                ? "الإعداد الأولي: إنشاء المؤسسة وحساب المدير"
                : "تسجيل الدخول لمتابعة دفاتر الأطفال"}
            </p>
          </div>

          {needsSetup && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <Field label="اسم الروضة أو المؤسسة التعليمية *">
                <input
                  className={inputCls}
                  placeholder="مثال: روضة البراعم النموذجية"
                  value={f.institutionName}
                  onChange={set("institutionName")}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="السنة الدراسية">
                  <input
                    className={inputCls}
                    placeholder="2025/2026"
                    value={f.academicYear}
                    onChange={set("academicYear")}
                  />
                </Field>
                <Field label="المدينة / الولاية">
                  <input
                    className={inputCls}
                    placeholder="المدينة"
                    value={f.city}
                    onChange={set("city")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="الفوج الأول (اختياري)">
                  <input
                    className={inputCls}
                    placeholder="الفوج أ"
                    value={f.className}
                    onChange={set("className")}
                  />
                </Field>
                <Field label="المستوى">
                  <input
                    className={inputCls}
                    placeholder="التحضيري / تمهيدي"
                    value={f.level}
                    onChange={set("level")}
                  />
                </Field>
              </div>

              <Field label="الاسم الكامل للمدير *">
                <input
                  className={inputCls}
                  placeholder="الاسم واللقب"
                  value={f.fullName}
                  onChange={set("fullName")}
                  required
                />
              </Field>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Field label="اسم المستخدم *">
              <div className="relative">
                <input
                  className={`${inputCls} pl-10`}
                  dir="ltr"
                  placeholder="username"
                  autoComplete="username"
                  value={f.username}
                  onChange={set("username")}
                  required
                />
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>

            <Field label="كلمة المرور *">
              <div className="relative">
                <input
                  className={`${inputCls} pl-10`}
                  dir="ltr"
                  type="password"
                  placeholder="••••••••"
                  autoComplete={needsSetup ? "new-password" : "current-password"}
                  value={f.password}
                  onChange={set("password")}
                  required
                />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
          </div>

          {err && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-bold">
              {err}
            </div>
          )}

          <Btn className="w-full font-bold text-sm h-11" disabled={busy}>
            {needsSetup ? (
              <>
                <UserPlus size={16} />
                <span>{busy ? "جارٍ إنشاء النظام..." : "إنشاء الحساب والبدء"}</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>{busy ? "جارٍ التحقق..." : "تسجيل الدخول"}</span>
              </>
            )}
          </Btn>
        </form>
      </div>
    </div>
  );
}
