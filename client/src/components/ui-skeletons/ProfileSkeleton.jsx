import React from 'react';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
              <div className="h-3 bg-gray-105 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block space-y-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className="w-5 h-5 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-28"></div>
                </div>
              ))}
            </div>

            {/* Stats Card */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="h-3 bg-gray-75 bg-gray-700 rounded w-16 mx-auto mb-4"></div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                  <div className="h-3 bg-gray-700 rounded w-8"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-5">
            {/* Profile Header Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-20 bg-gray-200/50"></div>
              <div className="px-5 pb-5 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-10">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-gray-200"></div>

                  {/* User Info */}
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-36 mx-auto sm:mx-0"></div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <div className="h-3.5 bg-gray-200 rounded w-28"></div>
                      <div className="h-3.5 bg-gray-200 rounded w-28"></div>
                    </div>
                  </div>

                  {/* Button */}
                  <div className="w-20 h-8 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>

            {/* Profile Details blocks */}
            <div className="space-y-4">
              {/* Personal Info Card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="w-16 h-7 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                      <div className="h-9 bg-gray-200 rounded-lg w-full"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address Card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="w-24 h-7 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
