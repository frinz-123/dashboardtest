"use client";

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className = "", animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 rounded ${animate ? "animate-pulse" : ""} ${className}`}
      aria-label="Loading..."
    />
  );
}

export function ClientSearchSkeleton() {
  return (
    <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
      <div className="relative">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="mt-2">
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ProductListSkeleton() {
  return (
    <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9] space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center">
            <Skeleton className="h-9 w-9 rounded-l-lg" />
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-9 rounded-r-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
      <div className="flex justify-between items-center mt-2">
        <Skeleton className="h-3 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-12 rounded" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
    </div>
  );
}
