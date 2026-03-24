import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Coffee, Home } from 'lucide-react';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page Not Found';
  }, []);

  return (
    <main className="min-h-screen bg-[#f7efe4] text-[#5a3418]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <section className="relative w-full overflow-hidden rounded-3xl border border-[#e6cfb7] bg-white p-8 shadow-[0_20px_60px_rgba(122,85,57,0.15)] sm:p-12">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[#fbe4c9] blur-2xl" />
          <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-[#ffe8d3] blur-2xl" />

          <div className="relative z-10 flex flex-col items-start gap-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e6cfb7] bg-[#fff7ef] px-4 py-2 text-sm font-medium text-[#7a5539]">
              <Coffee className="h-4 w-4" />
              Tawla Scan
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a7a5d]">Error 404</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">This page does not exist.</h1>
            <p className="max-w-2xl text-base text-[#7a5539] sm:text-lg">
              The link may be outdated or mistyped. You can return to the menu or go to the restaurant dashboard.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6a4730] px-5 text-sm font-medium text-white transition-colors hover:bg-[#7a5539]"
              >
                <Home className="h-4 w-4" />
                Back To Menu
              </Link>
              <Link
                to="/restaurant"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d9c0a4] bg-[#fffcf8] px-5 text-sm font-medium text-[#7a5539] transition-colors hover:bg-[#f8ecd9]"
              >
                <ArrowLeft className="h-4 w-4" />
                Open Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}