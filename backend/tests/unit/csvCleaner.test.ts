import { cleanDealRows, parseDate, parseNumber, parseOptionalNumber } from "../../src/services/csv/cleaner";
import type { RawDealRow } from "../../src/types/domain";

function row(overrides: RawDealRow = {}): RawDealRow {
  return {
    dealId: "X-1",
    date: "2024-06-01",
    city: "תל אביב",
    neighborhood: "פלורנטין",
    street: "הרצל",
    rooms: "3",
    floor: "2",
    sqm: "70",
    priceNis: "2100000",
    propertyType: "דירה",
    yearBuilt: "1960",
    ...overrides,
  };
}

describe("csv cleaner", () => {
  it("computes price per sqm and keeps valid deals", () => {
    const { deals, dropped } = cleanDealRows([row()]);
    expect(dropped).toBe(0);
    expect(deals).toHaveLength(1);
    expect(deals[0].pricePerSqm).toBe(30000);
    expect(deals[0].year).toBe(2024);
    expect(deals[0].floor).toBe(2);
    expect(deals[0].yearBuilt).toBe(1960);
  });

  it("parses Israeli thousand separators and DD/MM/YYYY dates", () => {
    const { deals } = cleanDealRows([row({ priceNis: "1,850,000", date: "07/03/2022" })]);
    expect(deals[0].priceNis).toBe(1850000);
    expect(deals[0].date).toBe("2022-03-07");
    expect(deals[0].year).toBe(2022);
  });

  it("accepts dealId from id and price from price aliases", () => {
    const { deals } = cleanDealRows([
      row({ dealId: "", id: "ALIAS-1", priceNis: undefined, price: "2100000" }),
    ]);
    expect(deals[0].dealId).toBe("ALIAS-1");
    expect(deals[0].priceNis).toBe(2100000);
  });

  it("defaults missing property type to דירה and optional numbers to null", () => {
    const { deals } = cleanDealRows([row({ propertyType: "", floor: "", yearBuilt: "not-a-year" })]);
    expect(deals[0].propertyType).toBe("דירה");
    expect(deals[0].floor).toBeNull();
    expect(deals[0].yearBuilt).toBeNull();
  });

  it("collapses extra whitespace in location fields", () => {
    const { deals } = cleanDealRows([
      row({ city: "  תל   אביב  ", neighborhood: "פלורנטין\t", street: "  הרצל  " }),
    ]);
    expect(deals[0].city).toBe("תל אביב");
    expect(deals[0].street).toBe("הרצל");
  });

  it("drops invalid prices, sqm, rooms, and unrealistic ppsqm", () => {
    const { deals, dropReasons } = cleanDealRows([
      row({ dealId: "bad-price", priceNis: "0" }),
      row({ dealId: "neg-price", priceNis: "-100" }),
      row({ dealId: "bad-sqm", sqm: "-4" }),
      row({ dealId: "zero-sqm", sqm: "0" }),
      row({ dealId: "bad-rooms", rooms: "0" }),
      row({ dealId: "insane", priceNis: "50", sqm: "80" }),
      row({ dealId: "ok" }),
    ]);
    expect(deals.map((d) => d.dealId)).toEqual(["ok"]);
    expect(dropReasons.invalid_price).toBe(2);
    expect(dropReasons.invalid_sqm).toBe(2);
    expect(dropReasons.invalid_rooms).toBe(1);
    expect(dropReasons.unrealistic_ppsqm).toBe(1);
  });

  it("drops missing identifiers, locations, and dates", () => {
    const { deals, dropReasons, dropped } = cleanDealRows([
      row({ dealId: "   " }),
      row({ dealId: "no-city", city: "" }),
      row({ dealId: "no-hood", neighborhood: "" }),
      row({ dealId: "no-street", street: "" }),
      row({ dealId: "bad-date", date: "not-a-date" }),
      row({ dealId: "ok" }),
    ]);
    expect(deals).toHaveLength(1);
    expect(dropped).toBe(5);
    expect(dropReasons.missing_deal_id).toBe(1);
    expect(dropReasons.missing_location).toBe(3);
    expect(dropReasons.invalid_date).toBe(1);
  });

  it("keeps ppsqm on the inclusive 1,000–250,000 bounds and drops just outside", () => {
    const lowOk = cleanDealRows([row({ dealId: "low", priceNis: "70000", sqm: "70" })]);
    const highOk = cleanDealRows([row({ dealId: "high", priceNis: "17500000", sqm: "70" })]);
    const tooLow = cleanDealRows([row({ dealId: "too-low", priceNis: "69999", sqm: "70" })]);
    const tooHigh = cleanDealRows([row({ dealId: "too-high", priceNis: "17500001", sqm: "70" })]);
    expect(lowOk.deals[0].pricePerSqm).toBe(1000);
    expect(highOk.deals[0].pricePerSqm).toBe(250000);
    expect(tooLow.dropReasons.unrealistic_ppsqm).toBe(1);
    expect(tooHigh.dropReasons.unrealistic_ppsqm).toBe(1);
  });

  it("dedupes by dealId keeping the last occurrence", () => {
    const { deals, dropReasons } = cleanDealRows([
      row({ dealId: "dup", priceNis: "2100000" }),
      row({ dealId: "dup", priceNis: "2200000" }),
    ]);
    expect(deals).toHaveLength(1);
    expect(deals[0].priceNis).toBe(2200000);
    expect(dropReasons.duplicate_id).toBe(1);
  });

  it("counts both invalid rows and duplicates in dropped", () => {
    const { dropped, deals } = cleanDealRows([
      row({ dealId: "dup" }),
      row({ dealId: "dup" }),
      row({ dealId: "bad", priceNis: "0" }),
    ]);
    expect(deals).toHaveLength(1);
    expect(dropped).toBe(2);
  });
});

describe("parseNumber / parseDate helpers", () => {
  it("parses NIS formatting and rejects empty or non-numeric values", () => {
    expect(parseNumber("₪ 1,200")).toBe(1200);
    expect(parseNumber("₪2,100,000")).toBe(2_100_000);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseOptionalNumber("3")).toBe(3);
    expect(parseOptionalNumber(undefined)).toBeNull();
  });

  it("parses ISO and Israeli dates within 1990–2100", () => {
    expect(parseDate("1990-01-01")).toEqual({ iso: "1990-01-01", year: 1990 });
    expect(parseDate("2100-12-31")?.year).toBe(2100);
    expect(parseDate("7/3/2022")).toEqual({ iso: "2022-03-07", year: 2022 });
    expect(parseDate("01/13/1980")).toBeNull();
    expect(parseDate("1989-01-01")).toBeNull();
    expect(parseDate("2101-01-01")).toBeNull();
    expect(parseDate("01/01/2101")).toBeNull();
    expect(parseDate("nope")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});
