"use client";

import React from "react";
import { CheckCircle2, Clock, Eye } from "lucide-react";

export function EvalCircle({
  levelKey,
  size = 20,
  showLabel = false,
  className = "",
}: {
  levelKey: string;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  if (levelKey === "acquired") {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="shrink-0 transition-transform hover:scale-110"
        >
          <circle cx="12" cy="12" r="10" fill="#16a34a" />
        </svg>
        {showLabel && <span className="text-xs font-semibold text-emerald-800">مكتسب باستقلالية</span>}
      </div>
    );
  }

  if (levelKey === "in_progress") {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="shrink-0 transition-transform hover:scale-110"
        >
          <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#d97706" strokeWidth="2.4" />
          {/* Half-filled circle (right half filled in RTL context or right semicircle) */}
          <path d="M 12 2 A 10 10 0 0 1 12 22 Z" fill="#f59e0b" />
        </svg>
        {showLabel && <span className="text-xs font-semibold text-amber-800">في طور الاكتساب (بمساعدة)</span>}
      </div>
    );
  }

  // not_acquired or default
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="shrink-0 transition-transform hover:scale-110"
      >
        <circle cx="12" cy="12" r="9" fill="#ffffff" stroke="#94a3b8" strokeWidth="2.4" />
      </svg>
      {showLabel && <span className="text-xs font-semibold text-slate-600">في بداية الظهور / قيد الملاحظة</span>}
    </div>
  );
}

export function EvalLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 sm:gap-8 rounded-xl bg-slate-50/80 border border-slate-200/90 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <EvalCircle levelKey="acquired" size={16} />
        <span>مكتسب باستقلالية</span>
      </div>
      <div className="flex items-center gap-2">
        <EvalCircle levelKey="in_progress" size={16} />
        <span>في طور الاكتساب (بمساعدة)</span>
      </div>
      <div className="flex items-center gap-2">
        <EvalCircle levelKey="not_acquired" size={16} />
        <span>في بداية الظهور / قيد الملاحظة</span>
      </div>
    </div>
  );
}

export function EvalSummaryCards({
  acquired = 0,
  inProgress = 0,
  notAcquired = 0,
  className = "",
}: {
  acquired: number;
  inProgress: number;
  notAcquired: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      <div className="flex items-center justify-between rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-800">مكتسب باستقلالية</div>
            <div className="text-xs font-medium text-emerald-600">يوظف الكفاءة بثقة</div>
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-700">{acquired}</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-800">في طور الاكتساب</div>
            <div className="text-xs font-medium text-amber-600">بمساعدة وتوجيه</div>
          </div>
        </div>
        <div className="text-2xl font-black text-amber-700">{inProgress}</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-slate-50/90 border border-slate-200/90 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-400 text-white shadow-xs">
            <Eye size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-700">في بداية الظهور</div>
            <div className="text-xs font-medium text-slate-500">قيد الملاحظة والدعم</div>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-700">{notAcquired}</div>
      </div>
    </div>
  );
}

