"use client";

import {
  API_CUTDOWN_BATCH_ROSTER,
  API_CUTDOWN_TIMELINE,
  type CutdownTimelineItem,
  type CutdownTimelineKind,
  isTimelineItemActive,
} from "@/lib/api-cutdowns";

const kindStyles: Record<
  CutdownTimelineKind,
  { dot: string; ring: string; card: string; chip: string }
> = {
  ogilvy: {
    dot: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.65)]",
    ring: "ring-cyan-400/40",
    card: "border-cyan-500/25 bg-cyan-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    chip: "border-cyan-500/30 bg-cyan-950/50 text-cyan-200",
  },
  revise: {
    dot: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.55)]",
    ring: "ring-violet-400/40",
    card: "border-violet-500/25 bg-violet-950/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    chip: "border-violet-500/30 bg-violet-950/50 text-violet-200",
  },
  dark: {
    dot: "bg-rose-400/90 shadow-[0_0_14px_rgba(251,113,133,0.45)]",
    ring: "ring-rose-400/35",
    card: "border-rose-500/20 bg-rose-950/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    chip: "border-rose-500/30 bg-rose-950/40 text-rose-200",
  },
  final: {
    dot: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
    ring: "ring-emerald-400/45",
    card: "border-emerald-500/25 bg-emerald-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    chip: "border-emerald-500/30 bg-emerald-950/50 text-emerald-200",
  },
};

function TimelineRow({ item }: { item: CutdownTimelineItem }) {
  const styles = kindStyles[item.kind];
  const active = isTimelineItemActive(item);

  return (
    <div className="relative flex gap-3 pb-6 last:pb-2">
      <div className="relative z-[1] flex w-[22px] shrink-0 justify-center pt-1">
        <div
          className={`h-3 w-3 rounded-full ring-2 ring-offset-2 ring-offset-[#0c0f18] ${styles.dot} ${styles.ring}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl border px-3.5 py-3 backdrop-blur-md transition-all duration-300 ${styles.card} ${
            active ? "scale-[1.01] ring-1 ring-white/15" : "opacity-95 hover:opacity-100"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <time className="font-mono text-[11px] font-medium tracking-wide text-slate-300">
              {item.dateDisplay}
            </time>
            {item.batchLabel ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${styles.chip}`}
              >
                {item.batchLabel}
              </span>
            ) : null}
            {active ? (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                Now
              </span>
            ) : null}
          </div>
          <h4 className="mt-2 text-sm font-semibold leading-snug text-white">{item.title}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{item.subtitle}</p>
          {item.batchNum ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-500">
              <span className="font-medium text-slate-400">Spots in this batch · </span>
              {API_CUTDOWN_BATCH_ROSTER[item.batchNum]}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CutdownSchedulePanel() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f18] shadow-2xl shadow-black/50">
      {/* Mesh + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 120% 80% at 20% -20%, rgba(34, 211, 238, 0.18), transparent 50%),
            radial-gradient(ellipse 90% 70% at 100% 30%, rgba(167, 139, 250, 0.14), transparent 45%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(52, 211, 153, 0.08), transparent 40%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative px-4 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              Assistant view
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Cutdown schedule</h3>
            <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-slate-400">
              March–April 2026 · Ogilvy batches, client review windows, dark week, and final deliver.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-center backdrop-blur-sm">
            <p className="font-mono text-[10px] text-slate-500">2026</p>
            <p className="text-lg font-semibold leading-none text-white">API</p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">
              :15 · :30
            </p>
          </div>
        </div>

        <div className="relative mt-5 pl-1">
          {/* Vertical spine — aligned to dot centers */}
          <div
            className="absolute left-[15px] top-3 bottom-8 w-px bg-gradient-to-b from-cyan-400/50 via-violet-500/40 to-emerald-400/50"
            aria-hidden
          />

          <div className="space-y-0">
            {API_CUTDOWN_TIMELINE.map((item) => (
              <TimelineRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
