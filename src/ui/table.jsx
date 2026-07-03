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
  <thead className={cn('bg-slate-50/80 text-slate-600 [&_tr]:border-b', className)} {...props} />
);

const TableBody = ({ className, ...props }) => (
  <tbody className={cn('divide-y divide-slate-100 bg-white [&_tr:last-child]:border-0', className)} {...props} />
);

const TableRow = ({ className, ...props }) => (
  <tr
    className={cn('border-b transition-colors hover:bg-slate-50/70 data-[state=selected]:bg-slate-100', className)}
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
