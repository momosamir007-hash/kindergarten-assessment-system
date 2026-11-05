"use client";
import { useState } from "react";
import { AiBanner, ClassAiView } from "@/components/ai-view";
import { Btn, Card, ClassPeriodPicker, Empty, PageTitle, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import Link from "next/link";

type Ai = { id: string; source: string; provider: string; content: Record<string, unknown>; createdAt: string; error?: string };

export default function AiPage() {
  const { classId, periodId, settings } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Ai | null>(null);
  const old = useApiData<Ai[]>(classId ? `/api/ai?scope=class&targetId=${classId}` : null, [classId]);
  const run = async () => {
    setBusy(true);
    try {
      setRes(await api<Ai>("/api/ai", { json: { scope: "class", targetId: classId, periodId } }));
      old.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };
  const shown = res ?? old.data?.[0] ?? null;
  return (
    <>
      <PageTitle sub="تحليل القسم كاملًا. التحليل الفردي متاح من ملف كل تلميذ (تبويب «تحليل ذكي»)">التحليل الذكي</PageTitle>
      <div className="mb-3"><ClassPeriodPicker /></div>
      <Card title="تحليل القسم" actions={<Btn disabled={busy || !classId} onClick={run}>{busy ? "جارٍ التحليل…" : "🤖 تحليل القسم"}</Btn>}>
        {!settings?.aiConfigured && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            لم يُضبط مزوّد الذكاء الاصطناعي بعد. يعمل النظام حاليًا بالتحليل البيداغوجي المدمج. لتفعيل أي مزوّد تفضله (Gemini، OpenAI، Groq، DeepSeek...) واختيار أحدث الموديلات، توجه إلى{" "}
            <Link className="font-bold underline text-[#0f4c81]" href="/settings">
              الإعدادات ➔ تبويب الذكاء الاصطناعي والمزودون
            </Link>.
          </div>
        )}
        {shown ? (
          <>
            <AiBanner source={shown.source} provider={shown.provider} error={res?.error} />
            <ClassAiView c={shown.content} />
            <div className="mt-2 text-xs text-slate-400">تاريخ التحليل: {new Date(shown.createdAt).toLocaleString("ar-DZ-u-nu-latn")}</div>
          </>
        ) : <Empty>لم يُجرَ تحليل لهذا القسم بعد. تأكد من وجود تقييمات في الفترة المحددة، ثم اضغط «تحليل القسم».</Empty>}
      </Card>
      <p className="mt-3 text-xs text-slate-500">للتحليل الفردي: <Link className="underline" href="/students">افتح ملف التلميذ</Link>.</p>
    </>
  );
}
