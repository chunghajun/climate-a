import PageSkeleton from "@/components/page-skeleton";

// Root fallback: also covers screens without their own loading.tsx, so it has no title.
export default function Loading() {
  return <PageSkeleton />;
}
