"use client";

// 오늘의 가방: a line-drawn bag beside the day's checklist. Ticking an item slides its icon into the
// bag and fills it a step; when everything is ticked (or 완료 is pressed) a zipper line is drawn
// and the card folds into a one-line summary. Tapping the summary opens it again.
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { ADVICE_LABEL, type AdviceKey } from "@/lib/advice";
import type { BagItem } from "@/lib/outing";
import { AdviceBadge } from "@/components/icons";
import { finishBag, setPacked } from "./actions/bag";

const nameOf = (k: AdviceKey) => (k === "range" ? "겉옷" : k === "heat" ? "물" : ADVICE_LABEL[k]);
const SMOOTH = "cubic-bezier(.4,0,.2,1)";
const NAVY = "#25324A";
const FILL = "#E8EDF5";
// inside of the bag outline, for the fill level
const INNER = "M13.6 23h36.8a1.5 1.5 0 0 1 1.5 1.6l-1.5 28.3a3.5 3.5 0 0 1-3.5 3.3H17.1a3.5 3.5 0 0 1-3.5-3.3L12.1 24.6a1.5 1.5 0 0 1 1.5-1.6z";

function BagLine({ level, zipped, size, clipId }: { level: number; zipped: boolean; size: number; clipId: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="overflow-visible" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d={INNER} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="23" width="64" height="35" fill={FILL} style={{ transform: `translateY(${35 * (1 - level)}px)`, transition: `transform .38s ${SMOOTH}` }} />
      </g>
      <g fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 21v-4a8 8 0 0 1 16 0v4" />
        <path d="M13 21h38a3 3 0 0 1 3 3l-1.6 29a5 5 0 0 1-5 4.7H16.6a5 5 0 0 1-5-4.7L10 24a3 3 0 0 1 3-3z" />
        <path d="M14 28.5h36" strokeDasharray="44" style={{ strokeDashoffset: zipped ? 0 : 44, transition: `stroke-dashoffset .42s ${SMOOTH}` }} />
        <path d="M44 28.5v5.5" style={{ opacity: zipped ? 1 : 0, transition: "opacity .2s .35s" }} />
      </g>
    </svg>
  );
}

// What was ticked in this visit to the app, so a prefetched (older) 오늘 page shows the bag as left.
const latest = new Map<string, { packed: string[]; finished: boolean }>();

