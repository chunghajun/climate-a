"use client";

// Page transitions that never freeze the screen. On a tap the current page is copied into a
// still overlay and the navigation starts right away; when the new page mounts (PageShell, from
// app/template.tsx) it animates in while the copy fades or slides away.
//   tab-next / tab-prev — 오늘·이번 주·이번 달: the copy fades out, the new page slides in 18px
//   push — 설정, + menu screens: the new page comes in from the right over the copy
//   pop  — back: the copy slides away to the right, revealing the new page
// Links prefetch their page, so the new screen usually arrives with its content at once.
// Tabs replace the history entry, so the phone's own back swipe does not cycle through them.
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type NavKind = "tab-next" | "tab-prev" | "push" | "pop";

const EASE = "cubic-bezier(.2,.8,.2,1)";
let pending: { kind: NavKind; copy: HTMLElement | null } | null = null;
const opened: string[] = []; // pages a push left from, so pop can go back in history

function copyCurrentPage() {
  const page = document.querySelector<HTMLElement>("[data-page-shell]");
  if (!page) return null;
  const r = page.getBoundingClientRect();
  const copy = page.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-page-shell");
  Object.assign(copy.style, {
    position: "fixed",
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "0",
    pointerEvents: "none",
    visibility: "hidden", // shown only once the new page is there
  });
  document.body.appendChild(copy);
  setTimeout(() => copy.remove(), 4000); // in case the navigation never lands
  return copy;
}

export function useNavTransition() {
  const router = useRouter();
  return (href: string, kind: NavKind) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pending?.copy?.remove();
    pending = reduced ? null : { kind, copy: copyCurrentPage() };
    if (kind.startsWith("tab")) router.replace(href);
    else if (kind === "push") {
      opened.push(location.pathname);
      router.push(href);
    } else if (opened.at(-1) === href.split("?")[0]) {
      // going back to the screen we came from: step back in history instead of adding an entry
      opened.pop();
      router.back();
    } else router.push(href);
  };
}

// Wraps every page (app/template.tsx, which remounts on each navigation): plays the entrance.
export function PageShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useLayoutEffect(() => {
    const p = pending;
    pending = null;
    const el = ref.current;
    if (!p || !el) return;
    // the page may have been shown from a prefetch; once it has settled, quietly bring it up to date
    setTimeout(() => router.refresh(), 400);
    const copy = p.copy;
    if (copy) copy.style.visibility = "visible";
    const done = () => copy?.remove();
    if (p.kind === "tab-next" || p.kind === "tab-prev") {
      const d = p.kind === "tab-next" ? 18 : -18;
      copy?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" }).finished.then(done);
      el.animate([{ opacity: 0, transform: `translateX(${d}px)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: EASE });
    } else if (p.kind === "push") {
      copy?.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(-40px)", opacity: 0.6 }], { duration: 280, easing: EASE, fill: "forwards" }).finished.then(done);
      el.animate(
        [
          { transform: "translateX(100%)", boxShadow: "-8px 0 24px rgba(31,29,26,.12)" },
          { transform: "none", boxShadow: "-8px 0 24px rgba(31,29,26,0)" },
        ],
        { duration: 280, easing: EASE }
      );
    } else {
      // pop: the leaving page (the copy) must be on top while it slides away
      if (copy) copy.style.zIndex = "2";
      copy?.animate([{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 260, easing: EASE, fill: "forwards" }).finished.then(done);
      el.animate([{ transform: "translateX(-40px)", opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: 260, easing: EASE });
    }
  }, [router]);
  return (
    <div ref={ref} data-page-shell className="relative z-[1] flex min-h-dvh flex-1 flex-col bg-paper">
      {children}
    </div>
  );
}

// A Link that navigates with a transition (plain clicks only; new-tab clicks behave as usual).
export function TLink({ href, kind, onClick, ...rest }: React.ComponentProps<typeof Link> & { href: string; kind: NavKind }) {
  const go = useNavTransition();
  return (
    <Link
      href={href}
      prefetch
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(href, kind);
      }}
    />
  );
}
