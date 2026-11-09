"use client";
import { useEffect, useState, type ComponentType } from "react";
import { Badge, Btn, Card, Empty, Field, PageTitle, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { AI_PROVIDERS, type AiModelInfo } from "@/lib/ai-providers";
import type { AiConfig, AiProviderId, Level } from "@/lib/levels";
import {
  Building2,
  Sparkles,
  Sliders,
  Users as UsersIcon,
  BookOpen,
  Calendar,
  Shield,
  History,
  Plus,
  Trash2,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
} from "lucide-react";

type TabId = "classes" | "inst" | "ai" | "levels" | "curr" | "periods" | "users" | "audit";

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "classes", label: "الأقسام", icon: UsersIcon },
  { id: "inst", label: "المؤسسة", icon: Building2 },
  { id: "ai", label: "الذكاء الاصطناعي", icon: Sparkles },
  { id: "levels", label: "مستويات التقييم", icon: Sliders },
  { id: "curr", label: "المواد والمهارات", icon: BookOpen },
  { id: "periods", label: "الفترات", icon: Calendar },
  { id: "users", label: "المستخدمون", icon: Shield },
  { id: "audit", label: "سجل العمليات", icon: History },
];

export default function Settings() {
  const { user } = useApp();
  const [tab, setTab] = useState<TabId>("classes");
  const admin = user.role === "admin";

  return (
    <div className="space-y-4">
      <PageTitle sub="تهيئة أقسام المؤسسة، البيانات الرسمية، ومزود الذكاء الاصطناعي">الإعدادات العامة</PageTitle>

      {!admin && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>بعض الإعدادات المتقدمة متاحة للمدير فقط بصلاحيات كاملة.</span>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? "bg-[#0f4c81] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {tab === "inst" && <Inst admin={admin} />}
      {tab === "ai" && <AiSettingsTab admin={admin} />}
      {tab === "levels" && <Levels admin={admin} />}
      {tab === "classes" && <Classes admin={admin} />}
      {tab === "curr" && <Curriculum admin={admin} />}
      {tab === "periods" && <Periods admin={admin} />}
      {tab === "users" && (admin ? <Users /> : <Empty>متاح لمدير النظام فقط.</Empty>)}
      {tab === "audit" && (admin ? <Audit /> : <Empty>متاح لمدير النظام فقط.</Empty>)}
    </div>
  );
}

function Inst({ admin }: { admin: boolean }) {
  const { settings, reload } = useApp();
  const toast = useToast();
  const [f, setF] = useState({ name: "", academicYear: "", city: "", logo: "" as string | null, signature: "" });

  useEffect(() => {
    if (settings) {
      setF({
        name: settings.name,
        academicYear: settings.academicYear,
        city: settings.city,
        logo: settings.logo,
        signature: settings.settings.teacherSignatureLabel ?? "",
      });
    }
  }, [settings]);

  const save = async () => {
    try {
      await api("/api/settings", {
        method: "PUT",
        json: {
          name: f.name,
          academicYear: f.academicYear,
          city: f.city,
          logo: f.logo,
          settings: { teacherSignatureLabel: f.signature },
        },
      });
      toast("تم حفظ بيانات المؤسسة بنجاح");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل الحفظ", "err");
    }
  };

  const onLogo = (file: File) => {
    const r = new FileReader();
    r.onload = () => setF({ ...f, logo: String(r.result) });
    r.readAsDataURL(file);
  };

  return (
    <Card title="بيانات المؤسسة (تظهر في رأس التقارير الرسمية والـ PDF)">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الروضة أو المؤسسة">
          <input
            className={inputCls}
            disabled={!admin}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="روضة براعم المستقبل"
          />
        </Field>
        <Field label="السنة الدراسية">
          <input
            className={inputCls}
            disabled={!admin}
            value={f.academicYear}
            onChange={(e) => setF({ ...f, academicYear: e.target.value })}
            placeholder="2024 / 2025"
          />
        </Field>
        <Field label="المدينة / الولاية">
          <input
            className={inputCls}
            disabled={!admin}
            value={f.city}
            onChange={(e) => setF({ ...f, city: e.target.value })}
            placeholder="الجزائر"
          />
        </Field>
        <Field label="عنوان خانة التوقيع">
          <input
            className={inputCls}
            disabled={!admin}
            placeholder="توقيع المعلم أو المربي(ة)"
            value={f.signature}
            onChange={(e) => setF({ ...f, signature: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="شعار المؤسسة (PNG أو JPG، يُفضل خلفية شفافة)">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!admin}
              className={inputCls}
              onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
            />
          </Field>
          {f.logo && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <img src={f.logo} alt="الشعار" className="h-16 w-16 object-contain rounded-lg border bg-white p-1" />
              <div className="flex-1 text-xs text-slate-600">
                <div className="font-semibold text-slate-800">الشعار الحالي جاهز للإدراج في التقارير</div>
                <div className="text-slate-400">سيظهر في الركن الأيمن للترويسة الرسمية في صفحة الـ PDF</div>
              </div>
              {admin && (
                <Btn variant="danger" onClick={() => setF({ ...f, logo: null })}>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>إزالة</span>
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
      {admin && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
          <Btn onClick={save}>
            <CheckCircle2 className="h-4 w-4" />
            <span>حفظ البيانات</span>
          </Btn>
        </div>
      )}
    </Card>
  );
}

function Levels({ admin }: { admin: boolean }) {
  const { settings, reload } = useApp();
  const toast = useToast();
  const [lv, setLv] = useState<Level[]>([]);
  const [th, setTh] = useState({ s: 80, p: 50 });

  useEffect(() => {
    if (settings) {
      setLv(settings.settings.levels);
      setTh({
        s: settings.settings.strengthThreshold,
        p: settings.settings.supportThreshold,
      });
    }
  }, [settings]);

  const upd = (i: number, k: keyof Level, v: string | number) =>
    setLv(lv.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const save = async () => {
    try {
      await api("/api/settings", {
        method: "PUT",
        json: {
          settings: {
            levels: lv,
            strengthThreshold: th.s,
            supportThreshold: th.p,
          },
        },
      });
      toast("تم حفظ مستويات التقييم");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <Card title="مستويات التقييم البيداغوجي">
      <div className="mb-4 rounded-xl bg-blue-50/70 p-3 text-xs text-slate-700 leading-relaxed border border-blue-100">
        نظام التقييم البصري الجديد يعتمد على الدوائر الثلاث (● مكتسب باستقلالية، ◐ في طور الاكتساب، ○ قيد الملاحظة).
        تُستعمل القيم الحسابية في حساب المؤشرات العامة ونسب الإتقان دون تعديل السجلات المخزنة.
      </div>
      <div className="space-y-2">
        {lv.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <input
              className={`${inputCls} max-w-56 font-bold`}
              disabled={!admin}
              value={l.label}
              onChange={(e) => upd(i, "label", e.target.value)}
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">الوزن:</span>
              <input
                className={`${inputCls} w-20 text-center font-mono`}
                dir="ltr"
                type="number"
                step="0.5"
                disabled={!admin}
                value={l.value}
                onChange={(e) => upd(i, "value", Number(e.target.value))}
              />
            </div>
            <input
              type="color"
              disabled={!admin}
              value={l.color}
              onChange={(e) => upd(i, "color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
            />
            <Badge color={l.color}>{l.key}</Badge>
            {admin && lv.length > 2 && (
              <button
                type="button"
                className="text-slate-400 hover:text-red-600 p-1 mr-auto"
                onClick={() => setLv(lv.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {admin && (
        <Btn
          variant="ghost"
          className="mt-3"
          onClick={() =>
            setLv([
              ...lv,
              {
                key: `lvl_${Date.now().toString(36)}`,
                label: "مستوى جديد",
                value: Math.max(...lv.map((l) => l.value)) + 1,
                color: "#0f4c81",
              },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          <span>إضافة مستوى تقييم</span>
        </Btn>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 pt-3 border-t border-slate-100">
        <Field label="عتبة نقاط القوة (نسبة % فأكثر)">
          <input
            className={inputCls}
            type="number"
            disabled={!admin}
            value={th.s}
            onChange={(e) => setTh({ ...th, s: Number(e.target.value) })}
          />
        </Field>
        <Field label="عتبة الحاجة إلى دعم (أقل من %)">
          <input
            className={inputCls}
            type="number"
            disabled={!admin}
            value={th.p}
            onChange={(e) => setTh({ ...th, p: Number(e.target.value) })}
          />
        </Field>
      </div>
      {admin && (
        <div className="mt-4 flex justify-end">
          <Btn onClick={save}>حفظ المستويات</Btn>
        </div>
      )}
    </Card>
  );
}

function Classes({ admin }: { admin: boolean }) {
  const { classes, reload } = useApp();
  const toast = useToast();
  const [n, setN] = useState({ name: "", level: "" });

  const add = async () => {
    try {
      await api("/api/classes", { json: n });
      setN({ name: "", level: "" });
      toast("تم إنشاء القسم بنجاح");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <Card title="الأقسام والفصول الدراسية">
      {admin && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputCls} max-w-56`}
            placeholder="اسم القسم (مثال: الفراشات)"
            value={n.name}
            onChange={(e) => setN({ ...n, name: e.target.value })}
          />
          <input
            className={`${inputCls} max-w-44`}
            placeholder="المستوى (مثال: تمهيدي)"
            value={n.level}
            onChange={(e) => setN({ ...n, level: e.target.value })}
          />
          <Btn onClick={add} disabled={!n.name.trim()}>
            <Plus className="h-4 w-4" />
            <span>إضافة قسم</span>
          </Btn>
        </div>
      )}

      {!classes.length ? (
        <Empty>لا توجد أقسام مسجلة حالياً.</Empty>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {classes.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0f4c81] font-bold">
                  {c.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    {c.name}
                    {c.level && <span className="font-normal text-slate-500 mr-2 text-xs">— {c.level}</span>}
                  </div>
                  <div className="text-xs text-slate-400">{c.studentCount} تلميذ مقيد</div>
                </div>
              </div>

              {admin && (
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                  onClick={async () => {
                    if (confirm("هل تريد حذف هذا القسم؟ سيبقى تلاميذه بدون قسم.")) {
                      await api(`/api/classes?id=${c.id}`, { method: "DELETE" });
                      reload();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type Subject = { id: string; name: string; kind: string; skills: { id: string; name: string }[] };

function Curriculum({ admin }: { admin: boolean }) {
  const { data, reload } = useApiData<Subject[]>("/api/curriculum");
  const toast = useToast();
  const [sub, setSub] = useState({ name: "", kind: "academic" });
  const [skill, setSkill] = useState<Record<string, string>>({});

  const call = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <Card title="المجالات والمهارات التربوية (أكاديمية وسلوكية)">
      {admin && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputCls} max-w-64`}
            placeholder="مادة أو مجال جديد"
            value={sub.name}
            onChange={(e) => setSub({ ...sub, name: e.target.value })}
          />
          <select
            className={`${inputCls} w-auto`}
            value={sub.kind}
            onChange={(e) => setSub({ ...sub, kind: e.target.value })}
          >
            <option value="academic">أكاديمي / معرفي</option>
            <option value="behavioral">سلوكي / نمائي</option>
          </select>
          <Btn
            disabled={!sub.name.trim()}
            onClick={() =>
              call(async () => {
                await api("/api/curriculum", { json: { type: "subject", ...sub } });
                setSub({ ...sub, name: "" });
              })
            }
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مجال</span>
          </Btn>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <b className="text-sm text-slate-800">{s.name}</b>
                <Badge color={s.kind === "behavioral" ? "#7c3aed" : "#0f4c81"}>
                  {s.kind === "behavioral" ? "سلوكي" : "أكاديمي"}
                </Badge>
              </div>
              {admin && (
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() =>
                    confirm("حذف المادة وكل مهاراتها وتقييماتها المرتبطة؟") &&
                    call(() => api(`/api/curriculum?type=subject&id=${s.id}`, { method: "DELETE" }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <ul className="mb-3 space-y-1.5 text-xs">
              {s.skills.map((k) => (
                <li key={k.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="text-slate-700">• {k.name}</span>
                  {admin && (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500"
                      onClick={() =>
                        confirm("حذف المهارة وتقييماتها؟") &&
                        call(() => api(`/api/curriculum?type=skill&id=${k.id}`, { method: "DELETE" }))
                      }
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
              {!s.skills.length && <li className="text-xs text-slate-400 py-1">لا توجد مهارات مضافة بعد</li>}
            </ul>

            {admin && (
              <div className="flex gap-1.5 pt-1">
                <input
                  className={`${inputCls} py-1 text-xs`}
                  placeholder="مهارة أو تعلم مستهدف جديد"
                  value={skill[s.id] ?? ""}
                  onChange={(e) => setSkill({ ...skill, [s.id]: e.target.value })}
                />
                <Btn
                  variant="ghost"
                  disabled={!(skill[s.id] ?? "").trim()}
                  onClick={() =>
                    call(async () => {
                      await api("/api/curriculum", {
                        json: { type: "skill", subjectId: s.id, name: skill[s.id] },
                      });
                      setSkill({ ...skill, [s.id]: "" });
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Btn>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Periods({ admin }: { admin: boolean }) {
  const { periods, reload } = useApp();
  const toast = useToast();
  const [name, setName] = useState("");

  const call = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <Card title="الفترات الدراسية والتقييمية">
      {admin && (
        <div className="mb-4 flex gap-2">
          <input
            className={`${inputCls} max-w-64`}
            placeholder="اسم الفترة (مثال: الثلاثي الأول)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Btn
            disabled={!name.trim()}
            onClick={() =>
              call(async () => {
                await api("/api/periods", { json: { name } });
                setName("");
              })
            }
          >
            <Plus className="h-4 w-4" />
            <span>إضافة فترة</span>
          </Btn>
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {periods.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-800">{p.name}</span>
              {p.isCurrent && <Badge color="#16a34a">الفترة النشطة حالياً</Badge>}
            </div>
            {admin && (
              <span className="flex items-center gap-3 text-xs">
                {!p.isCurrent && (
                  <button
                    type="button"
                    className="font-semibold text-[#0f4c81] hover:underline"
                    onClick={() =>
                      call(() => api("/api/periods", { method: "PATCH", json: { id: p.id, isCurrent: true } }))
                    }
                  >
                    تعيين كنشطة
                  </button>
                )}
                <button
                  type="button"
                  className="text-red-600 hover:text-red-800"
                  onClick={() =>
                    confirm("حذف الفترة؟ ستبقى التقييمات المسجلة بدون فترة.") &&
                    call(() => api(`/api/periods?id=${p.id}`, { method: "DELETE" }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Users() {
  const { data, reload } = useApiData<{ id: string; username: string; fullName: string; role: string; active: boolean }[]>(
    "/api/users"
  );
  const toast = useToast();
  const [n, setN] = useState({ fullName: "", username: "", password: "", role: "teacher" });

  const add = async () => {
    try {
      await api("/api/users", { json: n });
      setN({ fullName: "", username: "", password: "", role: "teacher" });
      toast("تم إنشاء المستخدم بنجاح");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <Card title="المستخدمون وإدارة الحسابات">
      <div className="mb-4 grid gap-2 sm:grid-cols-5">
        <input
          className={inputCls}
          placeholder="الاسم الكامل"
          value={n.fullName}
          onChange={(e) => setN({ ...n, fullName: e.target.value })}
        />
        <input
          className={inputCls}
          dir="ltr"
          placeholder="اسم المستخدم"
          value={n.username}
          onChange={(e) => setN({ ...n, username: e.target.value })}
        />
        <input
          className={inputCls}
          dir="ltr"
          type="password"
          placeholder="كلمة المرور"
          value={n.password}
          onChange={(e) => setN({ ...n, password: e.target.value })}
        />
        <select className={inputCls} value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}>
          <option value="teacher">معلم / مربي</option>
          <option value="admin">مدير النظام</option>
        </select>
        <Btn onClick={add} disabled={!n.fullName.trim() || !n.username.trim() || !n.password}>
          <Plus className="h-4 w-4" />
          <span>إضافة حساب</span>
        </Btn>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                {u.fullName.slice(0, 1)}
              </div>
              <div>
                <span className="font-bold text-slate-800">{u.fullName}</span>{" "}
                <span className="text-xs text-slate-400 font-mono" dir="ltr">
                  @{u.username}
                </span>{" "}
                <Badge color={u.role === "admin" ? "#0f4c81" : "#16a34a"}>
                  {u.role === "admin" ? "مدير" : "معلم"}
                </Badge>{" "}
                {!u.active && <Badge color="#dc2626">معطّل</Badge>}
              </div>
            </div>
            <span className="flex items-center gap-3 text-xs">
              <button
                type="button"
                className="font-semibold text-[#0f4c81] hover:underline"
                onClick={async () => {
                  await api("/api/users", { method: "PATCH", json: { id: u.id, active: !u.active } });
                  reload();
                }}
              >
                {u.active ? "تعطيل الحساب" : "تفعيل الحساب"}
              </button>
              <button
                type="button"
                className="font-semibold text-slate-600 hover:text-[#0f4c81] flex items-center gap-1"
                onClick={async () => {
                  const p = prompt("أدخل كلمة المرور الجديدة (6 أحرف على الأقل):");
                  if (p) {
                    try {
                      await api("/api/users", { method: "PATCH", json: { id: u.id, password: p } });
                      toast("تم تغيير كلمة المرور بنجاح");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "فشل", "err");
                    }
                  }
                }}
              >
                <Key className="h-3 w-3" />
                <span>كلمة المرور</span>
              </button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Audit() {
  const { data } = useApiData<{ id: string; action: string; entity: string; user: string | null; createdAt: string }[]>(
    "/api/exports?audit=1"
  );

  return (
    <Card title="سجل العمليات والتدقيق الأمني">
      {!data?.length ? (
        <Empty>لا توجد عمليات مسجلة في السجل.</Empty>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-right text-slate-600 border-b">
                <th className="p-2.5">التاريخ والوقت</th>
                <th className="p-2.5">المستخدم</th>
                <th className="p-2.5">نوع العملية</th>
                <th className="p-2.5">الكيان المتأثر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono text-slate-500">
                    {new Date(a.createdAt).toLocaleString("ar-DZ-u-nu-latn")}
                  </td>
                  <td className="p-2.5 font-bold text-slate-700">{a.user ?? "—"}</td>
                  <td dir="ltr" className="p-2.5 text-right font-mono text-slate-600">
                    {a.action}
                  </td>
                  <td dir="ltr" className="p-2.5 text-right font-mono text-slate-500">
                    {a.entity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AiSettingsTab({ admin }: { admin: boolean }) {
  const { settings, reload } = useApp();
  const toast = useToast();

  const [provider, setProvider] = useState<AiProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [liveModels, setLiveModels] = useState<AiModelInfo[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (settings?.settings?.ai) {
      const ai = settings.settings.ai;
      setProvider(ai.provider || "gemini");
      setApiKey(ai.apiKey || "");
      setBaseUrl(ai.baseUrl || "");
      setModel(ai.model || "");
    }
  }, [settings]);

  const providerMeta = AI_PROVIDERS[provider] ?? AI_PROVIDERS.gemini;

  const onSelectProvider = (p: AiProviderId) => {
    setProvider(p);
    const meta = AI_PROVIDERS[p];
    if (p === "custom") {
      setBaseUrl("http://localhost:11434/v1");
    } else {
      setBaseUrl(meta.defaultBaseUrl);
    }
    setModel(meta.defaultModel);
    setLiveModels([]);
    setTestResult(null);
  };

  const fetchModels = async () => {
    if (provider !== "custom" && !apiKey.trim()) {
      toast("يرجى إدخال مفتاح API أولاً لجلب الموديلات", "err");
      return;
    }
    setFetchingModels(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; count: number; models: AiModelInfo[] }>("/api/ai/models", {
        json: { provider, apiKey, baseUrl },
      });
      if (res.models?.length) {
        setLiveModels(res.models);
        if (!res.models.some((m) => m.id === model)) {
          setModel(res.models[0].id);
        }
        toast(`تم جلب ${res.models.length} موديل نشط في الوقت الفعلي بنجاح!`);
      } else {
        toast("لم يتم العثور على موديلات متوافقة", "err");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل جلب الموديلات من المزود", "err");
    } finally {
      setFetchingModels(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; message: string }>("/api/ai/test", {
        json: { provider, apiKey, baseUrl, model: model || providerMeta.defaultModel },
      });
      setTestResult({ ok: true, msg: res.message });
      toast(res.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الاتصال بالموديل";
      setTestResult({ ok: false, msg });
      toast(msg, "err");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    try {
      const aiConfig: AiConfig = {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || providerMeta.defaultModel,
        enabled: apiKey.trim().length > 0,
      };
      await api("/api/settings", {
        method: "PUT",
        json: { settings: { ai: aiConfig } },
      });
      toast("تم حفظ إعدادات ومزود الذكاء الاصطناعي بنجاح!");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل الحفظ", "err");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="إعدادات مزودي الذكاء الاصطناعي (Multi-Provider AI)">
        <p className="mb-4 text-xs text-slate-600 leading-relaxed">
          يدعم النظام الاتصال بأحدث مزودي الذكاء الاصطناعي مع ميزة <b>جلب الموديلات المتاحة في الوقت الفعلي</b> من واجهة المزود مباشرة.
        </p>

        {/* Provider Cards */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold text-slate-700">اختر المزود:</label>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((p) => {
              const meta = AI_PROVIDERS[p];
              const isSel = provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={!admin}
                  onClick={() => onSelectProvider(p)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-right transition-all ${
                    isSel
                      ? "border-[#0f4c81] bg-blue-50/60 ring-2 ring-[#0f4c81]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="font-bold text-sm text-slate-900">{meta.name}</span>
                  <span className="text-[11px] text-slate-500 font-mono mt-1" dir="ltr">
                    {meta.defaultModel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key Input */}
        <div className="space-y-3">
          <Field
            label={
              <span className="flex items-center justify-between">
                <span>مفتاح API الخاص بمزود ({providerMeta.name}) *</span>
                {providerMeta.helpUrl && (
                  <a
                    href={providerMeta.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#0f4c81] hover:underline"
                  >
                    <span>الحصول على مفتاح مجاني</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            }
          >
            <div className="relative">
              <input
                className={`${inputCls} pr-10`}
                dir="ltr"
                type={showKey ? "text" : "password"}
                disabled={!admin}
                placeholder={providerMeta.keyPlaceholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                {showKey ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </Field>

          {/* Base URL */}
          <Field label="عنوان الخادم (Base URL)">
            <input
              className={inputCls}
              dir="ltr"
              disabled={!admin}
              placeholder={providerMeta.defaultBaseUrl}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>

          {/* Dynamic Model Fetching & Selector */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-slate-700">
                الموديل المختار: {liveModels.length > 0 && <span className="text-emerald-700 text-[11px]">({liveModels.length} موديل نشط حالياً)</span>}
              </label>
              {admin && (
                <Btn
                  variant="ghost"
                  disabled={fetchingModels || (!apiKey.trim() && provider !== "custom")}
                  onClick={fetchModels}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${fetchingModels ? "animate-spin" : ""}`} />
                  <span>{fetchingModels ? "جارٍ جلب الموديلات…" : "جلب الموديلات المتاحة لحظياً"}</span>
                </Btn>
              )}
            </div>

            {liveModels.length > 0 ? (
              <div className="space-y-2">
                <select
                  className={inputCls}
                  dir="ltr"
                  disabled={!admin}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {liveModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  تم جلب هذه القائمة لحظياً ومباشرة من واجهة برمجة المزود.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className={inputCls}
                  dir="ltr"
                  disabled={!admin}
                  placeholder={`الافتراضي: ${providerMeta.defaultModel}`}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                  اضغط زر «جلب الموديلات المتاحة» أعلاه لعرض قائمة الموديلات النشطة لدى المزود، أو اكتب اسم أي موديل مخصص يدوياً.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {admin && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Btn onClick={save}>
                <CheckCircle2 className="h-4 w-4" />
                <span>حفظ إعدادات المزود</span>
              </Btn>
              <Btn
                variant="ghost"
                disabled={testing || (!apiKey.trim() && provider !== "custom")}
                onClick={testConnection}
              >
                <Zap className="h-4 w-4 text-amber-500" />
                <span>{testing ? "جارٍ الاختبار…" : "اختبار الاتصال بالموديل"}</span>
              </Btn>
            </div>
          )}

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                testResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
