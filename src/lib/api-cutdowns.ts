import type { CutdownAppData, CutdownBatchId, ReviewLinkVersion, VideoItem } from "@/types";

export const CUTDOWN_BATCH_IDS: CutdownBatchId[] = ["1", "2", "3"];

export function emptyBatchLinks(): Record<CutdownBatchId, ReviewLinkVersion[]> {
  return { "1": [], "2": [], "3": [] };
}

/** :15–:30 API cutdowns — stable ids map to Ogilvy batch (1–3). */
export const API_CUTDOWN_DEFS: {
  id: string;
  title: string;
  emoji: string;
  batch: 1 | 2 | 3;
}[] = [
  { id: "api-cut-exec-marc", title: "The Executive Advantage — Marc", emoji: "🎯", batch: 1 },
  {
    id: "api-cut-exec-mary-beth",
    title: "The Executive Advantage — Mary Beth",
    emoji: "🎯",
    batch: 1,
  },
  { id: "api-cut-behind-realest", title: "Behind the Business — The Realest", emoji: "💼", batch: 1 },
  { id: "api-cut-pop-barton", title: "The Pop-Up City — Barton G", emoji: "🏙️", batch: 1 },
  { id: "api-cut-pop-spectrum", title: "The Pop-Up City — Spectrum", emoji: "🌆", batch: 2 },
  { id: "api-cut-pulse-mike", title: "The Pulse Check — Mike K", emoji: "🫀", batch: 2 },
  { id: "api-cut-pulse-ginger", title: "The Pulse Check — Ginger S", emoji: "📈", batch: 2 },
  { id: "api-cut-course-mgmt", title: "Course Management for Business", emoji: "📚", batch: 2 },
  { id: "api-cut-ahead-mike", title: "Ahead of the Curve — Mike K", emoji: "📊", batch: 3 },
  { id: "api-cut-ahead-ranjita", title: "Ahead of the Curve — Ranjita I", emoji: "📉", batch: 3 },
  {
    id: "api-cut-unlocked-moov",
    title: "Unlocked: The Power of Partnership — MOOV",
    emoji: "🤝",
    batch: 3,
  },
];

/** Roster per batch (same order you listed) — shown on Schedule timeline, not on status badges. */
export const API_CUTDOWN_BATCH_ROSTER: Record<1 | 2 | 3, string> = {
  1: "Executive Advantage — Marc; Executive Advantage — Mary Beth; Behind the Business — The Realest; The Pop-Up City — Barton G",
  2: "The Pop-Up City — Spectrum; The Pulse Check — Mike K; The Pulse Check — Ginger S; Course Management for Business",
  3: "Ahead of the Curve — Mike K; Ahead of the Curve — Ranjita I; Unlocked: The Power of Partnership — MOOV",
};

export const API_CUTDOWN_SCHEDULE_LINES: string[] = [
  "March 30: Edit Batch 1 (3-4 videos) and send to Ogilvy at EOD",
  "March 31: Edit Batch 2 (3-4 videos) and send to Ogilvy at EOD",
  "April 1: Edit Batch 3 (3-4 videos) and send to Ogilvy at EOD",
  "April 2: Revise Batch 1 based on Agency notes and send to client at EOD; 48 hr review period begins",
  "April 3: Revise Batch 2 based on Agency notes and send to client at EOD; 48 hr review period begins",
  "April 6: Revise Batch 3 based on Agency notes and send to client at EOD; 48 hr review period begins",
  "DARK APRIL 7 - APRIL 12",
  "April 13: All client notes addressed + final deliver",
];

export type CutdownTimelineKind = "ogilvy" | "revise" | "dark" | "final";

export interface CutdownTimelineItem {
  id: string;
  /** ISO date (local) — start of this milestone */
  startYmd: string;
  /** ISO date inclusive; omit for single-day */
  endYmd?: string;
  dateDisplay: string;
  title: string;
  subtitle: string;
  kind: CutdownTimelineKind;
  batchLabel?: string;
  /** Batch number for roster line (1–3) */
  batchNum?: 1 | 2 | 3;
}

