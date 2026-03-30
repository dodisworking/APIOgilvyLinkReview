"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  addContactRecord,
  deleteReviewLinkRecord,
  fetchAppData,
  removeContactRecord,
  saveNotificationLog,
  saveReviewLink,
  seedLocalStorageIfMissing,
  updateVideoWorkflowState,
  updateReviewLinkRecord,
} from "@/lib/data-service";
import { ApiCutdownsView } from "@/components/ApiCutdownsView";
import { LinkComposerForm } from "@/components/LinkComposerForm";
import { BATCH_FRAME_DRAFT_KEY } from "@/lib/api-cutdowns";
import {
  emptyComposerDraft,
  getNextBatchPostingVersionLabel,
  getNextPostingVersionLabel,
  groupLinksIntoBundles,
  normalizeComposerDraft,
  type LinkComposerDraft,
} from "@/lib/link-bundles";
import {
  fetchCutdownRemotePayload,
  isCutdownRemoteWriteConfigured,
  pushCutdownRemote,
} from "@/lib/cutdown-remote";
import { loadCutdownAppData, saveCutdownAppData } from "@/lib/cutdown-storage";
import { saveAppData } from "@/lib/storage";
import {
  AppData,
  Contact,
  CutdownAppData,
  ManualTrackerStatus,
  VideoItem,
} from "@/types";

const dayOrder = [
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const videoOrderById = [
  "on-the-back-nine",
  "behind-the-business",
  "pulse-check-pt1",
  "ahead-of-curve-1",
  "course-management-for-business",
  "ahead-of-curve-2",
  "pulse-check-pt2",
  "pop-up-city-1",
  "pop-up-city-2",
  "unlocked-power-partnership",
  "executive-advantage",
];

const ownerByVideoId: Record<string, "IZZY" | "MAX"> = {
  "on-the-back-nine-review": "IZZY",
  "on-the-back-nine-record": "IZZY",
  "behind-the-business-review": "MAX",
  "behind-the-business-record": "MAX",
  "pulse-check-pt1-record": "IZZY",
  "ahead-of-curve-1-review": "IZZY",
  "ahead-of-curve-1-record": "IZZY",
  "course-management-business-review": "MAX",
  "course-management-business-record": "MAX",
  "ahead-of-curve-2-review": "IZZY",
  "ahead-of-curve-2-record": "IZZY",
  "pulse-check-pt2-review": "IZZY",
  "pulse-check-pt2-deliver": "IZZY",
  "pop-up-city-1-review": "MAX",
  "pop-up-city-1-deliver": "MAX",
  "pop-up-city-2-review": "IZZY",
  "pop-up-city-2-deliver": "IZZY",
  "unlocked-power-partnership": "IZZY",
  "executive-advantage": "MAX",
};

const getOwnerName = (video: VideoItem): "IZZY" | "MAX" | null => {
  if (ownerByVideoId[video.id]) {
    return ownerByVideoId[video.id];
  }

  const id = video.id.toLowerCase();
  const title = video.title.toLowerCase();
  const key = `${id} ${title}`;

  if (
    key.includes("on-the-back-nine") ||
    key.includes("on the back nine") ||
    key.includes("pulse-check") ||
    key.includes("pulse check") ||
    key.includes("ahead-of-curve") ||
    key.includes("ahead of the curve") ||
    key.includes("pop-up-city-2") ||
    key.includes("pop up city part 2") ||
    key.includes("unlocked-power-partnership") ||
    key.includes("unlocked the power of partnership")
  ) {
    return "IZZY";
  }

  if (
    key.includes("behind-the-business") ||
    key.includes("behind the business") ||
    key.includes("course-management") ||
    key.includes("course management") ||
    key.includes("pop-up-city-1") ||
    key.includes("pop up city part 1") ||
    key.includes("executive-advantage") ||
    key.includes("executive advantage")
  ) {
    return "MAX";
  }

  return null;
};

interface NotifyPayload {
  recipients: string[];
  subject: string;
  videoTitle: string;
  frameUrl: string;
  videoId?: string;
  allLinksUrl?: string;
  version: string;
  customMessage: string;
  commentsDueAt?: string;
  postedBy: string;
}

type TrackerStatus = ManualTrackerStatus | "approved";
type AppPanel = "status" | "schedule" | "links" | null;

const STATUS_OVERRIDE_KEY = "production-review-status-overrides-v1";
const APPROVALS_KEY = "production-review-approvals-v1";
type HubMode = "live" | "cutdowns";
const HUB_MODE_KEY = "production-review-hub-mode-v1";

const weekdayToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const sendEmailBlast = async (payload: NotifyPayload) => {
  const response = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "Failed to send email.");
  }
};

