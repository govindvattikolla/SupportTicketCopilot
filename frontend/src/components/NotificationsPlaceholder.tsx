import React, { useState } from 'react';
import { Bell, Info, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export const NotificationsPlaceholder: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed) {
    return (
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsDismissed(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
        >
          <Bell className="w-3 h-3 text-brand-400" />
          <span>Show Notification Center</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900/95 via-indigo-950/20 to-slate-900/95 border border-indigo-500/20 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                Staff Notification Center
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-brand-500/15 text-brand-400 border border-brand-500/25">
                <Sparkles className="w-2.5 h-2.5" />
                Preview Area
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">
              Real-time push notifications and SLA breach alert streams will be activated in an upcoming phase. You currently have <strong className="text-slate-200">0 pending alerts</strong>.
            </p>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>System initialized successfully. All queues are running normally.</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Today</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition text-xs flex items-center gap-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Dismiss notification box"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
