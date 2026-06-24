import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-card', className)}
    />
  );
}

export function PluginListSkeleton() {
  return (
    <div className="space-y-sm">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg bg-surface-card p-xl">
          <Skeleton className="mb-sm h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
