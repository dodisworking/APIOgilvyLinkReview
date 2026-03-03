import { seededAppData } from "@/data/seed";
import { AppData, Contact, ReviewLinkVersion, Role, TeamType, VideoItem } from "@/types";
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
    return fallbackRead();
  }

  const [videosRes, linksRes, contactsRes] = await Promise.all([
    supabase.from("videos").select("*").order("day").order("time"),
    supabase.from("review_links").select("*").order("posted_at", { ascending: false }),
    supabase.from("contacts").select("*").order("created_at"),
  ]);

  if (videosRes.error || linksRes.error || contactsRes.error) {
    return fallbackRead();
  }

  const linkMap = new Map<string, ReviewLinkVersion[]>();
  (linksRes.data as DbReviewLink[]).forEach((link) => {
    const current = linkMap.get(link.video_id) ?? [];
    current.push({
      id: link.id,
      version: link.version_label,
      frameUrl: link.frameio_url,
      note: link.notes ?? "",
      customMessage: link.custom_message ?? "",
      postedBy: link.posted_by_name,
      postedAt: link.posted_at,
    });
    linkMap.set(link.video_id, current);
  });

  const videos: VideoItem[] = (videosRes.data as DbVideo[]).map((video) => ({
    id: video.id,
    title: video.title,
    emoji: video.emoji,
    day: video.day,
    time: video.time,
    scheduleType: video.schedule_type,
    note: video.note ?? undefined,
    goesLive: video.goes_live ?? undefined,
    links: linkMap.get(video.id) ?? [],
  }));

  const contacts: Contact[] = (contactsRes.data as Contact[]) ?? [];
  const appData = { videos, contacts };
  fallbackWrite(appData);
  return appData;
};

export const saveReviewLink = async (params: {
  videoId: string;
  version: string;
  frameUrl: string;
  note: string;
  customMessage: string;
  postedBy: string;
}) => {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await supabase.from("review_links").insert({
    video_id: params.videoId,
    version_label: params.version,
    frameio_url: params.frameUrl,
    notes: params.note,
    custom_message: params.customMessage,
    posted_by_name: params.postedBy,
  });
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
