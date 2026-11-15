import { PageShell } from "@/components/nav-transition";

// Remounts on every navigation, so each page can play its entrance (see nav-transition.tsx).
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
