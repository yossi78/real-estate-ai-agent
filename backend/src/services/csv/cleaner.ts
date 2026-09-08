import type { Deal, RawDealRow } from "../../types/domain";

export interface CleanCsvResult {
  deals: Deal[];
  dropped: number;
  dropReasons: Record<string, number>;
}

export function cleanDealRows(rows: RawDealRow[]): CleanCsvResult {
  const deals: Deal[] = [];
  const dropReasons: Record<string, number> = {};

  for (const row of rows) {
    const result = cleanOne(row);
    if ("deal" in result) {
      deals.push(result.deal);
      continue;
    }
    dropReasons[result.reason] = (dropReasons[result.reason] ?? 0) + 1;
  }

  const unique = dedupeById(deals);
  const droppedDupes = deals.length - unique.length;
  if (droppedDupes > 0) {
    dropReasons.duplicate_id = droppedDupes;
  }

  return {
    deals: unique,
    dropped: rows.length - unique.length,
    dropReasons,
  };
}

function cleanOne(row: RawDealRow): { deal: Deal } | { reason: string } {
  const dealId = text(row.dealId) || text(row.id);
  const city = text(row.city);
  const neighborhood = text(row.neighborhood);
  const street = text(row.street);
  const dateRaw = text(row.date);
  const sqm = parseNumber(row.sqm);
  const priceNis = parseNumber(row.priceNis ?? row.price);
  const rooms = parseNumber(row.rooms);
  const floor = parseOptionalNumber(row.floor);
  const yearBuilt = parseOptionalNumber(row.yearBuilt);
  const propertyType = text(row.propertyType) || "דירה";
  const parsedDate = parseDate(dateRaw);

  if (!dealId) return { reason: "missing_deal_id" };
  if (!city || !neighborhood || !street) return { reason: "missing_location" };
  if (!parsedDate) return { reason: "invalid_date" };
  if (sqm === null || sqm <= 0) return { reason: "invalid_sqm" };
  if (priceNis === null || priceNis <= 0) return { reason: "invalid_price" };
  if (rooms === null || rooms <= 0) return { reason: "invalid_rooms" };
  if (priceNis / sqm < 1_000 || priceNis / sqm > 250_000) return { reason: "unrealistic_ppsqm" };

  return {
    deal: {
      dealId,
      date: parsedDate.iso,
      year: parsedDate.year,
      city,
      neighborhood,
      street,
      rooms,
      floor,
      sqm,
      priceNis,
      pricePerSqm: round2(priceNis / sqm),
      propertyType,
      yearBuilt,
    },
  };
}

export function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value)
    .trim()
    .replace(/[₪\s]/g, "")
    .replace(/,/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseOptionalNumber(value: string | undefined): number | null {
  const n = parseNumber(value);
  return n;
}

export function parseDate(value: string): { iso: string; year: number } | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const year = Number(iso[1]);
    if (year < 1990 || year > 2100) return null;
    return { iso: value, year };
  }
  const il = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (il) {
    const day = il[1].padStart(2, "0");
    const month = il[2].padStart(2, "0");
    const year = Number(il[3]);
    if (year < 1990 || year > 2100) return null;
    return { iso: `${year}-${month}-${day}`, year };
  }
  return null;
}

function text(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dedupeById(deals: Deal[]): Deal[] {
  const seen = new Map<string, Deal>();
  for (const deal of deals) {
    seen.set(deal.dealId, deal);
  }
  return [...seen.values()];
}
