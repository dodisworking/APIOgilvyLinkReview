"use client";

import type { Dispatch, SetStateAction } from "react";
import { CutdownSchedulePanel } from "@/components/CutdownSchedulePanel";
import { LinkComposerForm } from "@/components/LinkComposerForm";
import {
  BATCH_FRAME_DRAFT_KEY,
  getCutdownBatch,
  getCutdownScheduleStatus,
  partitionBatchFrameLinksByPostingDay,
  shortDayHeading,
} from "@/lib/api-cutdowns";
import { groupLinksIntoBundles, normalizeComposerDraft, type LinkComposerDraft } from "@/lib/link-bundles";
import type { ReviewLinkVersion, VideoItem } from "@/types";

type CutdownPanel = "status" | "links" | "schedule" | null;

interface ApiCutdownsViewProps {
  cutdownVideos: VideoItem[];
  batchFrameLinks: ReviewLinkVersion[];
  openBatchFrameComposer: boolean;
  setOpenBatchFrameComposer: Dispatch<SetStateAction<boolean>>;
  postCutdownBatchLink: () => void | Promise<void>;
  saveEditedCutdownLinkById: (linkId: string) => void | Promise<void>;
  deleteCutdownLinkById: (linkId: string) => void | Promise<void>;
  isAdmin: boolean;
  activePanel: CutdownPanel;
  onTogglePanel: (panel: Exclude<CutdownPanel, null>) => void;
  getCutdownBadgeClass: (label: string) => string;
  setCutdownApprovedState: (videoId: string, value: "approved" | "auto") => void;
  toggleCutdownApproved: (videoId: string) => void;
  drafts: Record<string, LinkComposerDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, LinkComposerDraft>>>;
  expandedHistoryByVideo: Record<string, boolean>;
  setExpandedHistoryByVideo: Dispatch<SetStateAction<Record<string, boolean>>>;
  editingLinkId: string | null;
  editLinkDraft: {
    version: string;
    frameUrl: string;
    note: string;
    customMessage: string;
    commentsDueAt: string;
  };
  setEditLinkDraft: Dispatch<
    SetStateAction<{
      version: string;
      frameUrl: string;
      note: string;
      customMessage: string;
      commentsDueAt: string;
    }>
  >;
  openComposerVideoId: string | null;
  setOpenComposerVideoId: Dispatch<SetStateAction<string | null>>;
  busyVideoId: string;
  savedVideoId: string | null;
  startEditingLink: (link: ReviewLinkVersion) => void;
  cancelEditingLink: () => void;
  saveEditedLink: (video: VideoItem, linkId: string) => void | Promise<void>;
  deleteLink: (video: VideoItem, linkId: string) => void | Promise<void>;
  postLink: (video: VideoItem) => void | Promise<void>;
  formatDue: (value?: string) => string;
  formatPosted: (value: string) => string;
  isRecentLink: (postedAt: string) => boolean;
  /** When false, shared cutdown data is browser-only unless GET sync is configured server-side. */
  cutdownRemoteWriteConfigured: boolean;
  onPushCutdownToServer: () => void | Promise<void>;
  cutdownPushBusy: boolean;
}

