import { guarded, bad } from "@/server/auth";
import { executeAiCall, AI_PROVIDERS } from "@/lib/ai-providers";
import type { AiProviderId } from "@/lib/levels";

export const dynamic = "force-dynamic";

export const POST = guarded(async (req) => {
  try {
    const body = await req.json();
    const provider = (body.provider || "gemini") as AiProviderId;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;
    const model = typeof body.model === "string" ? body.model.trim() : "";

    if (!AI_PROVIDERS[provider]) {
      return bad("المزود المحدد غير مدعوم.");
    }

    if (provider !== "custom" && !apiKey) {
      return bad("يرجى إدخال مفتاح API أولاً.");
    }

    const testConfig = {
      provider,
      apiKey,
      baseUrl,
      model: model || AI_PROVIDERS[provider]?.defaultModel,
      enabled: true,
    };

    const res = await executeAiCall(
      testConfig,
      "أنت نظام فحص اتصال. أجب بـ JSON يحتوي المفتاح status بقيمة ok فقط.",
      'فحص اتصال بالموديل. أجب بـ {"status":"ok","message":"الاتصال ناجح"}',
    );

    return Response.json({
      ok: true,
      message: `تم الاتصال بنجاح بالموديل "${testConfig.model}" عبر مزود "${AI_PROVIDERS[provider]?.name}"!`,
      response: res,
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "فشل اختبار الاتصال بالموديل.");
  }
});

