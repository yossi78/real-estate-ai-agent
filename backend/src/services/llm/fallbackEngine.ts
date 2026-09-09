import type { DealValuationMetrics, LlmInsight, NeighborhoodStats, Verdict } from "../../types/domain";
import { clamp, round2 } from "../stats/math";

export function fallbackFromDeal(metrics: DealValuationMetrics): LlmInsight {
  const v = metrics.varianceVsNeighborhoodPct ?? 0;
  const growth = metrics.neighborhoodCagrPct;
  const verdict = verdictFromVariance(v, growth);
  const score = metrics.opportunityScore;
  const deal = metrics.deal;

  const pros: string[] = [];
  const cons: string[] = [];
  const risks: string[] = [];
  const buyerTips: string[] = [];

  if (v <= -8) {
    pros.push(
      `העסקה מתומחרת כ-${Math.abs(v).toFixed(1)}% מתחת לממוצע השכונתי למ״ר (${fmt(metrics.neighborhoodAvgPricePerSqm)} ₪).`,
    );
  } else {
    pros.push(`המחיר למ״ר בעסקה הוא ${fmt(deal.pricePerSqm)} ₪ על בסיס ${deal.sqm} מ״ר.`);
  }

  if (metrics.varianceVsStreetPct !== null && metrics.varianceVsStreetPct <= -5) {
    pros.push(
      `ביחס לרחוב ${deal.street} העסקה זולה ב-${Math.abs(metrics.varianceVsStreetPct).toFixed(1)}%.`,
    );
  } else {
    pros.push(`קיימת דגימה של עסקאות ב${deal.neighborhood} המאפשרת השוואה סטטיסטית.`);
  }

  if (v > 8) {
    cons.push(
      `הנכס יקר ב-${v.toFixed(1)}% מממוצע השכונה למ״ר — פרמיה שיש להצדיק במאפייני הנכס.`,
    );
  } else {
    cons.push("מנוע הגיבוי אינו בודק מצב פיזי, חריגות בנייה או איכות שיפוץ.");
  }

  if (growth === null) {
    cons.push("אין מספיק היסטוריה שנתית לחישוב קצב צמיחה אמין.");
  } else if (growth < 0) {
    cons.push(`קצב הצמיחה ההיסטורי בשכונה שלילי (${growth.toFixed(1)}% CAGR).`);
  } else {
    cons.push("מגמת מחירים חיובית אינה מבטיחה נזילות עתידית או תשואה שוטפת.");
  }

  if (metrics.neighborhoodStddevPricePerSqm > (metrics.neighborhoodAvgPricePerSqm ?? 0) * 0.18) {
    risks.push("סטיית תקן גבוהה במחיר למ״ר — השוק השכונתי הטרוגני ותמחור שגוי אפשרי.");
  } else {
    risks.push("סיכון מקרו (ריבית, מיסוי, היצע חדש) אינו מגולל במודל העסקאות.");
  }

  if (verdict === "buy") {
    buyerTips.push("אשרו שמאי מטעם הקונה לפני התקדמות — הפער הסטטיסטי דורש אימות פיזי.");
    buyerTips.push("בדקו האם הפער נובע מקומה, כיווני אוויר או צורך בשיפוץ כבד.");
  } else if (verdict === "avoid") {
    buyerTips.push("אל תסמכו על פרמיית מיקום ללא נתוני השבחה מוכחים (תמ״א, פינוי-בינוי, קווי תחבורה).");
    buyerTips.push("השוו לפחות 3 עסקאות קרובות באותו רחוב לפני הצעה.");
  } else {
    buyerTips.push("העסקה קרובה לממוצע — כוח המיקוח תלוי במצב הנכס ובתנאי המימון.");
    buyerTips.push("בקשו היסטוריית ועד בית והיתרי בנייה לפני חתימה.");
  }

  return {
    summary: buildDealSummary(metrics, verdict),
    opportunityScore: score,
    verdict,
    pros,
    cons,
    risks,
    buyerTips,
    marketNarrative: buildDealNarrative(metrics, growth),
  };
}

