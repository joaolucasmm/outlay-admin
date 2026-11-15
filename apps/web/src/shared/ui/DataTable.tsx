import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnDefTemplate,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';

interface DataTableProps<T> {
  /** Accessible name of the table (rendered as a visually hidden caption). */
  caption: string;
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
}

/**
 * Calls a header/cell template as a plain function. TanStack's `flexRender` mounts it
 * as a component instead, so inline column definitions (new functions every render)
 * would remount every cell, losing focus and DOM identity. Templates must not use hooks.
 */
function renderTemplate<P extends object>(
  template: ColumnDefTemplate<P> | undefined,
  props: P,
): ReactNode {
  if (template === undefined) return null;
  return typeof template === 'function' ? (template(props) as ReactNode) : template;
}

export function DataTable<T>({ caption, data, columns, getRowId }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, getRowId, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  {renderTemplate(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                  {renderTemplate(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
