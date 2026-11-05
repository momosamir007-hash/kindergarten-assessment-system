"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Btn, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [f, setF] = useState({ username: "", password: "", fullName: "", institutionName: "", academicYear: "", city: "", className: "", level: "" });
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
      setErr(x instanceof Error ? x.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (needsSetup === null) return <div className="p-10 text-center text-slate-500">…</div>;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f4c81] text-2xl text-white">📚</div>
          <h1 className="text-xl font-extrabold">نظام التقييم التربوي</h1>
          <p className="text-sm text-slate-500">{needsSetup ? "الإعداد الأول: إنشاء المؤسسة وحساب المدير" : "تسجيل الدخول"}</p>
        </div>
        {needsSetup && (
          <>
            <Field label="اسم المؤسسة"><input className={inputCls} value={f.institutionName} onChange={set("institutionName")} required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="السنة الدراسية"><input className={inputCls} placeholder="2025/2026" value={f.academicYear} onChange={set("academicYear")} /></Field>
              <Field label="المدينة"><input className={inputCls} value={f.city} onChange={set("city")} /></Field>
              <Field label="القسم الأول (اختياري)"><input className={inputCls} value={f.className} onChange={set("className")} /></Field>
              <Field label="المستوى"><input className={inputCls} value={f.level} onChange={set("level")} /></Field>
            </div>
            <Field label="الاسم الكامل للمدير/المعلم"><input className={inputCls} value={f.fullName} onChange={set("fullName")} required /></Field>
          </>
        )}
        <Field label="اسم المستخدم"><input className={inputCls} dir="ltr" autoComplete="username" value={f.username} onChange={set("username")} required /></Field>
        <Field label="كلمة المرور"><input className={inputCls} dir="ltr" type="password" autoComplete={needsSetup ? "new-password" : "current-password"} value={f.password} onChange={set("password")} required /></Field>
        {err && <div className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <Btn className="w-full" disabled={busy}>{busy ? "…" : needsSetup ? "إنشاء الحساب والبدء" : "دخول"}</Btn>
      </form>
    </div>
  );
}