/** Rich rows for the cutdown schedule UI (same plan as API_CUTDOWN_SCHEDULE_LINES). */
export const API_CUTDOWN_TIMELINE: CutdownTimelineItem[] = [
  {
    id: "b1-ogilvy",
    startYmd: "2026-03-30",
    dateDisplay: "Mar 30",
    title: "Edit Batch 1 → Ogilvy",
    subtitle: "Edit Batch 1 (3-4 videos) and send to Ogilvy at EOD",
    kind: "ogilvy",
    batchLabel: "Batch 1",
    batchNum: 1,
  },
  {
    id: "b2-ogilvy",
    startYmd: "2026-03-31",
    dateDisplay: "Mar 31",
    title: "Edit Batch 2 → Ogilvy",
    subtitle: "Edit Batch 2 (3-4 videos) and send to Ogilvy at EOD",
    kind: "ogilvy",
    batchLabel: "Batch 2",
    batchNum: 2,
  },
  {
    id: "b3-ogilvy",
    startYmd: "2026-04-01",
    dateDisplay: "Apr 1",
    title: "Edit Batch 3 → Ogilvy",
    subtitle: "Edit Batch 3 (3-4 videos) and send to Ogilvy at EOD",
    kind: "ogilvy",
    batchLabel: "Batch 3",
    batchNum: 3,
  },
  {
    id: "b1-revise",
    startYmd: "2026-04-02",
    dateDisplay: "Apr 2",
    title: "Revise Batch 1 → client",
    subtitle:
      "Revise Batch 1 based on Agency notes and send to client at EOD; 48 hr review period begins",
    kind: "revise",
    batchLabel: "Batch 1",
    batchNum: 1,
  },
  {
    id: "b2-revise",
    startYmd: "2026-04-03",
    dateDisplay: "Apr 3",
    title: "Revise Batch 2 → client",
    subtitle:
      "Revise Batch 2 based on Agency notes and send to client at EOD; 48 hr review period begins",
    kind: "revise",
    batchLabel: "Batch 2",
    batchNum: 2,
  },
  {
    id: "b3-revise",
    startYmd: "2026-04-06",
    dateDisplay: "Apr 6",
    title: "Revise Batch 3 → client",
    subtitle:
      "Revise Batch 3 based on Agency notes and send to client at EOD; 48 hr review period begins",
    kind: "revise",
    batchLabel: "Batch 3",
    batchNum: 3,
  },
  {
    id: "dark",
    startYmd: "2026-04-07",
    endYmd: "2026-04-12",
    dateDisplay: "Apr 7 – 12",
    title: "DARK",
    subtitle: "DARK APRIL 7 - APRIL 12",
    kind: "dark",
  },
  {
    id: "final",
    startYmd: "2026-04-13",
    dateDisplay: "Apr 13",
    title: "Final deliver",
    subtitle: "All client notes addressed + final deliver",
    kind: "final",
  },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function isTimelineItemActive(item: CutdownTimelineItem, now = new Date()): boolean {
  const t = startOfDay(now).getTime();
  const a = startOfDay(parseYmd(item.startYmd)).getTime();
  if (t < a) {
    return false;
  }
  if (item.endYmd) {
    const end = startOfDay(parseYmd(item.endYmd)).getTime();
    return t <= end;
  }
  if (item.kind === "final") {
    return true;
  }
  return t === a;
}

export function getCutdownBatch(videoId: string): 1 | 2 | 3 {
  const row = API_CUTDOWN_DEFS.find((d) => d.id === videoId);
  return row?.batch ?? 1;
}

/**
 * Schedule-driven status (2026). Matches your calendar:
 * - **Being edited** — only on each batch’s “Edit Batch N … send to Ogilvy” day (Mar 30 / 31 / Apr 1).
 * - **With Ogilvy** — cut is with agency after that batch’s Ogilvy day until its “send to client” day.
 * - **With client** — from Apr 2 / Apr 3 / Apr 6 onward for that batch through Apr 6 (client receive + 48 hr window).
 * - **DARK** Apr 7–12, **Final deliver** Apr 13+.
 */
export function getCutdownScheduleStatus(videoId: string, now = new Date()): string {
  const batch = getCutdownBatch(videoId);
  const t = startOfDay(now).getTime();

  const D = (month: number, day: number) =>
    startOfDay(new Date(2026, month - 1, day)).getTime();

  const mar30 = D(3, 30);
  const mar31 = D(3, 31);
  const apr1 = D(4, 1);
  const apr2 = D(4, 2);
  const apr3 = D(4, 3);
  const apr5 = D(4, 5);
  const apr6 = D(4, 6);
  const apr7 = D(4, 7);
  const apr12 = D(4, 12);
  const apr13 = D(4, 13);

  if (t < mar30) {
    return "Queued";
  }

  if (t >= apr7 && t <= apr12) {
    return "DARK";
  }

  if (t >= apr13) {
    return "Final deliver";
  }

  if (batch === 1) {
    if (t === mar30) {
      return "Being edited";
    }
    if (t === mar31 || t === apr1) {
      return "With Ogilvy";
    }
    if (t >= apr2 && t <= apr6) {
      return "With client";
    }
    return "In pipeline";
  }

  if (batch === 2) {
    if (t <= mar30) {
      return "Queued";
    }
    if (t === mar31) {
      return "Being edited";
    }
    if (t === apr1 || t === apr2) {
      return "With Ogilvy";
    }
    if (t >= apr3 && t <= apr6) {
      return "With client";
    }
    return "In pipeline";
  }

  if (t <= mar31) {
    return "Queued";
  }
  if (t === apr1) {
    return "Being edited";
  }
  if (t >= apr2 && t <= apr5) {
    return "With Ogilvy";
  }
  if (t === apr6) {
    return "With client";
  }

  return "In pipeline";
}

export function buildCutdownSeedVideos(): VideoItem[] {
  return API_CUTDOWN_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    emoji: def.emoji,
    day: "—",
    time: "—",
    scheduleType: "record" as const,
    note: "API cutdown",
    links: [],
    isApproved: false,
  }));
}

