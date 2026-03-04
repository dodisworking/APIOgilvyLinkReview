"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  addContactRecord,
  deleteReviewLinkRecord,
  fetchAppData,
  removeContactRecord,
  saveNotificationLog,
  saveReviewLink,
  seedLocalStorageIfMissing,
  updateReviewLinkRecord,
} from "@/lib/data-service";
import { saveAppData } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  AppData,
  Contact,
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
  const [newContact, setNewContact] = useState<{
    name: string;
    email: string;
  }>({
    name: "",
    email: "",
  });

  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        frameUrl: string;
        note: string;
        customMessage: string;
        commentsDueAt: string;
      }
    >
  >({});

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

  useEffect(() => {
    if (data) {
      saveAppData(data);
      const allIds = data.contacts.map((contact) => contact.id);
      setSelectedRecipientIds((current) =>
        current.length > 0 ? current.filter((id) => allIds.includes(id)) : allIds,
      );
    }
  }, [data]);

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
  const formatPosted = (value: string) => new Date(value).toLocaleString();
  const isRecentLink = (postedAt: string) =>
    Date.now() - new Date(postedAt).getTime() <= 1000 * 60 * 60 * 24;
  const getNextLinkVersion = (links: VideoItem["links"]) => {
    const numericVersions = links
      .map((link) => Number(link.version.replace(/[^0-9]/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
    const next = numericVersions.length ? Math.max(...numericVersions) + 1 : 1;
    return `Link #${next}`;
  };

  const handleAdminAccess = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setStatus("Admin mode disabled.");
      return;
    }
    const password = window.prompt("Admin password");
    if (password === adminPassword) {
      setIsAdmin(true);
      setStatus("Admin mode enabled.");
    } else {
      setStatus("Wrong admin password.");
    }
  };

  useEffect(() => {
    if (selectedBlastVideo && selectedBlastLink) {
      setAdminBlastSubject(
        `${selectedBlastVideo.title} - ${selectedBlastLink.version} Ready for Review`,
      );
    }
  }, [selectedBlastVideo, selectedBlastLink]);

  const postLink = async (video: VideoItem) => {
    if (!data) {
      return;
    }
    const draft = drafts[video.id];
    if (!draft?.frameUrl) {
      setStatus("Frame.io link is required.");
      return;
    }

    setBusyVideoId(video.id);
    setSavedVideoId(null);
    setStatus("");
    const autoVersion = getNextLinkVersion(video.links);
    const postedAt = new Date().toISOString();
    const newLink = {
      id: crypto.randomUUID(),
      version: autoVersion,
      frameUrl: draft.frameUrl,
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
        frameUrl: draft.frameUrl,
        note: draft.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: "Admin",
      });

      setStatus(
        `Posted ${autoVersion} for ${video.title}.`,
      );
      setSavedVideoId(video.id);
      setDrafts((current) => ({
        ...current,
        [video.id]: {
          frameUrl: "",
          note: "",
          customMessage: "",
          commentsDueAt: "",
        },
      }));
      setPostDistributionPrompt({
        videoId: video.id,
        videoTitle: video.title,
        linkId: newLink.id,
        version: newLink.version,
        frameUrl: newLink.frameUrl,
        commentsDueAt: newLink.commentsDueAt,
      });
      setPostDistributionSubject(
        `${video.title} - ${newLink.version} Ready for Review`,
      );
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

    await updateReviewLinkRecord({
      linkId,
      version: editLinkDraft.version.trim(),
      frameUrl: editLinkDraft.frameUrl.trim(),
      note: editLinkDraft.note,
      customMessage: editLinkDraft.customMessage,
      commentsDueAt: editLinkDraft.commentsDueAt || undefined,
    });

    setStatus("Link updated.");
    cancelEditingLink();
  };

  const deleteLink = async (video: VideoItem, linkId: string) => {
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
        {isSupabaseConfigured ? (
          <p className="mt-2 rounded-lg border border-emerald-700/60 bg-emerald-950/30 p-2 text-xs text-emerald-300">
            Supabase mode enabled.
          </p>
        ) : (
          <p className="mt-2 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-300">
            Local mode enabled. Add Supabase env vars to share data across users.
          </p>
        )}
        <button
          onClick={() => setEntered(true)}
          className="mt-8 w-full animate-pulse rounded-2xl border border-cyan-400 bg-cyan-500/10 px-4 py-4 text-base font-semibold text-cyan-200 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500/20"
        >
          Tap to view links
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
      <header className="sticky top-0 z-10 rounded-xl bg-slate-900/95 p-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Production Review Hub</h1>
        <p className="text-xs text-slate-300">
          Full link history + posting dates for every video
        </p>
      </header>

      {status ? <p className="mt-3 rounded-lg bg-slate-800 p-2 text-xs">{status}</p> : null}

      <section className="mt-4 space-y-4">
        {groupedSchedule.days.map((day) => (
          <article key={day} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h2 className="text-base font-semibold">{day}</h2>
            <div className="mt-3 space-y-3">
              {(groupedSchedule.groups[day] ?? []).map((video) => {
                const draft = drafts[video.id] ?? {
                  frameUrl: "",
                  note: "",
                  customMessage: "",
                  commentsDueAt: "",
                };

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
                      </div>
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

                    {video.links.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {video.links.map((link, index) => (
                          <div key={link.id} className="rounded-md bg-slate-900 p-2">
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
                                  {index === 0 ? (
                                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
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
                                <p className="text-[11px] text-slate-400">
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
                                <p className="text-[11px] text-amber-300">
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
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">No links posted yet.</p>
                    )}

                    {isAdmin && openComposerVideoId === video.id ? (
                      <div className="mt-3 space-y-2 rounded-md border border-slate-800 p-2">
                        <p className="text-xs font-semibold text-slate-300">
                          + Add review link (auto labels Link #1, Link #2...)
                        </p>
                        <input
                          value={draft.frameUrl}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [video.id]: { ...draft, frameUrl: event.target.value },
                            }))
                          }
                          placeholder="Frame.io link"
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <textarea
                          value={draft.customMessage}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [video.id]: { ...draft, customMessage: event.target.value },
                            }))
                          }
                          placeholder="Notes for admin"
                          className="h-16 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={draft.commentsDueAt}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [video.id]: { ...draft, commentsDueAt: event.target.value },
                            }))
                          }
                          placeholder="Ask by when next round of feedback? (EOD Friday or time/date)"
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => postLink(video)}
                          disabled={busyVideoId === video.id}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold disabled:opacity-70"
                        >
                          {busyVideoId === video.id ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Saving...
                            </span>
                          ) : (
                            "Record link"
                          )}
                        </button>
                        {savedVideoId === video.id ? (
                          <p className="text-xs font-semibold text-emerald-300">
                            Saved. You can add another link now.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      {isAdmin ? (
        <section className="mt-4 space-y-4 rounded-xl border border-amber-500/40 bg-slate-900 p-3">
          <h2 className="text-base font-semibold text-amber-300">Admin Distribution Console</h2>

          <div className="rounded-md bg-slate-950 p-2">
            <p className="text-xs font-semibold">Distribution List</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Add everyone who should receive review emails.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
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
