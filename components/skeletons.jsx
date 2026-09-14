'use client';

// Page-shaped skeleton loaders for MotoDNA.
// Each exported component mirrors the layout of the corresponding page,
// so the switch from skeleton → content has NO layout shift (CLS = 0).
//
// Visual style: neutral tinted blocks on the black background,
// matching the metallic café-racer aesthetic without introducing
// dominant colours.

import { Skeleton } from '@/components/ui/skeleton';

// A tuned Skeleton with a brand-aligned tint that fits the café-racer theme.
// (The default shadcn Skeleton uses bg-primary/10; we lock it to an explicit
// orange @ 10% so it stays readable on pure-black backgrounds and echoes the
// MotoDNA accent without being loud.)
export function Sk({ className = '' }) {
  return <Skeleton className={`bg-orange-500/10 ${className}`} />;
}

/* ------------------------------------------------------------------ */
/*                              LAYOUT PARTS                           */
/* ------------------------------------------------------------------ */

function StickyHeaderSk({ compact = false }) {
  return (
    <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
      <div className={`${compact ? 'max-w-3xl' : 'max-w-6xl'} mx-auto px-5 py-3 flex items-center gap-3`}>
        <Sk className="w-8 h-8 rounded-md" />
        <Sk className="w-7 h-7 rounded-full" />
        <Sk className="w-28 h-4 rounded" />
        <div className="flex-1" />
        <Sk className="w-20 h-8 rounded-md" />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*                              DASHBOARD                              */
/* ------------------------------------------------------------------ */

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <StickyHeaderSk />
      <div className="max-w-6xl mx-auto px-5 pt-8">
        {/* Greeting */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <Sk className="w-28 h-3 rounded mb-2" />
            <Sk className="w-64 h-10 rounded-md" />
          </div>
          <Sk className="w-36 h-10 rounded-md" />
        </div>

        {/* Stats row (4 cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="metallic rounded-xl p-4 space-y-2">
              <Sk className="w-4 h-4 rounded" />
              <Sk className="w-14 h-7 rounded" />
              <Sk className="w-16 h-2.5 rounded" />
            </div>
          ))}
        </div>

        {/* Bike grid (2 cards) */}
        <Sk className="w-32 h-5 rounded mb-4" />
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="metallic overflow-hidden rounded-xl">
              <Sk className="w-full h-48 rounded-none" />
              <div className="p-5">
                <Sk className="w-16 h-3 rounded mb-2" />
                <Sk className="w-40 h-6 rounded mb-2" />
                <Sk className="w-24 h-4 rounded" />
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Sk className="w-8 h-2.5 rounded" />
                    <Sk className="w-16 h-4 rounded" />
                  </div>
                  <Sk className="w-24 h-3 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                             MOTO DETAIL                             */
/* ------------------------------------------------------------------ */

export function MotoDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <StickyHeaderSk />
      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <Sk className="w-full h-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-6xl mx-auto px-5 pb-6 space-y-3">
          <Sk className="w-40 h-6 rounded" />
          <Sk className="w-72 h-12 rounded-md" />
          <Sk className="w-52 h-4 rounded" />
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-5 pt-6">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Sk key={i} className="aspect-square rounded-xl md:h-20" />
          ))}
        </div>

        {/* Body: 2 columns like the "overview" tab */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="metallic p-6 rounded-xl space-y-3">
            <Sk className="w-40 h-5 rounded mb-4" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between border-b border-white/5 py-2">
                <Sk className="w-20 h-3 rounded" />
                <Sk className="w-24 h-4 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="metallic p-6 rounded-xl space-y-3">
              <Sk className="w-32 h-4 rounded" />
              <Sk className="w-16 h-8 rounded" />
              <Sk className="w-full h-8 rounded" />
            </div>
            <div className="metallic p-6 rounded-xl space-y-2">
              <Sk className="w-24 h-4 rounded mb-2" />
              <Sk className="w-full h-3 rounded" />
              <Sk className="w-11/12 h-3 rounded" />
              <Sk className="w-3/4 h-3 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                           PUBLIC PROFILE (/m)                       */
/* ------------------------------------------------------------------ */

export function PublicProfileSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top brand bar */}
      <div className="border-b border-white/5 bg-black/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sk className="w-7 h-7 rounded-full" />
            <Sk className="w-24 h-4 rounded" />
          </div>
          <Sk className="w-24 h-3 rounded" />
        </div>
      </div>

      {/* Hero */}
      <section className="relative">
        <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
          <Sk className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/50" />
          <div className="relative h-full max-w-5xl mx-auto px-5 flex flex-col justify-end pb-10 space-y-4">
            <Sk className="w-44 h-6 rounded-full" />
            <Sk className="w-36 h-3 rounded" />
            <Sk className="w-72 h-16 rounded-md" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Sk key={i} className="w-24 h-14 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/10 bg-neutral-950">
        <div className="max-w-5xl mx-auto px-5 py-4 grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center space-y-1">
              <Sk className="w-4 h-4 rounded mx-auto" />
              <Sk className="w-10 h-6 rounded mx-auto" />
              <Sk className="w-16 h-2.5 rounded mx-auto" />
            </div>
          ))}
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="metallic p-6 rounded-xl mb-8 space-y-3">
          <Sk className="w-24 h-3 rounded" />
          <Sk className="w-full h-3 rounded" />
          <Sk className="w-10/12 h-3 rounded" />
          <Sk className="w-8/12 h-3 rounded" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="w-24 h-9 rounded-md" />
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metallic p-5 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Sk className="w-16 h-4 rounded" />
                <Sk className="w-32 h-3 rounded" />
              </div>
              <Sk className="w-56 h-5 rounded" />
              <Sk className="w-full h-3 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                              COMMUNITY                              */