export default function TodayBag(props: { date: string; bag: BagItem[]; packed: string[]; finished: boolean }) {
  const { date, bag } = props;
  const known = latest.get(date) ?? props;
  const [packed, setLocal] = useState(known.packed.filter((k) => bag.some((b) => b.key === k)));
  const [finished, setFinished] = useState(known.finished);
  const [collapsed, setCollapsed] = useState(known.finished || (bag.length > 0 && bag.every((b) => known.packed.includes(b.key))));
  useEffect(() => {
    latest.set(date, { packed, finished });
  }, [date, packed, finished]);
  const [, start] = useTransition();
  const id = useId().replace(/:/g, "");
  const card = useRef<HTMLElement>(null);
  const open = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLButtonElement>(null);
  const bagIcon = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const folding = useRef(false);

  if (bag.length === 0) {
    return (
      <section className="mb-3 flex items-center gap-3 rounded-[22px] border border-line bg-white px-4 py-3">
        <BagLine level={0} zipped size={30} clipId={`${id}e`} />
        <p className="text-sm font-bold">
          <span className="mr-2 text-[11.5px] font-extrabold tracking-[.06em] text-muted">오늘의 가방</span>따로 챙길 건 없어요
        </p>
      </section>
    );
  }

  const n = packed.length;
  const all = bag.length;
  const zipped = n === all || finished;
  const inBag = bag.filter((b) => packed.includes(b.key)).map((b) => nameOf(b.key));
  const left = bag.filter((b) => !packed.includes(b.key)).map((b) => nameOf(b.key));

  // Folding: the open part fades out, the card eases to its new height, the other part fades in.
  async function fold(toCollapsed: boolean, before?: () => void) {
    const el = card.current;
    if (!el || folding.current) return;
    folding.current = true;
    const outgoing = toCollapsed ? open.current : summary.current;
    await outgoing?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: SMOOTH, fill: "forwards" }).finished;
    const from = el.offsetHeight;
    flushSync(() => {
      setCollapsed(toCollapsed);
      before?.();
    });
    outgoing?.getAnimations().forEach((a) => a.cancel());
    const to = el.offsetHeight;
    const incoming = toCollapsed ? summary.current : open.current;
    incoming?.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: 160, easing: SMOOTH, fill: "backwards" });
    await el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 380, easing: SMOOTH }).finished;
    folding.current = false;
  }

  function toggle(b: BagItem, row: HTMLElement) {
    clearTimeout(timer.current);
    if (packed.includes(b.key)) {
      setLocal((p) => p.filter((k) => k !== b.key));
      start(() => setPacked(date, b.key, false));
      return;
    }
    navigator.vibrate?.(6);
    // the item's icon slides into the bag and fades — short and quiet
    const badge = row.querySelector<HTMLElement>("[data-badge]");
    const target = bagIcon.current?.getBoundingClientRect();
    if (badge && target) {
      const a = badge.getBoundingClientRect();
      const ghost = badge.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, zIndex: "50", pointerEvents: "none" });
      document.body.appendChild(ghost);
      const dx = target.left + target.width / 2 - (a.left + a.width / 2);
      const dy = target.top + target.height * 0.62 - (a.top + a.height / 2);
      ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 0 }], { duration: 300, easing: SMOOTH }).onfinish = () =>
        ghost.remove();
    }
    const next = [...packed, b.key];
    setTimeout(() => setLocal(next), 180);
    start(() => setPacked(date, b.key, true));
    // fold as soon as the zipper line has been drawn
    if (next.length === all) timer.current = setTimeout(() => fold(true), 620);
  }

  function finish() {
    clearTimeout(timer.current);
    navigator.vibrate?.(6);
    setFinished(true);
    start(() =>
      finishBag(
        date,
        packed,
        bag.filter((b) => !packed.includes(b.key)).map((b) => b.key)
      )
    );
    timer.current = setTimeout(() => fold(true), n === all ? 120 : 440);
  }

  return (
    <section ref={card} className="mb-3 overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_1px_2px_rgba(40,34,24,.04)]">
      {collapsed ? (
        <button ref={summary} type="button" onClick={() => fold(false, () => setFinished(false))} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <BagLine level={n / all} zipped size={30} clipId={`${id}s`} />
          <span className="min-w-0 flex-1">
            <b className="block text-sm">준비 완료</b>
            <span className="block truncate text-xs font-semibold text-muted">
              {inBag.length ? inBag.join(" · ") : "챙긴 것 없음"}
              {left.length > 0 && <span className="text-faint"> · {left.join(", ")} 빼고</span>}
            </span>
          </span>
          <span className="text-faint">⌄</span>
        </button>
      ) : (
        <div ref={open}>
          <div className="flex items-center justify-between px-4 pt-3.5">
            <span className="text-[11.5px] font-extrabold tracking-[.06em] text-muted">오늘의 가방</span>
            <span className="flex items-center gap-2.5">
              <span className="text-xs font-extrabold tabular-nums text-soft">
                {n}/{all}
              </span>
              <button type="button" onClick={finish} className="rounded-full border border-line px-3 py-1 text-xs font-extrabold text-navy active:bg-navy active:text-white">
                완료
              </button>
            </span>
          </div>
          <div className="flex items-center gap-3.5 px-4 pb-3.5 pt-2.5">
            <div ref={bagIcon} className="flex w-[78px] flex-none flex-col items-center">
              <BagLine level={n / all} zipped={zipped} size={78} clipId={`${id}o`} />
              <span className="mt-0.5 min-h-[14px] text-center text-[10.5px] font-bold text-muted">{zipped ? "준비 완료" : n ? `${all - n}개 남았어요` : ""}</span>
            </div>
            <div className="min-w-0 flex-1">
              {bag.map((b, i) => {
                const on = packed.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={(e) => toggle(b, e.currentTarget)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-2.5 py-[7px] text-left ${i > 0 ? "border-t border-[#F3EFE8]" : ""}`}
                  >
                    <span data-badge className={`transition-opacity duration-200 ${on ? "opacity-35" : ""}`}>
                      <AdviceBadge k={b.key} size={30} colder={b.colder} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className={`block text-sm leading-tight transition-colors duration-200 ${on ? "text-faint" : ""}`}>{nameOf(b.key)}</b>
                      <span className="block truncate text-[11.5px] font-semibold text-muted">{b.reason}</span>
                    </span>
                    <span
                      className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.6px] transition-colors duration-200"
                      style={{ background: on ? NAVY : "transparent", borderColor: on ? NAVY : "#CFC8BB" }}
                    >
                      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 6.2l2.4 2.4 4.6-5" strokeDasharray="16" style={{ strokeDashoffset: on ? 0 : 16, transition: "stroke-dashoffset .22s .06s ease-out" }} />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
