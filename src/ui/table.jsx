import React from 'react';

const Table = ({ children, className, ...props }) => (
  <div className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain">
    <table className={`w-max min-w-full caption-bottom text-sm ${className}`} {...props}>
      {children}
    </table>
  </div>
);

const TableHeader = ({ className, ...props }) => (
  <thead className={`[&_tr]:border-b ${className}`} {...props} />
);

const TableBody = ({ className, ...props }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);

const TableRow = ({ className, ...props }) => (
  <tr
    className={`border-b transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100 ${className}`}
    {...props}
  />
);

const TableHead = ({ className, ...props }) => (
  <th
    className={`h-12 whitespace-nowrap px-3 text-left align-middle font-medium text-slate-500 sm:px-4 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
);

const TableCell = ({ className, ...props }) => (
  <td
    className={`px-3 py-3 align-middle sm:px-4 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
