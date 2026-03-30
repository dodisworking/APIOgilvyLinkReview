import type { ReviewLinkVersion } from "@/types";

export type LinkComposerSlotDraft = {
  frameUrl: string;
  note: string;
};

export type LinkSlotCount = 2 | 3 | 4;

export type LinkComposerDraft = {
  multiMode: boolean;
  slotCount: LinkSlotCount;
  slots: LinkComposerSlotDraft[];
  frameUrl: string;
  note: string;
  customMessage: string;
  commentsDueAt: string;
};

export function emptyComposerDraft(): LinkComposerDraft {
  return {
    multiMode: false,
    slotCount: 2,
    slots: [
      { frameUrl: "", note: "" },
      { frameUrl: "", note: "" },
      { frameUrl: "", note: "" },
      { frameUrl: "", note: "" },
    ],
    frameUrl: "",
    note: "",
    customMessage: "",
    commentsDueAt: "",
  };
}

/** Merge stored JSON with defaults (older saves lack multi fields). */
export function normalizeComposerDraft(raw: unknown): LinkComposerDraft {
  const base = emptyComposerDraft();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const o = raw as Partial<LinkComposerDraft>;
  const slots = Array.isArray(o.slots) ? o.slots : [];
  const padded: LinkComposerSlotDraft[] = [0, 1, 2, 3].map((i) => {
    const s = slots[i];
    if (s && typeof s === "object") {
      return {
        frameUrl: typeof s.frameUrl === "string" ? s.frameUrl : "",
        note: typeof s.note === "string" ? s.note : "",
      };
    }
    return { frameUrl: "", note: "" };
  });
  const sc = o.slotCount === 3 || o.slotCount === 4 ? o.slotCount : 2;
  return {
    multiMode: Boolean(o.multiMode),
    slotCount: sc,
    slots: padded,
    frameUrl: typeof o.frameUrl === "string" ? o.frameUrl : "",
    note: typeof o.note === "string" ? o.note : "",
    customMessage: typeof o.customMessage === "string" ? o.customMessage : "",
    commentsDueAt: typeof o.commentsDueAt === "string" ? o.commentsDueAt : "",
  };
}

export function extractLinkPostingNumber(version: string): number | null {
  const m = version.match(/Link\s*#?\s*(\d+)/i);
  if (!m) {
    return null;
  }
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function getNextPostingVersionLabel(links: ReviewLinkVersion[]): string {
  const nums = links
    .map((link) => extractLinkPostingNumber(link.version))
    .filter((n): n is number => n != null);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `Link #${next}`;
}

export function getNextBatchPostingVersionLabel(links: ReviewLinkVersion[]): string {
  const nums = links
    .map((link) => extractLinkPostingNumber(link.version))
    .filter((n): n is number => n != null);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `Batch link #${next}`;
}

/**
 * Group links into postings: same `bundleId` = one multi-link drop; missing id = singleton.
 */
export function groupLinksIntoBundles(links: ReviewLinkVersion[]): ReviewLinkVersion[][] {
  const byKey = new Map<string, ReviewLinkVersion[]>();
  for (const link of links) {
    const key = link.bundleId ?? `single:${link.id}`;
    const arr = byKey.get(key) ?? [];
    arr.push(link);
    byKey.set(key, arr);
  }
  const groups = Array.from(byKey.values());
  for (const g of groups) {
    g.sort((a, b) => (a.bundleOrder ?? 0) - (b.bundleOrder ?? 0));
  }
  groups.sort((a, b) => {
    const ta = new Date(a[0]?.postedAt ?? 0).getTime();
    const tb = new Date(b[0]?.postedAt ?? 0).getTime();
    return tb - ta;
  });
  return groups;
}
