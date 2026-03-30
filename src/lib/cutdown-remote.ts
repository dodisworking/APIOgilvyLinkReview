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
    const json = (await res.json()) as { payload?: CutdownAppData | null };
    if (!json.payload) {
      return null;
    }
    return json.payload;
  } catch {
    return null;
  }
}

export async function pushCutdownRemote(payload: CutdownAppData): Promise<boolean> {
  const secret = process.env.NEXT_PUBLIC_CUTDOWN_SYNC_SECRET?.trim();
  if (!secret) {
    return false;
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
    return res.ok;
  } catch {
    return false;
  }
}
