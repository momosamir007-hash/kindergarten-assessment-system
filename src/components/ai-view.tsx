"use client";
import type { ReactNode } from "react";
import { Badge } from "./ui";

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-sm font-bold text-slate-800">{title}</div>
      <ul className="list-disc space-y-1 pr-5 text-sm text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export function AiBanner({ source, provider, error }: { source: string; provider: string; error?: string }) {
  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
      <Badge color="#7c3aed">{source === "ai" ? "اقتراحات الذكاء الاصطناعي" : "اقتراحات آلية بقواعد تربوية"}</Badge>{" "}
      <span>مصدر البيانات: نتائج مسجلة فعليًا. هذه الاقتراحات مساعدة للمعلم وليست تقييمًا نهائيًا. {source === "ai" ? `(المزوّد: ${provider}) — لم تُرسَل أسماء ولا بيانات شخصية.` : "لم يُضبط مزوّد ذكاء اصطناعي في الخادم (AI_API_KEY)، لذا استُعملت القواعد المحلية."}</span>
      {error && <div className="mt-1 text-red-700">تعذر الاتصال بالمزوّد ({error}) فتم استعمال القواعد المحلية.</div>}
    </div>
  );
}

type Content = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export function StudentAiView({ c }: { c: Content }): ReactNode {
  return (
    <div>
      <List title="🌟 أبرز خطوات القوة والاكتساب" items={arr(c.strengths)} />
      <List title="🌱 مهارات نرافقها برفق ومحبة" items={arr(c.support)} />
      {typeof c.progressComparison === "string" && c.progressComparison && (
        <div className="mb-3 text-sm">
          <b>مسار التطور النمائي: </b>{c.progressComparison}
        </div>
      )}
      <List title="🎲 أفكار وألعاب منزلية ممتعة وداعمة" items={arr(c.remedialActivities)} />
      <List title="🎯 أهداف تحفيزية قريبة" items={arr(c.shortTermGoals)} />
      <List title="💡 توجيهات عملية للمربية" items={arr(c.teacherRecommendations)} />
      {typeof c.parentSummary === "string" && c.parentSummary && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs md:text-sm leading-relaxed text-slate-800">
          <b className="text-[#0f4c81] block mb-1">💌 رسالة المربية للأسرة: </b>
          {c.parentSummary}
        </div>
      )}
    </div>
  );
}

export function ClassAiView({ c }: { c: Content }): ReactNode {
  const groups = (Array.isArray(c.supportGroups) ? c.supportGroups : []) as { label: string; students: string[] }[];
  return (
    <div>
      {typeof c.summary === "string" && c.summary && <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">{c.summary}</div>}
      <List title="صعوبات مشتركة" items={arr(c.commonDifficulties)} />
      <List title="نقاط قوة القسم" items={arr(c.strengths)} />
      <List title="أنشطة معالجة جماعية" items={arr(c.collectiveActivities)} />
      {groups.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-sm font-bold">مجموعات مقترحة</div>
          {groups.map((g, i) => <div key={i} className="mb-1 text-sm"><Badge color="#0f4c81">{g.label}</Badge> {g.students.join("، ")}</div>)}
        </div>
      )}
      <List title="أنشطة إثرائية" items={arr(c.enrichment)} />
    </div>
  );
}
