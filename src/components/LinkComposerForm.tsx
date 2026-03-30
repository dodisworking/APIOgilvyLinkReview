"use client";

import type { Dispatch, SetStateAction } from "react";
import type { LinkComposerDraft, LinkSlotCount } from "@/lib/link-bundles";

type SetDrafts = Dispatch<SetStateAction<Record<string, LinkComposerDraft>>>;

interface LinkComposerFormProps {
  draftKey: string;
  draft: LinkComposerDraft;
  setDrafts: SetDrafts;
  onSubmit: () => void;
  busy: boolean;
  saved: boolean;
  submitLabel: string;
  accentClass?: string;
}

export function LinkComposerForm({
  draftKey,
  draft,
  setDrafts,
  onSubmit,
  busy,
  saved,
  submitLabel,
  accentClass = "bg-emerald-600",
}: LinkComposerFormProps) {
  const patch = (partial: Partial<LinkComposerDraft>) => {
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...draft, ...partial },
    }));
  };

  const patchSlot = (index: number, partial: Partial<{ frameUrl: string; note: string }>) => {
    const nextSlots = draft.slots.map((s, i) => (i === index ? { ...s, ...partial } : s));
    patch({ slots: nextSlots });
  };

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={draft.multiMode}
          onChange={(e) => patch({ multiMode: e.target.checked })}
          className="rounded border-slate-600"
        />
        Multi-link posting (2–4 Frame URLs in one drop)
      </label>

      {draft.multiMode ? (
        <div className="space-y-2 rounded-md border border-slate-700 bg-slate-950/50 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-400">How many links?</span>
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patch({ slotCount: n as LinkSlotCount })}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                  draft.slotCount === n
                    ? "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {Array.from({ length: draft.slotCount }, (_, i) => (
            <div key={i} className="space-y-1 border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
              <p className="text-[10px] font-medium text-slate-400">Link {i + 1}</p>
              <input
                value={draft.slots[i]?.frameUrl ?? ""}
                onChange={(e) => patchSlot(i, { frameUrl: e.target.value })}
                placeholder="Frame.io URL"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
              <input
                value={draft.slots[i]?.note ?? ""}
                onChange={(e) => patchSlot(i, { note: e.target.value })}
                placeholder="Optional note for this URL"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <input
            value={draft.frameUrl}
            onChange={(e) => patch({ frameUrl: e.target.value })}
            placeholder="Frame.io link"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
          <input
            value={draft.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="Optional note (stored with link)"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </>
      )}

      <textarea
        value={draft.customMessage}
        onChange={(e) => patch({ customMessage: e.target.value })}
        placeholder="Notes for admin (shared for whole posting)"
        className="h-16 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
      />
      <input
        type="text"
        value={draft.commentsDueAt}
        onChange={(e) => patch({ commentsDueAt: e.target.value })}
        placeholder="Feedback due (EOD Friday or time/date)"
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className={`rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-70 ${accentClass}`}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Saving...
          </span>
        ) : (
          submitLabel
        )}
      </button>
      {saved ? (
        <p className="text-xs font-semibold text-emerald-300">Saved. You can add another posting.</p>
      ) : null}
    </div>
  );
}
