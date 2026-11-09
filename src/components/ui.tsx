"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { api } from "@/lib/client";
import type { InstitutionSettings } from "@/lib/levels";
import type { AuthUser } from "@/server/auth";

// --- Types ---
export type ClassItem = {
  id: string;
  name: string;
  level: string;
  academicYear: string;
  studentCount?: number;
};

export type PeriodItem = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder?: number;
};

export type FullSettings = {
  name: string;
  academicYear: string;
  city: string;
  logo: string | null;
  settings: InstitutionSettings;
  aiConfigured?: boolean;
};

type AppContextType = {
  user: AuthUser;
  classes: ClassItem[];
  periods: PeriodItem[];
  settings: FullSettings | null;
  classId: string;
  setClassId: (id: string) => void;
  periodId: string;
  setPeriodId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
}

// --- AppProvider ---
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>({
    id: "",
    institutionId: "",
    username: "",
    fullName: "",
    role: "teacher",
  });
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [settings, setSettings] = useState<FullSettings | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [periodId, setPeriodId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const auth = await api<{ needsSetup: boolean; user: AuthUser | null }>("/api/auth");
      if (auth.user) {
        setUser(auth.user);
      }

      const [clsList, perList, setObj] = await Promise.all([
        api<ClassItem[]>("/api/classes").catch(() => []),
        api<PeriodItem[]>("/api/periods").catch(() => []),
        api<FullSettings>("/api/settings").catch(() => null),
      ]);

      setClasses(clsList);
      setPeriods(perList);
      setSettings(setObj);

      if (clsList.length > 0 && !classId) {
        setClassId(clsList[0].id);
      }
      if (perList.length > 0 && !periodId) {
        const curr = perList.find((p) => p.isCurrent) || perList[0];
        setPeriodId(curr.id);
      }
    } catch (err) {
      console.error("Failed to load app context data:", err);
    } finally {
      setLoading(false);
    }
  }, [classId, periodId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <AppContext.Provider
      value={{
        user,
        classes,
        periods,
        settings,
        classId,
        setClassId,
        periodId,
        setPeriodId,
        reload: loadAll,
        loading,
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </AppContext.Provider>
  );
}

// --- Toast System ---
type ToastMessage = {
  id: number;
  text: string;
  type: "ok" | "err" | "info";
};

type ToastContextType = (msg: string, type?: "ok" | "err" | "info") => void;

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const fn = useContext(ToastContext);
  if (!fn) {
    return (msg: string) => console.log("Toast:", msg);
  }
  return fn;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string, type: "ok" | "err" | "info" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 ${
              t.type === "err"
                ? "bg-red-600 text-white"
                : t.type === "info"
                ? "bg-blue-600 text-white"
                : "bg-emerald-600 text-white"
            }`}
          >
            <span>{t.type === "err" ? "⚠️" : t.type === "info" ? "ℹ️" : "✓"}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --- useApiData Hook ---
export function useApiData<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<T>(url);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء جلب البيانات");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, reload: fetchData };
}

// --- ClassPeriodPicker ---
export function ClassPeriodPicker({
  withClass = true,
  withPeriod = true,
}: {
  withClass?: boolean;
  withPeriod?: boolean;
}) {
  const { classes, periods, classId, setClassId, periodId, setPeriodId } = useApp();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {withClass && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500">الفوج/القسم:</span>
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs md:text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            {classes.length === 0 && <option value="">لا توجد أقسام</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.level ? `(${c.level})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {withPeriod && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500">الفترة/الفصل:</span>
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs md:text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            {periods.length === 0 && <option value="">لا توجد فترات</option>}
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isCurrent ? "★ الحالية" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// --- Standard Input Classes ---
export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500 transition-colors";

// --- UI Components ---
export function PageTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-xs md:text-sm text-slate-500 font-medium leading-relaxed">{sub}</p>}
    </div>
  );
}

export function Card({
  title,
  actions,
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {title && <h3 className="text-base md:text-lg font-bold text-slate-800">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col space-y-1.5 pb-3 ${className}`}>{children}</div>;
}

export function CardTitle({ className = "", children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base md:text-lg font-bold leading-none text-slate-800 ${className}`}>{children}</h3>;
}

export function CardContent({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`pt-0 ${className}`}>{children}</div>;
}

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  const styles = {
    primary: "bg-[#0f4c81] text-white hover:bg-[#0c3c66] shadow-sm",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  };

  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" }) {
  return <Btn {...props} />;
}

export function Field({
  label,
  children,
  error,
  hint,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs md:text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400 font-medium">{hint}</p>}
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

export function Badge({
  children,
  color,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-bold ${className}`}
      style={
        color
          ? {
              backgroundColor: `${color}18`,
              color: color,
              border: `1px solid ${color}40`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Empty({
  children = "لا توجد بيانات متاحة حالياً.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
      <div className="mb-2 text-3xl">📂</div>
      <p className="text-sm font-medium text-slate-500">{children}</p>
    </div>
  );
}

export function Spinner({ label, text }: { label?: string; text?: string }) {
  const displayText = label ?? text ?? "جارٍ التحميل...";
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#0f4c81]" />
      <span className="text-xs md:text-sm font-semibold">{displayText}</span>
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...props} />;
}

export function Label({ className = "", children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-xs md:text-sm font-semibold text-slate-700 ${className}`} {...props}>
      {children}
    </label>
  );
}
