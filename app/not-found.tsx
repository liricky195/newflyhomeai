import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <span className="text-8xl font-bold text-navy-600">404</span>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="text-sm text-slate-400">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
      >
        Back to Home
      </Link>
    </div>
  );
}
