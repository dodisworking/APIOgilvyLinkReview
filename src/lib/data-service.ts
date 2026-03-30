import { seededAppData } from "@/data/seed";
import {
  AppData,
  Contact,
  ManualTrackerStatus,
  ReviewLinkVersion,
  Role,
  TeamType,
  VideoItem,
} from "@/types";
import { loadAppData, saveAppData } from "@/lib/storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface DbVideo {
  id: string;
  title: string;
  emoji: string;
  day: string;
  time: string;
  schedule_type: VideoItem["scheduleType"];
  note: string | null;
  goes_live: string | null;
  is_approved: boolean | null;
  manual_status: ManualTrackerStatus | null;
}

interface DbReviewLink {
  id: string;
  video_id: string;
  version_label: string;
  frameio_url: string;
  notes: string | null;
  custom_message: string | null;
  posted_by_name: string;
  posted_at: string;
}

const fallbackRead = (): AppData => loadAppData();

const fallbackWrite = (data: AppData) => saveAppData(data);

const DUE_TAG_REGEX = /^\[\[DUE:([^\]]+)\]\]\s*/;
const VIDEO_OVERRIDES: Record<string, Partial<Pick<VideoItem, "title" | "emoji">>> = {
  "pulse-check-pt1-record": { emoji: "🫀" },
  "ahead-of-curve-1-record": { title: "Ahead of the Curve Part 1" },
  "ahead-of-curve-2-record": { title: "Ahead of the Curve Part 2", emoji: "📈" },
  "pop-up-city-1-deliver": { title: "The Pop Up City Part 1" },
  "pop-up-city-2-deliver": { title: "The Pop Up City Part 2" },
};

const splitDueFromNotes = (notes: string | null): { note: string; commentsDueAt?: string } => {
  const raw = notes ?? "";
  const match = raw.match(DUE_TAG_REGEX);
  if (!match) {
    return { note: raw };
  }
  return {
    commentsDueAt: match[1],
    note: raw.replace(DUE_TAG_REGEX, "").trim(),
  };
};

const combineDueAndNotes = (note: string, commentsDueAt?: string): string => {
  const cleanNote = note.trim();
  if (!commentsDueAt) {
    return cleanNote;
  }
  return `[[DUE:${commentsDueAt}]] ${cleanNote}`.trim();
};

const getVideoOverride = (video: VideoItem): Partial<Pick<VideoItem, "title" | "emoji">> => {
  const exact = VIDEO_OVERRIDES[video.id];
  if (exact) {
    return exact;
  }

  const key = `${video.id} ${video.title}`.toLowerCase();
  const byPattern: Partial<Pick<VideoItem, "title" | "emoji">> = {};

  if (key.includes("pulse-check-pt1") || key.includes("pulse check pt 1")) {
    byPattern.emoji = "🫀";
  }

  if (key.includes("ahead-of-curve-2") || key.includes("ahead of the curve 2")) {
    byPattern.emoji = "📈";
  }

  return byPattern;
};

const applyVideoOverrides = (data: AppData): { data: AppData; changed: boolean } => {
  let changed = false;
  const videos = data.videos.map((video) => {
    const override = getVideoOverride(video);
    if (!override.title && !override.emoji) {
      return video;
    }
    const next = {
      ...video,
      title: override.title ?? video.title,
      emoji: override.emoji ?? video.emoji,
    };
    if (next.title !== video.title || next.emoji !== video.emoji) {
      changed = true;
    }
    return next;
  });
  return { data: { ...data, videos }, changed };
};

export const seedLocalStorageIfMissing = () => {
  const local = loadAppData();
  if (!local.videos.length) {
    saveAppData(seededAppData);
  }
};

export const loadRoleFromProfile = async (
  userId: string,
): Promise<Role | null> => {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !data?.role) {
    return null;
  }
  return data.role as Role;
};

