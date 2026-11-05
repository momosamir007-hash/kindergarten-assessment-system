"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { InstitutionSettings } from "@/lib/levels";

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "success" }) {
  const v = {
    primary: "bg-[#0f4c81] text-white hover:bg-[#0c3d68]",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />;
}

export const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/20";

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Spinner({ text = "جارٍ التحميل…" }: { text?: string }) {
  return <div className="py-8 text-center text-sm text-slate-500">{text}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Badge({ children, color = "#475569" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${color}1a`, color }}>
      {children}
    </span>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{children}</h1>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-20 left-1/2 z-50 flex w-[92vw] max-w-md -translate-x-1/2 flex-col gap-2 md:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.kind === "ok" ? "bg-green-600" : "bg-red-600"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Shared data: classes, periods, settings, selection ----------
export type ClassRow = { id: string; name: string; level: string; studentCount: number };
export type PeriodRow = { id: string; name: string; isCurrent: boolean };
export type SettingsPayload = { name: string; academicYear: string; city: string; logo: string | null; settings: InstitutionSettings; aiConfigured: boolean };

type Ctx = {
  user: { id: string; fullName: string; role: "admin" | "teacher" };
  classes: ClassRow[];
  periods: PeriodRow[];
  settings: SettingsPayload | null;
  classId: string;
  periodId: string;
  setClassId: (v: string) => void;
  setPeriodId: (v: string) => void;
  reload: () => Promise<void>;
};
export const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("no app ctx");
  return c;
};

export function useApiData<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    api<T>(url)
      .then((d) => alive && (setData(d), setError("")))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);
  return { data, loading, error, reload: () => setTick((t) => t + 1), setData };
}

export function ClassPeriodPicker({ withClass = true, withPeriod = true }: { withClass?: boolean; withPeriod?: boolean }) {
  const { classes, periods, classId, periodId, setClassId, setPeriodId } = useApp();
  return (
    <div className="flex flex-wrap gap-2">
      {withClass && (
        <select className={`${inputCls} w-auto min-w-40`} value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="القسم">
          {!classes.length && <option value="">— لا توجد أقسام —</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.studentCount})
            </option>
          ))}
        </select>
      )}
      {withPeriod && (
        <select className={`${inputCls} w-auto min-w-40`} value={periodId} onChange={(e) => setPeriodId(e.target.value)} aria-label="الفترة">
          <option value="">كل الفترات (آخر تقييم)</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
