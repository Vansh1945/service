import React from 'react';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Error from './Error';

const Table = ({
  columns = [],
  data = [],
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyTitle = "No records found",
  emptyMessage = "There is no data available to display.",
  stickyHeader = true,
  className = "",
  renderRow,
  rowKey = "id"
}) => {
  if (isLoading) {
    return <Loader text="Loading Table Data..." />;
  }

  if (isError) {
    return <Error title="Failed to Load Table" message={errorMessage} onRetry={onRetry} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} className="my-4" />;
  }

  return (
    <div className={`w-full overflow-x-auto rounded-2xl border border-neutral-100 bg-white shadow-sm ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={`border-b border-neutral-100 bg-neutral-50/80 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`px-4 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 text-xs font-medium text-secondary">
          {data.map((item, idx) => {
            if (renderRow) {
              return renderRow(item, idx);
            }
            const key = typeof rowKey === 'function' ? rowKey(item, idx) : item[rowKey] || idx;
            return (
              <tr key={key} className="hover:bg-neutral-50/50 transition-colors">
                {columns.map((col, cIdx) => (
                  <td key={col.key || cIdx} className={`px-4 py-3.5 whitespace-nowrap ${col.cellClassName || ''}`}>
                    {col.accessor ? col.accessor(item, idx) : item[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
