import React from 'react';
import { cn } from './utils';

const Table = ({ children, className, ...props }) => (
  <div
    data-slot="table-scroll"
    className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain scrollbar-hide"
  >
    <table className={cn('w-max min-w-full caption-bottom text-xs sm:text-sm', className)} {...props}>
      {children}
    </table>
  </div>
);

const TableHeader = ({ className, ...props }) => (
  <thead className={cn('bg-slate-50/90 text-slate-600 dark:bg-slate-950/70 dark:text-slate-300 [&_tr]:border-b', className)} {...props} />
);

const TableBody = ({ className, ...props }) => (
  <tbody data-slot="table-body" className={cn('divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900 [&_tr:last-child]:border-0', className)} {...props} />
);

const TableRow = ({ className, ...props }) => (
  <tr
    data-slot="table-row"
    className={cn('border-b border-slate-100 transition-colors hover:bg-blue-50/60 data-[state=selected]:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20 dark:data-[state=selected]:bg-blue-950/30', className)}
    {...props}
  />
);

const TableHead = ({ className, ...props }) => (
  <th
    className={cn('h-11 whitespace-nowrap px-3 text-left align-middle text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-4 [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
);

const TableCell = ({ className, ...props }) => (
  <td
    className={cn('max-w-[20rem] px-3 py-3 align-middle text-slate-700 sm:px-4 [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
