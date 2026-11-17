"use client";

import { useEffect, useRef } from "react";

export const ROW = 36; // wheel row height

// One wheel column of the time picker (scroll-snapped, like the phone's alarm).
export default function Wheel({ items, index, onPick, wide }: { items: string[]; index: number; onPick: (i: number) => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ROW;
    // only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      onScroll={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => ref.current && onPick(Math.round(ref.current.scrollTop / ROW)), 80);
      }}
      className="relative z-[1] h-[216px] snap-y snap-mandatory overflow-y-scroll py-[90px] text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ width: wide ? 76 : 64 }}
    >
      {items.map((x) => (
        <div key={x} className={`h-9 snap-center leading-9 tabular-nums text-soft ${wide ? "text-lg" : "text-[22px]"}`}>
          {x}
        </div>
      ))}
    </div>
  );
}
