"use client";
import { useState } from "react";
import { Btn, Card, Empty, PageTitle, useApiData, useApp, useToast } from "@/components/ui";
import { api, fetchFile, saveBlob } from "@/lib/client";

type Log = { id: string; kind: string; filename: string; count: number; sizeBytes: number; createdAt: string };

export default function Backup() {
  const toast = useToast();
  const { user, reload } = useApp();
  const logs = useApiData<Log[]>("/api/exports");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const f = await fetchFile("/api/backup");
      saveBlob(f);
      toast(`تم إنشاء النسخة الاحتياطية: ${f.filename}`);
      logs.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (file: File) => {
    if (!confirm("⚠ ستُستبدل بيانات التلاميذ والتقييمات والأقسام والمواد والفترات الحالية بمحتوى النسخة. يُنصح بإنشاء نسخة احتياطية قبل المتابعة. هل تريد المتابعة؟")) return;
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const r = await api<{ students: number; evaluations: number }>("/api/backup", { json });
      toast(`تمت الاستعادة: ${r.students} تلميذ و${r.evaluations} تقييم`);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ملف غير صالح", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle sub="نسخة كاملة بصيغة JSON (دون كلمات المرور) يمكن حفظها خارج الجهاز واستعادتها عند الحاجة">إدارة النسخ الاحتياطية</PageTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="إنشاء نسخة احتياطية"><p className="mb-3 text-sm text-slate-600">تشمل: التلاميذ، الأقسام، التقييمات وتاريخها، المواد والمهارات، الفترات، الإعدادات، التحليلات المحفوظة.</p><Btn disabled={busy} onClick={create}>💾 إنشاء وتنزيل نسخة</Btn></Card>
        <Card title="استعادة نسخة">
          {user.role === "admin" ? (
            <>
              <p className="mb-3 text-sm text-slate-600">اختر ملف نسخة احتياطية سبق تنزيله. تُستبدل البيانات الحالية بمحتواه.</p>
              <input type="file" accept=".json" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} className="w-full text-sm" />
            </>
          ) : <Empty>الاستعادة متاحة للمدير فقط.</Empty>}
        </Card>
      </div>
      <Card title="سجل النسخ" className="mt-4">
        {!logs.data?.filter((l) => l.kind === "backup").length ? <Empty>لا توجد نسخ سابقة.</Empty> : (
          <ul className="space-y-1 text-sm">{logs.data.filter((l) => l.kind === "backup").map((l) => <li key={l.id} className="flex justify-between border-b py-1"><span>{l.filename}</span><span className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleString("ar-DZ-u-nu-latn")} — {l.count} تلميذ — {(l.sizeBytes / 1024).toFixed(0)} ك.ب</span></li>)}</ul>
        )}
      </Card>
    </>
  );
}
