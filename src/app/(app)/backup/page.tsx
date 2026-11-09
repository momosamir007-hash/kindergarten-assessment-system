"use client";

import { useState } from "react";
import {
  HardDriveDownload,
  UploadCloud,
  FileJson,
  History,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Btn, Card, Empty, PageTitle, useApiData, useApp, useToast } from "@/components/ui";
import { api, fetchFile, saveBlob } from "@/lib/client";

type Log = {
  id: string;
  kind: string;
  filename: string;
  count: number;
  sizeBytes: number;
  createdAt: string;
};

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
      toast(`تم إنشاء وتنزيل النسخة الاحتياطية: ${f.filename}`);
      logs.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل إنشاء النسخة", "err");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    if (
      !confirm(
        "⚠ تنبيه هام:\nستُستبدل بيانات الأطفال والتقييمات والأقسام الحالية بمحتوى النسخة المختارة.\nهل ترغب في المتابعة؟"
      )
    )
      return;

    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const r = await api<{ students: number; evaluations: number }>("/api/backup", { json });
      toast(`تمت استعادة البيانات بنجاح: ${r.students} تلميذ و${r.evaluations} تقييم`);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ملف النسخة الاحتياطية غير صالح", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle sub="نسخة احتياطية شاملة بصيغة JSON آمنة (مشفرة وبدون كلمات مرور) تضمن الحفاظ على البيانات وسهولة استعادتها">
        إدارة النسخ الاحتياطية واستعادة البيانات
      </PageTitle>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="إنشاء وتصدير نسخة احتياطية">
          <div className="space-y-4">
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              تتضمن النسخة: بيانات الأطفال، الصور الشخصية، الأفواج، سجل التقييمات التراكمي، المناهج والمهارات، الفترات الدراسية، وإعدادات المؤسسة.
            </p>

            <Btn disabled={busy} onClick={create} className="font-bold text-xs md:text-sm">
              <Download size={16} />
              <span>{busy ? "جارٍ التوليد والتنزيل..." : "تنزيل نسخة احتياطية فورية"}</span>
            </Btn>
          </div>
        </Card>

        <Card title="استعادة نسخة احتياطية">
          {user.role === "admin" ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  يُرجى إنشاء نسخة حديثة أولاً قبل استعادة أي ملف قديم لتفادي فقدان أي تقييمات حديثة.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اختر ملف النسخة الاحتياطية (.json):
                </label>
                <input
                  type="file"
                  accept=".json"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) restore(f);
                    e.target.value = "";
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#0f4c81] hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <Empty>خاصية استعادة البيانات الاحتياطية متاحة لمدير المؤسسة فقط.</Empty>
          )}
        </Card>
      </div>

      <Card title="سجل النسخ الاحتياطية">
        {!logs.data?.filter((l) => l.kind === "backup").length ? (
          <Empty>لا توجد عمليات نسخ احتياطي مسجلة في هذا الجهاز بعد.</Empty>
        ) : (
          <ul className="space-y-2 text-xs divide-y divide-slate-100">
            {logs.data
              .filter((l) => l.kind === "backup")
              .map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <FileJson size={16} className="text-[#0f4c81]" />
                    <span>{l.filename}</span>
                  </div>
                  <div className="text-slate-400 font-medium">
                    {new Date(l.createdAt).toLocaleString("ar-DZ-u-nu-latn")} • {l.count} تلميذ •{" "}
                    {(l.sizeBytes / 1024).toFixed(0)} ك.ب
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
