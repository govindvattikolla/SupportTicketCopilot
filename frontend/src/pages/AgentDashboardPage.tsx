import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  getAgentSummaryApi,
  listTicketsApi,
  getWorkspaceAgentsApi,
  createTicketQueryApi,
  listTicketQueriesApi,
  addTicketQueryMessageApi,
  updateTicketQueryStatusApi,
  Ticket,
  TicketQuery,
  TicketQueryCategory,
  TicketQueryUrgency,
  getUrgencyRankingApi,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import {
  StatusBadge,
  PriorityBadge,
  CategoryBadge,
  QueryStatusBadge,
  UrgencyBadge,
  RoleBadge,
  SLABadge,
  AttentionScoreBadge,
} from '../components/Badges';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { DashboardLayout } from '../components/DashboardLayout';
import { getSocket } from '../realtime/socket';
import {
  Inbox,
  Clock,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  History,
  CheckCircle,
  RefreshCw,
  MessageSquareShare,
  Send,
  Plus,
  X,
  FileQuestion,
} from 'lucide-react';

export const AgentDashboardPage: React.FC = () => {
  useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'my_work' | 'urgent' | 'inbox' | 'queries'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'my_work' | 'urgent' | 'inbox' | 'queries'>(
    tabParam === 'queries' ? 'queries' : 'my_work'
  );

  useEffect(() => {
    if (tabParam === 'queries') {
      setActiveTab('queries');
    }
  }, [tabParam]);

  // Real-time Socket.IO synchronization for ticket changes
  useEffect(() => {
    const socket = getSocket();
    const handleTicketChange = () => {
      queryClient.invalidateQueries({ queryKey: ['agentSummary'] });
      queryClient.invalidateQueries({ queryKey: ['staffTickets'] });
      queryClient.invalidateQueries({ queryKey: ['agentQueries'] });
    };

    socket.on('ticket:created', handleTicketChange);
    socket.on('ticket:updated', handleTicketChange);

    return () => {
      socket.off('ticket:created', handleTicketChange);
      socket.off('ticket:updated', handleTicketChange);
    };
  }, [queryClient]);

  const handleTabChange = (tab: 'my_work' | 'urgent' | 'inbox' | 'queries') => {
    setActiveTab(tab);
    if (tab === 'queries') {
      setSearchParams({ tab: 'queries' });
    } else {
      setSearchParams({});
    }
  };

  // Inbox filters & pagination state
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Queries Tab state
  const [queryFilterStatus, setQueryFilterStatus] = useState('all');
  const [showNewQueryModal, setShowNewQueryModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [querySubject, setQuerySubject] = useState('');
  const [queryCategory, setQueryCategory] = useState<TicketQueryCategory>('technical');
  const [queryUrgency, setQueryUrgency] = useState<TicketQueryUrgency>('medium');
  const [queryMessage, setQueryMessage] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);

  // Active Query Conversation Drawer/Modal
  const [activeQuery, setActiveQuery] = useState<TicketQuery | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  // Debounce search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    const val = e.target.value;
    const timeout = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  };

  // Query 1: Agent Dashboard Summary (Real backend metrics & urgent items)
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['agentSummary'],
    queryFn: getAgentSummaryApi,
  });

  // Query 2: Active Agents for assignment filter
  const { data: agents = [] } = useQuery({
    queryKey: ['workspaceAgents'],
    queryFn: getWorkspaceAgentsApi,
  });

  // Query 3: My Assigned Open & In Progress Tickets
  const {
    data: myWorkResult,
    isLoading: myWorkLoading,
    error: myWorkError,
    refetch: refetchMyWork,
  } = useQuery({
    queryKey: ['myWorkTickets'],
    queryFn: () =>
      listTicketsApi({
        assignedTo: 'me',
        status: 'open,in_progress',
        limit: 20,
      }),
  });

  // Query 4: Full Ticket Inbox with active filters
  const {
    data: inboxResult,
    isLoading: inboxLoading,
    error: inboxError,
    refetch: refetchInbox,
  } = useQuery({
    queryKey: [
      'inboxTickets',
      page,
      statusFilter,
      priorityFilter,
      categoryFilter,
      assignedFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      listTicketsApi({
        page,
        limit: 10,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        assignedTo: assignedFilter,
        search: debouncedSearch,
      }),
    enabled: activeTab === 'inbox',
  });

  // Query 5: Agent's Ticket Queries to Team Lead
  const {
    data: queriesResult,
    isLoading: queriesLoading,
    error: queriesError,
    refetch: refetchQueries,
  } = useQuery({
    queryKey: ['agentTicketQueries', queryFilterStatus],
    queryFn: () =>
      listTicketQueriesApi({
        status: queryFilterStatus !== 'all' ? queryFilterStatus : undefined,
      }),
  });

  // Query 6: Urgency Ranking for Attention Scores
  const { data: urgencyRankingResult } = useQuery({
    queryKey: ['urgencyRanking'],
    queryFn: () => getUrgencyRankingApi({ limit: 150 }),
  });

  const attentionScoreMap = new Map<string, { score: number; tier: any }>();
  if (urgencyRankingResult?.tickets) {
    for (const t of urgencyRankingResult.tickets) {
      attentionScoreMap.set(t.ticketId, { score: t.attentionScore, tier: t.urgencyTier });
    }
  }

  // Mutations
  const createQueryMutation = useMutation({
    mutationFn: createTicketQueryApi,
    onSuccess: (newQuery) => {
      setShowNewQueryModal(false);
      setSelectedTicketId('');
      setQuerySubject('');
      setQueryMessage('');
      setQueryError(null);
      queryClient.invalidateQueries({ queryKey: ['agentTicketQueries'] });
      setActiveQuery(newQuery);
    },
    onError: (err: any) => {
      setQueryError(err.message || 'Failed to submit query to Team Lead');
    },
  });

  const replyQueryMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      addTicketQueryMessageApi(id, message),
    onSuccess: (updated) => {
      setReplyMessage('');
      setReplyError(null);
      setActiveQuery(updated);
      queryClient.invalidateQueries({ queryKey: ['agentTicketQueries'] });
    },
    onError: (err: any) => {
      setReplyError(err.message || 'Failed to send reply');
    },
  });

  const resolveQueryMutation = useMutation({
    mutationFn: (id: string) =>
      updateTicketQueryStatusApi(id, 'resolved', 'Resolved by agent consultation'),
    onSuccess: (updated) => {
      setActiveQuery(updated);
      queryClient.invalidateQueries({ queryKey: ['agentTicketQueries'] });
    },
  });

  const handleRefreshAll = () => {
    refetchSummary();
    refetchMyWork();
    refetchQueries();
    if (activeTab === 'inbox') refetchInbox();
  };

  const handleCreateQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId) {
      setQueryError('Please select a ticket for this query');
      return;
    }
    if (!querySubject.trim()) {
      setQueryError('Please enter a query subject');
      return;
    }
    if (!queryMessage.trim()) {
      setQueryError('Please describe your query for the Team Lead');
      return;
    }

    createQueryMutation.mutate({
      ticketId: selectedTicketId,
      subject: querySubject.trim(),
      category: queryCategory,
      urgency: queryUrgency,
      message: queryMessage.trim(),
    });
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuery || !replyMessage.trim()) return;
    replyQueryMutation.mutate({
      id: activeQuery._id,
      message: replyMessage.trim(),
    });
  };

  const renderTicketRow = (ticket: Ticket) => (
    <tr
      key={ticket._id}
      onClick={() => navigate(`/agent/tickets/${ticket._id}`)}
      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition group"
    >
      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-400 group-hover:text-brand-300">
        {ticket.ticketNumber}
      </td>
      <td className="py-3 px-4">
        <div className="font-medium text-xs text-slate-100 group-hover:text-white line-clamp-1 max-w-xs sm:max-w-sm">
          {ticket.subject}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {ticket.customer.name} ({ticket.customer.email})
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={ticket.status} />
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PriorityBadge priority={ticket.priority} />
            {attentionScoreMap.has(ticket._id) && (
              <AttentionScoreBadge
                score={attentionScoreMap.get(ticket._id)!.score}
                tier={attentionScoreMap.get(ticket._id)!.tier}
                showLabel={false}
              />
            )}
          </div>
          {ticket.sla && (
            <SLABadge
              status={
                ticket.sla.isResolutionBreached || ticket.sla.isFirstResponseBreached
                  ? 'breached'
                  : ticket.status === 'pending'
                  ? 'paused'
                  : ticket.status === 'resolved' || ticket.status === 'closed'
                  ? 'satisfied'
                  : ticket.sla.isWarningSent
                  ? 'warning'
                  : 'healthy'
              }
            />
          )}
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <CategoryBadge category={ticket.category} />
      </td>
      <td className="py-3 px-4 text-xs text-slate-300 hidden sm:table-cell">
        {ticket.assignedTo ? ticket.assignedTo.name : <span className="text-slate-500 italic">Unassigned</span>}
      </td>
      <td className="py-3 px-4 text-[11px] text-slate-400 text-right whitespace-nowrap">
        {new Date(ticket.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="py-3 px-3 text-right">
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition ml-auto" />
      </td>
    </tr>
  );

  const sidebarItems = [
    {
      id: 'my_work',
      label: 'My Active Tickets',
      icon: <Inbox className="w-4 h-4" />,
      badge: myWorkResult?.tickets?.length ? { text: myWorkResult.tickets.length } : undefined,
    },
    {
      id: 'urgent',
      label: 'High-Priority & Overdue',
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      badge:
        (summary?.highPriorityTickets?.length || 0) + (summary?.overdueTickets?.length || 0) > 0
          ? {
              text: (summary?.highPriorityTickets?.length || 0) + (summary?.overdueTickets?.length || 0),
              variant: 'danger' as const,
            }
          : undefined,
    },
    {
      id: 'queries',
      label: 'Team Lead Consultations',
      icon: <MessageSquareShare className="w-4 h-4 text-indigo-400" />,
      badge:
        (queriesResult?.summary?.open || 0) + (queriesResult?.summary?.inReview || 0) > 0
          ? {
              text: (queriesResult?.summary?.open || 0) + (queriesResult?.summary?.inReview || 0),
              variant: 'info' as const,
            }
          : undefined,
    },
    {
      id: 'inbox',
      label: 'Full Ticket Inbox',
      icon: <Filter className="w-4 h-4 text-slate-400" />,
    },
  ];

  return (
    <DashboardLayout
      portalTitle="Agent Workspace"
      roleBadgeText="Level 1 Support"
      roleBadgeVariant="agent"
      accentColor="brand"
      headerTitle="Agent Workspace"
      headerSubtitle="Manage your assigned queues, handle high-priority tickets, and collaborate with your Team Lead."
      items={sidebarItems}
      activeItemId={activeTab}
      onSelectItemId={(id) => handleTabChange(id as any)}
      sidebarFooterAction={{
        label: 'Consult Team Lead',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowNewQueryModal(true),
      }}
      headerActions={
        <>
          <button
            onClick={() => setShowNewQueryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Consult Team Lead</span>
          </button>

          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </>
      }
    >
      {/* Real Statistics Metric Cards */}
      {summaryError ? (
        <ErrorState
          title="Could not load dashboard statistics"
          message={(summaryError as Error).message}
          onRetry={refetchSummary}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            title="My Open Tickets"
            value={summary?.myOpenCount ?? 0}
            subtitle="Assigned & awaiting action"
            icon={Inbox}
            variant="brand"
            isLoading={summaryLoading}
            onClick={() => handleTabChange('my_work')}
          />
          <StatCard
            title="My In Progress"
            value={summary?.myInProgressCount ?? 0}
            subtitle="Currently under investigation"
            icon={Clock}
            variant="amber"
            isLoading={summaryLoading}
            onClick={() => handleTabChange('my_work')}
          />
          <StatCard
            title="High-Priority & Overdue"
            value={(summary?.myHighPriorityCount ?? 0) + (summary?.myOverdueCount ?? 0)}
            subtitle="SLA critical tickets"
            icon={AlertTriangle}
            variant={(summary?.myOverdueCount ?? 0) > 0 ? 'rose' : 'default'}
            isLoading={summaryLoading}
            badge={
              (summary?.myOverdueCount ?? 0) > 0
                ? { text: `${summary?.myOverdueCount} Overdue`, variant: 'danger' }
                : undefined
            }
            onClick={() => handleTabChange('urgent')}
          />
          <StatCard
            title="Lead Consultations"
            value={queriesResult?.summary.open ?? 0}
            subtitle="Active queries with Team Lead"
            icon={MessageSquareShare}
            variant="indigo"
            isLoading={queriesLoading}
            badge={
              (queriesResult?.summary.inReview ?? 0) > 0
                ? { text: `${queriesResult?.summary.inReview} Lead Replies`, variant: 'info' }
                : undefined
            }
            onClick={() => handleTabChange('queries')}
          />
        </div>
      )}

      {/* Tab 1: My Active Queue */}
      {activeTab === 'my_work' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Assigned to You (Open & In Progress)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tickets requiring direct customer responses or technical triage
              </p>
            </div>
            <button
              onClick={() => handleTabChange('inbox')}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1"
            >
              <span>View full inbox</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {myWorkLoading ? (
            <LoadingState type="table" rows={4} />
          ) : myWorkError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load your assigned tickets"
                message={(myWorkError as Error).message}
                onRetry={refetchMyWork}
              />
            </div>
          ) : (myWorkResult?.tickets.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCircle}
                title="All clear! No pending tickets"
                description="You have no open or in-progress tickets assigned to your queue. Check the full ticket inbox to claim tickets."
                actionLabel="Browse Full Inbox"
                onAction={() => handleTabChange('inbox')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Customer & Subject</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4 hidden md:table-cell">Category</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Assignee</th>
                    <th className="py-3 px-4 text-right">Created</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>{myWorkResult?.tickets.map(renderTicketRow)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: High Priority & Overdue Work */}
      {activeTab === 'urgent' && (
        <div className="space-y-6">
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-rose-950/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <h2 className="text-sm font-bold text-white">Overdue Work (Exceeded SLA Limits)</h2>
                </div>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Tickets that have been pending longer than guaranteed response thresholds
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {summary?.overdueTickets?.length ?? 0} Tickets
              </span>
            </div>

            {summaryLoading ? (
              <LoadingState type="table" rows={3} />
            ) : (summary?.overdueTickets?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle}
                  title="No overdue tickets"
                  description="Great work! You currently have zero tickets exceeding target SLA response times."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Customer & Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4 hidden md:table-cell">Category</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Assignee</th>
                      <th className="py-3 px-4 text-right">Created</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>{summary?.overdueTickets.map(renderTicketRow)}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white">High-Priority Work (P1 Critical & P2 High)</h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Critical customer inquiries requiring immediate resolution
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {summary?.highPriorityTickets?.length ?? 0} Tickets
              </span>
            </div>

            {summaryLoading ? (
              <LoadingState type="table" rows={3} />
            ) : (summary?.highPriorityTickets?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle}
                  title="No critical priority tickets"
                  description="No P1 or P2 tickets are currently assigned to you."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Customer & Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4 hidden md:table-cell">Category</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Assignee</th>
                      <th className="py-3 px-4 text-right">Created</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>{summary?.highPriorityTickets.map(renderTicketRow)}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 3: Team Lead Consultations & Queries (NEW AGENT CAPABILITY) */}
      {activeTab === 'queries' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquareShare className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white">Team Lead Consultations & Queries</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Communicate directly with your Team Lead regarding ticket ambiguities, refund approvals, and technical advice
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={queryFilterStatus}
                onChange={(e) => setQueryFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Query Statuses</option>
                <option value="open">Open (Awaiting Lead)</option>
                <option value="in_review">In Review (Lead Replied)</option>
                <option value="resolved">Resolved</option>
              </select>

              <button
                onClick={() => setShowNewQueryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ask Team Lead</span>
              </button>
            </div>
          </div>

          {queriesLoading ? (
            <LoadingState type="table" rows={4} />
          ) : queriesError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load queries"
                message={(queriesError as Error).message}
                onRetry={refetchQueries}
              />
            </div>
          ) : (queriesResult?.queries.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileQuestion}
                title="No Team Lead queries"
                description="When you encounter an edge case, dispute, or need a refund authorization on a ticket, click 'Ask Team Lead' to raise a consultation."
                actionLabel="Consult Team Lead"
                onAction={() => setShowNewQueryModal(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Subject & Question</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Team Lead</th>
                    <th className="py-3 px-4 text-right">Messages</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {queriesResult?.queries.map((q) => (
                    <tr
                      key={q._id}
                      onClick={() => setActiveQuery(q)}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition group"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-indigo-400">
                        {q.ticketNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-xs text-slate-100 group-hover:text-white line-clamp-1 max-w-sm">
                          {q.subject}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {q.messages?.[q.messages.length - 1]?.message || 'No messages yet'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {q.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <UrgencyBadge urgency={q.urgency} />
                      </td>
                      <td className="py-3 px-4">
                        <QueryStatusBadge status={q.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {q.leadName || <span className="text-slate-500 italic">Unassigned Lead</span>}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400 text-right">
                        {q.messages?.length || 1}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveQuery(q);
                          }}
                          className="px-2 py-1 text-xs rounded-lg bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 4: Full Ticket Inbox with active filters */}
      {activeTab === 'inbox' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Inbox Filter Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search subject, description, ticket number..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Priorities</option>
                <option value="P1">P1 Critical</option>
                <option value="P2">P2 High</option>
                <option value="P3">P3 Normal</option>
                <option value="P4">P4 Low</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Categories</option>
                <option value="technical">Technical</option>
                <option value="billing">Billing</option>
                <option value="general">General</option>
                <option value="bug">Bug</option>
                <option value="feature_request">Feature Request</option>
              </select>

              <select
                value={assignedFilter}
                onChange={(e) => {
                  setAssignedFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Assignees</option>
                <option value="me">Assigned to Me</option>
                <option value="unassigned">Unassigned</option>
                {agents.map((ag) => (
                  <option key={ag._id} value={ag._id}>
                    {ag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inbox Table */}
          <div>
            {inboxLoading ? (
              <LoadingState type="table" rows={6} />
            ) : inboxError ? (
              <div className="p-6">
                <ErrorState
                  title="Could not load tickets"
                  message={(inboxError as Error).message}
                  onRetry={refetchInbox}
                />
              </div>
            ) : (inboxResult?.tickets.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Inbox}
                  title="No matching tickets"
                  description="No tickets match the selected status, priority, or search term."
                  actionLabel="Clear Filters"
                  onAction={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setCategoryFilter('all');
                    setAssignedFilter('all');
                    setSearchInput('');
                    setDebouncedSearch('');
                    setPage(1);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                        <th className="py-3 px-4">Ticket</th>
                        <th className="py-3 px-4">Customer & Subject</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4 hidden md:table-cell">Category</th>
                        <th className="py-3 px-4 hidden sm:table-cell">Assignee</th>
                        <th className="py-3 px-4 text-right">Created</th>
                        <th className="py-3 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>{inboxResult?.tickets.map(renderTicketRow)}</tbody>
                  </table>
                </div>

                {/* Pagination Toolbar */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Showing {inboxResult?.tickets.length} of {inboxResult?.total} tickets
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>

                    <span className="px-2 font-mono text-slate-300">
                      Page {page} of {inboxResult?.totalPages || 1}
                    </span>

                    <button
                      onClick={() => setPage((p) => Math.min(inboxResult?.totalPages || 1, p + 1))}
                      disabled={page >= (inboxResult?.totalPages || 1)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Activity History Footer Section */}
      {summary?.recentActivity && summary.recentActivity.length > 0 && (
        <section className="mt-10 bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-brand-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Recent Workspace Activity
            </h3>
          </div>

          <div className="space-y-2">
            {summary.recentActivity.slice(0, 5).map((evt: any) => (
              <div
                key={evt._id}
                className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-900/80 border border-slate-800/80"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                  <span className="font-semibold text-slate-200">{evt.actor.name}</span>
                  <span className="text-slate-400">performed</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {evt.action.replace(/_/g, ' ')}
                  </span>
                  {evt.ticketId && (
                    <span className="text-slate-400">
                      on <strong className="text-slate-300">{evt.ticketId.ticketNumber}</strong>
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                  {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW QUERY TO TEAM LEAD */}
      {/* ========================================================================= */}
      {showNewQueryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowNewQueryModal(false);
                setQueryError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <MessageSquareShare className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white">Consult Team Lead</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Submit an internal query regarding a ticket for Team Lead guidance, approval, or escalation.
            </p>

            {queryError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {queryError}
              </div>
            )}

            <form onSubmit={handleCreateQuerySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Associated Ticket <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Choose from your active tickets --</option>
                  {myWorkResult?.tickets.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.ticketNumber} - {t.subject} ({t.priority})
                    </option>
                  ))}
                  {inboxResult?.tickets
                    .filter((t) => !myWorkResult?.tickets.some((m) => m._id === t._id))
                    .map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.ticketNumber} - {t.subject}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Query Category
                  </label>
                  <select
                    value={queryCategory}
                    onChange={(e) => setQueryCategory(e.target.value as TicketQueryCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="technical">Technical Guidance</option>
                    <option value="refund_approval">Refund & Credit Approval</option>
                    <option value="policy_guidance">Policy Clarification</option>
                    <option value="sla_escalation">SLA Escalation</option>
                    <option value="customer_dispute">Customer Dispute</option>
                    <option value="other">Other Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Urgency
                  </label>
                  <select
                    value={queryUrgency}
                    onChange={(e) => setQueryUrgency(e.target.value as TicketQueryUrgency)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent / Blocking</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject / Summary <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={querySubject}
                  onChange={(e) => setQuerySubject(e.target.value)}
                  placeholder="e.g. Need refund authorization for invoice INV-1002"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Detailed Question for Team Lead <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={queryMessage}
                  onChange={(e) => setQueryMessage(e.target.value)}
                  placeholder="Explain the context, what you have verified, and what specific action or decision you need from the Team Lead..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewQueryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createQueryMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
                >
                  {createQueryMutation.isPending ? 'Sending Query...' : 'Send to Team Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW QUERY & INTERACTIVE DISCUSSION */}
      {/* ========================================================================= */}
      {activeQuery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setActiveQuery(null);
                setReplyError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="border-b border-slate-800 pb-4 mb-4 pr-8">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {activeQuery.ticketNumber}
                </span>
                <QueryStatusBadge status={activeQuery.status} />
                <UrgencyBadge urgency={activeQuery.urgency} />
                <span className="capitalize text-xs text-slate-400">
                  {activeQuery.category.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1">{activeQuery.subject}</h3>

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>
                  Consulting: <strong className="text-slate-300">{activeQuery.leadName || 'Team Lead'}</strong>
                </span>
                <Link
                  to={`/agent/tickets/${typeof activeQuery.ticketId === 'object' ? (activeQuery.ticketId as any)._id : activeQuery.ticketId}`}
                  target="_blank"
                  className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
                >
                  <span>Open Ticket Detail</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Resolution Banner if resolved */}
            {activeQuery.status === 'resolved' && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <div className="font-semibold mb-0.5">Resolved Consultation</div>
                <p>{activeQuery.resolutionSummary || 'Guidance provided by Team Lead.'}</p>
              </div>
            )}

            {/* Conversation Messages Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 max-h-80">
              {activeQuery.messages?.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  className={`p-3.5 rounded-2xl text-xs border ${
                    msg.senderRole === 'agent'
                      ? 'bg-slate-800/80 border-slate-700/80 ml-4'
                      : 'bg-indigo-950/40 border-indigo-800/40 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{msg.senderName}</span>
                      <RoleBadge role={msg.senderRole} />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Follow-up Reply Composer */}
            {replyError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {replyError}
              </div>
            )}

            <form onSubmit={handleReplySubmit} className="mt-auto pt-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Ask a follow-up or reply to Team Lead..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={replyQueryMutation.isPending || !replyMessage.trim()}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 text-xs">
                {activeQuery.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => resolveQueryMutation.mutate(activeQuery._id)}
                    disabled={resolveQueryMutation.isPending}
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Mark Query as Resolved</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveQuery(null)}
                  className="text-slate-400 hover:text-slate-200 ml-auto"
                >
                  Close Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
