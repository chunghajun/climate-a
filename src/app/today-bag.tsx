"use client";

// 오늘의 가방 (A안): a light-blue bag with a handle and a dashed zipper, the day's items as chips.
// Ticking a chip sends its name up into the bag; when everything is ticked (or 완료 is pressed) the
// zipper closes and the card folds into a one-line summary. Tapping the summary opens it again.
import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { ADVICE_LABEL, type AdviceKey } from "@/lib/advice";
import type { BagItem } from "@/lib/outing";
import { finishBag, setPacked } from "./actions/bag";

const nameOf = (k: AdviceKey) => (k === "range" ? "겉옷" : k === "heat" ? "물" : ADVICE_LABEL[k]);
const SMOOTH = "cubic-bezier(.4,0,.2,1)";

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
  const card = useRef<HTMLDivElement>(null);
  const open = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLButtonElement>(null);
  const bagIcon = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const folding = useRef(false);

  if (bag.length === 0) {
    return (
      <section className="relative mb-5 pt-[18px]">
        <Handle zipped />
        <div className="relative rounded-[24px] bg-sky px-4 pb-4 pt-7 text-center">
          <Zipper zipped />
          <h3 className="text-[15.5px] font-extrabold">오늘의 가방</h3>
          <p className="mt-1.5 text-[12.5px] text-[#5a5a5a]">따로 챙길 건 없어요</p>
        </div>
      </section>
    );
  }

  const n = packed.length;
  const all = bag.length;
  const zipped = n === all || finished;
  const inBag = bag.filter((b) => packed.includes(b.key)).map((b) => nameOf(b.key));
  const left = bag.filter((b) => !packed.includes(b.key)).map((b) => nameOf(b.key));
  const why = [...new Set(bag.map((b) => b.reason).filter(Boolean))].join(" · ");

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
    <section className="relative mb-5 pt-[18px]">
      <Handle zipped={zipped} small={collapsed} />
      <span ref={bagIcon} className="absolute left-1/2 top-0 h-8 w-10 -translate-x-1/2" aria-hidden />
      <div ref={card} className="relative overflow-hidden rounded-[24px] bg-sky">
        <Zipper zipped={zipped} />
        {collapsed ? (
          <button ref={summary} type="button" onClick={() => fold(false, () => setFinished(false))} className="flex w-full items-center gap-3 px-4 pb-3.5 pt-[22px] text-left">
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] font-extrabold">{left.length ? "준비 완료" : "가방 다 챙겼어요"}</b>
              <span className="mt-0.5 block truncate text-[12.5px] text-[#5a5a5a]">
                {inBag.length ? inBag.join(" · ") : "챙긴 것 없음"}
                {left.length > 0 && <span className="text-muted"> · {left.join(", ")} 빼고</span>}
              </span>
            </span>
            <span className="text-[13px] font-bold text-blue">펼치기</span>
          </button>
        ) : (
          <div ref={open} className="px-4 pb-4 pt-7 text-center">
            <h3 className="text-[15.5px] font-extrabold">
              오늘의 가방
              <span className="ml-1.5 text-[12px] font-bold tabular-nums text-blue">
                {n}/{all}
              </span>
            </h3>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {bag.map((b) => {
                const on = packed.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={(e) => toggle(b, e.currentTarget)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 text-[14px] font-bold shadow-[0_1px_2px_rgba(30,50,100,.06)] transition-colors duration-200 ${on ? "bg-blue text-white" : "bg-white text-ink"}`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors duration-200 ${on ? "border-white bg-white" : "border-[#9a9a9a]"}`}
                    >
                      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke={BLUE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 6.2l2.4 2.4 4.6-5" strokeDasharray="16" style={{ strokeDashoffset: on ? 0 : 16, transition: "stroke-dashoffset .22s .06s ease-out" }} />
                      </svg>
                    </span>
                    <span data-badge>{nameOf(b.key)}</span>
                  </button>
                );
              })}
            </div>
            {why && <p className="mt-3 text-[12.5px] leading-relaxed text-[#5a5a5a]">{why}</p>}
            <button type="button" onClick={finish} className="mt-2.5 px-3 py-1 text-[13px] font-extrabold text-blue">
              완료
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const BLUE = "#3A6FD8";

// The bag's handle: an arc above the card. It shrinks when the card is folded.
function Handle({ zipped, small }: { zipped: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-0 -translate-x-1/2 rounded-t-full border-x-[5px] border-t-[5px] border-blue transition-[width,height,opacity] duration-300"
      style={{ width: small ? 72 : 96, height: small ? 30 : 44, opacity: zipped || !small ? 1 : 0.85 }}
    />
  );
}

// Dashed zipper line with a pull tab; it turns solid when everything is packed.
function Zipper({ zipped }: { zipped: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute left-[22px] right-[22px] top-3.5 border-t-2 transition-colors duration-300"
        style={{ borderStyle: zipped ? "solid" : "dashed", borderColor: zipped ? BLUE : "#AFC3EC" }}
      />
      <span
        aria-hidden
        className="absolute top-2 h-[13px] w-9 -translate-x-1/2 rounded-[7px] bg-blue transition-[left] duration-500"
        style={{ left: zipped ? "calc(100% - 40px)" : "50%" }}
      />
    </>
  );
}
