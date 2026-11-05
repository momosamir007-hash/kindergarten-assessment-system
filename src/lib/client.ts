"use client";
// Browser helpers: JSON api calls, file download / preview / print / share.

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.method = opts.method ?? "POST";
    opts.headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
    opts.body = JSON.stringify(init.json);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? "حدث خطأ") as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {}
  }
  return fallback;
}

export type FetchedFile = { blob: Blob; filename: string };

export async function fetchFile(url: string, init?: RequestInit & { json?: unknown }): Promise<FetchedFile> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.method = "POST";
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(init.json);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? "تعذر إنشاء الملف");
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("الملف الناتج فارغ");
  return { blob, filename: filenameFrom(res, "report") };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || "";
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendToFlutterBridge(action: string, f: FetchedFile): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = (window as unknown as { FlutterBridge?: { postMessage: (msg: string) => void } }).FlutterBridge;
  if (!bridge || typeof bridge.postMessage !== "function") return false;
  try {
    const base64 = await blobToBase64(f.blob);
    bridge.postMessage(
      JSON.stringify({
        action,
        filename: f.filename,
        base64,
        mime: f.blob.type || "application/octet-stream",
      })
    );
    return true;
  } catch (err) {
    console.error("FlutterBridge error", err);
    return false;
  }
}

export async function saveBlob(f: FetchedFile) {
  if (await sendToFlutterBridge("download", f)) {
    return;
  }
  const a = document.createElement("a");
  const url = URL.createObjectURL(f.blob);
  a.href = url;
  a.download = f.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function printBlob(f: FetchedFile) {
  if (await sendToFlutterBridge("print", f)) {
    return;
  }
  const url = URL.createObjectURL(f.blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(iframe);
}

export async function shareBlob(f: FetchedFile): Promise<boolean> {
  if (await sendToFlutterBridge("share", f)) {
    return true;
  }
  const mime = f.blob.type || "application/octet-stream";
  const file = new File([f.blob], f.filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: f.filename });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export const GENDER_LABEL: Record<string, string> = { M: "ذكر", F: "أنثى" };
