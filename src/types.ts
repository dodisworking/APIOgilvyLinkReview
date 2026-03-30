export type Role = "editor" | "client" | "ogilvy" | "admin";

export type TeamType = "editor" | "client" | "ogilvy";

export type ScheduleType = "record" | "deliver" | "review" | "go_live";
export type ManualTrackerStatus =
  | "waiting to shoot"
  | "shot"
  | "editing"
  | "waiting on approval";

export interface ReviewLinkVersion {
  id: string;
  version: string;
  frameUrl: string;
  note: string;
  customMessage: string;
  commentsDueAt?: string;
  postedBy: string;
  postedAt: string;
  /** Same id on all URLs saved together in one multi-link posting. */
  bundleId?: string;
  /** Order inside a bundle (0, 1, 2…). */
  bundleOrder?: number;
}

export interface VideoItem {
  id: string;
  title: string;
  emoji: string;
  day: string;
  time: string;
  scheduleType: ScheduleType;
  note?: string;
  goesLive?: string;
  isApproved?: boolean;
  manualStatus?: ManualTrackerStatus;
  links: ReviewLinkVersion[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  team: TeamType;
}

export interface LoginActivityEntry {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: string;
  loginCount: number;
}

export interface AppData {
  videos: VideoItem[];
  contacts: Contact[];
}

/** API cutdown workspace: spots + optional batch-level Frame links (local storage). */
export type CutdownBatchId = "1" | "2" | "3";

export interface CutdownAppData {
  videos: VideoItem[];
  contacts: Contact[];
  batchLinks: Record<CutdownBatchId, ReviewLinkVersion[]>;
}
