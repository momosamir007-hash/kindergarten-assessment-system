import { describe, expect, it } from "vitest";
import { sanitizePedagogicalNote } from "../src/lib/pedagogical-sanitizer";

describe("Pedagogical Sanitizer", () => {
  it("eliminates personal salutations like عزيزي and عزيزتي", () => {
    const raw = "عزيزتي/عزيزي الوالد(ة)، يسرنا التواصل معكم.";
    const clean = sanitizePedagogicalNote(raw);
    expect(clean).not.toContain("عزيز");
    expect(clean).toContain("للأسرة الكريمة");
  });

  it("handles عزيزي الوالد and عزيزتي الوالدة", () => {
    expect(sanitizePedagogicalNote("عزيزي الوالد المحترم: نلاحظ تقدم الطفل")).not.toContain("عزيز");
    expect(sanitizePedagogicalNote("عزيزتي الوالدة: نلاحظ تقدم الطفلة")).not.toContain("عزيز");
  });

  it("discards legacy canned robotic boilerplate", () => {
    const canned = "عزيزتي/عزيزي الوالد(ة)، نلاحظ أن طفلك يبدأ في استكشاف مهاراته عبر اللعب، لكنه لا يزال في مرحلة البداية لكل المهارات المذكورة. هذه المرحلة طبيعية وتحتاج إلى دعم مستمر من المنزل والمدرسة.";
    const clean = sanitizePedagogicalNote(canned);
    expect(clean).toBe("");
  });

  it("preserves legitimate pedagogical words like تعزيز", () => {
    const valid = "يسعدنا مشاركة الأسرة الكريمة خطوات الطفل، ونوصي بتعزيز مهارة الاستماع.";
    const clean = sanitizePedagogicalNote(valid);
    expect(clean).toContain("بتعزيز");
    expect(clean).not.toContain("عزيزي");
    expect(clean).not.toContain("عزيزتي");
  });
});
