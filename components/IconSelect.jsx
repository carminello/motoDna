'use client';

// Icon selector styled like the MotoDNA café racer badge.
// Each option is a rounded shield card with the icon centered,
// an orange racing stripe accent, and a mono uppercase label below.
export default function IconSelect({ value, onChange, options, columns = 4 }) {
  const gridClass = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-4 sm:grid-cols-5',
    6: 'grid-cols-4 sm:grid-cols-6',
  }[columns] || 'grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-2`}>
      {options.map(opt => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="group flex flex-col items-center gap-1.5"
          >
            <div
              className={`relative flex items-center justify-center w-full aspect-square rounded-xl border-2 transition-all overflow-hidden ${
                selected
                  ? 'bg-gradient-to-br from-orange-500/25 to-red-600/10 border-orange-500 shadow-[0_0_20px_-4px_rgba(238,100,50,0.5)]'
                  : 'bg-neutral-950 border-white/10 group-hover:border-orange-500/40 group-hover:bg-neutral-900'
              }`}
            >
              {/* Racing stripe accent — matches logo */}
              <div className={`absolute inset-x-0 top-[42%] h-[3px] ${selected ? 'bg-orange-500/60' : 'bg-white/5'}`} />
              {/* Motorsport dots at bottom — matches logo */}
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                <span className={`w-0.5 h-0.5 rounded-full ${selected ? 'bg-orange-400' : 'bg-white/15'}`} />
                <span className={`w-0.5 h-0.5 rounded-full ${selected ? 'bg-orange-400' : 'bg-white/15'}`} />
                <span className={`w-0.5 h-0.5 rounded-full ${selected ? 'bg-orange-400' : 'bg-white/15'}`} />
              </div>
              <Icon
                className={`relative w-6 h-6 transition ${selected ? 'text-orange-400' : 'text-neutral-300 group-hover:text-white'}`}
                strokeWidth={1.6}
              />
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider text-center leading-tight transition ${
                selected ? 'text-orange-400' : 'text-neutral-500 group-hover:text-neutral-300'
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
