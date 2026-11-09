"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Bot, Lightbulb } from "lucide-react";
import { AiBanner, ClassAiView } from "@/components/ai-view";
import {
  Btn,
  Card,
  ClassPeriodPicker,
  Empty,
  PageTitle,
  useApiData,
  useApp,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/client";
import Link from "next/link";

type Ai = {
  id: string;
  source: string;
  provider: string;
  content: Record<string, unknown>;
  createdAt: string;
  error?: string;
};

export default function AiPage() {
  const { classId, periodId, settings } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Ai | null>(null);
  const old = useApiData<Ai[]>(classId ? `/api/ai?scope=class&targetId=${classId}` : null, [classId]);

  const run = async () => {
    setBusy(true);
    try {
      setRes(
        await api<Ai>("/api/ai", { json: { scope: "class", targetId: classId, periodId } })
      );
      old.reload();
      toast("تم إجراء التحليل التربوي للقسم بنجاح");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل إجراء التحليل", "err");
    } finally {
      setBusy(false);
    }
  };

  const shown = res ?? old.data?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="تحليل شامل لمستوى الفوج، الصعوبات المشتركة، واقتراح مجموعات الدعم وأنشطة المعالجة">
          التحليل والتوجيه التربوي الذكي
        </PageTitle>
        <ClassPeriodPicker />
      </div>

      <Card
        title="تقرير التحليل التربوي للفوج"
        actions={
          <Btn disabled={busy || !classId} onClick={run} className="text-xs font-bold">
            <Sparkles size={15} />
            <span>{busy ? "جارٍ التحليل..." : "تحليل نتائج القسم"}</span>
          </Btn>
        }
      >
        {!settings?.aiConfigured && (
          <div className="mb-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 text-xs md:text-sm text-amber-900 flex items-start gap-3">
            <Lightbulb size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">نظام القواعد البيداغوجية المدمجة مفعّل (يعمل دون إنترنت)</span>
              <p className="text-xs text-amber-800">
                يمكنك أيضاً ربط مزوّد ذكاء اصطناعي تفضله (Gemini، OpenAI، Groq، DeepSeek...) في أي وقت عبر{" "}
                <Link className="font-bold underline text-[#0f4c81]" href="/settings">
                  الإعدادات ➔ تبويب الذكاء الاصطناعي والمزودون
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {shown ? (
          <div className="space-y-3">
            <AiBanner source={shown.source} provider={shown.provider} error={res?.error} />
            <ClassAiView c={shown.content} />
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              تاريخ التحليل: {new Date(shown.createdAt).toLocaleString("ar-DZ-u-nu-latn")}
            </div>
          </div>
        ) : (
          <Empty>
            لم يُجرَ تحليل لهذا القسم بعد. اختر فترة دراسية تضم تقييمات مسجلة، ثم اضغط «تحليل نتائج القسم».
          </Empty>
        )}
      </Card>

      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span>للتحليل الفردي لكل طفل:</span>
        <Link className="text-[#0f4c81] font-bold hover:underline inline-flex items-center gap-1" href="/students">
          <span>افتح بطاقة التلميذ</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