export const fetchAppData = async (): Promise<AppData> => {
  if (!isSupabaseConfigured || !supabase) {
    const localData = fallbackRead();
    const normalized = applyVideoOverrides(localData);
    const withoutCutdowns = {
      ...normalized.data,
      videos: normalized.data.videos.filter((v) => !v.id.startsWith("api-cut-")),
    };
    if (normalized.changed || withoutCutdowns.videos.length !== normalized.data.videos.length) {
      fallbackWrite(withoutCutdowns);
    }
    return withoutCutdowns;
  }

  const [videosRes, linksRes, contactsRes] = await Promise.all([
    supabase.from("videos").select("*").order("day").order("time"),
    supabase.from("review_links").select("*").order("posted_at", { ascending: false }),
    supabase.from("contacts").select("*").order("created_at"),
  ]);

  if (videosRes.error || linksRes.error || contactsRes.error) {
    const localData = fallbackRead();
    const normalized = applyVideoOverrides(localData);
    const withoutCutdowns = {
      ...normalized.data,
      videos: normalized.data.videos.filter((v) => !v.id.startsWith("api-cut-")),
    };
    if (normalized.changed || withoutCutdowns.videos.length !== normalized.data.videos.length) {
      fallbackWrite(withoutCutdowns);
    }
    return withoutCutdowns;
  }

  const linkMap = new Map<string, ReviewLinkVersion[]>();
  (linksRes.data as DbReviewLink[]).forEach((link) => {
    const { note, commentsDueAt } = splitDueFromNotes(link.notes);
    const current = linkMap.get(link.video_id) ?? [];
    current.push({
      id: link.id,
      version: link.version_label,
      frameUrl: link.frameio_url,
      note,
      customMessage: link.custom_message ?? "",
      commentsDueAt,
      postedBy: link.posted_by_name,
      postedAt: link.posted_at,
    });
    linkMap.set(link.video_id, current);
  });

  const videos: VideoItem[] = (videosRes.data as DbVideo[])
    .filter((video) => !video.id.startsWith("api-cut-"))
    .map((video) => ({
      id: video.id,
      title: video.title,
      emoji: video.emoji,
      day: video.day,
      time: video.time,
      scheduleType: video.schedule_type,
      note: video.note ?? undefined,
      goesLive: video.goes_live ?? undefined,
      isApproved: Boolean(video.is_approved),
      manualStatus: video.manual_status ?? undefined,
      links: linkMap.get(video.id) ?? [],
    }));

  const contacts: Contact[] = (contactsRes.data as Contact[]) ?? [];
  const normalized = applyVideoOverrides({ videos, contacts });
  fallbackWrite(normalized.data);
  return normalized.data;
};

export const saveReviewLink = async (params: {
  videoId: string;
  version: string;
  frameUrl: string;
  note: string;
  customMessage: string;
  commentsDueAt?: string;
  postedBy: string;
}) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await supabase.from("review_links").insert({
    video_id: params.videoId,
    version_label: params.version,
    frameio_url: params.frameUrl,
    notes: combineDueAndNotes(params.note, params.commentsDueAt),
    custom_message: params.customMessage,
    posted_by_name: params.postedBy,
  });
};

export const updateReviewLinkRecord = async (params: {
  linkId: string;
  version: string;
  frameUrl: string;
  note: string;
  customMessage: string;
  commentsDueAt?: string;
}) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase
    .from("review_links")
    .update({
      version_label: params.version,
      frameio_url: params.frameUrl,
      notes: combineDueAndNotes(params.note, params.commentsDueAt),
      custom_message: params.customMessage,
    })
    .eq("id", params.linkId);
};

export const deleteReviewLinkRecord = async (linkId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase.from("review_links").delete().eq("id", linkId);
};

export const addContactRecord = async (contact: Contact) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase.from("contacts").insert({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    team: contact.team,
  });
};

export const removeContactRecord = async (contactId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase.from("contacts").delete().eq("id", contactId);
};

export const saveNotificationLog = async (params: {
  videoId: string;
  version: string;
  recipients: string[];
  teams: TeamType[];
  subject: string;
  message: string;
}) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase.from("notification_logs").insert({
    video_id: params.videoId,
    recipient_emails: params.recipients,
    target_teams: params.teams,
    subject: `${params.subject} (${params.version})`,
    message: params.message,
  });
};

export const updateVideoRecord = async (
  videoId: string,
  updates: Partial<Pick<VideoItem, "day" | "time" | "note" | "goesLive">>,
) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase
    .from("videos")
    .update({
      day: updates.day,
      time: updates.time,
      note: updates.note,
      goes_live: updates.goesLive,
    })
    .eq("id", videoId);
};

export const updateVideoWorkflowState = async (params: {
  videoId: string;
  isApproved?: boolean;
  manualStatus?: ManualTrackerStatus | null;
}) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  await supabase
    .from("videos")
    .update({
      is_approved: params.isApproved,
      manual_status: params.manualStatus ?? null,
    })
    .eq("id", params.videoId);
};
