const PRODUCT_SKELETON_KEYS = [
  "product-skeleton-1",
  "product-skeleton-2",
  "product-skeleton-3",
  "product-skeleton-4",
  "product-skeleton-5",
  "product-skeleton-6",
];

export default function Loading() {
  return (
    <div
      className="min-h-screen bg-white font-sans w-full"
      style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8rem" }}
    >
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="space-y-2 w-32 animate-pulse">
            <div className="h-7 rounded bg-slate-200" />
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-3" aria-busy="true">
        <div className="bg-white rounded-lg p-3 border border-[#E2E4E9] space-y-2">
          <div className="h-10 rounded-md bg-slate-200 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
        </div>

        <div className="bg-white rounded-lg p-3 border border-[#E2E4E9] space-y-3">
          <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
          <div className="h-[300px] rounded-lg bg-slate-200 animate-pulse" />
        </div>

        <div className="bg-white rounded-lg p-3 border border-[#E2E4E9] space-y-3">
          {PRODUCT_SKELETON_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
              <div className="h-9 rounded-md bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
