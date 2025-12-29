"use client";

export default function SellerSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="flex items-center justify-between py-3 border-b border-gray-100 px-2"
        >
          <div className="flex items-center min-w-0 flex-1">
            {/* Rank circle skeleton */}
            <div className="w-8 h-8 rounded-full bg-gray-200 mr-3 flex-shrink-0" />

            {/* Name and stats skeleton */}
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
              <div className="flex items-center space-x-3">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-1" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
          </div>

          {/* Sales info skeleton */}
          <div className="text-right flex-shrink-0 ml-4">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2 ml-auto" />
            <div className="h-3 bg-gray-200 rounded w-28 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
