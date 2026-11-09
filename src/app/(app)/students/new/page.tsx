"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Btn, Card, Field, PageTitle, inputCls, useApp, useToast } from "@/components/ui";
import { PhotoUpload } from "@/components/photo-upload";
import { api } from "@/lib/client";

export default function NewStudent() {
  const router = useRouter();
  const toast = useToast();
  const { classes, classId, reload } = useApp();
  const [f, setF] = useState({
    fullName: "",
    birthDate: "",
    gender: "",
    nationalId: "",
    classId: classId || "",
    notes: "",
    photo: "" as string | null,
  });
  const [extras, setExtras] = useState<{ k: string; v: string }[]>([]);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (force = false) => {
    setBusy(true);
    setErr("");
    try {
      const extra = Object.fromEntries(
        extras.filter((x) => x.k.trim()).map((x) => [x.k.trim(), x.v])
      );
      const r = await api<{ id: string }>("/api/students", {
        json: { ...f, extra, force },
      });
      toast("تم تسجيل التلميذ بنجاح");
      await reload();
      router.push(`/students/${r.id}`);
    } catch (e) {
      const x = e as Error & { status?: number };
      if (x.status === 409) setDup(x.message);
      else setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setF({ ...f, [k]: e.target.value });
      setDup(null);
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="تسجيل طفل جديد في السجل الرقمي وتخصيص الفوج والصورة الشخصية">
          إضافة تلميذ جديد
        </PageTitle>
        <Link href="/students">
          <Btn variant="outline" className="text-xs">
            <ArrowLeft size={14} />
            <span>العودة لقائمة الأطفال</span>
          </Btn>
        </Link>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          className="space-y-6"
        >
          {/* Photo Section */}
          <div className="rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 md:p-5">
            <label className="block text-xs md:text-sm font-bold text-slate-700 mb-3">
              الصورة الشخصية للطفل(ة)
            </label>
            <PhotoUpload
              value={f.photo}
              onChange={(photo) => setF({ ...f, photo })}
              disabled={busy}
            />
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم واللقب الكامل *">
              <input
                className={inputCls}
                placeholder="مثال: أحمد بن علي"
                value={f.fullName}
                onChange={set("fullName")}
                required
              />
            </Field>

            <Field label="رقم التعريف المدرسي أو الوطني" hint="يُستعمل لمنع تكرار التلاميذ">
              <input
                className={inputCls}
                dir="ltr"
                placeholder="Matricule / ID"
                value={f.nationalId}
                onChange={set("nationalId")}
              />
            </Field>

            <Field label="تاريخ الميلاد">
              <input
                type="date"
                className={inputCls}
                value={f.birthDate}
                onChange={set("birthDate")}
              />
            </Field>

            <Field label="الجنس">
              <select className={inputCls} value={f.gender} onChange={set("gender")}>
                <option value="">— تحديد الجنس —</option>
                <option value="M">ذكر</option>
                <option value="F">أنثى</option>
              </select>
            </Field>

            <Field label="الفوج / القسم التربوي">
              <select className={inputCls} value={f.classId} onChange={set("classId")}>
                <option value="">— بدون قسم حالياً —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.level ? `(${c.level})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ملاحظات صحية أو تربوية أولية">
              <input
                className={inputCls}
                placeholder="حساسية، تفضيلات، سلوكيات أولية..."
                value={f.notes}
                onChange={set("notes")}
              />
            </Field>
          </div>

          {/* Custom Extra Fields */}
          <div className="pt-2 border-t border-slate-100">
            <div className="mb-3 text-xs md:text-sm font-bold text-slate-700">
              بيانات إضافية مخصصة (اسم الولي، الهاتف، العنوان...)
            </div>
            {extras.map((x, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  className={`${inputCls} max-w-xs`}
                  placeholder="اسم الحقل (مثال: هاتف الولي)"
                  value={x.k}
                  onChange={(e) =>
                    setExtras(
                      extras.map((y, j) => (j === i ? { ...y, k: e.target.value } : y))
                    )
                  }
                />
                <input
                  className={inputCls}
                  placeholder="القيمة"
                  value={x.v}
                  onChange={(e) =>
                    setExtras(
                      extras.map((y, j) => (j === i ? { ...y, v: e.target.value } : y))
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                  className="px-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExtras([...extras, { k: "", v: "" }])}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0f4c81] hover:underline cursor-pointer pt-1"
            >
              <Plus size={14} />
              <span>إضافة حقل مخصص</span>
            </button>
          </div>

          {/* Duplicate Detection Alert */}
          {dup && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs md:text-sm text-amber-900 space-y-2">
              <div className="font-bold">⚠️ تنبيه: اشتباه في تكرار التلميذ</div>
              <p>{dup}</p>
              <div className="flex gap-2 pt-1">
                <Btn
                  type="button"
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => submit(true)}
                  disabled={busy}
                >
                  تأكيد الإضافة على أي حال
                </Btn>
                <Btn
                  type="button"
                  variant="outline"
                  onClick={() => setDup(null)}
                  disabled={busy}
                >
                  إلغاء
                </Btn>
              </div>
            </div>
          )}

          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs md:text-sm text-rose-800 font-semibold">
              {err}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/students">
              <Btn type="button" variant="ghost">
                إلغاء
              </Btn>
            </Link>
            <Btn type="submit" disabled={busy || !f.fullName.trim()} className="font-bold">
              <UserPlus size={16} />
              <span>{busy ? "جارٍ الحفظ..." : "حفظ بيانات الطفل"}</span>
            </Btn>
          </div>
        </form>
      </Card>
    </div>
  );
}
