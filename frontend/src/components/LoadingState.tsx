import React from 'react';

interface LoadingStateProps {
  message?: string;
  type?: 'spinner' | 'skeleton' | 'table' | 'cards';
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data from server...',
  type = 'spinner',
  rows = 4,
}) => {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-800/60 border border-slate-800 p-5">
            <div className="h-4 w-24 bg-slate-700/60 rounded mb-3" />
            <div className="h-8 w-16 bg-slate-700/80 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mb-6" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50">
            <div className="flex items-center gap-3 w-1/3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 shrink-0" />
              <div className="h-4 w-full bg-slate-800 rounded" />
            </div>
            <div className="h-4 w-20 bg-slate-800 rounded" />
            <div className="h-4 w-16 bg-slate-800 rounded" />
            <div className="h-4 w-24 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative w-10 h-10 mb-4">
        <div className="w-10 h-10 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
      <p className="text-xs text-slate-400 font-medium">{message}</p>
    </div>
  );
};
