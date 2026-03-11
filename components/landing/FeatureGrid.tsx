const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Real-Time Monitoring",
    description:
      "Scans departing flights as fast as every 30 seconds depending on your plan. New routes appear the instant they are scheduled and available for booking.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
        <polyline points="7.5 19.79 7.5 14.6 3 12" />
        <polyline points="21 12 16.5 14.6 16.5 19.79" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "Instant Rebooking",
    description:
      "One-click booking powered by Duffel. See the price, confirm your details, and secure your seat in under 60 seconds.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Smart Alerts",
    description:
      "Push notifications and email alerts the moment a new flight matches your route. Never miss a departure window again.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-navy-700 p-6 transition-colors hover:border-accent/30"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              {f.icon}
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-400">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
