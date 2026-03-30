import type { CutdownAppData } from "@/types";
import { buildCutdownSeedData, mergeStoredCutdownData } from "@/lib/api-cutdowns";

const CUTDOWN_DATA_KEY = "production-review-api-cutdowns-v1";

export function loadCutdownAppData(): CutdownAppData {
  if (typeof window === "undefined") {
    return buildCutdownSeedData();
  }
  const raw = window.localStorage.getItem(CUTDOWN_DATA_KEY);
  if (!raw) {
    const seed = buildCutdownSeedData();
    window.localStorage.setItem(CUTDOWN_DATA_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CutdownAppData>;
    const merged = mergeStoredCutdownData(parsed);
    return merged;
  } catch {
    const seed = buildCutdownSeedData();
    window.localStorage.setItem(CUTDOWN_DATA_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function saveCutdownAppData(data: CutdownAppData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CUTDOWN_DATA_KEY, JSON.stringify(data));
}
