import { guarded, bad } from "@/server/auth";
import { fetchLiveModels, AI_PROVIDERS } from "@/lib/ai-providers";
import type { AiProviderId } from "@/lib/levels";

export const dynamic = "force-dynamic";

export const POST = guarded(async (req) => {
  try {
    const body = await req.json();
    const provider = (body.provider || "gemini") as AiProviderId;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;

    if (!AI_PROVIDERS[provider]) {
      return bad("المزود المحدد غير مدعوم.");
    }

    if (provider !== "custom" && !apiKey) {
      return bad("يرجى إدخال مفتاح API لجلب الموديلات المتاحة.");
    }

    const models = await fetchLiveModels(provider, apiKey, baseUrl);
    return Response.json({ ok: true, provider, count: models.length, models });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "فشل جلب قائمة الموديلات من المزود");
  }
});

