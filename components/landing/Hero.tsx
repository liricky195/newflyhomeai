import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-24 text-center md:pt-32">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
          Real-time flight monitoring
        </p>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
          Never miss your next flight out,
          <br />
          <span className="text-accent">ever again.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          Passive flight monitoring for airports with major disruptions.
          Instantly find and book rerouted flights home from your stranded&nbsp;airport.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/auth"
            className="rounded-lg bg-accent px-8 py-3 text-sm font-bold uppercase tracking-wider text-navy transition-all hover:bg-accent-dark hover:shadow-lg hover:shadow-accent/20"
          >
            Get Home Now
          </Link>
          <Link
            href="/plans"
            className="rounded-lg border border-border px-8 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            View Plans
          </Link>
        </div>

        <div className="mt-12 flex items-center justify-center gap-6 text-xs text-slate-500">
          <span className="font-mono">DXB</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="font-mono">AUH</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="font-mono">DOH</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="font-mono">BAH</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="font-mono">KWI</span>
        </div>
      </div>
    </section>
  );
}
