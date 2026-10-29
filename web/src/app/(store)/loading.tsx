// Shown the instant a link is clicked (and prefetched with the route), so navigation never feels stuck
// while the server renders the next page.
export default function StoreLoading() {
  return (
    <div className="container-x py-10 md:py-14" aria-busy="true" aria-live="polite">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-4 h-10 w-2/3 max-w-md md:h-14" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5] w-full" />
            <div className="skeleton mt-3 h-3 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
