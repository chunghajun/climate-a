"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { pillButton } from "./ui";

// A button that opens a bottom sheet; the sheet content is rendered on the server and passed in.
// The sheet goes into <body> so it covers the tab bar (pages sit in their own layer).
export default function Sheet({ label, title, subtitle, children }: { label: string; title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button className={pillButton} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button aria-label="닫기" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[28px] bg-paper px-5 pb-[calc(32px+env(safe-area-inset-bottom))] pt-2.5">
              <div className="mx-auto mb-3.5 h-[5px] w-10 rounded-full bg-[#D8D2C6]" />
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="font-serif text-[22px] font-bold">
                  {title}
                  {subtitle && <span className="ml-2 font-sans text-xs font-semibold text-muted">{subtitle}</span>}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm font-bold text-muted"
                >
                  ✕
                </button>
              </div>
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
