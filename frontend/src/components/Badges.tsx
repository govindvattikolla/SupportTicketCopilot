import React from 'react';
import { TicketStatus, TicketPriority } from '../api/client';

export const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Open
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          In Progress
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Pending
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Resolved
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          Closed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
          {status}
        </span>
      );
  }
};

export const PriorityBadge: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
  switch (priority) {
    case 'P1':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          P1 Critical
        </span>
      );
    case 'P2':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          P2 High
        </span>
      );
    case 'P3':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          P3 Normal
        </span>
      );
    case 'P4':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          P4 Low
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{priority}</span>;
  }
};

export const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  return (
    <span className="capitalize px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 border border-slate-700">
      {category.replace('_', ' ')}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Admin
        </span>
      );
    case 'lead':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          Team Lead
        </span>
      );
    case 'agent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Agent
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
          {role}
        </span>
      );
  }
};

export const QueryStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'open':
    case 'submitted':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {status === 'submitted' ? 'Submitted' : 'Open'}
        </span>
      );
    case 'in_review':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          In Review
        </span>
      );
    case 'acknowledged':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          Acknowledged
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          In Progress
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Resolved
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
          Closed
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
};

export const UrgencyBadge: React.FC<{ urgency: string }> = ({ urgency }) => {
  switch (urgency) {
    case 'urgent':
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          {urgency === 'critical' ? 'Critical' : 'Urgent'}
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
          Medium
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
          Low
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{urgency}</span>;
  }
};

export const SLABadge: React.FC<{
  status?: 'healthy' | 'warning' | 'breached' | 'paused' | 'satisfied';
  label?: string;
  isBreached?: boolean;
}> = ({ status, label, isBreached }) => {
  if (isBreached || status === 'breached') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
        <span>{label || 'SLA Breached'}</span>
      </span>
    );
  }

  switch (status) {
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>{label || 'Approaching SLA'}</span>
        </span>
      );
    case 'paused':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          <span>{label || 'SLA Paused'}</span>
        </span>
      );
    case 'satisfied':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{label || 'SLA Met'}</span>
        </span>
      );
    case 'healthy':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{label || 'On Track'}</span>
        </span>
      );
  }
};

export const AttentionScoreBadge: React.FC<{
  score: number;
  tier?: 'critical' | 'high' | 'medium' | 'low';
  showLabel?: boolean;
}> = ({ score, tier, showLabel = true }) => {
  const calculatedTier =
    tier || (score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low');

  switch (calculatedTier) {
    case 'critical':
      return (
        <span
          title={`Attention Score: ${score}/100 (Critical Urgency)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-900/20"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          <span>{score}</span>
          {showLabel && <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/90">Critical</span>}
        </span>
      );
    case 'high':
      return (
        <span
          title={`Attention Score: ${score}/100 (High Urgency)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-900/20"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>{score}</span>
          {showLabel && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">High</span>}
        </span>
      );
    case 'medium':
      return (
        <span
          title={`Attention Score: ${score}/100 (Medium Urgency)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span>{score}</span>
          {showLabel && <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400/80">Medium</span>}
        </span>
      );
    case 'low':
    default:
      return (
        <span
          title={`Attention Score: ${score}/100 (Low Urgency)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span>{score}</span>
          {showLabel && <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Low</span>}
        </span>
      );
  }
};



