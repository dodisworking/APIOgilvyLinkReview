export type Role = "editor" | "client" | "ogilvy" | "admin";

export type TeamType = "editor" | "client" | "ogilvy";

export type ScheduleType = "record" | "deliver" | "review" | "go_live";

export interface ReviewLinkVersion {
  id: string;
  version: string;
  frameUrl: string;
  note: string;
  customMessage: string;
  postedBy: string;
  postedAt: string;
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
