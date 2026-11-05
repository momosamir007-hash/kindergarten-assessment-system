"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Btn, Empty, Spinner, inputCls, useApiData, useApp, useToast } from "./ui";

type Subject = { id: string; name: string; kind: string; skills: { id: string; name: string }[] };
type Cur = { skillId: string; levelKey: string; note: string; evaluatedAt: string; teacher: string | null };
type Hist = { id: string; skillId: string; levelKey: string; note: string; evaluatedAt: string; teacher: string | null };

export function EvalForm({ studentId, kind }: { studentId: string; kind: "academic" | "behavioral" }) {
  const { periodId, settings } = useApp();
  const toast = useToast();
  const levels = settings?.settings.levels ?? [];
  const cur = useApiData<Subject[]>("/api/curriculum");
  const ev = useApiData<{ current: Cur[]; history: Hist[] }>(periodId ? `/api/evaluations?studentId=${studentId}&periodId=${periodId}` : null, [studentId]);
  const [draft, setDraft] = useState<Record<string, { levelKey: string; note: string }>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => setDraft({}), [periodId, studentId]);
  const current = useMemo(() => new Map((ev.data?.current ?? []).map((c) => [c.skillId, c])), [ev.data]);
  const subjects = (cur.data ?? []).filter((s) => s.kind === kind && s.skills.length);

  if (!periodId) return <Empty>اختر فترة دراسية محددة (من أعلى الصفحة أو من لوحة التحكم) لتسجيل تقييم جديد.</Empty>;
  if (cur.loading || ev.loading) return <Spinner />;

  const dirty = Object.entries(draft);
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/evaluations", { json: { periodId, items: dirty.map(([skillId, d]) => ({ studentId, skillId, levelKey: d.levelKey, note: d.note })) } });
      toast(`تم حفظ ${dirty.length} تقييم (التقييمات القديمة محفوظة في السجل)`);
      setDraft({});
      ev.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل الحفظ", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!subjects.length && <Empty>لا توجد مواد/مهارات في هذا النوع. أضفها من الإعدادات.</Empty>}
      {subjects.map((s) => (
        <div key={s.id} className="rounded-xl border border-slate-200">
          <div className="rounded-t-xl bg-slate-50 px-3 py-2 text-sm font-bold">{s.name}</div>
          {s.skills.map((sk) => {
            const c = current.get(sk.id);
            const d = draft[sk.id];
            const levelKey = d?.levelKey ?? c?.levelKey ?? "";
            const hist = (ev.data?.history ?? []).filter((h) => h.skillId === sk.id);
            return (
              <div key={sk.id} className="border-t px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{sk.name}</span>
                  {hist.length > 0 && <button className="text-xs text-[#0f4c81] underline" onClick={() => setOpen(open === sk.id ? null : sk.id)}>السجل ({hist.length})</button>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {levels.map((l) => (
                    <button key={l.key} type="button" onClick={() => setDraft({ ...draft, [sk.id]: { levelKey: l.key, note: d?.note ?? "" } })}
                      className="rounded-full border-2 px-3 py-1 text-xs font-bold transition"
                      style={levelKey === l.key ? { background: l.color, borderColor: l.color, color: "#fff" } : { borderColor: `${l.color}66`, color: l.color }}>
                      {l.label}
                    </button>
                  ))}
                  <input className={`${inputCls} min-w-40 flex-1 py-1 text-xs`} placeholder="ملاحظة المربية/المعلم (شواهد الملاحظة الحية)" value={d?.note ?? ""} onChange={(e) => levelKey && setDraft({ ...draft, [sk.id]: { levelKey, note: e.target.value } })} disabled={!levelKey} />
                </div>
                {open === sk.id && (
                  <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs">
                    {hist.map((h) => (
                      <li key={h.id}>{new Date(h.evaluatedAt).toLocaleDateString("ar-DZ-u-nu-latn")} — <b style={{ color: levels.find((l) => l.key === h.levelKey)?.color }}>{levels.find((l) => l.key === h.levelKey)?.label ?? h.levelKey}</b>{h.teacher ? ` — ${h.teacher}` : ""}{h.note ? ` — ${h.note}` : ""}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="sticky bottom-16 flex items-center gap-3 rounded-xl bg-white/95 p-2 shadow md:bottom-2">
        <Btn disabled={!dirty.length || busy} onClick={save}>{busy ? "…" : `💾 حفظ الملاحظات النمائية (${dirty.length})`}</Btn>
        {dirty.length > 0 && <Btn variant="ghost" onClick={() => setDraft({})}>تراجع</Btn>}
      </div>
    </div>
  );
}
