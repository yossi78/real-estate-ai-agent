import fs from "fs";
import path from "path";
import type { Deal } from "../types/domain";
import { logger } from "../config/logger";
import { corpusKey, getJson, setJson } from "../services/cache/cacheService";
import { parseCsvBuffer } from "../services/csv/parser";
import { cleanDealRows } from "../services/csv/cleaner";

let deals: Deal[] = [];

export function getDeals(): Deal[] {
  return deals;
}

export function setDeals(next: Deal[]): void {
  deals = next;
}

export function findDealById(dealId: string): Deal | undefined {
  return deals.find((d) => d.dealId === dealId);
}

export function loadDealsFromCsv(buffer: Buffer | string): { deals: Deal[]; dropped: number } {
  const parsed = parseCsvBuffer(buffer);
  const cleaned = cleanDealRows(parsed.rows);
  setDeals(cleaned.deals);
  return { deals: cleaned.deals, dropped: cleaned.dropped };
}

export async function persistCorpus(): Promise<void> {
  await setJson(corpusKey(), deals, 0);
}

export async function hydrateCorpusFromRedis(): Promise<boolean> {
  const stored = await getJson<Deal[]>(corpusKey());
  if (stored && stored.length > 0) {
    setDeals(stored);
    return true;
  }
  return false;
}

export async function loadSampleDeals(): Promise<void> {
  const hydrated = await hydrateCorpusFromRedis();
  if (hydrated) {
    logger.info("corpus_hydrated_from_redis", { count: deals.length });
    return;
  }
  const candidates = [
    path.resolve(process.cwd(), "src/data/sample-deals.csv"),
    path.resolve(__dirname, "../data/sample-deals.csv"),
    path.resolve(__dirname, "../../src/data/sample-deals.csv"),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    logger.warn("sample_csv_missing");
    return;
  }
  const result = loadDealsFromCsv(fs.readFileSync(file));
  await persistCorpus();
  logger.info("sample_deals_loaded", { count: result.deals.length, dropped: result.dropped });
}