export default function Home() {
  const adminPassword = "123";
  const [entered, setEntered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState("");
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [newContact, setNewContact] = useState<{
    name: string;
    email: string;
  }>({
    name: "",
    email: "",
  });

  const [drafts, setDrafts] = useState<Record<string, LinkComposerDraft>>({});

  const [adminBlastVideoId, setAdminBlastVideoId] = useState("");
  const [adminBlastLinkId, setAdminBlastLinkId] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [adminBlastSubject, setAdminBlastSubject] = useState("");
  const [adminBlastMessage, setAdminBlastMessage] = useState(
    "Please review as soon as possible.",
  );
  const [adminReminderDueAt, setAdminReminderDueAt] = useState("");

  const [busyVideoId, setBusyVideoId] = useState("");
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const [openComposerVideoId, setOpenComposerVideoId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<AppPanel>(null);
  const [hubMode, setHubMode] = useState<HubMode>("live");
  const [cutdownData, setCutdownData] = useState<CutdownAppData | null>(null);
  const [openBatchFrameComposer, setOpenBatchFrameComposer] = useState(false);
  const [cutdownPushBusy, setCutdownPushBusy] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ManualTrackerStatus>>(
    {},
  );
  const [approvedByVideoId, setApprovedByVideoId] = useState<Record<string, boolean>>({});
  const [expandedHistoryByVideo, setExpandedHistoryByVideo] = useState<
    Record<string, boolean>
  >({});
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [postDistributionPrompt, setPostDistributionPrompt] = useState<{
    videoId: string;
    videoTitle: string;
    linkId: string;
    version: string;
    frameUrl: string;
    commentsDueAt?: string;
  } | null>(null);
  const [postSelectedRecipientIds, setPostSelectedRecipientIds] = useState<string[]>(
    [],
  );
  const [postDistributionSubject, setPostDistributionSubject] = useState("");
  const [postDistributionMessage, setPostDistributionMessage] = useState(
    "Hey team, we have a new posting. Please review and share feedback by the requested deadline.",
  );
  const [aiMessageBusy, setAiMessageBusy] = useState(false);
  const teamNameInputRef = useRef<HTMLInputElement | null>(null);
  const [editLinkDraft, setEditLinkDraft] = useState({
    version: "",
    frameUrl: "",
    note: "",
    customMessage: "",
    commentsDueAt: "",
  });

  useEffect(() => {
    seedLocalStorageIfMissing();
    fetchAppData().then((appData) => setData(appData));
  }, []);

  const cutdownSyncQuietUntil = useRef(0);

  useEffect(() => {
    const local = loadCutdownAppData();
    setCutdownData(local);
    let cancelled = false;
    void (async () => {
      try {
        const remote = await fetchCutdownRemotePayload();
        if (cancelled || !remote) {
          return;
        }
        cutdownSyncQuietUntil.current = Date.now() + 2000;
        setCutdownData(remote);
      } catch {
        /* keep local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cutdownData) {
      return;
    }
    saveCutdownAppData(cutdownData);
    if (Date.now() < cutdownSyncQuietUntil.current) {
      return;
    }
    const t = setTimeout(() => {
      void pushCutdownRemote(cutdownData);
    }, 600);
    return () => clearTimeout(t);
  }, [cutdownData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(HUB_MODE_KEY);
    if (raw === "live" || raw === "cutdowns") {
      setHubMode(raw);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HUB_MODE_KEY, hubMode);
  }, [hubMode]);

  useEffect(() => {
    if (data) {
      saveAppData(data);
      const allIds = data.contacts.map((contact) => contact.id);
      setSelectedRecipientIds((current) =>
        current.length > 0 ? current.filter((id) => allIds.includes(id)) : allIds,
      );
      const nextApprovals = Object.fromEntries(
        data.videos.map((video) => [video.id, Boolean(video.isApproved)]),
      ) as Record<string, boolean>;
      const nextManualStatuses = Object.fromEntries(
        data.videos
          .filter((video) => Boolean(video.manualStatus))
          .map((video) => [video.id, video.manualStatus as ManualTrackerStatus]),
      ) as Record<string, ManualTrackerStatus>;
      setApprovedByVideoId(nextApprovals);
      setStatusOverrides(nextManualStatuses);
    }
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(STATUS_OVERRIDE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const migrated = Object.fromEntries(
        Object.entries(parsed).map(([videoId, value]) => [
          videoId,
          value === "hasnt shot yet" ? "waiting to shoot" : value,
        ]),
      ) as Record<string, ManualTrackerStatus>;
      setStatusOverrides(migrated);
    } catch {
      setStatusOverrides({});
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STATUS_OVERRIDE_KEY, JSON.stringify(statusOverrides));
  }, [statusOverrides]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(APPROVALS_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setApprovedByVideoId(parsed);
    } catch {
      setApprovedByVideoId({});
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvedByVideoId));
  }, [approvedByVideoId]);

  const groupedSchedule = useMemo(() => {
    if (!data) {
      return { days: [], groups: {} as Record<string, VideoItem[]> };
    }

    const groups: Record<string, VideoItem[]> = {};
    const videosToShow = data.videos;

    for (const video of videosToShow) {
      const shootDay = video.day || "Unscheduled";
      if (!groups[shootDay]) {
        groups[shootDay] = [];
      }
      groups[shootDay].push(video);
    }

    const days = Object.keys(groups).sort((a, b) => {
      const aIndex = dayOrder.includes(a) ? dayOrder.indexOf(a) : 999;
      const bIndex = dayOrder.includes(b) ? dayOrder.indexOf(b) : 999;
      return aIndex - bIndex;
    });

    for (const day of days) {
      groups[day].sort((a, b) => {
        const aIndex = videoOrderById.indexOf(a.id);
        const bIndex = videoOrderById.indexOf(b.id);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }

    return { days, groups };
  }, [data]);

  const selectedBlastVideo =
    data?.videos.find((item) => item.id === adminBlastVideoId) ?? null;
  const selectedBlastLink =
    selectedBlastVideo?.links.find((item) => item.id === adminBlastLinkId) ??
    selectedBlastVideo?.links[0] ??
    null;
  const formatDue = (value?: string) =>
    value
      ? Number.isNaN(new Date(value).getTime())
        ? value
        : new Date(value).toLocaleString()
      : "Not set";
  const formatPosted = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const getDeliverLabel = (video: VideoItem) => {
    if (video.goesLive) {
      return video.goesLive;
    }
    const note = video.note ?? "";
    const match = note.match(/deliver(?:s| by)?\s+([^.,]+)/i);
    if (!match) {
      return "TBD";
    }
    const normalized = match[1].trim().replace(/^by\s+/i, "");
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };
  const parseTime = (value: string): { hour: number; minute: number } | null => {
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return null;
    }
    const rawHour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    let hour = rawHour % 12;
    if (period === "PM") {
      hour += 12;
    }
    return { hour, minute };
  };
  const getWeekStartMonday = (date: Date) => {
    const copy = new Date(date);
    const shift = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - shift);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const getShootDateTime = (video: VideoItem, now: Date) => {
    const dayIndex = weekdayToIndex[video.day.toLowerCase()];
    if (dayIndex === undefined) {
      return null;
    }
    const weekStart = getWeekStartMonday(now);
    const mondayBasedIndex = (dayIndex + 6) % 7;
    const shootDate = new Date(weekStart);
    shootDate.setDate(weekStart.getDate() + mondayBasedIndex);

    const parsedTime = parseTime(video.time);
    if (parsedTime) {
      shootDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    } else {
      shootDate.setHours(23, 59, 59, 999);
    }
    return shootDate;
  };
  const isDueToday = (video: VideoItem, now: Date) => {
    const todayFull = now.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
    const todayShort = now.toLocaleDateString(undefined, { weekday: "short" }).toLowerCase();
    return video.links.some((link) => {
      const due = link.commentsDueAt?.trim();
      if (!due) {
        return false;
      }
      const parsed = new Date(due);
      if (!Number.isNaN(parsed.getTime())) {
        return (
          parsed.getFullYear() === now.getFullYear() &&
          parsed.getMonth() === now.getMonth() &&
          parsed.getDate() === now.getDate()
        );
      }
      const normalized = due.toLowerCase();
      return normalized.includes(todayFull) || normalized.includes(todayShort);
    });
  };
  const getAutoTrackerStatus = (video: VideoItem): TrackerStatus => {
    const now = new Date();
    const shootAt = getShootDateTime(video, now);

    if (!shootAt || now < shootAt) {
      return "waiting to shoot";
    }

    if (video.links.length > 0 || isDueToday(video, now)) {
      return "editing";
    }

    const note = (video.note ?? "").toLowerCase();
    const mentionsNextDelivery =
      note.includes("deliver next") || note.includes("delivers next");
    if (mentionsNextDelivery) {
      const mondayAfterShoot = getWeekStartMonday(shootAt);
      mondayAfterShoot.setDate(mondayAfterShoot.getDate() + 7);
      if (now >= mondayAfterShoot) {
        return "editing";
      }
    }

    return "shot";
  };
  const getTrackerStatus = (video: VideoItem): TrackerStatus => {
    if (statusOverrides[video.id]) {
      return statusOverrides[video.id];
    }
    if (approvedByVideoId[video.id]) {
      return "approved";
    }
    return getAutoTrackerStatus(video);
  };
  const getCutdownBadgeClass = (label: string) => {
    const lower = label.toLowerCase();
    if (label === "approved") {
      return "bg-emerald-700/40 border border-emerald-300 text-emerald-100";
    }
    if (lower.includes("dark")) {
      return "bg-zinc-800/50 border border-zinc-500 text-zinc-100";
    }
    if (lower.includes("final deliver")) {
      return "bg-teal-800/45 border border-teal-300 text-teal-100";
    }
    if (lower.includes("queued")) {
      return "bg-slate-700/45 border border-slate-500 text-slate-200";
    }
    if (lower.includes("being edited")) {
      return "bg-amber-700/40 border border-amber-300 text-amber-100";
    }
    if (lower.includes("with client")) {
      return "bg-indigo-800/40 border border-indigo-300 text-indigo-100";
    }
    if (lower.includes("with ogilvy")) {
      return "bg-sky-900/45 border border-sky-400/50 text-sky-100";
    }
    return "bg-orange-900/35 border border-orange-500/60 text-orange-100";
  };

  const getStatusBadgeClass = (statusValue: TrackerStatus) => {
    if (statusValue === "approved") {
      return "bg-emerald-700/40 border border-emerald-300 text-emerald-100";
    }
    if (statusValue === "waiting on approval") {
      return "bg-indigo-700/35 border border-indigo-300 text-indigo-100";
    }
    if (statusValue === "editing") {
      return "bg-amber-600/30 border border-amber-400 text-amber-200";
    }
    if (statusValue === "shot") {
      return "bg-blue-700/35 border border-blue-300 text-blue-100";
    }
    return "bg-slate-700/40 border border-slate-500 text-slate-200";
  };
  const setManualStatus = async (videoId: string, value: string) => {
    if (value === "approved") {
      setData((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          videos: current.videos.map((video) =>
            video.id === videoId
              ? { ...video, isApproved: true, manualStatus: undefined }
              : video,
          ),
        };
      });
      setApprovedByVideoId((current) => ({ ...current, [videoId]: true }));
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[videoId];
        return next;
      });
      try {
        await updateVideoWorkflowState({
          videoId,
          isApproved: true,
          manualStatus: null,
        });
      } catch {
        setStatus("Could not save approval to Supabase. Run the SQL migration first.");
      }
      return;
    }
    if (value === "auto") {
      setData((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          videos: current.videos.map((video) =>
            video.id === videoId ? { ...video, manualStatus: undefined } : video,
          ),
        };
      });
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[videoId];
        return next;
      });
      try {
        await updateVideoWorkflowState({ videoId, manualStatus: null });
      } catch {
        setStatus("Could not save manual status to Supabase. Run the SQL migration first.");
      }
      return;
    }
    const castValue = value as ManualTrackerStatus;
    setData((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        videos: current.videos.map((video) =>
          video.id === videoId
            ? { ...video, isApproved: false, manualStatus: castValue }
            : video,
        ),
      };
    });
    setApprovedByVideoId((current) => ({ ...current, [videoId]: false }));
    setStatusOverrides((current) => ({ ...current, [videoId]: castValue }));
    try {
      await updateVideoWorkflowState({
        videoId,
        isApproved: false,
        manualStatus: castValue,
      });
    } catch {
      setStatus("Could not save manual status to Supabase. Run the SQL migration first.");
    }
  };
  const toggleApproved = async (videoId: string) => {
    const currentApproved = Boolean(approvedByVideoId[videoId]);
    const nextApproved = !currentApproved;
    setData((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        videos: current.videos.map((video) =>
          video.id === videoId ? { ...video, isApproved: nextApproved } : video,
        ),
      };
    });
    setApprovedByVideoId((current) => ({ ...current, [videoId]: nextApproved }));
    try {
      await updateVideoWorkflowState({ videoId, isApproved: nextApproved });
    } catch {
      setStatus("Could not save approval to Supabase. Run the SQL migration first.");
    }
  };

  const setCutdownApprovedState = (videoId: string, value: "approved" | "auto") => {
    if (!cutdownData) {
      return;
    }
    const approved = value === "approved";
    setCutdownData({
      ...cutdownData,
      videos: cutdownData.videos.map((video) =>
        video.id === videoId
          ? { ...video, isApproved: approved, manualStatus: undefined }
          : video,
      ),
    });
  };

  const toggleCutdownApproved = (videoId: string) => {
    if (!cutdownData) {
      return;
    }
    const current =
      cutdownData.videos.find((video) => video.id === videoId)?.isApproved ?? false;
    setCutdownData({
      ...cutdownData,
      videos: cutdownData.videos.map((video) =>
        video.id === videoId ? { ...video, isApproved: !current } : video,
      ),
    });
  };
  const isRecentLink = (postedAt: string) =>
    Date.now() - new Date(postedAt).getTime() <= 1000 * 60 * 60 * 24;
  const togglePanel = (panel: Exclude<AppPanel, null>) => {
    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }
    setActivePanel(panel);
  };

  const handleAdminAccess = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setShowAdminPrompt(false);
      setAdminPasswordInput("");
      setStatus("Admin mode disabled.");
      return;
    }
    setAdminPasswordInput("");
    setShowAdminPrompt(true);
  };

  const jumpToTeamRoster = () => {
    if (!isAdmin || hubMode !== "live") {
      return;
    }
    setActivePanel("links");
    const rosterSection = document.getElementById("team-roster-section");
    rosterSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      teamNameInputRef.current?.focus();
    }, 350);
  };

  const submitAdminPassword = () => {
    if (adminPasswordInput.trim() === adminPassword) {
      setIsAdmin(true);
      setShowAdminPrompt(false);
      setAdminPasswordInput("");
      setStatus("Admin mode enabled.");
      return;
    }
    setStatus("Wrong admin password.");
  };

  useEffect(() => {
    if (selectedBlastVideo && selectedBlastLink) {
      setAdminBlastSubject(
        `${selectedBlastVideo.title} - ${selectedBlastLink.version} Ready for Review`,
      );
    }
  }, [selectedBlastVideo, selectedBlastLink]);

  const postLink = async (video: VideoItem) => {
    const draft = normalizeComposerDraft(drafts[video.id]);

    const buildMultiLinks = (
      links: VideoItem["links"],
      filled: { frameUrl: string; note: string }[],
      useBatchLabel: boolean,
    ) => {
      const bundleId = crypto.randomUUID();
      const postedAt = new Date().toISOString();
      const parentVersion = useBatchLabel
        ? getNextBatchPostingVersionLabel(links)
        : getNextPostingVersionLabel(links);
      return filled.map((slot, i) => ({
        id: crypto.randomUUID(),
        version: `${parentVersion} · ${i + 1}/${filled.length}`,
        frameUrl: slot.frameUrl.trim(),
        note: slot.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: "Admin",
        postedAt,
        bundleId,
        bundleOrder: i,
      }));
    };

    if (video.id.startsWith("api-cut-")) {
      if (!cutdownData) {
        return;
      }

      if (draft.multiMode) {
        const filled = draft.slots
          .slice(0, draft.slotCount)
          .filter((s) => s.frameUrl.trim());
        if (filled.length < 2) {
          setStatus("Multi-link posting needs at least 2 Frame URLs.");
          return;
        }
        setBusyVideoId(video.id);
        setSavedVideoId(null);
        setStatus("");
        const newLinks = buildMultiLinks(video.links, filled, false);
        const updatedVideos = cutdownData.videos.map((item) =>
          item.id !== video.id
            ? item
            : { ...item, links: [...newLinks, ...item.links] },
        );
        const nextData = { ...cutdownData, videos: updatedVideos };
        setCutdownData(nextData);
        saveCutdownAppData(nextData);
        setStatus(`Posted ${newLinks.length} links for ${video.title}.`);
        setSavedVideoId(video.id);
        setDrafts((c) => ({ ...c, [video.id]: emptyComposerDraft() }));
        setBusyVideoId("");
        setTimeout(() => {
          setSavedVideoId((current) => (current === video.id ? null : current));
        }, 2000);
        return;
      }

      if (!draft.frameUrl.trim()) {
        setStatus("Frame.io link is required.");
        return;
      }

      setBusyVideoId(video.id);
      setSavedVideoId(null);
      setStatus("");
      const autoVersion = getNextPostingVersionLabel(video.links);
      const postedAt = new Date().toISOString();
      const newLink = {
        id: crypto.randomUUID(),
        version: autoVersion,
        frameUrl: draft.frameUrl.trim(),
        note: draft.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: "Admin",
        postedAt,
      };

      const updatedVideos = cutdownData.videos.map((item) => {
        if (item.id !== video.id) {
          return item;
        }
        return {
          ...item,
          links: [newLink, ...item.links],
        };
      });

      const nextData = { ...cutdownData, videos: updatedVideos };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);
      setStatus(`Posted ${autoVersion} for ${video.title}.`);
      setSavedVideoId(video.id);
      setDrafts((c) => ({ ...c, [video.id]: emptyComposerDraft() }));
      setBusyVideoId("");
      setTimeout(() => {
        setSavedVideoId((current) => (current === video.id ? null : current));
      }, 2000);
      return;
    }

    if (!data) {
      return;
    }

    if (draft.multiMode) {
      const filled = draft.slots
        .slice(0, draft.slotCount)
        .filter((s) => s.frameUrl.trim());
      if (filled.length < 2) {
        setStatus("Multi-link posting needs at least 2 Frame URLs.");
        return;
      }
      setBusyVideoId(video.id);
      setSavedVideoId(null);
      setStatus("");
      const newLinks = buildMultiLinks(video.links, filled, false);
      const updatedVideos = data.videos.map((item) =>
        item.id !== video.id ? item : { ...item, links: [...newLinks, ...item.links] },
      );
      const nextData = { ...data, videos: updatedVideos };
      setData(nextData);
      saveAppData(nextData);

      try {
        for (let i = 0; i < newLinks.length; i += 1) {
          const nl = newLinks[i];
          await saveReviewLink({
            videoId: video.id,
            version: nl.version,
            frameUrl: nl.frameUrl,
            note: nl.note,
            customMessage: nl.customMessage,
            commentsDueAt: nl.commentsDueAt,
            postedBy: "Admin",
            bundleId: nl.bundleId,
            bundleOrder: nl.bundleOrder,
          });
        }
        const parentLabel = newLinks[0].version.replace(/\s·\s\d+\/\d+$/, "");
        setStatus(`Posted ${newLinks.length} links for ${video.title}.`);
        setSavedVideoId(video.id);
        setDrafts((c) => ({ ...c, [video.id]: emptyComposerDraft() }));
        setPostDistributionPrompt({
          videoId: video.id,
          videoTitle: video.title,
          linkId: newLinks[0].id,
          version: `${parentLabel} (${newLinks.length} links)`,
          frameUrl: newLinks[0].frameUrl,
          commentsDueAt: newLinks[0].commentsDueAt,
        });
        setPostDistributionSubject(`${video.title} — ${newLinks.length} review links ready`);
        setPostSelectedRecipientIds(data.contacts.map((contact) => contact.id));
        setPostDistributionMessage(
          `Hey team, ${newLinks.length} Frame links for ${video.title} (${parentLabel}) are ready. Primary: ${newLinks[0].frameUrl}. Feedback by ${formatDue(newLinks[0].commentsDueAt)}.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save link.";
        setStatus(`Link save failed: ${message}`);
      } finally {
        setBusyVideoId("");
        setTimeout(() => {
          setSavedVideoId((current) => (current === video.id ? null : current));
        }, 2000);
      }
      return;
    }

    if (!draft.frameUrl.trim()) {
      setStatus("Frame.io link is required.");
      return;
    }

    setBusyVideoId(video.id);
    setSavedVideoId(null);
    setStatus("");
    const autoVersion = getNextPostingVersionLabel(video.links);
    const postedAt = new Date().toISOString();
    const newLink = {
      id: crypto.randomUUID(),
      version: autoVersion,
      frameUrl: draft.frameUrl.trim(),
      note: draft.note,
      customMessage: draft.customMessage,
      commentsDueAt: draft.commentsDueAt || undefined,
      postedBy: "Admin",
      postedAt,
    };

    const updatedVideos = data.videos.map((item) => {
      if (item.id !== video.id) {
        return item;
      }
      return {
        ...item,
        links: [newLink, ...item.links],
      };
    });

    const nextData = { ...data, videos: updatedVideos };
    setData(nextData);
    saveAppData(nextData);

    try {
      await saveReviewLink({
        videoId: video.id,
        version: autoVersion,
        frameUrl: draft.frameUrl.trim(),
        note: draft.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: "Admin",
      });

      setStatus(`Posted ${autoVersion} for ${video.title}.`);
      setSavedVideoId(video.id);
      setDrafts((c) => ({ ...c, [video.id]: emptyComposerDraft() }));
      setPostDistributionPrompt({
        videoId: video.id,
        videoTitle: video.title,
        linkId: newLink.id,
        version: newLink.version,
        frameUrl: newLink.frameUrl,
        commentsDueAt: newLink.commentsDueAt,
      });
      setPostDistributionSubject(`${video.title} - ${newLink.version} Ready for Review`);
      setPostSelectedRecipientIds(data.contacts.map((contact) => contact.id));
      setPostDistributionMessage(
        `Hey team, we have a new posting for ${video.title} (${newLink.version}). Please share feedback by ${formatDue(newLink.commentsDueAt)}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save link.";
      setStatus(`Link save failed: ${message}`);
    } finally {
      setBusyVideoId("");
      setTimeout(() => {
        setSavedVideoId((current) => (current === video.id ? null : current));
      }, 2000);
    }
  };

  const startEditingLink = (link: VideoItem["links"][number]) => {
    setEditingLinkId(link.id);
    setEditLinkDraft({
      version: link.version,
      frameUrl: link.frameUrl,
      note: link.note,
      customMessage: link.customMessage,
      commentsDueAt: link.commentsDueAt ?? "",
    });
  };

  const cancelEditingLink = () => {
    setEditingLinkId(null);
    setEditLinkDraft({
      version: "",
      frameUrl: "",
      note: "",
      customMessage: "",
      commentsDueAt: "",
    });
  };

  const saveEditedLink = async (video: VideoItem, linkId: string) => {
    if (video.id.startsWith("api-cut-")) {
      if (!cutdownData) {
        return;
      }
      if (!editLinkDraft.version.trim() || !editLinkDraft.frameUrl.trim()) {
        setStatus("Version and Frame.io link are required.");
        return;
      }

      const nextVideos = cutdownData.videos.map((item) => {
        if (item.id !== video.id) {
          return item;
        }
        return {
          ...item,
          links: item.links.map((link) =>
            link.id === linkId
              ? {
                  ...link,
                  version: editLinkDraft.version.trim(),
                  frameUrl: editLinkDraft.frameUrl.trim(),
                  note: editLinkDraft.note,
                  customMessage: editLinkDraft.customMessage,
                  commentsDueAt: editLinkDraft.commentsDueAt || undefined,
                }
              : link,
          ),
        };
      });

      const nextData = { ...cutdownData, videos: nextVideos };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);
      setStatus("Link updated.");
      cancelEditingLink();
      return;
    }

    if (!data) {
      return;
    }
    if (!editLinkDraft.version.trim() || !editLinkDraft.frameUrl.trim()) {
      setStatus("Version and Frame.io link are required.");
      return;
    }

    const nextVideos = data.videos.map((item) => {
      if (item.id !== video.id) {
        return item;
      }
      return {
        ...item,
        links: item.links.map((link) =>
          link.id === linkId
            ? {
                ...link,
                version: editLinkDraft.version.trim(),
                frameUrl: editLinkDraft.frameUrl.trim(),
                note: editLinkDraft.note,
                customMessage: editLinkDraft.customMessage,
                commentsDueAt: editLinkDraft.commentsDueAt || undefined,
              }
            : link,
        ),
      };
    });

    const nextData = { ...data, videos: nextVideos };
    setData(nextData);
    saveAppData(nextData);

    const existingLink = video.links.find((l) => l.id === linkId);
    await updateReviewLinkRecord({
      linkId,
      version: editLinkDraft.version.trim(),
      frameUrl: editLinkDraft.frameUrl.trim(),
      note: editLinkDraft.note,
      customMessage: editLinkDraft.customMessage,
      commentsDueAt: editLinkDraft.commentsDueAt || undefined,
      bundleId: existingLink?.bundleId,
      bundleOrder: existingLink?.bundleOrder,
    });

    setStatus("Link updated.");
    cancelEditingLink();
  };

  const deleteLink = async (video: VideoItem, linkId: string) => {
    if (video.id.startsWith("api-cut-")) {
      if (!cutdownData) {
        return;
      }

      const nextVideos = cutdownData.videos.map((item) => {
        if (item.id !== video.id) {
          return item;
        }
        return {
          ...item,
          links: item.links.filter((link) => link.id !== linkId),
        };
      });

      const nextData = { ...cutdownData, videos: nextVideos };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);

      if (editingLinkId === linkId) {
        cancelEditingLink();
      }
      setStatus("Link deleted.");
      return;
    }

    if (!data) {
      return;
    }

    const nextVideos = data.videos.map((item) => {
      if (item.id !== video.id) {
        return item;
      }
      return {
        ...item,
        links: item.links.filter((link) => link.id !== linkId),
      };
    });

    const nextData = { ...data, videos: nextVideos };
    setData(nextData);
    saveAppData(nextData);
    await deleteReviewLinkRecord(linkId);

    if (editingLinkId === linkId) {
      cancelEditingLink();
    }
    setStatus("Link deleted.");
  };

  const postCutdownBatchLink = async () => {
    if (!cutdownData) {
      return;
    }
    const dkey = BATCH_FRAME_DRAFT_KEY;
    const draft = normalizeComposerDraft(drafts[dkey]);
    const existing = cutdownData.batchFrameLinks;

    const buildBatchMulti = (filled: { frameUrl: string; note: string }[]) => {
      const bundleId = crypto.randomUUID();
      const postedAt = new Date().toISOString();
      const parentVersion = getNextBatchPostingVersionLabel(existing);
      return filled.map((slot, i) => ({
        id: crypto.randomUUID(),
        version: `${parentVersion} · ${i + 1}/${filled.length}`,
        frameUrl: slot.frameUrl.trim(),
        note: slot.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: "Admin",
        postedAt,
        bundleId,
        bundleOrder: i,
      }));
    };

    if (draft.multiMode) {
      const filled = draft.slots
        .slice(0, draft.slotCount)
        .filter((s) => s.frameUrl.trim());
      if (filled.length < 2) {
        setStatus("Multi-link posting needs at least 2 Frame URLs.");
        return;
      }
      setBusyVideoId(dkey);
      setSavedVideoId(null);
      setStatus("");
      const newLinks = buildBatchMulti(filled);
      const nextData: CutdownAppData = {
        ...cutdownData,
        batchFrameLinks: [...newLinks, ...existing],
      };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);
      setStatus(`Posted ${newLinks.length} shared batch link(s) (today's column).`);
      setSavedVideoId(dkey);
      setDrafts((c) => ({ ...c, [dkey]: emptyComposerDraft() }));
      setBusyVideoId("");
      setOpenBatchFrameComposer(false);
      setTimeout(() => {
        setSavedVideoId((current) => (current === dkey ? null : current));
      }, 2000);
      return;
    }

    if (!draft.frameUrl.trim()) {
      setStatus("Frame.io link is required.");
      return;
    }

    setBusyVideoId(dkey);
    setSavedVideoId(null);
    setStatus("");
    const autoVersion = getNextBatchPostingVersionLabel(existing);
    const postedAt = new Date().toISOString();
    const newLink = {
      id: crypto.randomUUID(),
      version: autoVersion,
      frameUrl: draft.frameUrl.trim(),
      note: draft.note,
      customMessage: draft.customMessage,
      commentsDueAt: draft.commentsDueAt || undefined,
      postedBy: "Admin",
      postedAt,
    };

    const nextData: CutdownAppData = {
      ...cutdownData,
      batchFrameLinks: [newLink, ...existing],
    };
    setCutdownData(nextData);
    saveCutdownAppData(nextData);
    setStatus(`Posted ${autoVersion} (today's column).`);
    setSavedVideoId(dkey);
    setDrafts((c) => ({ ...c, [dkey]: emptyComposerDraft() }));
    setBusyVideoId("");
    setOpenBatchFrameComposer(false);
    setTimeout(() => {
      setSavedVideoId((current) => (current === dkey ? null : current));
    }, 2000);
  };

  const saveEditedCutdownLinkById = async (linkId: string) => {
    if (!cutdownData) {
      return;
    }
    if (!editLinkDraft.version.trim() || !editLinkDraft.frameUrl.trim()) {
      setStatus("Version and Frame.io link are required.");
      return;
    }

    const spot = cutdownData.videos.find((v) => v.links.some((l) => l.id === linkId));
    if (spot) {
      await saveEditedLink(spot, linkId);
      return;
    }

    if (cutdownData.batchFrameLinks.some((l) => l.id === linkId)) {
      const nextLinks = cutdownData.batchFrameLinks.map((link) =>
        link.id === linkId
          ? {
              ...link,
              version: editLinkDraft.version.trim(),
              frameUrl: editLinkDraft.frameUrl.trim(),
              note: editLinkDraft.note,
              customMessage: editLinkDraft.customMessage,
              commentsDueAt: editLinkDraft.commentsDueAt || undefined,
            }
          : link,
      );
      const nextData: CutdownAppData = {
        ...cutdownData,
        batchFrameLinks: nextLinks,
      };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);
      setStatus("Link updated.");
      cancelEditingLink();
      return;
    }
  };

  const deleteCutdownLinkById = async (linkId: string) => {
    if (!cutdownData) {
      return;
    }
    const spot = cutdownData.videos.find((v) => v.links.some((l) => l.id === linkId));
    if (spot) {
      await deleteLink(spot, linkId);
      return;
    }

    if (cutdownData.batchFrameLinks.some((l) => l.id === linkId)) {
      const nextLinks = cutdownData.batchFrameLinks.filter((l) => l.id !== linkId);
      const nextData: CutdownAppData = {
        ...cutdownData,
        batchFrameLinks: nextLinks,
      };
      setCutdownData(nextData);
      saveCutdownAppData(nextData);
      if (editingLinkId === linkId) {
        cancelEditingLink();
      }
      setStatus("Link deleted.");
      return;
    }
  };

  const syncCutdownToServerNow = async () => {
    if (!cutdownData) {
      return;
    }
    setCutdownPushBusy(true);
    setStatus("");
    const ok = await pushCutdownRemote(cutdownData);
    setCutdownPushBusy(false);
    setStatus(
      ok
        ? "Cutdown workspace uploaded to server. Refresh on another device to load it."
        : "Upload failed. Add SUPABASE_SERVICE_ROLE_KEY and matching sync secrets (.env.local on dev, Vercel on prod), then restart / redeploy.",
    );
  };

  const addContact = () => {
    if (!data) {
      return;
    }
    if (!newContact.name.trim() || !newContact.email.trim()) {
      setStatus("Contact name and email are required.");
      return;
    }
    const contact: Contact = {
      id: crypto.randomUUID(),
      name: newContact.name.trim(),
      email: newContact.email.trim(),
      team: "client",
    };
    const nextData = { ...data, contacts: [...data.contacts, contact] };
    setData(nextData);
    saveAppData(nextData);
    addContactRecord(contact);
    setSelectedRecipientIds((current) => [...current, contact.id]);
    setNewContact({ name: "", email: "" });
    setStatus("Contact added.");
  };

  const removeContact = (id: string) => {
    if (!data) {
      return;
    }
    const nextData = {
      ...data,
      contacts: data.contacts.filter((contact) => contact.id !== id),
    };
    setData(nextData);
    saveAppData(nextData);
    removeContactRecord(id);
    setSelectedRecipientIds((current) => current.filter((item) => item !== id));
    setStatus("Contact removed.");
  };

  const sendAdminBlast = async () => {
    if (!data || !adminBlastVideoId) {
      setStatus("Choose a video first.");
      return;
    }
    if (!selectedBlastVideo || !selectedBlastLink) {
      setStatus("Choose a posted link version first.");
      return;
    }

    const recipients = data.contacts
      .filter((contact) => selectedRecipientIds.includes(contact.id))
      .map((contact) => contact.email);
    if (recipients.length === 0) {
      setStatus("No recipients selected.");
      return;
    }

    try {
      await sendEmailBlast({
        recipients,
        subject: adminBlastSubject || `${selectedBlastVideo.title} - ${selectedBlastLink.version}`,
        videoTitle: selectedBlastVideo.title,
        frameUrl: selectedBlastLink.frameUrl,
        videoId: selectedBlastVideo.id,
        allLinksUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/?video=${encodeURIComponent(selectedBlastVideo.id)}`
            : undefined,
        version: selectedBlastLink.version,
        customMessage: adminBlastMessage,
        commentsDueAt: selectedBlastLink.commentsDueAt,
        postedBy: "Admin",
      });

      await saveNotificationLog({
        videoId: selectedBlastVideo.id,
        version: selectedBlastLink.version,
        recipients,
        teams: [],
        subject: `${selectedBlastVideo.title} - Link Ready for Review`,
        message: adminBlastMessage,
      });

      setStatus("Admin blast sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email failure.";
      setStatus(`Email blast failed: ${message}`);
    }
  };

  const sendAdminReminder = async () => {
    if (!data || !adminBlastVideoId || !selectedBlastVideo || !selectedBlastLink) {
      setStatus("Choose a video and link version first.");
      return;
    }
    const recipients = data.contacts
      .filter((contact) => selectedRecipientIds.includes(contact.id))
      .map((contact) => contact.email);
    if (recipients.length === 0) {
      setStatus("No recipients selected.");
      return;
    }

    const dueAt = adminReminderDueAt || selectedBlastLink.commentsDueAt || "";
    try {
      await sendEmailBlast({
        recipients,
        subject: `${selectedBlastVideo.title} - Reminder (${selectedBlastLink.version})`,
        videoTitle: selectedBlastVideo.title,
        frameUrl: selectedBlastLink.frameUrl,
        videoId: selectedBlastVideo.id,
        allLinksUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/?video=${encodeURIComponent(selectedBlastVideo.id)}`
            : undefined,
        version: selectedBlastLink.version,
        customMessage:
          adminBlastMessage ||
          "Reminder: please review and leave comments before the due time.",
        commentsDueAt: dueAt || undefined,
        postedBy: "Admin",
      });
      setStatus("Reminder sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email failure.";
      setStatus(`Reminder failed: ${message}`);
    }
  };

  const requestAiMessage = async (mode: "suggest" | "polish") => {
    if (!postDistributionPrompt) {
      return;
    }
    setAiMessageBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/ai-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message: postDistributionMessage,
          videoTitle: postDistributionPrompt.videoTitle,
          version: postDistributionPrompt.version,
          frameUrl: postDistributionPrompt.frameUrl,
          allLinksUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/?video=${encodeURIComponent(postDistributionPrompt.videoId)}`
              : "",
          dueText: postDistributionPrompt.commentsDueAt || "",
        }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok || !result.message) {
        throw new Error(result.error ?? "AI message failed.");
      }
      setPostDistributionMessage(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI message failed.";
      setStatus(message);
    } finally {
      setAiMessageBusy(false);
    }
  };

  const sendPostDistribution = async () => {
    if (!postDistributionPrompt) {
      return;
    }
    if (!data) {
      return;
    }
    const recipients = data.contacts
      .filter((contact) => postSelectedRecipientIds.includes(contact.id))
      .map((contact) => contact.email);
    if (recipients.length === 0) {
      setStatus("No recipients selected.");
      return;
    }

    try {
      await sendEmailBlast({
        recipients,
        subject:
          postDistributionSubject ||
          `${postDistributionPrompt.videoTitle} - ${postDistributionPrompt.version}`,
        videoTitle: postDistributionPrompt.videoTitle,
        frameUrl: postDistributionPrompt.frameUrl,
        videoId: postDistributionPrompt.videoId,
        allLinksUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/?video=${encodeURIComponent(postDistributionPrompt.videoId)}`
            : undefined,
        version: postDistributionPrompt.version,
        customMessage: postDistributionMessage,
        commentsDueAt: postDistributionPrompt.commentsDueAt,
        postedBy: "Admin",
      });

      await saveNotificationLog({
        videoId: postDistributionPrompt.videoId,
        version: postDistributionPrompt.version,
        recipients,
        teams: [],
        subject: `${postDistributionPrompt.videoTitle} - Link Ready for Review`,
        message: postDistributionMessage,
      });

      setStatus("Posted and sent to distribution list.");
      setPostDistributionPrompt(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email blast failed.";
      setStatus(`Distribution send failed: ${message}`);
    }
  };

  if (!data) {
    return <main className="p-6 text-sm">Loading app...</main>;
  }

  if (!entered) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="mb-6 flex justify-center">
          <Image
            src="/arnold-palmer-mastercard.png"
            alt="Arnold Palmer Invitational presented by Mastercard"
            width={220}
            height={220}
            className="h-auto w-[220px] rounded-md"
            priority
          />
        </div>
        <h1 className="text-center text-2xl font-semibold">Production Review Hub</h1>
        <p className="mt-3 text-center text-sm text-slate-300">
          One place for every video, every link, and every review date.
        </p>
        <button
          onClick={() => setEntered(true)}
          className="mt-8 w-full animate-pulse rounded-2xl border border-cyan-400 bg-cyan-500/10 px-4 py-4 text-base font-semibold text-cyan-200 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500/20"
        >
          Open App
        </button>
        {status ? <p className="mt-4 rounded-lg bg-slate-800 p-2 text-xs">{status}</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-950 p-4 text-slate-100">
      <button
        onClick={handleAdminAccess}
        className="fixed right-3 top-3 z-30 rounded-full bg-slate-800/70 px-2 py-1 text-[10px] text-slate-300 opacity-50 transition hover:opacity-100"
        aria-label="Admin access"
      >
        {isAdmin ? "admin on" : "•••"}
      </button>
      {isAdmin && hubMode === "live" ? (
        <button
          onClick={jumpToTeamRoster}
          className="fixed right-16 top-3 z-30 rounded-full border border-amber-500/60 bg-amber-950/60 px-2 py-1 text-[10px] font-semibold text-amber-200 shadow-md shadow-amber-900/40 transition hover:bg-amber-900/60"
        >
          Team
        </button>
      ) : null}
      {showAdminPrompt ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4"
          onClick={() => {
            setShowAdminPrompt(false);
            setAdminPasswordInput("");
          }}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-200">Admin password</p>
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(event) => setAdminPasswordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitAdminPassword();
                }
              }}
              autoFocus
              className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              placeholder="Enter password"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={submitAdminPassword}
                className="h-10 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white"
              >
                Unlock
              </button>
              <button
                onClick={() => {
                  setShowAdminPrompt(false);
                  setAdminPasswordInput("");
                }}
                className="h-10 rounded-md bg-slate-700 px-3 text-sm text-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mb-3 flex justify-center">
        <Image
          src="/arnold-palmer-mastercard.png"
          alt="Arnold Palmer Invitational presented by Mastercard"
          width={180}
          height={180}
          className="h-auto w-[180px] rounded-md"
          priority
        />
      </div>
      <section className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setHubMode("live");
            setActivePanel(null);
          }}
          className={`rounded-xl border p-3 text-left transition-all duration-200 ${
            hubMode === "live"
              ? "border-rose-400 bg-rose-900/45 shadow-lg shadow-rose-900/35"
              : "border-slate-700 bg-slate-900/60 hover:bg-slate-800"
          }`}
        >
          <p className="text-2xl leading-none">🎬</p>
          <p className="mt-2 text-xs font-semibold text-rose-100">Live production</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
            Status tracker · shooting schedule · link review
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setHubMode("cutdowns");
            setActivePanel(null);
          }}
          className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${
            hubMode === "cutdowns"
              ? "border-orange-400 bg-orange-900/40 shadow-lg shadow-orange-900/30"
              : "border-slate-700 bg-slate-900/60 hover:bg-slate-800"
          }`}
        >
          <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-slate-950 shadow">
            New
          </span>
          <p className="text-2xl leading-none">✂️</p>
          <p className="mt-2 text-xs font-semibold text-orange-100">API cutdowns</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
            :15 / :30 · links + status only
          </p>
        </button>
      </section>

      {status ? <p className="mt-3 rounded-lg bg-slate-800 p-2 text-xs">{status}</p> : null}

      {hubMode === "live" ? (
        <>
      <header className="sticky top-0 z-10 rounded-xl bg-slate-900/95 p-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Ogilvy Production Review Link Hub</h1>
        <p className="text-xs text-slate-300">
          Full link history + posting dates for every video
        </p>
      </header>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => togglePanel("status")}
          className={`aspect-square rounded-xl border p-2 text-center transition-all duration-200 ${
            activePanel === "status"
              ? "border-violet-400 bg-violet-900/50 shadow-lg shadow-violet-900/40"
              : "border-violet-700/50 bg-violet-950/20 hover:bg-violet-900/30 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-2xl">📊</p>
            <p className="mt-2 text-xs font-semibold text-violet-200">Status Tracker</p>
          </div>
        </button>
        <button
          onClick={() => togglePanel("schedule")}
          className={`aspect-square rounded-xl border p-2 text-center transition-all duration-200 ${
            activePanel === "schedule"
              ? "border-cyan-400 bg-cyan-900/50 shadow-lg shadow-cyan-900/40"
              : "border-cyan-700/50 bg-cyan-950/20 hover:bg-cyan-900/30 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-2xl">🎬</p>
            <p className="mt-2 text-xs font-semibold text-cyan-200">Shooting Schedule</p>
          </div>
        </button>
        <button
          onClick={() => togglePanel("links")}
          className={`aspect-square rounded-xl border p-2 text-center transition-all duration-200 ${
            activePanel === "links"
              ? "border-emerald-400 bg-emerald-900/50 shadow-lg shadow-emerald-900/40"
              : "border-emerald-700/50 bg-emerald-950/20 hover:bg-emerald-900/30 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-2xl">🔗</p>
            <p className="mt-2 text-xs font-semibold text-emerald-200">Link Review</p>
          </div>
        </button>
      </section>

      <section
        className={`overflow-hidden transition-all duration-300 ease-out ${
          activePanel === "status" ? "mt-3 max-h-[5200px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-violet-700/40 bg-slate-900 p-3">
            <h2 className="text-lg font-semibold text-violet-200">Film Status Tracker</h2>
            <div className="mt-3 space-y-3">
              {groupedSchedule.days.map((day) => (
                <article
                  key={`status-${day}`}
                  className="rounded-lg border border-slate-700 bg-slate-950 p-3"
                >
                  <h3 className="text-base font-semibold">{day}</h3>
                  <div className="mt-2 space-y-2">
                    {(groupedSchedule.groups[day] ?? []).map((video) => {
                      const statusValue = getTrackerStatus(video);
                      const hasManualOverride = Boolean(statusOverrides[video.id]);
                      return (
                        <div
                          key={`status-row-${video.id}`}
                          className="rounded-md border border-slate-800 bg-slate-900 p-2"
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                            <div className="min-w-0">
                              <p className="pr-1 text-sm font-medium leading-tight">
                                {video.emoji} {video.title}
                              </p>
                              <p className="text-xs text-slate-400">
                                Shoots {video.day} {video.time}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${getStatusBadgeClass(
                                statusValue,
                              )}`}
                            >
                              {statusValue}
                            </span>
                          </div>
                          {isAdmin ? (
                            <div className="mt-2 flex items-center gap-2">
                              <label htmlFor={`status-select-${video.id}`} className="text-[11px] text-slate-400">
                                Admin override
                              </label>
                              <select
                                id={`status-select-${video.id}`}
                                value={
                                  statusOverrides[video.id] ??
                                  (approvedByVideoId[video.id] ? "approved" : "auto")
                                }
                                onChange={(event) => setManualStatus(video.id, event.target.value)}
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                              >
                                <option value="auto">auto</option>
                                <option value="approved">approved</option>
                                <option value="waiting to shoot">waiting to shoot</option>
                                <option value="shot">shot</option>
                                <option value="editing">editing</option>
                                <option value="waiting on approval">waiting on approval</option>
                              </select>
                              {hasManualOverride ? (
                                <span className="text-[11px] text-violet-300">manual</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
        </div>
      </section>

      <section
        className={`overflow-hidden transition-all duration-300 ease-out ${
          activePanel === "schedule" ? "mt-3 max-h-[5200px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-cyan-700/40 bg-slate-900 p-3">
            <h2 className="text-xl font-semibold text-cyan-200">What We Are Shooting</h2>
            <div className="mt-3 space-y-3">
              {groupedSchedule.days.map((day) => (
                <article key={`schedule-${day}`} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <h3 className="text-base font-semibold text-cyan-100">{day}</h3>
                  <div className="mt-2 space-y-2">
                    {(groupedSchedule.groups[day] ?? []).map((video) => {
                      const ownerName = getOwnerName(video);
                      return (
                        <div
                          key={`schedule-line-${video.id}`}
                          className="rounded-md border border-slate-800 bg-slate-900 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium leading-tight">
                              {video.emoji} {video.title}
                            </p>
                            {ownerName ? (
                              <span className="shrink-0 rounded-full border border-sky-600 bg-sky-900/60 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                {ownerName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Shoot</p>
                              <p className="text-xs font-medium text-slate-200">{video.day} {video.time}</p>
                            </div>
                            <div className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Deliver</p>
                              <p className="text-xs font-medium text-cyan-200">{getDeliverLabel(video)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
        </div>
      </section>

      <section
        className={`overflow-hidden transition-all duration-300 ease-out ${
          activePanel === "links" ? "mt-4 max-h-[12000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
      <div className="space-y-4">
        {groupedSchedule.days.map((day) => (
          <article key={day} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h2 className="text-base font-semibold">{day}</h2>
            <div className="mt-3 space-y-3">
              {(groupedSchedule.groups[day] ?? []).map((video) => {
                const ownerName = getOwnerName(video);
                const linkBundles = groupLinksIntoBundles(video.links);
                const isApproved = Boolean(approvedByVideoId[video.id]);

                return (
                  <div key={video.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {video.emoji} {video.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          Goes live: {video.goesLive || "TBD"}
                        </p>
                        {isApproved ? (
                          <p className="mt-1 inline-block rounded-full border border-emerald-400 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-200">
                            APPROVED
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {ownerName ? (
                          <span className="rounded-full border border-sky-600 bg-sky-900/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-200">
                            {ownerName}
                          </span>
                        ) : null}
                        {isAdmin ? (
                          <button
                            onClick={() => toggleApproved(video.id)}
                            className={`rounded-full px-2 py-1 text-[10px] font-bold text-white ${
                              isApproved ? "bg-emerald-700" : "bg-slate-700"
                            }`}
                            title="Toggle approved"
                          >
                            {isApproved ? "Approved" : "Mark approved"}
                          </button>
                        ) : null}
                        {isAdmin ? (
                          <button
                            onClick={() =>
                              setOpenComposerVideoId((current) =>
                                current === video.id ? null : video.id,
                              )
                            }
                            className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white"
                            title="Add link"
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {video.links.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {(expandedHistoryByVideo[video.id]
                          ? linkBundles
                          : linkBundles.slice(0, 1)
                        ).map((bundle, bundleIdx) => (
                          <div
                            key={bundle[0]?.bundleId ?? bundle[0]?.id ?? `bundle-${bundleIdx}`}
                            className="rounded-md border border-slate-800 bg-slate-900 p-2"
                          >
                            {bundle.length > 1 ? (
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                One posting · {bundle.length} Frame links
                              </p>
                            ) : null}
                            <div className="space-y-2">
                              {bundle.map((link, linkIdx) => (
                                <div
                                  key={link.id}
                                  className={
                                    bundle.length > 1
                                      ? "rounded-md border border-slate-800 bg-slate-950 p-2"
                                      : ""
                                  }
                                >
                                  {editingLinkId === link.id ? (
                                    <div className="space-y-2">
                                      <input
                                        value={editLinkDraft.version}
                                        onChange={(event) =>
                                          setEditLinkDraft((current) => ({
                                            ...current,
                                            version: event.target.value,
                                          }))
                                        }
                                        placeholder="Version"
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                      />
                                      <input
                                        value={editLinkDraft.frameUrl}
                                        onChange={(event) =>
                                          setEditLinkDraft((current) => ({
                                            ...current,
                                            frameUrl: event.target.value,
                                          }))
                                        }
                                        placeholder="Frame.io link"
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                      />
                                      <textarea
                                        value={editLinkDraft.customMessage}
                                        onChange={(event) =>
                                          setEditLinkDraft((current) => ({
                                            ...current,
                                            customMessage: event.target.value,
                                          }))
                                        }
                                        placeholder="Notes"
                                        className="h-16 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                      />
                                      <input
                                        type="text"
                                        value={editLinkDraft.commentsDueAt}
                                        onChange={(event) =>
                                          setEditLinkDraft((current) => ({
                                            ...current,
                                            commentsDueAt: event.target.value,
                                          }))
                                        }
                                        placeholder="Feedback due (EOD Friday or specific date/time)"
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => saveEditedLink(video, link.id)}
                                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={cancelEditingLink}
                                          className="rounded-md bg-slate-700 px-2 py-1 text-xs"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="mb-1 flex gap-2">
                                        {bundleIdx === 0 && linkIdx === 0 ? (
                                          <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                            NEWEST
                                          </span>
                                        ) : null}
                                        {isRecentLink(link.postedAt) ? (
                                          <span className="rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                                            Posted recently at {formatPosted(link.postedAt)}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="text-xs font-semibold">{link.version}</p>
                                      <p className="text-[11px] text-yellow-300">
                                        Posted at: {formatPosted(link.postedAt)}
                                      </p>
                                      <a
                                        href={link.frameUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-blue-300 underline"
                                      >
                                        Open Frame.io
                                      </a>
                                      <p className="mt-1 text-[11px] text-slate-400">
                                        {link.customMessage || link.note}
                                      </p>
                                      <p className="text-[11px] text-red-300">
                                        Feedback due: {formatDue(link.commentsDueAt)}
                                      </p>
                                      {isAdmin ? (
                                        <div className="mt-2 flex gap-2">
                                          <button
                                            onClick={() => startEditingLink(link)}
                                            className="rounded-md bg-blue-700 px-2 py-1 text-xs"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => deleteLink(video, link.id)}
                                            className="rounded-md bg-red-700 px-2 py-1 text-xs"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {linkBundles.length > 1 ? (
                          <button
                            onClick={() =>
                              setExpandedHistoryByVideo((current) => ({
                                ...current,
                                [video.id]: !current[video.id],
                              }))
                            }
                            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200"
                          >
                            🎬{" "}
                            {expandedHistoryByVideo[video.id]
                              ? "Hide film history"
                              : `Film history (${linkBundles.length - 1} older postings)`}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">No links posted yet.</p>
                    )}

                    {isAdmin && openComposerVideoId === video.id ? (
                      <div className="mt-3 space-y-2 rounded-md border border-slate-800 p-2">
                        <p className="text-xs font-semibold text-slate-300">
                          + Add review link (single or multi-link posting)
                        </p>
                        <LinkComposerForm
                          draftKey={video.id}
                          draft={normalizeComposerDraft(drafts[video.id])}
                          setDrafts={setDrafts}
                          onSubmit={() => void postLink(video)}
                          busy={busyVideoId === video.id}
                          saved={savedVideoId === video.id}
                          submitLabel="Record link"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      </section>
        </>
      ) : cutdownData ? (
        <ApiCutdownsView
          cutdownVideos={cutdownData.videos}
          batchFrameLinks={cutdownData.batchFrameLinks}
          openBatchFrameComposer={openBatchFrameComposer}
          setOpenBatchFrameComposer={setOpenBatchFrameComposer}
          postCutdownBatchLink={postCutdownBatchLink}
          saveEditedCutdownLinkById={saveEditedCutdownLinkById}
          deleteCutdownLinkById={deleteCutdownLinkById}
          isAdmin={isAdmin}
          activePanel={activePanel}
          onTogglePanel={(panel) => togglePanel(panel)}
          getCutdownBadgeClass={getCutdownBadgeClass}
          setCutdownApprovedState={setCutdownApprovedState}
          toggleCutdownApproved={toggleCutdownApproved}
          drafts={drafts}
          setDrafts={setDrafts}
          expandedHistoryByVideo={expandedHistoryByVideo}
          setExpandedHistoryByVideo={setExpandedHistoryByVideo}
          editingLinkId={editingLinkId}
          editLinkDraft={editLinkDraft}
          setEditLinkDraft={setEditLinkDraft}
          openComposerVideoId={openComposerVideoId}
          setOpenComposerVideoId={setOpenComposerVideoId}
          busyVideoId={busyVideoId}
          savedVideoId={savedVideoId}
          startEditingLink={startEditingLink}
          cancelEditingLink={cancelEditingLink}
          saveEditedLink={saveEditedLink}
          deleteLink={deleteLink}
          postLink={postLink}
          formatDue={formatDue}
          formatPosted={formatPosted}
          isRecentLink={isRecentLink}
          cutdownRemoteWriteConfigured={isCutdownRemoteWriteConfigured()}
          onPushCutdownToServer={syncCutdownToServerNow}
          cutdownPushBusy={cutdownPushBusy}
        />
      ) : (
        <p className="mt-3 text-sm text-slate-400">Loading API cutdown workspace…</p>
      )}

      {hubMode === "live" && isAdmin ? (
        <section className="mt-4 space-y-4 rounded-xl border border-amber-500/40 bg-slate-900 p-3">
          <h2 className="text-base font-semibold text-amber-300">Admin Distribution Console</h2>

          <div id="team-roster-section" className="rounded-md bg-slate-950 p-2">
            <p className="text-xs font-semibold">Distribution List</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Add everyone who should receive review emails.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
                ref={teamNameInputRef}
                value={newContact.name}
                onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}
                placeholder="Name"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
              <input
                value={newContact.email}
                onChange={(event) => setNewContact({ ...newContact, email: event.target.value })}
                placeholder="Email"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
              <div className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400">
                Saved to email list
              </div>
            </div>
            <button onClick={addContact} className="mt-2 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold">
              Add to distribution list
            </button>

            <div className="mt-3 space-y-1">
              {data.contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-xs">
                  <span>
                    {contact.name} - {contact.team} - {contact.email}
                  </span>
                  <button onClick={() => removeContact(contact.id)} className="text-red-300 underline">
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-slate-950 p-2">
            <p className="text-xs font-semibold">Send to distribution list</p>
            <select
              value={adminBlastVideoId}
              onChange={(event) => {
                const nextVideoId = event.target.value;
                setAdminBlastVideoId(nextVideoId);
                const selected = data.videos.find((item) => item.id === nextVideoId);
                setAdminBlastLinkId(selected?.links[0]?.id ?? "");
              }}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            >
              <option value="">Select video</option>
              {data.videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title} - live {video.goesLive || video.day}
                </option>
              ))}
            </select>

            <select
              value={adminBlastLinkId}
              onChange={(event) => setAdminBlastLinkId(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            >
              <option value="">Select link version</option>
              {(selectedBlastVideo?.links ?? []).map((link) => (
                <option key={link.id} value={link.id}>
                  {link.version} - {new Date(link.postedAt).toLocaleString()}
                </option>
              ))}
            </select>

            <div className="mt-2 space-y-1 rounded-md border border-slate-800 bg-slate-900 p-2 text-[11px]">
              {data.contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRecipientIds.includes(contact.id)}
                    onChange={() =>
                      setSelectedRecipientIds((current) =>
                        current.includes(contact.id)
                          ? current.filter((id) => id !== contact.id)
                          : [...current, contact.id],
                      )
                    }
                  />
                  {contact.name} ({contact.email})
                </label>
              ))}
            </div>
            <input
              value={adminBlastSubject}
              onChange={(event) => setAdminBlastSubject(event.target.value)}
              placeholder="Email subject"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <textarea
              value={adminBlastMessage}
              onChange={(event) => setAdminBlastMessage(event.target.value)}
              className="mt-2 h-16 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={adminReminderDueAt}
              onChange={(event) => setAdminReminderDueAt(event.target.value)}
              placeholder="Reminder deadline (EOD Friday or specific date/time)"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <button onClick={sendAdminBlast} className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold">
              Send blast
            </button>
            <button
              onClick={sendAdminReminder}
              className="mt-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold"
            >
              Send reminder
            </button>
          </div>
        </section>
      ) : null}

      {postDistributionPrompt ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-emerald-300">
              Link posted: {postDistributionPrompt.version}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Send to distribution list now?
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {postDistributionPrompt.videoTitle} • Ask by{" "}
              {formatDue(postDistributionPrompt.commentsDueAt)}
            </p>
            <div className="mt-2 space-y-1 rounded-md border border-slate-800 bg-slate-950 p-2 text-[11px]">
              {data.contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={postSelectedRecipientIds.includes(contact.id)}
                    onChange={() =>
                      setPostSelectedRecipientIds((current) =>
                        current.includes(contact.id)
                          ? current.filter((id) => id !== contact.id)
                          : [...current, contact.id],
                      )
                    }
                  />
                  {contact.name} ({contact.email})
                </label>
              ))}
            </div>
            <input
              value={postDistributionSubject}
              onChange={(event) => setPostDistributionSubject(event.target.value)}
              placeholder="Email subject"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
            <textarea
              value={postDistributionMessage}
              onChange={(event) => setPostDistributionMessage(event.target.value)}
              className="mt-2 h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => requestAiMessage("suggest")}
                className="rounded-md bg-violet-700 px-2 py-1 text-xs"
                disabled={aiMessageBusy}
              >
                AI suggest
              </button>
              <button
                onClick={() => requestAiMessage("polish")}
                className="rounded-md bg-indigo-700 px-2 py-1 text-xs"
                disabled={aiMessageBusy}
              >
                AI polish my message
              </button>
              <button
                onClick={sendPostDistribution}
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold"
              >
                Send now
              </button>
              <button
                onClick={() => setPostDistributionPrompt(null)}
                className="rounded-md bg-slate-700 px-2 py-1 text-xs"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
