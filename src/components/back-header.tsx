import { TLink } from "./nav-transition";

const VIEWS = ["/", "/week", "/month", "/events", "/settings"];

export default function BackHeader({ href, title }: { href: string; title: string }) {
  return (
    <header className="flex items-center gap-1.5">
      <TLink
        href={VIEWS.includes(href) ? href : "/"}
        kind="pop"
        aria-label="뒤로"
        className="-ml-2 flex h-9 w-9 items-center justify-center text-[26px] leading-none text-ink"
      >
        ‹
      </TLink>
      <h1 className="text-[20px] font-extrabold tracking-[-.02em]">{title}</h1>
    </header>
  );
}
