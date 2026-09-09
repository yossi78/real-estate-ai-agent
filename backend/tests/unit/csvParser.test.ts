import { parseCsvBuffer, normalizeHeader } from "../../src/services/csv/parser";
import { ValidationError } from "../../src/middleware/errorHandler";

describe("csv parser", () => {
  it("maps Hebrew headers to canonical fields", () => {
    expect(normalizeHeader("שכונה")).toBe("neighborhood");
    expect(normalizeHeader("מחיר")).toBe("priceNis");
    expect(normalizeHeader("שטח")).toBe("sqm");
    expect(normalizeHeader("תאריך")).toBe("date");
    expect(normalizeHeader("מזהה")).toBe("dealId");
    expect(normalizeHeader("עיר")).toBe("city");
    expect(normalizeHeader("רחוב")).toBe("street");
    expect(normalizeHeader("חדרים")).toBe("rooms");
    expect(normalizeHeader("קומה")).toBe("floor");
    expect(normalizeHeader("סוג_נכס")).toBe("propertyType");
    expect(normalizeHeader("סוג נכס")).toBe("propertyType");
    expect(normalizeHeader("שנת_בניה")).toBe("yearBuilt");
    expect(normalizeHeader("שנת בניה")).toBe("yearBuilt");
  });

  it("maps English aliases and ignores case, spaces, and BOM", () => {
    expect(normalizeHeader("deal_id")).toBe("dealId");
    expect(normalizeHeader("ID")).toBe("dealId");
    expect(normalizeHeader("  DEALID  ")).toBe("dealId");
    expect(normalizeHeader("\uFEFFdate")).toBe("date");
    expect(normalizeHeader("area")).toBe("sqm");
    expect(normalizeHeader("price")).toBe("priceNis");
    expect(normalizeHeader("price_nis")).toBe("priceNis");
    expect(normalizeHeader("property_type")).toBe("propertyType");
    expect(normalizeHeader("year_built")).toBe("yearBuilt");
  });

  it("leaves unknown headers trimmed but otherwise unchanged", () => {
    expect(normalizeHeader("  Extra Col  ")).toBe("Extra Col");
  });

  it("parses English CSV rows", () => {
    const csv = [
      "dealId,date,city,neighborhood,street,rooms,floor,sqm,priceNis,propertyType,yearBuilt",
      "A-1,2024-01-02,תל אביב,פלורנטין,הרצל,3,2,70,2100000,דירה,1960",
    ].join("\n");
    const result = parseCsvBuffer(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].dealId).toBe("A-1");
    expect(result.rows[0].neighborhood).toBe("פלורנטין");
    expect(result.rows[0].priceNis).toBe("2100000");
    expect(result.headerCount).toBeGreaterThanOrEqual(11);
  });

  it("parses Hebrew-header CSV", () => {
    const csv = [
      "מזהה,תאריך,עיר,שכונה,רחוב,חדרים,קומה,שטח,מחיר,סוג_נכס,שנת_בניה",
      "B-9,03/05/2023,תל אביב,רמת אביב,ברודצקי,4,1,100,\"3,200,000\",דירה,1999",
    ].join("\n");
    const result = parseCsvBuffer(csv);
    expect(result.rows[0].dealId).toBe("B-9");
    expect(result.rows[0].priceNis).toBe("3,200,000");
    expect(result.rows[0].date).toBe("03/05/2023");
  });

  it("parses alias English headers from a Buffer including a BOM", () => {
    const csv =
      "\uFEFFdeal_id,date,city,neighborhood,street,rooms,floor,area,price,property_type,year_built\n" +
      "C-3,2024-02-02,תל אביב,פלורנטין,הרצל,3,2,70,2100000,דירה,1960\n";
    const result = parseCsvBuffer(Buffer.from(csv, "utf8"));
    expect(result.rows[0].dealId).toBe("C-3");
    expect(result.rows[0].sqm).toBe("70");
    expect(result.rows[0].priceNis).toBe("2100000");
    expect(result.rows[0].propertyType).toBe("דירה");
    expect(result.rows[0].yearBuilt).toBe("1960");
  });

  it("skips empty lines between rows", () => {
    const csv = [
      "dealId,date,city,neighborhood,street,rooms,floor,sqm,priceNis,propertyType,yearBuilt",
      "A-1,2024-01-02,תל אביב,פלורנטין,הרצל,3,2,70,2100000,דירה,1960",
      "",
      "A-2,2024-01-03,תל אביב,פלורנטין,הרצל,4,3,90,2800000,דירה,1970",
    ].join("\n");
    expect(parseCsvBuffer(csv).rows).toHaveLength(2);
  });

  it("rejects empty files", () => {
    expect(() => parseCsvBuffer("   ")).toThrow(ValidationError);
    expect(() => parseCsvBuffer("   ")).toThrow("קובץ CSV ריק");
    expect(() => parseCsvBuffer(Buffer.from(""))).toThrow("קובץ CSV ריק");
  });

  it("rejects header-only files with no data rows", () => {
    expect(() => parseCsvBuffer("dealId,date,city\n")).toThrow(ValidationError);
    expect(() => parseCsvBuffer("dealId,date,city\n")).toThrow("לא נמצאו שורות תקינות ב-CSV");
  });
});
