"use client";

import React, { useRef, useState } from "react";
import { Camera, Trash2, User } from "lucide-react";

export function StudentAvatar({
  src,
  alt = "",
  size = "md",
  className = "",
}: {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    xs: "w-7 h-7 text-xs",
    sm: "w-9 h-9 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-20 h-20 text-xl",
    xl: "w-28 h-28 text-2xl",
  };

  const iconSizes = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 34,
    xl: 46,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-2xl object-cover border border-slate-200/90 shadow-xs shrink-0 ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/80 flex items-center justify-center text-[#0f4c81] shadow-xs shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <User size={iconSizes[size]} strokeWidth={2} />
    </div>
  );
}

export function PhotoUpload({
  value,
  onChange,
  disabled = false,
}: {
  value?: string | null;
  onChange: (photo: string | null) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFile = (file: File) => {
    if (!file) return;
    setCompressing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 360;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          }
        } else {
          if (h > MAX) {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          onChange(compressed);
        }
        setCompressing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative group">
        <StudentAvatar src={value} size="lg" />
        {!disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
            title="تغيير الصورة"
          >
            <Camera size={22} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || compressing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-colors shadow-xs"
          >
            <Camera size={14} />
            <span>{compressing ? "جارٍ التحسين..." : value ? "تغيير الصورة" : "اختيار صورة شخصية"}</span>
          </button>
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
              title="إزالة الصورة"
            >
              <Trash2 size={14} />
              <span>إزالة</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">صيغ مدعومة: JPG، PNG، WEBP (يتم الضغط والتحسين للطباعة وتقرير A4 تلقائياً)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    </div>
  );
}