export function ApiCutdownsView({
  cutdownVideos,
  batchFrameLinks,
  openBatchFrameComposer,
  setOpenBatchFrameComposer,
  postCutdownBatchLink,
  saveEditedCutdownLinkById,
  deleteCutdownLinkById,
  isAdmin,
  activePanel,
  onTogglePanel,
  getCutdownBadgeClass,
  setCutdownApprovedState,
  toggleCutdownApproved,
  drafts,
  setDrafts,
  expandedHistoryByVideo,
  setExpandedHistoryByVideo,
  editingLinkId,
  editLinkDraft,
  setEditLinkDraft,
  openComposerVideoId,
  setOpenComposerVideoId,
  busyVideoId,
  savedVideoId,
  startEditingLink,
  cancelEditingLink,
  saveEditedLink,
  deleteLink,
  postLink,
  formatDue,
  formatPosted,
  isRecentLink,
  cutdownRemoteWriteConfigured,
  onPushCutdownToServer,
  cutdownPushBusy,
}: ApiCutdownsViewProps) {
  const batchDayParts = partitionBatchFrameLinksByPostingDay(batchFrameLinks);
  const batchDaySections = [
    {
      expandKey: "batch:today",
      title: `Today — ${shortDayHeading(batchDayParts.todayYmd)}`,
      subtitle: "Anything you post now is stamped today (local time) and shows here.",
      links: batchDayParts.today,
    },
    {
      expandKey: "batch:tomorrow",
      title: `Tomorrow — ${shortDayHeading(batchDayParts.tomorrowYmd)}`,
      subtitle: "Links posted on that calendar day land in this column.",
      links: batchDayParts.tomorrow,
    },
    {
      expandKey: "batch:other",
      title: "Earlier and other days",
      subtitle: "Yesterday, the day after tomorrow, and older shared drops.",
      links: batchDayParts.other,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-10 rounded-xl bg-slate-900/95 p-3 backdrop-blur">
        <h1 className="text-lg font-semibold text-orange-100">API cutdowns</h1>
        <p className="text-xs text-slate-300">
          Three workspaces below — open <span className="text-orange-200/90">Schedule</span> for the
          full March–April timeline.
        </p>
      </header>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onTogglePanel("status")}
          className={`flex flex-col items-center rounded-2xl border px-1.5 py-3 text-center transition-all duration-200 ${
            activePanel === "status"
              ? "border-violet-400 bg-violet-900/50 shadow-lg shadow-violet-900/40"
              : "border-violet-800/40 bg-slate-900/80 hover:border-violet-600/50 hover:bg-violet-950/30"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-xl ring-1 ring-violet-400/30">
            📊
          </span>
          <p className="mt-2 text-[10px] font-semibold leading-tight text-violet-100">Status</p>
          <p className="mt-0.5 text-[8px] leading-tight text-slate-500">Tracker</p>
        </button>
        <button
          type="button"
          onClick={() => onTogglePanel("links")}
          className={`flex flex-col items-center rounded-2xl border px-1.5 py-3 text-center transition-all duration-200 ${
            activePanel === "links"
              ? "border-emerald-400 bg-emerald-900/50 shadow-lg shadow-emerald-900/40"
              : "border-emerald-800/40 bg-slate-900/80 hover:border-emerald-600/50 hover:bg-emerald-950/30"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl ring-1 ring-emerald-400/30">
            🔗
          </span>
          <p className="mt-2 text-[10px] font-semibold leading-tight text-emerald-100">Links</p>
          <p className="mt-0.5 text-[8px] leading-tight text-slate-500">Frame.io</p>
        </button>
        <button
          type="button"
          onClick={() => onTogglePanel("schedule")}
          className={`relative flex flex-col items-center overflow-hidden rounded-2xl border px-1.5 py-3 text-center transition-all duration-200 ${
            activePanel === "schedule"
              ? "border-cyan-400 bg-cyan-950/50 shadow-lg shadow-cyan-900/35"
              : "border-cyan-900/50 bg-slate-900/80 hover:border-cyan-600/45 hover:bg-cyan-950/25"
          }`}
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,211,238,0.25), transparent 55%)",
            }}
          />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/25 text-xl ring-1 ring-cyan-400/35">
            📅
          </span>
          <p className="relative mt-2 text-[10px] font-semibold leading-tight text-cyan-100">Schedule</p>
          <p className="relative mt-0.5 text-[8px] leading-tight text-slate-500">Timeline</p>
        </button>
      </section>

      <section
        className={`overflow-hidden transition-all duration-500 ease-out ${
          activePanel === "schedule" ? "mt-4 max-h-[16000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <CutdownSchedulePanel />
      </section>

      <section
        className={`overflow-hidden transition-all duration-300 ease-out ${
          activePanel === "status" ? "mt-3 max-h-[8000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-violet-700/40 bg-slate-900 p-3">
          <h2 className="text-lg font-semibold text-violet-200">Cutdown status</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            <span className="text-amber-200/90">Being edited</span> = Edit batch day to Ogilvy ·{" "}
            <span className="text-sky-200/90">With Ogilvy</span> = with agency ·{" "}
            <span className="text-indigo-200/90">With client</span> = client receive / 48 hr review.
            Set <span className="text-emerald-300">approved</span> when you sign off.
          </p>
          <div className="mt-3 space-y-2">
            {cutdownVideos.map((video) => {
              const scheduleLabel = video.isApproved
                ? "approved"
                : getCutdownScheduleStatus(video.id);
              return (
                <div
                  key={`cutdown-status-${video.id}`}
                  className="rounded-md border border-slate-800 bg-slate-950 p-2"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {video.emoji} {video.title}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Batch {getCutdownBatch(video.id)}
                      </p>
                    </div>
                    <span
                      className={`max-w-[148px] shrink-0 whitespace-normal text-right text-[9px] font-semibold leading-tight ${getCutdownBadgeClass(
                        scheduleLabel,
                      )} rounded-full px-2 py-1`}
                    >
                      {scheduleLabel}
                    </span>
                  </div>
                  {isAdmin ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`cutdown-status-${video.id}`}
                        className="text-[11px] text-slate-400"
                      >
                        Override
                      </label>
                      <select
                        id={`cutdown-status-${video.id}`}
                        value={video.isApproved ? "approved" : "auto"}
                        onChange={(event) =>
                          setCutdownApprovedState(
                            video.id,
                            event.target.value as "approved" | "auto",
                          )
                        }
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                      >
                        <option value="auto">Schedule (auto)</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className={`overflow-hidden transition-all duration-300 ease-out ${
          activePanel === "links" ? "mt-4 max-h-[24000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-4 rounded-xl border border-emerald-800/40 bg-slate-900 p-3">
          <h2 className="text-base font-semibold text-emerald-200">Link tracker</h2>
          {!cutdownRemoteWriteConfigured ? (
            <p className="rounded-md border border-amber-700/50 bg-amber-950/40 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95">
              Cross-device save: add{" "}
              <code className="rounded bg-slate-900 px-1">SUPABASE_SERVICE_ROLE_KEY</code>,{" "}
              <code className="rounded bg-slate-900 px-1">CUTDOWN_SYNC_SECRET</code>, and the same
              value as{" "}
              <code className="rounded bg-slate-900 px-1">NEXT_PUBLIC_CUTDOWN_SYNC_SECRET</code> on
              Vercel, then run the <code className="rounded bg-slate-900 px-1">cutdown_workspace</code>{" "}
              SQL from the repo schema.
            </p>
          ) : null}
          {isAdmin && cutdownRemoteWriteConfigured ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onPushCutdownToServer()}
                disabled={cutdownPushBusy}
                className="rounded-md bg-cyan-700 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
              >
                {cutdownPushBusy ? "Uploading…" : "Save this browser's cutdowns to server"}
              </button>
              <span className="text-[10px] text-slate-500">
                Use once to copy localhost links into Supabase without re-entering them.
              </span>
            </div>
          ) : null}
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="text-cyan-200/90">Shared Frame drops</span> sort into{" "}
            <span className="text-cyan-100">today</span>, <span className="text-cyan-100">tomorrow</span>,
            and <span className="text-cyan-100">other days</span> using each link&apos;s posting date
            (your local time). <span className="text-emerald-200/90">Spot links</span> are per title
            below. Ogilvy editorial batch rosters stay on the Schedule tile.
          </p>

          <div>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
                Shared batch Frame drops
              </h3>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenComposerVideoId(null);
                    setOpenBatchFrameComposer((open) => !open);
                  }}
                  className="shrink-0 rounded-full bg-cyan-700 px-2 py-1 text-xs font-bold text-white"
                  title="Add shared batch link"
                >
                  +
                </button>
              ) : null}
            </div>

            {isAdmin && openBatchFrameComposer ? (
              <div className="mt-3 space-y-2 rounded-md border border-cyan-900/50 p-2">
                <p className="text-xs font-semibold text-cyan-200">
                  Add shared drop (single or multi-link) — appears under Today until the calendar day
                  changes.
                </p>
                <LinkComposerForm
                  draftKey={BATCH_FRAME_DRAFT_KEY}
                  draft={normalizeComposerDraft(drafts[BATCH_FRAME_DRAFT_KEY])}
                  setDrafts={setDrafts}
                  onSubmit={() => void postCutdownBatchLink()}
                  busy={busyVideoId === BATCH_FRAME_DRAFT_KEY}
                  saved={savedVideoId === BATCH_FRAME_DRAFT_KEY}
                  submitLabel="Save batch link"
                  accentClass="bg-cyan-600"
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {batchDaySections.map((section) => {
                const linkBundles = groupLinksIntoBundles(section.links);
                const expandKey = section.expandKey;
                return (
                  <div
                    key={expandKey}
                    className="rounded-lg border border-cyan-900/40 bg-slate-950 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-cyan-100">{section.title}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{section.subtitle}</p>
                    </div>

                    {section.links.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {(expandedHistoryByVideo[expandKey]
                          ? linkBundles
                          : linkBundles.slice(0, 1)
                        ).map((bundle, bundleIdx) => (
                          <div
                            key={bundle[0]?.bundleId ?? bundle[0]?.id ?? `b-${expandKey}-${bundleIdx}`}
                            className="rounded-md border border-cyan-900/40 bg-slate-900 p-2"
                          >
                            {bundle.length > 1 ? (
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-200/80">
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
                                        placeholder="Feedback due (optional)"
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => void saveEditedCutdownLinkById(link.id)}
                                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
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
                                          <span className="rounded-full bg-cyan-700 px-2 py-0.5 text-[10px] font-bold text-white">
                                            NEWEST
                                          </span>
                                        ) : null}
                                        {isRecentLink(link.postedAt) ? (
                                          <span className="rounded-full bg-cyan-900 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                                            Posted {formatPosted(link.postedAt)}
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
                                            type="button"
                                            onClick={() => startEditingLink(link)}
                                            className="rounded-md bg-blue-700 px-2 py-1 text-xs"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void deleteCutdownLinkById(link.id)}
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
                            type="button"
                            onClick={() =>
                              setExpandedHistoryByVideo((current) => ({
                                ...current,
                                [expandKey]: !current[expandKey],
                              }))
                            }
                            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200"
                          >
                            {expandedHistoryByVideo[expandKey]
                              ? "Hide history for this day"
                              : `More postings (${linkBundles.length - 1} older)`}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">No shared drops for this day yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">
              Spot links
            </h3>
            <p className="mt-1 text-[10px] text-slate-500">
              Per title — use when a spot has its own Frame link outside the batch drop.
            </p>
          </div>

          <div className="space-y-3">
            {cutdownVideos.map((video) => {
              const spotBundles = groupLinksIntoBundles(video.links);
              const isApproved = Boolean(video.isApproved);
              return (
                <div key={video.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {video.emoji} {video.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Batch {getCutdownBatch(video.id)}
                      </p>
                      {isApproved ? (
                        <p className="mt-1 inline-block rounded-full border border-emerald-400 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-200">
                          APPROVED
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => toggleCutdownApproved(video.id)}
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
                          type="button"
                          onClick={() => {
                            setOpenBatchFrameComposer(false);
                            setOpenComposerVideoId((current) =>
                              current === video.id ? null : video.id,
                            );
                          }}
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
                        ? spotBundles
                        : spotBundles.slice(0, 1)
                      ).map((bundle, bundleIdx) => (
                        <div
                          key={bundle[0]?.bundleId ?? bundle[0]?.id ?? `s-${bundleIdx}`}
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
                                      placeholder="Feedback due (optional)"
                                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void saveEditedLink(video, link.id)}
                                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
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
                                          Posted {formatPosted(link.postedAt)}
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
                                          type="button"
                                          onClick={() => startEditingLink(link)}
                                          className="rounded-md bg-blue-700 px-2 py-1 text-xs"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void deleteLink(video, link.id)}
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
                      {spotBundles.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryByVideo((current) => ({
                              ...current,
                              [video.id]: !current[video.id],
                            }))
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200"
                        >
                          {expandedHistoryByVideo[video.id]
                            ? "Hide link history"
                            : `Link history (${spotBundles.length - 1} older postings)`}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No links yet.</p>
                  )}

                  {isAdmin && openComposerVideoId === video.id ? (
                    <div className="mt-3 space-y-2 rounded-md border border-slate-800 p-2">
                      <p className="text-xs font-semibold text-slate-300">
                        Add review link (single or multi-link posting)
                      </p>
                      <LinkComposerForm
                        draftKey={video.id}
                        draft={normalizeComposerDraft(drafts[video.id])}
                        setDrafts={setDrafts}
                        onSubmit={() => void postLink(video)}
                        busy={busyVideoId === video.id}
                        saved={savedVideoId === video.id}
                        submitLabel="Save link"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
