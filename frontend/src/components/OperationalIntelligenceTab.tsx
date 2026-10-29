import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getUrgencyRankingApi,
  getBottleneckAnalyticsApi,
  getRecurringIssuesApi,
  assignTicketApi,
  getAgentRecommendationsApi,
  RankedTicket,
  UrgencyTier,
} from '../api/client';
import { StatCard } from './StatCard';
import {
  StatusBadge,
  PriorityBadge,
  CategoryBadge,
  AttentionScoreBadge,
} from './Badges';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import {
  Flame,
  AlertTriangle,
  Sparkles,
  Inbox,
  Clock,
  Users,
  Search,
  Filter,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldAlert,
  Cpu,
  BarChart2,
  Info,
  X,
  RefreshCw,
} from 'lucide-react';

interface OperationalIntelligenceTabProps {
  userRole?: string;
}

export const OperationalIntelligenceTab: React.FC<OperationalIntelligenceTabProps> = ({
  userRole,
}) => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<
    'urgency' | 'bottlenecks' | 'clusters' | 'workload'
  >('urgency');

  // Urgency filter states
  const [tierFilter, setTierFilter] = useState<'all' | UrgencyTier>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Quick Reassign Modal state
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<RankedTicket | null>(null);

  // Queries
  const {
    data: urgencyData,
    isLoading: isUrgencyLoading,
    isError: isUrgencyError,
    refetch: refetchUrgency,
  } = useQuery({
    queryKey: ['urgencyRanking'],
    queryFn: () => getUrgencyRankingApi({ limit: 150 }),
  });

  const {
    data: bottleneckData,
    isLoading: isBottlenecksLoading,
    isError: isBottlenecksError,
    refetch: refetchBottlenecks,
  } = useQuery({
    queryKey: ['bottlenecks'],
    queryFn: () => getBottleneckAnalyticsApi(),
  });

  const {
    data: clustersData,
    isLoading: isClustersLoading,
    isError: isClustersError,
    refetch: refetchClusters,
  } = useQuery({
    queryKey: ['recurringIssues'],
    queryFn: () => getRecurringIssuesApi({ daysLookback: 30 }),
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, agentId }: { ticketId: string; agentId: string | null }) =>
      assignTicketApi(ticketId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urgencyRanking'] });
      queryClient.invalidateQueries({ queryKey: ['bottlenecks'] });
      setSelectedTicketForAssign(null);
    },
  });

  // Quick recommend query for the selected ticket
  const { data: quickRecsData, isLoading: isLoadingQuickRecs } = useQuery({
    queryKey: ['quickRecommendations', selectedTicketForAssign?.ticketId],
    queryFn: () => getAgentRecommendationsApi(selectedTicketForAssign!.ticketId),
    enabled: Boolean(selectedTicketForAssign),
  });

  const canAssign = userRole === 'admin' || userRole === 'lead';

  // Filter ranked tickets
  const filteredTickets = (urgencyData?.tickets || []).filter((t) => {
    if (tierFilter !== 'all' && t.urgencyTier !== tierFilter) return false;
    if (assignmentFilter === 'unassigned' && t.assignedTo) return false;
    if (assignmentFilter === 'assigned' && !t.assignedTo) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5 text-brand-400" />
            SupportFlow Operational Intelligence
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Queue Intelligence & Bottleneck Radar
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Real-time attention scoring, workload-aware agent matching, deterministic incident
            clustering, and operational bottleneck analytics driven by real database aggregation.
          </p>
        </div>

        <button
          onClick={() => {
            refetchUrgency();
            refetchBottlenecks();
            refetchClusters();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium border border-slate-600 transition shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Critical Urgency"
          value={urgencyData?.tierCounts.critical ?? 0}
          icon={Flame}
          variant="rose"
          subtitle="Attention Score ≥ 75"
        />
        <StatCard
          title="Unassigned Queue"
          value={bottleneckData?.summary.unassignedCount ?? 0}
          icon={Inbox}
          variant="amber"
          subtitle={
            bottleneckData
              ? `Avg wait: ${bottleneckData.unassigned.avgWaitingHours}h`
              : 'Awaiting triage'
          }
        />
        <StatCard
          title="Waiting for Customer"
          value={bottleneckData?.summary.waitingCustomerCount ?? 0}
          icon={Clock}
          variant="default"
          subtitle={
            bottleneckData
              ? `${bottleneckData.waitingForCustomer.staleCount} stale (>72h)`
              : 'Status pending'
          }
        />
        <StatCard
          title="Awaiting Engineering"
          value={bottleneckData?.summary.awaitingEngineeringCount ?? 0}
          icon={Cpu}
          variant="indigo"
          subtitle="Software bugs & blockers"
        />
        <StatCard
          title="SLA Breaches"
          value={bottleneckData?.summary.slaBreachCount ?? 0}
          icon={ShieldAlert}
          variant="rose"
          subtitle={
            bottleneckData?.workloadImbalance.status === 'severe_imbalance'
              ? 'Severe Workload Imbalance'
              : bottleneckData?.workloadImbalance.status === 'moderate_imbalance'
              ? 'Moderate Imbalance'
              : 'Workload Balanced'
          }
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-700 space-x-1 sm:space-x-4 overflow-x-auto text-xs font-medium text-slate-400">
        <button
          onClick={() => setActiveSubTab('urgency')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'urgency'
              ? 'border-brand-500 text-white font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Urgency Ranking Queue ({urgencyData?.totalAnalyzed ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bottlenecks')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'bottlenecks'
              ? 'border-brand-500 text-white font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          <span>Bottleneck Radar (5 Dimensions)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('workload')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'workload'
              ? 'border-brand-500 text-white font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Workload Imbalance Inspector</span>
        </button>

        <button
          onClick={() => setActiveSubTab('clusters')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'clusters'
              ? 'border-brand-500 text-white font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Recurring Issues & Incidents ({clustersData?.totalClusters ?? 0})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: URGENCY RANKING QUEUE */}
      {/* ============================================================== */}
      {activeSubTab === 'urgency' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Tier:
              </span>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
                    tierFilter === t
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-900/60 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}

              <div className="h-4 w-[1px] bg-slate-700 mx-2 hidden sm:block"></div>

              <span className="text-xs font-medium text-slate-400 mr-1">Assignment:</span>
              {(['all', 'unassigned', 'assigned'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAssignmentFilter(a)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
                    assignmentFilter === a
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900/60 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search ticket #, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Ranking Table */}
          {isUrgencyLoading ? (
            <LoadingState message="Ranking queue by urgency factors..." />
          ) : isUrgencyError ? (
            <ErrorState message="Failed to load urgency rankings" onRetry={refetchUrgency} />
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              title="No tickets match criteria"
              description="No tickets currently match the selected tier or search parameters."
            />
          ) : (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Attention Score</th>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Original Priority</th>
                      <th className="py-3 px-4">Waiting Time</th>
                      <th className="py-3 px-4">Assignee</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {filteredTickets.map((t) => {
                      const isExpanded = expandedTicketId === t.ticketId;

                      return (
                        <React.Fragment key={t.ticketId}>
                          <tr
                            className={`hover:bg-slate-700/40 transition cursor-pointer ${
                              isExpanded ? 'bg-slate-700/30' : ''
                            }`}
                            onClick={() =>
                              setExpandedTicketId(isExpanded ? null : t.ticketId)
                            }
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <AttentionScoreBadge
                                score={t.attentionScore}
                                tier={t.urgencyTier}
                              />
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-200">
                              <Link
                                to={`/agent/tickets/${t.ticketId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1"
                              >
                                {t.ticketNumber}
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </Link>
                            </td>
                            <td className="py-3 px-4 max-w-xs sm:max-w-md truncate font-medium text-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{t.subject}</span>
                                <CategoryBadge category={t.category} />
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <PriorityBadge priority={t.originalPriority} />
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {t.waitingHours}h
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                              {t.assignedTo ? (
                                <span className="text-xs text-slate-200">
                                  {t.assignedTo.name}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td
                              className="py-3 px-4 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-2">
                                {canAssign && (
                                  <button
                                    onClick={() => setSelectedTicketForAssign(t)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-brand-600 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-600 hover:border-brand-500 transition flex items-center gap-1 shadow-sm"
                                  >
                                    <Sparkles className="w-3 h-3 text-brand-300" />
                                    <span>Match Agent</span>
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    setExpandedTicketId(isExpanded ? null : t.ticketId)
                                  }
                                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Explanation Accordion */}
                          {isExpanded && (
                            <tr className="bg-slate-900/60 border-b border-slate-700/80">
                              <td colSpan={7} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-brand-400" />
                                      Operational Attention Factors & Explanation
                                    </h4>
                                    <span className="text-[11px] text-slate-400">
                                      Note: Original Priority ({t.originalPriority}) is kept
                                      separate from operational attention score ({t.attentionScore}).
                                    </span>
                                  </div>

                                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed font-sans">
                                    {t.explanation}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                                    {t.factors.map((f, i) => (
                                      <div
                                        key={i}
                                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60"
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[11px] font-semibold text-slate-300">
                                            {f.name}
                                          </span>
                                          <span className="text-[11px] font-bold text-brand-400">
                                            +{f.score} pts
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-tight">
                                          {f.details}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: BOTTLENECK RADAR (5 DIMENSIONS) */}
      {/* ============================================================== */}
      {activeSubTab === 'bottlenecks' && (
        isBottlenecksLoading ? (
          <LoadingState message="Analyzing operational bottlenecks across database..." />
        ) : isBottlenecksError ? (
          <ErrorState message="Failed to load bottleneck analytics" onRetry={refetchBottlenecks} />
        ) : bottleneckData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dimension 1: Unassigned Bottleneck */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-slate-100 text-sm">
                    1. Unassigned Tickets & Triage Latency
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {bottleneckData.unassigned.totalCount} unassigned
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Total Unassigned
                  </span>
                  <span className="text-xl font-bold text-amber-300">
                    {bottleneckData.unassigned.totalCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Avg Wait Time
                  </span>
                  <span className="text-xl font-bold text-slate-200">
                    {bottleneckData.unassigned.avgWaitingHours}h
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Max Wait Time
                  </span>
                  <span className="text-xl font-bold text-rose-300">
                    {bottleneckData.unassigned.maxWaitingHours}h
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Oldest Awaiting Triage:
                </h4>
                <div className="space-y-2">
                  {bottleneckData.unassigned.oldestTickets.slice(0, 4).map((t) => (
                    <div
                      key={t.ticketId}
                      className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <PriorityBadge priority={t.priority} />
                        <Link
                          to={`/agent/tickets/${t.ticketId}`}
                          className="font-medium text-slate-200 hover:text-brand-400 truncate"
                        >
                          {t.ticketNumber}: {t.subject}
                        </Link>
                      </div>
                      <span className="text-slate-400 text-[11px] shrink-0 font-medium">
                        Waiting {t.waitingHours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dimension 2: Pending Customer Bottleneck */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-slate-100 text-sm">
                    2. Waiting on Customer Response
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {bottleneckData.waitingForCustomer.totalCount} pending
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Average Pending Time
                  </span>
                  <span className="text-xl font-bold text-slate-200">
                    {bottleneckData.waitingForCustomer.avgPendingHours}h
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Stale (&gt; 72 hours)
                  </span>
                  <span className="text-xl font-bold text-amber-300">
                    {bottleneckData.waitingForCustomer.staleCount} tickets
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Pending Customer Inquiries:
                </h4>
                <div className="space-y-2">
                  {bottleneckData.waitingForCustomer.tickets.slice(0, 4).map((t) => (
                    <div
                      key={t.ticketId}
                      className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <Link
                        to={`/agent/tickets/${t.ticketId}`}
                        className="font-medium text-slate-200 hover:text-brand-400 truncate pr-2"
                      >
                        {t.ticketNumber}: {t.subject}
                      </Link>
                      <span className="text-purple-300 text-[11px] shrink-0 font-medium">
                        Pending {t.pendingHours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dimension 3: Tickets Awaiting Engineering */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm">
                    3. Tickets Awaiting Engineering
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {bottleneckData.awaitingEngineering.totalCount} blockers
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Tickets categorized as software bugs or flagged with active engineering escalations
                preventing customer resolution.
              </p>

              <div className="space-y-2">
                {bottleneckData.awaitingEngineering.tickets.slice(0, 4).map((t) => (
                  <div
                    key={t.ticketId}
                    className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/agent/tickets/${t.ticketId}`}
                        className="font-semibold text-indigo-300 hover:underline"
                      >
                        {t.ticketNumber}: {t.subject}
                      </Link>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="text-[11px] text-slate-400">{t.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension 4: SLA Breaches & Deadlines */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <h3 className="font-bold text-slate-100 text-sm">
                    4. Active SLA Target Breaches
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  {bottleneckData.slaBreaches.totalBreached} breached
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    First Response Breaches
                  </span>
                  <span className="text-xl font-bold text-rose-400">
                    {bottleneckData.slaBreaches.firstResponseBreached}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Resolution Breaches
                  </span>
                  <span className="text-xl font-bold text-rose-400">
                    {bottleneckData.slaBreaches.resolutionBreached}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Breaches by Assignee:
                </h4>
                <div className="space-y-1.5">
                  {bottleneckData.slaBreaches.byAgent.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 text-xs"
                    >
                      <span className="text-slate-300 font-medium">{a.agentName}</span>
                      <span className="font-bold text-rose-400">{a.breachCount} breaches</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null)}

      {/* ============================================================== */}
      {/* SUB-TAB 3: WORKLOAD IMBALANCE INSPECTOR */}
      {/* ============================================================== */}
      {activeSubTab === 'workload' && bottleneckData && (
        <div className="space-y-6">
          {/* Workload Metric Header Banner */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Staff Capacity & Workload Balance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standard deviation analysis across active support personnel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    bottleneckData.workloadImbalance.status === 'severe_imbalance'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : bottleneckData.workloadImbalance.status === 'moderate_imbalance'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  Status: {bottleneckData.workloadImbalance.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 leading-relaxed font-sans">
              {bottleneckData.workloadImbalance.explanation}
            </div>

            {/* Mathematical Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Active Agents
                </span>
                <span className="text-xl font-bold text-slate-100">
                  {bottleneckData.workloadImbalance.totalActiveAgents}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Mean Load (μ)
                </span>
                <span className="text-xl font-bold text-slate-100">
                  {bottleneckData.workloadImbalance.meanActiveTickets}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Standard Dev (σ)
                </span>
                <span className="text-xl font-bold text-indigo-300">
                  {bottleneckData.workloadImbalance.standardDeviation}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Max/Min Ratio
                </span>
                <span className="text-xl font-bold text-amber-300">
                  {bottleneckData.workloadImbalance.imbalanceRatio}x
                </span>
              </div>
            </div>
          </div>

          {/* Agent Distribution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bottleneckData.workloadImbalance.agentDistribution.map((agent) => (
              <div
                key={agent.agentId}
                className={`p-5 rounded-2xl border text-xs space-y-3 ${
                  agent.isOverloaded
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : agent.isUnderutilized
                    ? 'bg-blue-950/20 border-blue-500/30'
                    : 'bg-slate-800/80 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{agent.name}</h4>
                    <span className="text-[11px] text-slate-400 capitalize">{agent.role}</span>
                  </div>
                  {agent.isOverloaded ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Overloaded
                    </span>
                  ) : agent.isUnderutilized ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Available Capacity
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Optimal
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Workload Capacity</span>
                    <span className="font-semibold text-slate-200">
                      {agent.activeTickets} / {agent.maxCapacity} active
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        agent.loadRatio >= 1.0
                          ? 'bg-rose-500'
                          : agent.loadRatio >= 0.7
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(agent.loadRatio * 100))}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/50 flex justify-between">
                  <span>Load Ratio: {agent.loadRatio}</span>
                  <span>{Math.round(agent.loadRatio * 100)}% utilized</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 4: RECURRING ISSUES & INCIDENTS */}
      {/* ============================================================== */}
      {activeSubTab === 'clusters' && (
        <div className="space-y-6">
          {/* Explicit Human Review Warning & Disclaimer Banner */}
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-amber-300 text-sm">
                Potential Incidents Require Human Review
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Issue clusters identify correlated symptom patterns and keyword overlap across recent
                tickets within structured categories. Text similarity indicates correlated patterns,
                not proven shared root cause. Manual investigation is required by engineering or
                support leadership to confirm whether an active service disruption exists.
              </p>
            </div>
          </div>

          {/* Non-LLM Methodology Banner */}
          {clustersData?.methodology && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Cpu className="w-4 h-4 text-brand-400" />
                <span>Deterministic Operational Clustering Methodology</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-[11px] text-slate-400">
                <div>
                  <span className="font-semibold text-slate-300 block">Cost:</span>
                  <span>{clustersData.methodology.nonLlmRationale.cost}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-300 block">Privacy:</span>
                  <span>{clustersData.methodology.nonLlmRationale.privacy}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-300 block">Failure Handling:</span>
                  <span>{clustersData.methodology.nonLlmRationale.failureHandling}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-300 block">Explainability:</span>
                  <span>{clustersData.methodology.nonLlmRationale.explainability}</span>
                </div>
              </div>
            </div>
          )}

          {isClustersLoading ? (
            <LoadingState message="Analyzing symptom patterns across recent tickets..." />
          ) : isClustersError ? (
            <ErrorState message="Failed to load recurring issue clusters" onRetry={refetchClusters} />
          ) : !clustersData?.clusters || clustersData.clusters.length === 0 ? (
            <EmptyState
              title="No recurring issue clusters detected"
              description="No significant symptom correlations or repeating patterns detected in the current lookback window."
            />
          ) : (
            <div className="space-y-4">
              {clustersData.clusters.map((cluster) => (
                <div
                  key={cluster.clusterId}
                  className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Potential Incident
                        </span>
                        <CategoryBadge category={cluster.category} />
                        <PriorityBadge priority={cluster.highestPriority} />
                        <span className="text-xs text-slate-400">
                          {cluster.ticketCount} correlated tickets
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-100 text-base">{cluster.themeTitle}</h4>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <span>Avg Similarity: </span>
                      <span className="font-semibold text-brand-400">
                        {Math.round(cluster.averageSimilarity * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Shared Keywords */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-400 text-[11px] font-medium">Shared Tokens:</span>
                    {cluster.sharedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-mono"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Recommended Action */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                    <span className="font-bold text-amber-400 mr-1.5">Action Recommended:</span>
                    <span>{cluster.recommendedAction}</span>
                  </div>

                  {/* Correlated Tickets List */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                      Correlated Tickets in Cluster:
                    </h5>
                    <div className="divide-y divide-slate-700/50 border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/40">
                      {cluster.tickets.map((t) => (
                        <div
                          key={t.ticketId}
                          className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/40 transition"
                        >
                          <div className="flex items-center gap-3 truncate pr-2">
                            <Link
                              to={`/agent/tickets/${t.ticketId}`}
                              className="font-mono text-brand-400 hover:underline shrink-0"
                            >
                              {t.ticketNumber}
                            </Link>
                            <span className="font-medium text-slate-200 truncate">{t.subject}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={t.status} />
                            <PriorityBadge priority={t.priority} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK AGENT ASSIGN MODAL (POWERED BY FEATURE 2 RECOMMENDATIONS) */}
      {/* ============================================================== */}
      {selectedTicketForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  Workload-Aware Agent Recommendation
                </h3>
                <p className="text-xs text-slate-400">
                  Assigning ticket{' '}
                  <span className="font-mono text-brand-400">
                    {selectedTicketForAssign.ticketNumber}
                  </span>{' '}
                  ({selectedTicketForAssign.category})
                </p>
              </div>
              <button
                onClick={() => setSelectedTicketForAssign(null)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingQuickRecs ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Evaluating candidate staff bandwidth & category expertise...
              </div>
            ) : !quickRecsData?.recommendations || quickRecsData.recommendations.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No active candidates found.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {quickRecsData.recommendations.map((rec) => (
                  <div
                    key={rec.agent._id}
                    className={`p-3 rounded-2xl border text-xs space-y-2 ${
                      rec.isRecommended
                        ? 'bg-brand-950/30 border-brand-500/40 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100">{rec.agent.name}</span>
                          {rec.isRecommended && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {rec.agent.role} • {rec.activeTicketCount} active tickets (
                          {rec.capacityUtilizationPercent}% cap)
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {rec.matchScore}%
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-snug">{rec.explanation}</p>

                    <button
                      onClick={() =>
                        assignMutation.mutate({
                          ticketId: selectedTicketForAssign.ticketId,
                          agentId: rec.agent._id,
                        })
                      }
                      disabled={assignMutation.isPending}
                      className="w-full py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Assign to {rec.agent.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
