"use client";

import Link from "next/link";
import { useState } from "react";
import {
  UserPlus,
  UploadCloud,
  Search,
  Trash2,
  ExternalLink,
  Users,
  Filter,
} from "lucide-react";
import {
  Badge,
  Btn,
  Card,
  Empty,
  PageTitle,
  Spinner,
  inputCls,
  useApiData,
  useApp,
  useToast,
} from "@/components/ui";
import { StudentAvatar } from "@/components/photo-upload";
import { GENDER_LABEL, api } from "@/lib/client";

type S = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  nationalId: string | null;
  classId: string | null;
  className: string | null;
  photo?: string | null;
};

export default function Students() {
  const { classes, reload } = useApp();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const url = `/api/students?q=${encodeURIComponent(q)}${cls ? `&classId=${cls}` : ""}`;
  const { data, loading, reload: rl } = useApiData<S[]>(url);

  const remove = async (s: S) => {
    if (!confirm(`هل أنت متأكد من حذف التلميذ «${s.fullName}» وكافة تقييماته نهائياً؟`)) return;
    try {
      await api(`/api/students/${s.id}`, { method: "DELETE" });
      toast("تم حذف سجل التلميذ بنجاح");
      rl();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل الحذف", "err");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="سجل الملاحظة والبيانات الفردية للأطفال مع إمكانية التعديل وإدارة الصور">
          سجل الأطفال
        </PageTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/students/new">
            <Btn className="font-bold text-xs md:text-sm">
              <UserPlus size={16} />
              <span>إضافة طفل(ة) جديد</span>
            </Btn>
          </Link>
          <Link href="/import">
            <Btn variant="outline" className="text-xs md:text-sm">
              <UploadCloud size={16} />
              <span>استيراد جماعي</span>
            </Btn>
          </Link>
        </div>
      </div>

      <Card>
        {/* Filters & Search */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className={`${inputCls} pr-10 text-xs md:text-sm`}
                placeholder="بحث بالاسم أو رقم التعريف..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter size={15} className="text-slate-400" />
              <select
                className={`${inputCls} w-auto text-xs md:text-sm font-semibold`}
                value={cls}
                onChange={(e) => setCls(e.target.value)}
              >
                <option value="">جميع الأفواج / الأقسام</option>
                <option value="none">بدون فوج</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
            {data ? `${data.length} طفل(ة)` : "..."}
          </div>
        </div>

        {loading && !data && <Spinner label="جارٍ تحميل سجل الأطفال..." />}

        {data && data.length === 0 && (
          <Empty>
            لا يوجد أطفال مسجلون مطابقون لخيارات البحث. يمكنك إضافة طفل جديد عبر الزر أعلاه.
          </Empty>
        )}

        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                  <th className="pb-3 pr-2">الطفل(ة)</th>
                  <th className="pb-3 px-3">الفوج / القسم</th>
                  <th className="hidden pb-3 px-3 sm:table-cell">الميلاد</th>
                  <th className="hidden pb-3 px-3 sm:table-cell">الجنس</th>
                  <th className="hidden pb-3 px-3 md:table-cell">رقم التعريف</th>
                  <th className="pb-3 pl-2 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((s) => (
                  <tr
                    key={s.id}
                    className="group hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    <td className="py-3 pr-2">
                      <Link
                        href={`/students/${s.id}`}
                        className="flex items-center gap-3 font-bold text-slate-800 hover:text-[#0f4c81]"
                      >
                        <StudentAvatar src={s.photo} alt={s.fullName} size="sm" />
                        <span className="group-hover:underline">{s.fullName}</span>
                      </Link>
                    </td>

                    <td className="py-3 px-3">
                      {s.className ? (
                        <Badge color="#0f4c81">{s.className}</Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="hidden py-3 px-3 sm:table-cell text-slate-600 font-mono text-xs">
                      {s.birthDate ?? "—"}
                    </td>

                    <td className="hidden py-3 px-3 sm:table-cell text-slate-600">
                      {s.gender ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            s.gender === "M"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {GENDER_LABEL[s.gender] ?? s.gender}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="hidden py-3 px-3 md:table-cell text-slate-500 font-mono text-xs">
                      {s.nationalId || "—"}
                    </td>

                    <td className="py-3 pl-2 text-left">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/students/${s.id}`}>
                          <button
                            className="p-1.5 text-slate-500 hover:text-[#0f4c81] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="عرض الملف والتقارير"
                          >
                            <ExternalLink size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => remove(s)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
