// Shown the moment a screen is opened while its data loads (loading.tsx), so page transitions
// start right away instead of waiting for the server.
export default function PageSkeleton({ title, back = false }: { title?: string; back?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6" aria-busy="true">
      {back ? (
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full border border-line bg-white" />
          {title ? <h1 className="font-serif text-[22px] font-bold">{title}</h1> : <span className="h-5 w-24 rounded bg-[#ECECEC]" />}
        </div>
      ) : (
        <>
          <div className="mb-1 h-3 w-28 rounded bg-[#ECECEC]" />
          {title ? <h1 className="font-serif text-[27px] font-bold leading-tight tracking-tight">{title}</h1> : <div className="h-8 w-40 rounded bg-[#ECECEC]" />}
          <div className="mb-4 mt-5 h-px bg-line" />
        </>
      )}
      <div className="mt-4 space-y-3 [animation:skeleton-pulse_1.2s_ease-in-out_infinite]">
        <div className="h-36 rounded-[22px] bg-white/80" />
        <div className="h-48 rounded-[22px] bg-white/80" />
        <div className="h-24 rounded-[22px] bg-white/80" />
      </div>
    </main>
  );
}