export function mergeStoredCutdownVideos(stored: VideoItem[]): VideoItem[] {
  const byId = new Map(stored.map((v) => [v.id, v]));
  return API_CUTDOWN_DEFS.map((def) => {
    const existing = byId.get(def.id);
    if (existing) {
      return {
        ...existing,
        title: def.title,
        emoji: def.emoji,
      };
    }
    return {
      id: def.id,
      title: def.title,
      emoji: def.emoji,
      day: "—",
      time: "—",
      scheduleType: "record",
      note: "API cutdown",
      links: [],
      isApproved: false,
    };
  });
}

function normalizeBatchLinks(
  raw: unknown,
): Record<CutdownBatchId, ReviewLinkVersion[]> {
  const base = emptyBatchLinks();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const o = raw as Record<string, ReviewLinkVersion[]>;
  for (const id of CUTDOWN_BATCH_IDS) {
    const arr = o[id];
    base[id] = Array.isArray(arr) ? arr : [];
  }
  return base;
}

/** Merge localStorage JSON into a full cutdown workspace (spots + batch links). */
export function mergeStoredCutdownData(parsed: Partial<CutdownAppData>): CutdownAppData {
  const videos = mergeStoredCutdownVideos(parsed.videos ?? []);
  const batchLinks = normalizeBatchLinks(parsed.batchLinks);
  return {
    videos,
    contacts: [],
    batchLinks,
  };
}

export function buildCutdownSeedData(): CutdownAppData {
  return {
    videos: buildCutdownSeedVideos(),
    contacts: [],
    batchLinks: emptyBatchLinks(),
  };
}
