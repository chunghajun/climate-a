"use client";

// Shown instead of the bare "server error" page when a view fails to load
// (e.g. the database is briefly unavailable).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center">
      <p className="text-4xl">🌧️</p>
      <h1 className="mt-3 font-serif text-2xl font-bold">잠시 불러오지 못했어요</h1>
      <p className="mt-2 text-sm text-soft">
        서버가 잠깐 바빠요. 조금 뒤에 다시 열어 주세요.
        <br />
        알림은 복구되면 다시 정상적으로 와요.
      </p>
      <button onClick={reset} className="mt-6 rounded-xl bg-navy px-5 py-3 font-bold text-white">
        다시 시도
      </button>
    </main>
  );
}