/* ------------------------------------------------------------------ */

export function CommunitySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="metallic overflow-hidden rounded-xl">
          <Sk className="w-full h-52 rounded-none" />
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sk className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="w-32 h-4 rounded" />
                <Sk className="w-24 h-3 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Sk className="w-14 h-3 rounded" />
              <Sk className="w-16 h-3 rounded" />
            </div>
            <div className="flex gap-2 mt-2">
              <Sk className="flex-1 h-8 rounded-md" />
              <Sk className="flex-1 h-8 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                                ADMIN                                */
/* ------------------------------------------------------------------ */

export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <StickyHeaderSk />
      <div className="max-w-7xl mx-auto px-5 pt-8">
        <Sk className="w-40 h-3 rounded mb-2" />
        <Sk className="w-72 h-10 rounded-md mb-6" />

        {/* Primary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metallic p-4 rounded-xl space-y-2">
              <Sk className="w-4 h-4 rounded" />
              <Sk className="w-16 h-8 rounded" />
              <Sk className="w-20 h-2.5 rounded" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="metallic p-6 rounded-xl mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Sk className="w-56 h-4 rounded" />
              <Sk className="w-40 h-3 rounded" />
            </div>
            <Sk className="w-14 h-5 rounded-md" />
          </div>
          <Sk className="w-full h-64 rounded-lg" />
        </div>

        {/* Secondary stats */}
        <Sk className="w-48 h-5 rounded mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metallic p-4 rounded-xl space-y-2">
              <Sk className="w-4 h-4 rounded" />
              <Sk className="w-16 h-8 rounded" />
              <Sk className="w-20 h-2.5 rounded" />
            </div>
          ))}
        </div>

        {/* Recent users */}
        <div className="metallic p-6 rounded-xl space-y-3">
          <Sk className="w-52 h-4 rounded mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <Sk className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Sk className="w-40 h-4 rounded" />
                <Sk className="w-56 h-3 rounded" />
              </div>
              <Sk className="w-16 h-3 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                          MESSAGES INBOX                             */
/* ------------------------------------------------------------------ */

export function MessagesInboxSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="metallic p-4 rounded-xl flex items-center gap-3">
          <Sk className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Sk className="w-40 h-4 rounded" />
            <Sk className="w-64 h-3 rounded" />
          </div>
          <Sk className="w-10 h-3 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                                CHAT                                 */
/* ------------------------------------------------------------------ */

export function ChatSkeleton() {
  // Alternating message bubbles.
  const rows = [
    { mine: false, w: 'w-56' },
    { mine: true,  w: 'w-40' },
    { mine: false, w: 'w-64' },
    { mine: true,  w: 'w-48' },
    { mine: false, w: 'w-32' },
  ];
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <StickyHeaderSk compact />
      <div className="flex-1 overflow-hidden px-5 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {rows.map((r, i) => (
            <div key={i} className={`flex ${r.mine ? 'justify-end' : 'justify-start'}`}>
              <Sk className={`${r.w} h-12 rounded-2xl`} />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/5 bg-black/70 backdrop-blur shrink-0">
        <div className="max-w-3xl mx-auto px-5 py-3 flex gap-2 items-end">
          <Sk className="flex-1 h-11 rounded-md" />
          <Sk className="w-11 h-11 rounded-md shrink-0" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                            USER PROFILE (/u)                        */
/* ------------------------------------------------------------------ */

export function UserProfileSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <StickyHeaderSk />
      <div className="max-w-5xl mx-auto px-5 pt-8">
        <div className="flex flex-col items-center text-center mb-8 space-y-3">
          <Sk className="w-32 h-32 rounded-full" />
          <Sk className="w-48 h-8 rounded" />
          <Sk className="w-24 h-3 rounded" />
          <div className="flex items-center gap-4 mt-2">
            <Sk className="w-16 h-3 rounded" />
            <Sk className="w-24 h-3 rounded" />
            <Sk className="w-28 h-3 rounded" />
          </div>
          <Sk className="w-44 h-10 rounded-md mt-3" />
        </div>

        <Sk className="w-52 h-5 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metallic overflow-hidden rounded-xl">
              <Sk className="w-full h-40 rounded-none" />
              <div className="p-4 space-y-2">
                <Sk className="w-16 h-3 rounded" />
                <Sk className="w-36 h-5 rounded" />
                <Sk className="w-40 h-3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                              TRANSFER                               */
/* ------------------------------------------------------------------ */

export function TransferSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <div className="metallic p-8 max-w-md w-full rounded-xl space-y-4">
        <Sk className="w-12 h-12 rounded-full mx-auto" />
        <Sk className="w-56 h-6 rounded mx-auto" />
        <Sk className="w-full h-3 rounded" />
        <Sk className="w-3/4 h-3 rounded mx-auto" />
        <Sk className="w-32 h-8 rounded mx-auto" />
        <Sk className="w-full h-10 rounded-md" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                    Full-page fallback (route-level)                 */
/* ------------------------------------------------------------------ */

// A generic placeholder for `app/loading.js` and similar route-level fallbacks.
// Used only where a page-specific skeleton isn't available.
export function GenericPageSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <StickyHeaderSk />
      <div className="max-w-6xl mx-auto px-5 pt-8 space-y-4">
        <Sk className="w-64 h-10 rounded-md" />
        <Sk className="w-full h-56 rounded-xl" />
        <Sk className="w-full h-40 rounded-xl" />
      </div>
    </div>
  );
}
