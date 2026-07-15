import React from 'react';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-neutral-50/50 pb-12 font-sans animate-pulse">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Sidebar - Desktop */}
          <div className="hidden xl:block space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-100 p-2 shadow-sm space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 bg-neutral-100 rounded-md"></div>
                    <div className="h-3 bg-neutral-100 rounded-lg w-28"></div>
                  </div>
                  <div className="w-4 h-4 bg-neutral-100 rounded-md"></div>
                </div>
              ))}
            </div>

            {/* Stats Card */}
            <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="h-3 bg-neutral-100 rounded-lg w-16 mb-4"></div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 bg-neutral-100 rounded-lg w-20"></div>
                  <div className="h-3 bg-neutral-100 rounded-lg w-8"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="xl:col-span-3 space-y-5">
            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="h-10 bg-neutral-100/50"></div>
              <div className="px-4 pb-4 -mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm bg-neutral-100"></div>

                  {/* User Info */}
                  <div className="space-y-2">
                    <div className="h-4 bg-neutral-100 rounded-lg w-36"></div>
                    <div className="h-3 bg-neutral-100 rounded-lg w-28"></div>
                    <div className="h-3 bg-neutral-100 rounded-lg w-28"></div>
                  </div>
                </div>

                {/* Button */}
                <div className="w-8 h-8 bg-neutral-100 rounded-xl"></div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white border border-neutral-100 shadow-sm">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl"></div>
                  <div className="h-3 bg-neutral-100 rounded-lg w-12"></div>
                </div>
              ))}
            </div>

            {/* Profile Details blocks */}
            <div className="space-y-4">
              {/* Personal Info Card */}
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-neutral-100 rounded-lg w-32"></div>
                  <div className="w-16 h-7 bg-neutral-100 rounded-xl"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 bg-neutral-100 rounded-lg w-16"></div>
                      <div className="h-9 bg-neutral-100 rounded-xl w-full"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address Card */}
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-neutral-100 rounded-lg w-24"></div>
                  <div className="w-24 h-7 bg-neutral-100 rounded-xl"></div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-100 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-neutral-100 rounded-lg w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
