import { parse } from "csv-parse/sync";
import type { RawDealRow } from "../../types/domain";
import { ValidationError } from "../../middleware/errorHandler";

export interface ParseCsvResult {
  rows: RawDealRow[];
  headerCount: number;
}

export function parseCsvBuffer(buffer: Buffer | string): ParseCsvResult {
  const input = typeof buffer === "string" ? buffer : buffer.toString("utf8");
  const trimmed = stripBom(input).trim();
  if (!trimmed) {
    throw new ValidationError("קובץ CSV ריק");
  }

  const records = parse(trimmed, {
    columns: (header: string[]) => header.map((h) => normalizeHeader(h)),
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as RawDealRow[];

  if (!Array.isArray(records) || records.length === 0) {
    throw new ValidationError("לא נמצאו שורות תקינות ב-CSV");
  }

  return {
    rows: records,
    headerCount: Object.keys(records[0] ?? {}).length,
  };
}

export function normalizeHeader(header: string): string {
  const key = header.replace(/^\uFEFF/, "").trim().toLowerCase();
  const map: Record<string, string> = {
    dealid: "dealId",
    deal_id: "dealId",
    id: "dealId",
    מזהה: "dealId",
    date: "date",
    תאריך: "date",
    city: "city",
    עיר: "city",
    neighborhood: "neighborhood",
    שכונה: "neighborhood",
    street: "street",
    רחוב: "street",
    rooms: "rooms",
    חדרים: "rooms",
    floor: "floor",
    קומה: "floor",
    sqm: "sqm",
    area: "sqm",
    שטח: "sqm",
    pricenis: "priceNis",
    price: "priceNis",
    price_nis: "priceNis",
    מחיר: "priceNis",
    propertytype: "propertyType",
    property_type: "propertyType",
    סוג_נכס: "propertyType",
    "סוג נכס": "propertyType",
    yearbuilt: "yearBuilt",
    year_built: "yearBuilt",
    שנת_בניה: "yearBuilt",
    "שנת בניה": "yearBuilt",
  };
  return map[key] ?? header.trim();
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
