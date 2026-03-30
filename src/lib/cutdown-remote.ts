import { cutdownHasUserContent, mergeStoredCutdownData } from "@/lib/api-cutdowns";
import type { CutdownAppData } from "@/types";

/** True when the browser can attempt remote sync (shared secret present at build time). */
export function isCutdownRemoteWriteConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CUTDOWN_SYNC_SECRET?.trim());
}

export async function fetchCutdownRemotePayload(): Promise<CutdownAppData | null> {
  try {
    const res = await fetch("/api/cutdown-data", { cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { payload?: unknown };
    if (!json.payload || typeof json.payload !== "object") {
      return null;
    }
    const merged = mergeStoredCutdownData(json.payload as Partial<CutdownAppData>);
    if (!cutdownHasUserContent(merged)) {
      return null;
    }
    return merged;
  } catch {
    return null;
  }
}

export type CutdownPushResult = { ok: true } | { ok: false; detail: string };

export async function pushCutdownRemote(payload: CutdownAppData): Promise<CutdownPushResult> {
  const secret = process.env.NEXT_PUBLIC_CUTDOWN_SYNC_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      detail: "Set NEXT_PUBLIC_CUTDOWN_SYNC_SECRET (same as CUTDOWN_SYNC_SECRET on the server).",
    };
  }
  try {
    const res = await fetch("/api/cutdown-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cutdown-sync-secret": secret,
      },
      body: JSON.stringify({ payload }),
    });
    if (res.ok) {
      return { ok: true };
    }
    let detail = `Server returned ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) {
        detail = j.error;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, detail };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Network error",
    };
  }
}
