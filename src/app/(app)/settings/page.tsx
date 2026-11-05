"use client";
import { useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, Field, PageTitle, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { AI_PROVIDERS, type AiModelInfo } from "@/lib/ai-providers";
import type { AiConfig, AiProviderId, Level } from "@/lib/levels";

const TABS = [["classes", "الأقسام"], ["inst", "المؤسسة"], ["ai", "الذكاء الاصطناعي والمزودون 🤖"], ["levels", "مستويات التقييم"], ["curr", "المواد والمهارات"], ["periods", "الفترات"], ["users", "المستخدمون"], ["audit", "سجل العمليات"]] as const;

export default function Settings() {
  const { user } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("classes");
  const admin = user.role === "admin";
  return (
    <>
      <PageTitle>الإعدادات</PageTitle>
      {!admin && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">بعض الإعدادات متاحة للمدير فقط.</div>}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? "bg-[#0f4c81] text-white" : "text-slate-600"}`}>{l}</button>)}
      </div>
      {tab === "inst" && <Inst admin={admin} />}
      {tab === "ai" && <AiSettingsTab admin={admin} />}
      {tab === "levels" && <Levels admin={admin} />}
      {tab === "classes" && <Classes admin={admin} />}
      {tab === "curr" && <Curriculum admin={admin} />}
      {tab === "periods" && <Periods admin={admin} />}
      {tab === "users" && (admin ? <Users /> : <Empty>للمدير فقط.</Empty>)}
      {tab === "audit" && (admin ? <Audit /> : <Empty>للمدير فقط.</Empty>)}
    </>
  );
}

function Inst({ admin }: { admin: boolean }) {
  const { settings, reload } = useApp();
  const toast = useToast();
  const [f, setF] = useState({ name: "", academicYear: "", city: "", logo: "" as string | null, signature: "" });
  useEffect(() => { if (settings) setF({ name: settings.name, academicYear: settings.academicYear, city: settings.city, logo: settings.logo, signature: settings.settings.teacherSignatureLabel ?? "" }); }, [settings]);
  const save = async () => {
    try { await api("/api/settings", { method: "PUT", json: { name: f.name, academicYear: f.academicYear, city: f.city, logo: f.logo, settings: { teacherSignatureLabel: f.signature } } }); toast("تم الحفظ"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); }
  };
  const onLogo = (file: File) => { const r = new FileReader(); r.onload = () => setF({ ...f, logo: String(r.result) }); r.readAsDataURL(file); };
  return (
    <Card title="بيانات المؤسسة (تظهر في التقارير)">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم المؤسسة"><input className={inputCls} disabled={!admin} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="السنة الدراسية"><input className={inputCls} disabled={!admin} value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} /></Field>
        <Field label="المدينة"><input className={inputCls} disabled={!admin} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="عنوان خانة التوقيع"><input className={inputCls} disabled={!admin} placeholder="توقيع المعلم" value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} /></Field>
        <Field label="الشعار (PNG أو JPG، أقل من 1 ميغابايت)">
          <input type="file" accept="image/png,image/jpeg" disabled={!admin} onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
        </Field>
        {f.logo && <div className="flex items-center gap-2"><img src={f.logo} alt="الشعار" className="h-16 rounded border" /><Btn variant="ghost" onClick={() => setF({ ...f, logo: null })}>إزالة</Btn></div>}
      </div>
      {admin && <Btn className="mt-3" onClick={save}>حفظ</Btn>}
    </Card>
  );
}

function Levels({ admin }: { admin: boolean }) {
  const { settings, reload } = useApp();
  const toast = useToast();
  const [lv, setLv] = useState<Level[]>([]);
  const [th, setTh] = useState({ s: 80, p: 50 });
  useEffect(() => { if (settings) { setLv(settings.settings.levels); setTh({ s: settings.settings.strengthThreshold, p: settings.settings.supportThreshold }); } }, [settings]);
  const upd = (i: number, k: keyof Level, v: string | number) => setLv(lv.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const save = async () => {
    try { await api("/api/settings", { method: "PUT", json: { settings: { levels: lv, strengthThreshold: th.s, supportThreshold: th.p } } }); toast("تم حفظ المستويات"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); }
  };
  return (
    <Card title="مستويات التقييم والقيم الحسابية">
      <p className="mb-3 text-xs text-slate-500">القيمة الحسابية تُستعمل في حساب النسب (النسبة = القيمة ÷ أعلى قيمة). التقييمات القديمة تحتفظ بقيمتها وقت التسجيل.</p>
      <div className="space-y-2">
        {lv.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} max-w-52`} disabled={!admin} value={l.label} onChange={(e) => upd(i, "label", e.target.value)} />
            <input className={`${inputCls} w-24`} dir="ltr" type="number" step="0.5" disabled={!admin} value={l.value} onChange={(e) => upd(i, "value", Number(e.target.value))} />
            <input type="color" disabled={!admin} value={l.color} onChange={(e) => upd(i, "color", e.target.value)} className="h-9 w-12" />
            <Badge color={l.color}>{l.key}</Badge>
            {admin && lv.length > 2 && <Btn variant="ghost" onClick={() => setLv(lv.filter((_, j) => j !== i))}>حذف</Btn>}
          </div>
        ))}
      </div>
      {admin && <Btn variant="ghost" className="mt-2" onClick={() => setLv([...lv, { key: `lvl_${Date.now().toString(36)}`, label: "مستوى جديد", value: Math.max(...lv.map((l) => l.value)) + 1, color: "#0f4c81" }])}>+ مستوى</Btn>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="عتبة نقاط القوة (نسبة % فأكثر)"><input className={inputCls} type="number" disabled={!admin} value={th.s} onChange={(e) => setTh({ ...th, s: Number(e.target.value) })} /></Field>
        <Field label="عتبة الحاجة إلى دعم (أقل من %)"><input className={inputCls} type="number" disabled={!admin} value={th.p} onChange={(e) => setTh({ ...th, p: Number(e.target.value) })} /></Field>
      </div>
      {admin && <Btn className="mt-3" onClick={save}>حفظ</Btn>}
    </Card>
  );
}

function Classes({ admin }: { admin: boolean }) {
  const { classes, reload } = useApp();
  const toast = useToast();
  const [n, setN] = useState({ name: "", level: "" });
  const add = async () => { try { await api("/api/classes", { json: n }); setN({ name: "", level: "" }); toast("تم إنشاء القسم"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } };
  return (
    <Card title="الأقسام">
      <div className="mb-3 flex flex-wrap gap-2"><input className={`${inputCls} max-w-52`} placeholder="اسم القسم" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /><input className={`${inputCls} max-w-44`} placeholder="المستوى" value={n.level} onChange={(e) => setN({ ...n, level: e.target.value })} /><Btn onClick={add} disabled={!n.name.trim()}>+ إضافة قسم</Btn></div>
      {!classes.length && <Empty>لا توجد أقسام.</Empty>}
      <ul className="space-y-1 text-sm">{classes.map((c) => <li key={c.id} className="flex items-center justify-between border-b py-2"><span><b>{c.name}</b> {c.level && <span className="text-slate-500">— {c.level}</span>} <Badge>{c.studentCount} تلميذ</Badge></span>{admin && <button className="text-xs text-red-600" onClick={async () => { if (confirm("حذف القسم؟ (يبقى تلاميذه بدون قسم)")) { await api(`/api/classes?id=${c.id}`, { method: "DELETE" }); reload(); } }}>حذف</button>}</li>)}</ul>
    </Card>
  );
}

type Subject = { id: string; name: string; kind: string; skills: { id: string; name: string }[] };
function Curriculum({ admin }: { admin: boolean }) {
  const { data, reload } = useApiData<Subject[]>("/api/curriculum");
  const toast = useToast();
  const [sub, setSub] = useState({ name: "", kind: "academic" });
  const [skill, setSkill] = useState<Record<string, string>>({});
  const call = async (fn: () => Promise<unknown>) => { try { await fn(); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } };
  return (
    <Card title="المواد والمهارات (أكاديمية وسلوكية)">
      {admin && <div className="mb-3 flex flex-wrap gap-2"><input className={`${inputCls} max-w-52`} placeholder="مادة أو مجال جديد" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /><select className={`${inputCls} w-auto`} value={sub.kind} onChange={(e) => setSub({ ...sub, kind: e.target.value })}><option value="academic">أكاديمي</option><option value="behavioral">سلوكي</option></select><Btn disabled={!sub.name.trim()} onClick={() => call(async () => { await api("/api/curriculum", { json: { type: "subject", ...sub } }); setSub({ ...sub, name: "" }); })}>+ إضافة</Btn></div>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((s) => (
          <div key={s.id} className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between"><b className="text-sm">{s.name} <Badge color={s.kind === "behavioral" ? "#7c3aed" : "#0f4c81"}>{s.kind === "behavioral" ? "سلوكي" : "أكاديمي"}</Badge></b>{admin && <button className="text-xs text-red-600" onClick={() => confirm("حذف المادة وكل مهاراتها وتقييماتها؟") && call(() => api(`/api/curriculum?type=subject&id=${s.id}`, { method: "DELETE" }))}>حذف</button>}</div>
            <ul className="mb-2 space-y-1 text-sm">{s.skills.map((k) => <li key={k.id} className="flex justify-between"><span>• {k.name}</span>{admin && <button className="text-xs text-red-500" onClick={() => confirm("حذف المهارة وتقييماتها؟") && call(() => api(`/api/curriculum?type=skill&id=${k.id}`, { method: "DELETE" }))}>✕</button>}</li>)}</ul>
            {admin && <div className="flex gap-1"><input className={`${inputCls} py-1 text-xs`} placeholder="مهارة جديدة" value={skill[s.id] ?? ""} onChange={(e) => setSkill({ ...skill, [s.id]: e.target.value })} /><Btn variant="ghost" disabled={!(skill[s.id] ?? "").trim()} onClick={() => call(async () => { await api("/api/curriculum", { json: { type: "skill", subjectId: s.id, name: skill[s.id] } }); setSkill({ ...skill, [s.id]: "" }); })}>+</Btn></div>}
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
  const call = async (fn: () => Promise<unknown>) => { try { await fn(); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } };
  return (
    <Card title="الفترات الدراسية">
      {admin && <div className="mb-3 flex gap-2"><input className={`${inputCls} max-w-60`} placeholder="اسم الفترة" value={name} onChange={(e) => setName(e.target.value)} /><Btn disabled={!name.trim()} onClick={() => call(async () => { await api("/api/periods", { json: { name } }); setName(""); })}>+ إضافة</Btn></div>}
      <ul className="space-y-1 text-sm">{periods.map((p) => <li key={p.id} className="flex items-center justify-between border-b py-2"><span>{p.name} {p.isCurrent && <Badge color="#16a34a">الحالية</Badge>}</span>{admin && <span className="flex gap-3 text-xs">{!p.isCurrent && <button className="text-[#0f4c81]" onClick={() => call(() => api("/api/periods", { method: "PATCH", json: { id: p.id, isCurrent: true } }))}>تعيين كحالية</button>}<button className="text-red-600" onClick={() => confirm("حذف الفترة؟ (تبقى التقييمات بدون فترة)") && call(() => api(`/api/periods?id=${p.id}`, { method: "DELETE" }))}>حذف</button></span>}</li>)}</ul>
    </Card>
  );
}

function Users() {
  const { data, reload } = useApiData<{ id: string; username: string; fullName: string; role: string; active: boolean }[]>("/api/users");
  const toast = useToast();
  const [n, setN] = useState({ fullName: "", username: "", password: "", role: "teacher" });
  const add = async () => { try { await api("/api/users", { json: n }); setN({ fullName: "", username: "", password: "", role: "teacher" }); toast("تم إنشاء المستخدم"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } };
  return (
    <Card title="المستخدمون والصلاحيات">
      <div className="mb-3 grid gap-2 sm:grid-cols-5"><input className={inputCls} placeholder="الاسم الكامل" value={n.fullName} onChange={(e) => setN({ ...n, fullName: e.target.value })} /><input className={inputCls} dir="ltr" placeholder="username" value={n.username} onChange={(e) => setN({ ...n, username: e.target.value })} /><input className={inputCls} dir="ltr" type="password" placeholder="كلمة المرور" value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} /><select className={inputCls} value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}><option value="teacher">معلم</option><option value="admin">مدير</option></select><Btn onClick={add}>+ إضافة</Btn></div>
      <ul className="space-y-1 text-sm">{data?.map((u) => <li key={u.id} className="flex items-center justify-between border-b py-2"><span>{u.fullName} <span className="text-xs text-slate-400" dir="ltr">@{u.username}</span> <Badge>{u.role === "admin" ? "مدير" : "معلم"}</Badge> {!u.active && <Badge color="#dc2626">معطّل</Badge>}</span><span className="flex gap-3 text-xs"><button className="text-[#0f4c81]" onClick={async () => { await api("/api/users", { method: "PATCH", json: { id: u.id, active: !u.active } }); reload(); }}>{u.active ? "تعطيل" : "تفعيل"}</button><button className="text-[#0f4c81]" onClick={async () => { const p = prompt("كلمة المرور الجديدة (6 أحرف على الأقل)"); if (p) { try { await api("/api/users", { method: "PATCH", json: { id: u.id, password: p } }); toast("تم تغيير كلمة المرور"); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } } }}>كلمة مرور</button></span></li>)}</ul>
    </Card>
  );
}

function Audit() {
  const { data } = useApiData<{ id: string; action: string; entity: string; user: string | null; createdAt: string }[]>("/api/exports?audit=1");
  return (
    <Card title="سجل العمليات المهمة">
      {!data?.length ? <Empty>لا توجد عمليات.</Empty> : <div className="max-h-[60vh] overflow-auto"><table className="w-full text-xs"><thead><tr className="text-right text-slate-500"><th className="p-1">التاريخ</th><th>المستخدم</th><th>العملية</th><th>الكيان</th></tr></thead><tbody>{data.map((a) => <tr key={a.id} className="border-t"><td className="p-1">{new Date(a.createdAt).toLocaleString("ar-DZ-u-nu-latn")}</td><td>{a.user ?? "—"}</td><td dir="ltr" className="text-right">{a.action}</td><td dir="ltr" className="text-right">{a.entity}</td></tr>)}</tbody></table></div>}
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

  // Change provider handler
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

  // Fetch live models in real-time
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
        // If current model isn't in the list, set to the first or default
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

  // Test connection & model
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

  // Save settings
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
          يدعم النظام الاتصال بأحدث مزودي الذكاء الاصطناعي العالميين والمحليين مع ميزة <b>جلب الموديلات الحية والمتاحة في الوقت الفعلي</b> مباشرة من المزود دون تقييدك بموديلات ثابتة أو قديمة.
        </p>

        {/* Provider Cards */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold text-slate-700">اختر مزود الذكاء الاصطناعي:</label>
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
                    className="text-[11px] text-[#0f4c81] underline"
                  >
                    الحصول على مفتاح مجاني ↗
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

          {/* Base URL (for custom or proxy) */}
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
                  {fetchingModels ? "جارٍ جلب الموديلات الحية…" : "🔄 جلب الموديلات المتاحة في الوقت الفعلي"}
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

          {/* Test & Save Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {admin && (
              <>
                <Btn onClick={save}>حفظ إعدادات الذكاء الاصطناعي</Btn>
                <Btn
                  variant="ghost"
                  disabled={testing || (!apiKey.trim() && provider !== "custom")}
                  onClick={testConnection}
                >
                  {testing ? "جارٍ الاختبار…" : "⚡ اختبار الاتصال بالموديل"}
                </Btn>
              </>
            )}
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold ${
                testResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              }`}
            >
              {testResult.ok ? "✓ " : "✕ "}
              {testResult.msg}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
