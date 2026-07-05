interface Props {
  variant?: 'spinner' | 'grid' | 'release' | 'watch'
  count?: number
}

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-xl bg-white/[0.05] border border-white/[0.06]" />
      <div className="mt-3 h-3 rounded bg-white/[0.05]" />
      <div className="mt-2 h-3 w-2/3 rounded bg-white/[0.04]" />
    </div>
  )
}

export default function Spinner({ variant = 'spinner', count = 6 }: Props) {
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (variant === 'release') {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-4 w-20 rounded bg-white/[0.05] mb-6" />
        <div className="flex gap-6 sm:gap-8 flex-col sm:flex-row">
          <div className="w-44 sm:w-52 aspect-[2/3] rounded-2xl bg-white/[0.05] border border-white/[0.06]" />
          <div className="flex-1">
            <div className="h-8 w-2/3 rounded bg-white/[0.06]" />
            <div className="mt-3 h-4 w-1/2 rounded bg-white/[0.05]" />
            <div className="mt-5 flex gap-2 flex-wrap">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-7 w-20 rounded-full bg-white/[0.04]" />
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-4 rounded bg-white/[0.04]" />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 h-48 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      </div>
    )
  }

  if (variant === 'watch') {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-4 w-20 rounded bg-white/[0.05] mb-6" />
        <div className="h-8 w-1/2 rounded bg-white/[0.06] mb-5" />
        <div className="flex gap-2 flex-wrap mb-7">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
    </div>
  )
}
