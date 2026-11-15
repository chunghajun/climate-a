import { TLink } from "./nav-transition";

const VIEWS = ["/", "/week", "/month", "/events", "/settings"];

export default function BackHeader({ href, title }: { href: string; title: string }) {
  return (
    <header className="flex items-center gap-3">
      <TLink
        href={VIEWS.includes(href) ? href : "/"}
        kind="pop"
        aria-label="뒤로"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-xl text-soft"
      >
        ‹
      </TLink>
      <h1 className="font-serif text-[22px] font-bold">{title}</h1>
    </header>
  );
}
