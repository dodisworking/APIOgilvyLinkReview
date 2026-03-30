import type { CutdownAppData, ReviewLinkVersion, VideoItem } from "@/types";

/** Draft key for the single shared batch Frame composer (see page.tsx). */
export const BATCH_FRAME_DRAFT_KEY = "batch:frame";

/** Must exist as `videos.id` in Supabase; batch column links use `review_links.video_id`. */
export const API_CUTDOWN_BATCH_VIDEO_ID = "api-cut-batch-shared";

/** Local calendar YYYY-MM-DD in the user's timezone. */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shortDayHeading(ymd: string): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  if (!y || !mo || !da) {
    return ymd;
  }
  const dt = new Date(y, mo - 1, da);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export interface BatchFramePartitions {
  todayYmd: string;
  tomorrowYmd: string;
  today: ReviewLinkVersion[];
  tomorrow: ReviewLinkVersion[];
  /** Any posting not on today or tomorrow (yesterday, day after tomorrow, etc.). */
  other: ReviewLinkVersion[];
}

const byPostedDesc = (a: ReviewLinkVersion, b: ReviewLinkVersion) =>
  new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();

/** Split shared batch links into today / tomorrow / other by local date of `postedAt`. */
export function partitionBatchFrameLinksByPostingDay(
  links: ReviewLinkVersion[],
  now = new Date(),
): BatchFramePartitions {
  const todayYmd = localYmd(now);
  const t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowYmd = localYmd(t2);

  const today: ReviewLinkVersion[] = [];
  const tomorrow: ReviewLinkVersion[] = [];
  const other: ReviewLinkVersion[] = [];

  for (const link of links) {
    const ymd = localYmd(new Date(link.postedAt));
    if (ymd === todayYmd) {
      today.push(link);
    } else if (ymd === tomorrowYmd) {
      tomorrow.push(link);
    } else {
      other.push(link);
    }
  }

  today.sort(byPostedDesc);
  tomorrow.sort(byPostedDesc);
  other.sort(byPostedDesc);

  return { todayYmd, tomorrowYmd, today, tomorrow, other };
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

function normalizeBatchFrameLinks(parsed: unknown): ReviewLinkVersion[] {
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const o = parsed as Record<string, unknown>;
  if (Array.isArray(o.batchFrameLinks)) {
    return o.batchFrameLinks as ReviewLinkVersion[];
  }
  const bl = o.batchLinks;
  if (bl && typeof bl === "object") {
    const r = bl as Record<string, ReviewLinkVersion[]>;
    return [...(r["1"] ?? []), ...(r["2"] ?? []), ...(r["3"] ?? [])];
  }
  return [];
}

/** True if this browser/workspace has anything worth keeping or uploading (links or approvals). */
export function cutdownHasUserContent(data: CutdownAppData): boolean {
  if (data.batchFrameLinks.length > 0) {
    return true;
  }
  if (data.videos.some((v) => v.links.length > 0)) {
    return true;
  }
  if (data.videos.some((v) => v.isApproved)) {
    return true;
  }
  return false;
}

/**
 * Union spot + batch links from local and remote so a slow GET cannot wipe links
 * that exist only in this browser (or only on the server).
 */
export function mergeCutdownRemoteAndLocal(
  local: CutdownAppData,
  remote: CutdownAppData,
): CutdownAppData {
  const localById = new Map(local.videos.map((v) => [v.id, v]));
  const remoteById = new Map(remote.videos.map((v) => [v.id, v]));

  const mergedVideos: VideoItem[] = API_CUTDOWN_DEFS.map((def) => {
    const lv = localById.get(def.id);
    const rv = remoteById.get(def.id);
    const base =
      lv ??
      rv ?? {
        id: def.id,
        title: def.title,
        emoji: def.emoji,
        day: "—",
        time: "—",
        scheduleType: "record" as const,
        note: "API cutdown",
        links: [],
        isApproved: false,
      };
    const linkMap = new Map<string, ReviewLinkVersion>();
    for (const l of rv?.links ?? []) {
      linkMap.set(l.id, l);
    }
    for (const l of lv?.links ?? []) {
      linkMap.set(l.id, l);
    }
    const mergedLinks = [...linkMap.values()].sort(byPostedDesc);
    return {
      ...base,
      title: def.title,
      emoji: def.emoji,
      links: mergedLinks,
      isApproved: Boolean(lv?.isApproved || rv?.isApproved),
    };
  });

  const batchMap = new Map<string, ReviewLinkVersion>();
  for (const l of remote.batchFrameLinks) {
    batchMap.set(l.id, l);
  }
  for (const l of local.batchFrameLinks) {
    batchMap.set(l.id, l);
  }
  const mergedBatch = [...batchMap.values()].sort(byPostedDesc);

  return mergeStoredCutdownData({
    videos: mergedVideos,
    batchFrameLinks: mergedBatch,
  });
}

/** Merge localStorage JSON into a full cutdown workspace (spots + batch links). */
export function mergeStoredCutdownData(parsed: Partial<CutdownAppData>): CutdownAppData {
  const videos = mergeStoredCutdownVideos(parsed.videos ?? []);
  const batchFrameLinks = normalizeBatchFrameLinks(parsed);
  return {
    videos,
    contacts: [],
    batchFrameLinks,
  };
}

export function buildCutdownSeedData(): CutdownAppData {
  return {
    videos: buildCutdownSeedVideos(),
    contacts: [],
    batchFrameLinks: [],
  };
}
