"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
  clearSession,
  loadSession,
  recordLoginActivity,
  saveAppData,
  saveSession,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  AppData,
  Contact,
  Role,
  TeamType,
  VideoItem,
} from "@/types";
const liveDayOrder = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
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
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "123";
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [requestedView, setRequestedView] = useState<Role | null>(null);
  const [requestedVideoId, setRequestedVideoId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState("");

  const [adminVisible, setAdminVisible] = useState(false);
  const [newContact, setNewContact] = useState<{
    name: string;
    email: string;
    team: TeamType;
  }>({
    name: "",
    email: "",
    team: "client",
  });

  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        version: string;
        frameUrl: string;
        note: string;
        customMessage: string;
        commentsDueAt: string;
      }
    >
  >({});

  const [adminBlastVideoId, setAdminBlastVideoId] = useState("");
  const [adminBlastLinkId, setAdminBlastLinkId] = useState("");
  const [adminBlastTeams, setAdminBlastTeams] = useState<TeamType[]>([
    "client",
    "ogilvy",
  ]);
  const [adminBlastMessage, setAdminBlastMessage] = useState(
    "Please review as soon as possible.",
  );
  const [adminReminderDueAt, setAdminReminderDueAt] = useState("");

  const [busyVideoId, setBusyVideoId] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [expandedHistoryByVideo, setExpandedHistoryByVideo] = useState<
    Record<string, boolean>
  >({});
  const [editLinkDraft, setEditLinkDraft] = useState({
    version: "",
    frameUrl: "",
    note: "",
    customMessage: "",
    commentsDueAt: "",
  });

  useEffect(() => {
    const session = loadSession();
    seedLocalStorageIfMissing();
    fetchAppData().then((appData) => setData(appData));

    if (session.role) {
      setRole(session.role);
      setUserName(session.name);
      setLoginName(session.name);
    }
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const view = search.get("view") as Role | null;
      const video = search.get("video");
      setRequestedView(view);
      setRequestedVideoId(video);
    }
  }, []);

  useEffect(() => {
    if (data) {
      saveAppData(data);
    }
  }, [data]);

  const groupedVideos = useMemo(() => {
    if (!data) {
      return { days: [], groups: {} as Record<string, VideoItem[]> };
    }

    const groups: Record<string, VideoItem[]> = {};
    const videosToShow = requestedVideoId
      ? data.videos.filter((video) => video.id === requestedVideoId)
      : data.videos;

    for (const video of videosToShow) {
      const displayDay = video.goesLive || video.day || "Unscheduled";
      if (!groups[displayDay]) {
        groups[displayDay] = [];
      }
      groups[displayDay].push(video);
    }

    const days = Object.keys(groups).sort((a, b) => {
      const aIndex = liveDayOrder.includes(a) ? liveDayOrder.indexOf(a) : 999;
      const bIndex = liveDayOrder.includes(b) ? liveDayOrder.indexOf(b) : 999;
      return aIndex - bIndex;
    });
    return { days, groups };
  }, [data, requestedVideoId]);

  const selectedBlastVideo =
    data?.videos.find((item) => item.id === adminBlastVideoId) ?? null;
  const selectedBlastLink =
    selectedBlastVideo?.links.find((item) => item.id === adminBlastLinkId) ??
    selectedBlastVideo?.links[0] ??
    null;
  const canManageLinks = role === "editor" || role === "admin";
  const isViewerMode = role === "client" || role === "ogilvy";
  const formatDue = (value?: string) =>
    value ? new Date(value).toLocaleString() : "Not set";

  const loginAs = (nextRole: Role) => {
    const cleanName = loginName.trim();
    if (!cleanName && nextRole !== "admin") {
      setStatus("Please enter your name.");
      return;
    }

    setRole(nextRole);
    setUserName(cleanName || "Admin");
    saveSession(nextRole, cleanName || "Admin");
    recordLoginActivity({
      name: cleanName || "Admin",
      email: loginEmail.trim(),
      role: nextRole,
    });
    router.replace(`/?view=${nextRole}`);
    setStatus("");
  };

  const roleContacts = (teams: TeamType[]) => {
    if (!data) {
      return [];
    }
    return data.contacts.filter((contact) => teams.includes(contact.team));
  };

  const postLink = async (video: VideoItem) => {
    if (!data) {
      return;
    }
    const draft = drafts[video.id];
    if (!draft?.version || !draft?.frameUrl) {
      setStatus("Version and Frame.io link are required.");
      return;
    }

    setBusyVideoId(video.id);
    setStatus("");

    const updatedVideos = data.videos.map((item) => {
      if (item.id !== video.id) {
        return item;
      }
      return {
        ...item,
        links: [
          {
            id: crypto.randomUUID(),
            version: draft.version,
            frameUrl: draft.frameUrl,
            note: draft.note,
            customMessage: draft.customMessage,
            commentsDueAt: draft.commentsDueAt || undefined,
            postedBy: userName || "Editor",
            postedAt: new Date().toISOString(),
          },
          ...item.links,
        ],
      };
    });

    const nextData = { ...data, videos: updatedVideos };
    setData(nextData);
    saveAppData(nextData);

    try {
      await saveReviewLink({
        videoId: video.id,
        version: draft.version,
        frameUrl: draft.frameUrl,
        note: draft.note,
        customMessage: draft.customMessage,
        commentsDueAt: draft.commentsDueAt || undefined,
        postedBy: userName || "Editor",
      });

      setStatus(
        `Recorded ${draft.version} for ${video.title}. Admin can send notifications when ready.`,
      );
      setDrafts((current) => ({
        ...current,
        [video.id]: {
          version: "",
          frameUrl: "",
          note: "",
          customMessage: "",
          commentsDueAt: "",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save link.";
      setStatus(`Link save failed: ${message}`);
    } finally {
      setBusyVideoId("");
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
      team: newContact.team,
    };
    const nextData = { ...data, contacts: [...data.contacts, contact] };
    setData(nextData);
    saveAppData(nextData);
    addContactRecord(contact);
    setNewContact({ name: "", email: "", team: "client" });
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

    const recipients = roleContacts(adminBlastTeams).map((contact) => contact.email);
    if (recipients.length === 0) {
      setStatus("No recipients found in selected teams.");
      return;
    }

    try {
      await sendEmailBlast({
        recipients,
        subject: `${selectedBlastVideo.title} - ${selectedBlastLink.version} Ready for Review`,
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
        postedBy: userName || "Admin",
      });

      await saveNotificationLog({
        videoId: selectedBlastVideo.id,
        version: selectedBlastLink.version,
        recipients,
        teams: adminBlastTeams,
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
    const recipients = roleContacts(adminBlastTeams).map((contact) => contact.email);
    if (recipients.length === 0) {
      setStatus("No recipients found in selected teams.");
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
        postedBy: userName || "Admin",
      });
      setStatus("Reminder sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email failure.";
      setStatus(`Reminder failed: ${message}`);
    }
  };

  if (!data) {
    return <main className="p-6 text-sm">Loading app...</main>;
  }

  if (!role) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-slate-950 p-6 text-slate-100">
        <div className="mb-4 flex justify-center">
          <Image
            src="/arnold-palmer-mastercard.png"
            alt="Arnold Palmer Invitational presented by Mastercard"
            width={220}
            height={220}
            className="h-auto w-[220px] rounded-md"
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold">Production Review Hub</h1>
        <p className="mt-2 text-sm text-slate-300">
          Choose your role to open the schedule and review links.
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
        <div className="mt-6 space-y-3">
          <input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            placeholder="Your email"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <button onClick={() => loginAs("client")} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium">
            Enter as Client
          </button>
          <button onClick={() => loginAs("editor")} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium">
            Enter as Editor
          </button>
          <button onClick={() => loginAs("ogilvy")} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium">
            Enter as Ogilvy
          </button>
        </div>
        <button
          onClick={() => setAdminVisible((current) => !current)}
          className="mt-8 text-xs text-slate-400 underline"
        >
          admin access
        </button>
        {adminVisible ? (
          <button
            onClick={() => {
              const password = window.prompt("Admin password");
              if (password === adminPassword) {
                setRole("admin");
                setUserName("Admin");
                saveSession("admin", "Admin");
                recordLoginActivity({
                  name: "Admin",
                  email: "",
                  role: "admin",
                });
                router.replace("/?view=admin");
                setStatus("");
              } else {
                setStatus("Wrong admin password.");
              }
            }}
            className="mt-2 block text-xs text-amber-300 underline"
          >
            open hidden admin
          </button>
        ) : null}
        {status ? <p className="mt-4 rounded-lg bg-slate-800 p-2 text-xs">{status}</p> : null}
      </main>
    );
  }

  if (requestedView && requestedView !== role) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Role Access Mismatch</h1>
        <p className="mt-2 text-sm text-slate-300">
          You are signed in as {role}, but attempted to access {requestedView} view.
        </p>
        <button
          onClick={() => router.replace(`/?view=${role}`)}
          className="mt-4 rounded-md bg-slate-700 px-3 py-2 text-sm"
        >
          Go to my view
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-950 p-4 text-slate-100">
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
          Logged in as {userName} ({role})
        </p>
        <button
          onClick={() => {
            clearSession();
            setRole(null);
            setUserName("");
            setStatus("");
            router.replace("/");
          }}
          className="mt-2 rounded-md bg-slate-700 px-2 py-1 text-xs"
        >
          Switch role
        </button>
      </header>

      {status ? <p className="mt-3 rounded-lg bg-slate-800 p-2 text-xs">{status}</p> : null}

      <section className="mt-4 space-y-4">
        {groupedVideos.days.map((day) => (
          <article key={day} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h2 className="text-base font-semibold">{day}</h2>
            <div className="mt-3 space-y-3">
              {(groupedVideos.groups[day] ?? []).map((video) => {
                const latest = video.links[0];
                const isHistoryOpen = Boolean(expandedHistoryByVideo[video.id]);
                const draft = drafts[video.id] ?? {
                  version: "",
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
                        <p className="text-xs text-slate-400">Goes live {video.goesLive}</p>
                      </div>
                      {latest ? (
                        <span className="rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-semibold">
                          Link {latest.version} ready
                        </span>
                      ) : null}
                    </div>

                    {video.links.length > 0 && isViewerMode ? (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-md bg-slate-900 p-2">
                          <p className="text-xs font-semibold">
                            Most recent: {latest?.version}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Posted:{" "}
                            {latest
                              ? new Date(latest.postedAt).toLocaleString()
                              : "N/A"}
                          </p>
                          <p className="text-[11px] text-amber-300">
                            Comments due: {formatDue(latest?.commentsDueAt)}
                          </p>
                          {latest ? (
                            <a
                              href={latest.frameUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs text-blue-300 underline"
                            >
                              Open latest review link
                            </a>
                          ) : null}
                          <div className="mt-2">
                            <button
                              onClick={() =>
                                setExpandedHistoryByVideo((current) => ({
                                  ...current,
                                  [video.id]: !current[video.id],
                                }))
                              }
                              className="rounded-md bg-slate-700 px-2 py-1 text-xs"
                            >
                              {isHistoryOpen
                                ? "Hide link history"
                                : "View link history"}
                            </button>
                          </div>
                        </div>
                        {isHistoryOpen ? (
                          <div className="space-y-2">
                            {video.links.map((link) => (
                              <div
                                key={link.id}
                                className="rounded-md border border-slate-800 bg-slate-900 p-2"
                              >
                                <p className="text-xs font-semibold">
                                  {link.version}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Posted: {new Date(link.postedAt).toLocaleString()}
                                </p>
                                <p className="text-[11px] text-amber-300">
                                  Comments due: {formatDue(link.commentsDueAt)}
                                </p>
                                <a
                                  href={link.frameUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-300 underline"
                                >
                                  Open Frame.io
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : video.links.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {video.links.map((link) => (
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
                                  type="datetime-local"
                                  value={editLinkDraft.commentsDueAt}
                                  onChange={(event) =>
                                    setEditLinkDraft((current) => ({
                                      ...current,
                                      commentsDueAt: event.target.value,
                                    }))
                                  }
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
                                <p className="text-xs font-semibold">{link.version}</p>
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
                                  Comments due: {formatDue(link.commentsDueAt)}
                                </p>
                                {canManageLinks ? (
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

                    {role === "editor" || role === "admin" ? (
                      <div className="mt-3 space-y-2 rounded-md border border-slate-800 p-2">
                        <p className="text-xs font-semibold text-slate-300">Post new review link</p>
                        <input
                          value={draft.version}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [video.id]: { ...draft, version: event.target.value },
                            }))
                          }
                          placeholder="Version (ex: v1)"
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
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
                          type="datetime-local"
                          value={draft.commentsDueAt}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [video.id]: { ...draft, commentsDueAt: event.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => postLink(video)}
                          disabled={busyVideoId === video.id}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold disabled:opacity-70"
                        >
                          {busyVideoId === video.id ? "Saving..." : "Record link"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      {role === "admin" ? (
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
              <select
                value={newContact.team}
                onChange={(event) => setNewContact({ ...newContact, team: event.target.value as TeamType })}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="client">client</option>
                <option value="ogilvy">ogilvy</option>
                <option value="editor">editor</option>
              </select>
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

            <div className="mt-2 flex gap-2 text-[11px]">
              {(["client", "ogilvy", "editor"] as TeamType[]).map((team) => (
                <label key={team} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={adminBlastTeams.includes(team)}
                    onChange={() =>
                      setAdminBlastTeams((current) =>
                        current.includes(team)
                          ? current.filter((item) => item !== team)
                          : [...current, team],
                      )
                    }
                  />
                  {team}
                </label>
              ))}
            </div>
            <textarea
              value={adminBlastMessage}
              onChange={(event) => setAdminBlastMessage(event.target.value)}
              className="mt-2 h-16 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <input
              type="datetime-local"
              value={adminReminderDueAt}
              onChange={(event) => setAdminReminderDueAt(event.target.value)}
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
    </main>
  );
}
