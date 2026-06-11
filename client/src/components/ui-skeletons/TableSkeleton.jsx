import React from 'react';

const TableSkeleton = ({ rows = 8, cols = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-6 py-4 whitespace-nowrap">
              <div className="flex flex-col gap-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                {c === 0 && <div className="h-3 bg-gray-200 rounded w-32"></div>}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;
