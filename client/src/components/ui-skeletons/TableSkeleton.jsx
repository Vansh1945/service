import React from 'react';

/**
 * Reusable Table Skeleton Loader.
 * Accepts `cols` or `columns`, `rows`, and optional `standalone` flag.
 * If `standalone` is true, wraps skeleton in <table><tbody> to satisfy HTML DOM nesting rules.
 */
const TableSkeleton = ({ rows = 8, cols = 5, columns, standalone = false }) => {
  const columnCount = columns || cols || 5;

  const skeletonRows = Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="animate-pulse border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {Array.from({ length: columnCount }).map((_, c) => (
        <td key={c} className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col gap-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            {c === 0 && <div className="h-3 bg-gray-200 rounded w-32"></div>}
          </div>
        </td>
      ))}
    </tr>
  ));

  if (standalone) {
    return (
      <div className="overflow-x-auto w-full p-6">
        <table className="w-full text-left text-xs text-slate-600">
          <tbody>
            {skeletonRows}
          </tbody>
        </table>
      </div>
    );
  }

  return <>{skeletonRows}</>;
};

export default TableSkeleton;
