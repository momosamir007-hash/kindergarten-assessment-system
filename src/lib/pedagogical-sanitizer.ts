/**
 * Sanitizer ensuring all pedagogical guidance and notes:
 * 1. Strictly exclude sensitive personal salutations such as "عزيزي", "عزيزتي", "عزيزي/عزيزتي", "أخي", "أختي"
 * 2. Replace them with respectful, dignified family address: "الأسرة الكريمة"
 * 3. Eliminate robotic/canned phrases that sound bureaucratic.
 */

export function sanitizePedagogicalNote(text: string | null | undefined): string {
  if (!text) return "";
  let s = text.trim();

  // If text is the legacy robotic template from previous runs, discard it so the warm dynamic summary is used instead
  if (
    s.includes("نلاحظ أن طفلك يبدأ في استكشاف مهاراته عبر اللعب، لكنه لا يزال في مرحلة البداية") ||
    s.includes("النسبة السلوكية الحالية") ||
    s.includes("حد الدعم (50%)")
  ) {
    return "";
  }

  // Remove or replace all banned address variations (عزيزي, عزيزتي, عزيزي/عزيزتي, الوالد(ة), etc.)
  // Note: we use word boundaries / careful matching to never match "تعزيز"
  s = s.replace(/(?:^|\s)(?:عزيزتي\s*[\/\\]\s*عزيزي|عزيزي\s*[\/\\]\s*عزيزتي|عزيزي|عزيزتي)(?:\s*(?:الوالد\(ة\)|\(ة\)|\s*الوالد|\s*الوالدة|\s*المحترم|\s*المحترمة))?[\s،,.:-]*/gi, " تحية طيبة للأسرة الكريمة، ");
  s = s.replace(/(?:^|\s)(?:أخي\s+الولي|أختي\s+الولية|أيها\s+الولي)[\s،,.:-]*/gi, " تحية طيبة للأسرة الكريمة، ");

  // Clean double spaces and duplicate greetings
  s = s.replace(/(تحية طيبة للأسرة الكريمة،\s*)+/g, "تحية طيبة للأسرة الكريمة، ");
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}