export function fallbackFromNeighborhood(stats: NeighborhoodStats): LlmInsight {
  const growth = stats.historicalCagrPct;
  const cv =
    stats.pricePerSqm.mean > 0 ? stats.pricePerSqm.stddev / stats.pricePerSqm.mean : 0;
  const verdict: Verdict = growth !== null && growth >= 4 && cv < 0.22 ? "buy" : growth !== null && growth < 0 ? "avoid" : "hold";
  const score = round2(
    clamp(50 + (growth ?? 0) * 2 - cv * 30 + (stats.dataConfidence - 50) * 0.2, 0, 100),
  );

  return {
    summary: `ב${stats.neighborhood} (${stats.city}) נותחו ${stats.dealCount} עסקאות. ממוצע למ״ר ${fmt(stats.pricePerSqm.mean)} ₪, חציון ${fmt(stats.pricePerSqm.median)} ₪. ${growth === null ? "אין CAGR שנתי מספק." : `CAGR היסטורי ${growth.toFixed(1)}%.`}`,
    opportunityScore: score,
    verdict,
    pros: [
      `חציון מחיר למ״ר ${fmt(stats.pricePerSqm.median)} ₪ על בסיס ${stats.dealCount} עסקאות.`,
      stats.streets[0]
        ? `הרחוב הפעיל ביותר במדגם: ${stats.streets[0].street} (${stats.streets[0].dealCount} עסקאות).`
        : "קיים פירוט רחובות במדגם.",
    ],
    cons: [
      stats.dealCount < 8 ? "מדגם קטן — הממוצעים רגישים לעסקה חריגה אחת." : "המדגם אינו כולל נכסים לא מדווחים או עסקאות מחוץ לשוק החופשי.",
      growth === null ? "אין עומק היסטורי לחישוב מגמה." : "צמיחה היסטורית אינה תחזית.",
    ],
    risks: [
      cv > 0.2
        ? "תנודתיות גבוהה במחיר למ״ר בתוך השכונה."
        : "סיכון ריבית ומס רכישה אינו מגולל בסטטיסטיקת העסקאות.",
    ],
    buyerTips: [
      "סננו לפי רחוב וגודל דירה לפני שמסיקים לגבי נכס בודד.",
      "השוו את החציון למ״ר לנכס היעד ואל תסתמכו על הממוצע בלבד.",
    ],
    marketNarrative: `טווח למ״ר ${fmt(stats.pricePerSqm.min)}–${fmt(stats.pricePerSqm.max)} ₪. סטיית תקן ${fmt(stats.pricePerSqm.stddev)}. רמת ביטחון בנתונים ${stats.dataConfidence.toFixed(0)}/100.`,
  };
}

export function verdictFromVariance(variancePct: number, cagrPct: number | null): Verdict {
  if (variancePct <= -10 && (cagrPct === null || cagrPct >= -1)) return "buy";
  if (variancePct >= 15) return "avoid";
  if (cagrPct !== null && cagrPct <= -4 && variancePct >= 5) return "avoid";
  return "hold";
}

function buildDealSummary(metrics: DealValuationMetrics, verdict: Verdict): string {
  const v = metrics.varianceVsNeighborhoodPct;
  const vs =
    v === null
      ? "אין מספיק בסיס שכונתי"
      : `${v > 0 ? "יקרה" : "זולה"} ב-${Math.abs(v).toFixed(1)}% מממוצע השכונה למ״ר`;
  const label = verdict === "buy" ? "הזדמנות יחסית" : verdict === "avoid" ? "פרמיה גבוהה" : "תמחור קרוב לממוצע";
  return `עסקה ${metrics.deal.dealId} ב${metrics.deal.street}, ${metrics.deal.neighborhood}: ${vs}. ציון הזדמנות ${metrics.opportunityScore}. הערכה דטרמיניסטית: ${label}.`;
}

function buildDealNarrative(metrics: DealValuationMetrics, growth: number | null): string {
  const growthText = growth === null ? "מגמת CAGR לא חושבה (מדגם שנתי חסר)." : `CAGR שכונתי ${growth.toFixed(1)}%.`;
  return `מחיר העסקה ${fmt(metrics.deal.priceNis)} ₪, ${fmt(metrics.deal.pricePerSqm)} ₪/מ״ר. ממוצע רחוב ${fmt(metrics.streetAvgPricePerSqm)} מול ממוצע שכונה ${fmt(metrics.neighborhoodAvgPricePerSqm)}. ${growthText}`;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "לא זמין";
  return Math.round(n).toLocaleString("he-IL");
}
