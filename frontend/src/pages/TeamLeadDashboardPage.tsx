import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  getTeamLeadReportApi,
  getWorkspaceAgentsApi,
  listTicketQueriesApi,
  addTicketQueryMessageApi,
  updateTicketQueryStatusApi,
  createAdminReportApi,
  listAdminReportsApi,
  addAdminReportMessageApi,
  Ticket,
  TicketQuery,
  AdminReport,
  AdminReportCategory,
  AdminReportPriority,
} from '../api/client';
import { StatCard } from '../components/StatCard';
import {
  StatusBadge,
  PriorityBadge,
  CategoryBadge,
  RoleBadge,
  QueryStatusBadge,
  UrgencyBadge,
} from '../components/Badges';
import { ReassignDropdown } from '../components/ReassignDropdown';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import {
  Users,
  AlertCircle,
  Inbox,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Layers,
  MessageSquareShare,
  ClipboardList,
  Plus,
  Send,
  X,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const TeamLeadDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active top-level section: 'workload' | 'queries' | 'admin_reports'
  const tabParam = searchParams.get('tab');
  const [activeSection, setActiveSection] = useState<'workload' | 'queries' | 'admin_reports'>(
    tabParam === 'admin_reports'
      ? 'admin_reports'
      : tabParam === 'queries'
      ? 'queries'
      : 'workload'
  );

  useEffect(() => {
    if (tabParam === 'admin_reports') {
      setActiveSection('admin_reports');
    } else if (tabParam === 'queries') {
      setActiveSection('queries');
    }
  }, [tabParam]);

  const handleSectionChange = (section: 'workload' | 'queries' | 'admin_reports') => {
    setActiveSection(section);
    if (section === 'workload') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: section });
    }
  };

  const [triageTab, setTriageTab] = useState<'unassigned' | 'overdue'>('unassigned');

  // Agent Inquiries state
  const [queryStatusFilter, setQueryStatusFilter] = useState('all');
  const [activeQuery, setActiveQuery] = useState<TicketQuery | null>(null);
  const [leadGuidanceText, setLeadGuidanceText] = useState('');
  const [resolutionSummaryText, setResolutionSummaryText] = useState('');
  const [queryActionError, setQueryActionError] = useState<string | null>(null);

  // Admin Reports state
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState<AdminReportCategory>('incident_escalation');
  const [reportPriority, setReportPriority] = useState<AdminReportPriority>('high');
  const [reportSummary, setReportSummary] = useState('');
  const [reportActionRequired, setReportActionRequired] = useState('');
  const [reportTicketId, setReportTicketId] = useState('');
  const [createReportError, setCreateReportError] = useState<string | null>(null);

  const [activeAdminReport, setActiveAdminReport] = useState<AdminReport | null>(null);
  const [leadFollowUpText, setLeadFollowUpText] = useState('');
  const [leadFollowUpError, setLeadFollowUpError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
  // Query 1: Real Team Lead Report Data
  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['teamLeadReport'],
    queryFn: getTeamLeadReportApi,
  });

  // Query 2: Active Agents for Reassignment Selectors
  const { data: agents = [] } = useQuery({
    queryKey: ['workspaceAgents'],
    queryFn: getWorkspaceAgentsApi,
  });

  // Query 3: Incoming Agent Queries
  const {
    data: queriesResult,
    isLoading: queriesLoading,
    error: queriesError,
    refetch: refetchQueries,
  } = useQuery({
    queryKey: ['teamLeadAgentQueries', queryStatusFilter],
    queryFn: () =>
      listTicketQueriesApi({
        status: queryStatusFilter !== 'all' ? queryStatusFilter : undefined,
      }),
  });

  // Query 4: Operational Reports to Admin
  const {
    data: adminReportsResult,
    isLoading: adminReportsLoading,
    error: adminReportsError,
    refetch: refetchAdminReports,
  } = useQuery({
    queryKey: ['teamLeadAdminReports', reportStatusFilter],
    queryFn: () =>
      listAdminReportsApi({
        status: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
      }),
  });

  // ---------------------------------------------------------------------------
  // MUTATIONS
  // ---------------------------------------------------------------------------
  const replyQueryMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      addTicketQueryMessageApi(id, message),
    onSuccess: (updated) => {
      setLeadGuidanceText('');
      setQueryActionError(null);
      setActiveQuery(updated);
      refetchQueries();
    },
    onError: (err: any) => setQueryActionError(err.message || 'Failed to send guidance'),
  });

  const resolveQueryMutation = useMutation({
    mutationFn: ({ id, summary }: { id: string; summary?: string }) =>
      updateTicketQueryStatusApi(id, 'resolved', summary),
    onSuccess: (updated) => {
      setActiveQuery(updated);
      setResolutionSummaryText('');
      refetchQueries();
    },
    onError: (err: any) => setQueryActionError(err.message || 'Failed to resolve query'),
  });

  const createAdminReportMutation = useMutation({
    mutationFn: createAdminReportApi,
    onSuccess: (newReport) => {
      setShowNewReportModal(false);
      setReportTitle('');
      setReportSummary('');
      setReportActionRequired('');
      setReportTicketId('');
      setCreateReportError(null);
      refetchAdminReports();
      setActiveAdminReport(newReport);
    },
    onError: (err: any) => setCreateReportError(err.message || 'Failed to submit report to Admin'),
  });

  const replyAdminReportMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      addAdminReportMessageApi(id, message),
    onSuccess: (updated) => {
      setLeadFollowUpText('');
      setLeadFollowUpError(null);
      setActiveAdminReport(updated);
      refetchAdminReports();
    },
    onError: (err: any) => setLeadFollowUpError(err.message || 'Failed to send update to Admin'),
  });

  const handleRefreshAll = () => {
    refetchReport();
    refetchQueries();
    refetchAdminReports();
  };

  const handleCreateReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) {
      setCreateReportError('Please enter a report title');
      return;
    }
    if (!reportSummary.trim()) {
      setCreateReportError('Please enter the summary/observations');
      return;
    }

    createAdminReportMutation.mutate({
      title: reportTitle.trim(),
      category: reportCategory,
      priority: reportPriority,
      summary: reportSummary.trim(),
      actionRequired: reportActionRequired.trim() || undefined,
      ticketId: reportTicketId.trim() || undefined,
    });
  };

  const workload = report?.teamWorkload;
  const totalActive =
    (workload?.openTickets ?? 0) +
    (workload?.inProgressTickets ?? 0) +
    (workload?.pendingTickets ?? 0);

  const renderTriageRow = (ticket: Ticket) => (
    <tr
      key={ticket._id}
      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition group"
    >
      <td
        onClick={() => navigate(`/agent/tickets/${ticket._id}`)}
        className="py-3 px-4 font-mono text-xs font-semibold text-brand-400 group-hover:text-brand-300 cursor-pointer"
      >
        {ticket.ticketNumber}
      </td>

      <td
        onClick={() => navigate(`/agent/tickets/${ticket._id}`)}
        className="py-3 px-4 cursor-pointer"
      >
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
        <PriorityBadge priority={ticket.priority} />
      </td>

      <td className="py-3 px-4 hidden md:table-cell">
        <CategoryBadge category={ticket.category} />
      </td>

      <td className="py-3 px-4 text-xs whitespace-nowrap">
        <ReassignDropdown
          ticketId={ticket._id}
          currentAssigneeId={ticket.assignedTo?._id || null}
          agents={agents}
          compact
        />
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
        <button
          onClick={() => navigate(`/agent/tickets/${ticket._id}`)}
          className="text-slate-500 hover:text-brand-400 transition"
          title="Open Ticket"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Team Lead Portal
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">
              Operations Supervisor
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Supervise team workload, unblock frontline agents, and report incident escalations to Workspace Administration.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowNewReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Report to Admin</span>
          </button>

          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Section Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-8 gap-2 sm:gap-4 overflow-x-auto">
        <button
          onClick={() => handleSectionChange('workload')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeSection === 'workload'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Workload & Queue Triage</span>
        </button>

        <button
          onClick={() => handleSectionChange('queries')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeSection === 'queries'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquareShare className="w-4 h-4 text-brand-400" />
          <span>Agent Inquiries & Guidance</span>
          {queriesResult?.summary && queriesResult.summary.open + queriesResult.summary.inReview > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-500/20 text-brand-300 font-bold">
              {queriesResult.summary.open} Open
            </span>
          )}
        </button>

        <button
          onClick={() => handleSectionChange('admin_reports')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeSection === 'admin_reports'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-purple-400" />
          <span>Admin Reports & Escalations</span>
          {adminReportsResult?.summary && adminReportsResult.summary.critical > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold">
              {adminReportsResult.summary.critical} Critical
            </span>
          )}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: WORKLOAD & QUEUE TRIAGE */}
      {/* ===================================================================== */}
      {activeSection === 'workload' && (
        <div className="space-y-8">
          {/* Key Metric StatCards */}
          {reportError ? (
            <ErrorState
              title="Could not load team workload report"
              message={(reportError as Error).message}
              onRetry={refetchReport}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Active Workload"
                value={totalActive}
                subtitle="Open, in progress, pending"
                icon={Inbox}
                variant="brand"
                isLoading={reportLoading}
              />
              <StatCard
                title="Unassigned Queue"
                value={workload?.unassignedTickets ?? 0}
                subtitle="Awaiting agent allocation"
                icon={Users}
                variant={(workload?.unassignedTickets ?? 0) > 0 ? 'amber' : 'default'}
                isLoading={reportLoading}
                badge={
                  (workload?.unassignedTickets ?? 0) > 0
                    ? { text: 'Needs Reassignment', variant: 'warning' }
                    : undefined
                }
              />
              <StatCard
                title="Overdue Incidents"
                value={workload?.overdueTickets ?? 0}
                subtitle="Exceeded guaranteed SLA"
                icon={AlertCircle}
                variant={(workload?.overdueTickets ?? 0) > 0 ? 'rose' : 'default'}
                isLoading={reportLoading}
                badge={
                  (workload?.overdueTickets ?? 0) > 0
                    ? { text: 'SLA Breach Risk', variant: 'danger' }
                    : undefined
                }
              />
              <StatCard
                title="Resolved Tickets"
                value={workload?.resolvedTickets ?? 0}
                subtitle="Successfully resolved tickets"
                icon={CheckCircle2}
                variant="emerald"
                isLoading={reportLoading}
              />
            </div>
          )}

          {/* Unassigned & Overdue Triage Queue */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Operational Triage Queue</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allocate unassigned tickets or reassign overdue tickets to balance agent capacity
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setTriageTab('unassigned')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    triageTab === 'unassigned'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Unassigned ({report?.unassignedTickets?.length ?? 0})
                </button>
                <button
                  onClick={() => setTriageTab('overdue')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    triageTab === 'overdue'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Overdue ({report?.overdueTickets?.length ?? 0})
                </button>
              </div>
            </div>

            {reportLoading ? (
              <LoadingState type="table" rows={4} />
            ) : triageTab === 'unassigned' ? (
              (report?.unassignedTickets?.length ?? 0) === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No unassigned tickets"
                    description="All incoming customer tickets have been assigned to frontline agents."
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
                        <th className="py-3 px-4">Assign Staff</th>
                        <th className="py-3 px-4 text-right">Age</th>
                        <th className="py-3 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>{report?.unassignedTickets.map(renderTriageRow)}</tbody>
                  </table>
                </div>
              )
            ) : (report?.overdueTickets?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle2}
                  title="No overdue tickets"
                  description="All active tickets are meeting guaranteed SLA thresholds."
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
                      <th className="py-3 px-4">Reassign</th>
                      <th className="py-3 px-4 text-right">Age</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>{report?.overdueTickets.map(renderTriageRow)}</tbody>
                </table>
              </div>
            )}
          </section>

          {/* Agent Workload Comparison Table */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Agent Workload & Capacity Comparison</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time active ticket distribution across support staff
              </p>
            </div>

            {reportLoading ? (
              <LoadingState type="table" rows={3} />
            ) : (report?.agentWorkloads?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Users}
                  title="No agents found"
                  description="No registered agents found in this workspace."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4">Team Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center">Open</th>
                      <th className="py-3 px-4 text-center">In Progress</th>
                      <th className="py-3 px-4 text-center">Pending</th>
                      <th className="py-3 px-4 text-center">Resolved</th>
                      <th className="py-3 px-4 text-right font-bold text-slate-200">Total Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.agentWorkloads.map((item) => {
                      const activeTotal = item.openCount + item.inProgressCount + item.pendingCount;
                      return (
                        <tr
                          key={item.user._id}
                          className="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-100">{item.user.name}</div>
                            <div className="text-[11px] text-slate-400">{item.user.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <RoleBadge role={item.user.role} />
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-blue-400">
                            {item.openCount}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-amber-400">
                            {item.inProgressCount}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-purple-400">
                            {item.pendingCount}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-400">
                            {item.resolvedCount}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-bold ${
                                activeTotal > 5
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : activeTotal > 0
                                  ? 'bg-brand-500/20 text-brand-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {activeTotal} tickets
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Domain Reporting Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-brand-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  By Ticket Status
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                {Object.entries(report?.statusBreakdown || {}).map(([st, cnt]) => (
                  <div
                    key={st}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60"
                  >
                    <span className="capitalize text-slate-300">{st.replace('_', ' ')}</span>
                    <span className="font-mono font-bold text-white">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  By Ticket Priority
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                {Object.entries(report?.priorityBreakdown || {}).map(([pr, cnt]) => (
                  <div
                    key={pr}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60"
                  >
                    <span className="font-semibold text-slate-300">{pr}</span>
                    <span className="font-mono font-bold text-white">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  By Domain Category
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                {Object.entries(report?.categoryBreakdown || {}).map(([cat, cnt]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60"
                  >
                    <span className="capitalize text-slate-300">{cat.replace('_', ' ')}</span>
                    <span className="font-mono font-bold text-white">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: AGENT TICKET INQUIRIES & GUIDANCE */}
      {/* ===================================================================== */}
      {activeSection === 'queries' && (
        <div className="space-y-6">
          {/* Query Summary StatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Open Inquiries"
              value={queriesResult?.summary.open ?? 0}
              subtitle="Frontline agents awaiting advice"
              icon={MessageSquareShare}
              variant={(queriesResult?.summary.open ?? 0) > 0 ? 'brand' : 'default'}
              isLoading={queriesLoading}
            />
            <StatCard
              title="In Review"
              value={queriesResult?.summary.inReview ?? 0}
              subtitle="Discussion in progress"
              icon={Clock}
              variant="indigo"
              isLoading={queriesLoading}
            />
            <StatCard
              title="Urgent Escalations"
              value={queriesResult?.summary.urgent ?? 0}
              subtitle="High/Urgent customer blockers"
              icon={AlertCircle}
              variant={(queriesResult?.summary.urgent ?? 0) > 0 ? 'rose' : 'default'}
              isLoading={queriesLoading}
            />
            <StatCard
              title="Resolved Inquiries"
              value={queriesResult?.summary.resolved ?? 0}
              subtitle="Guidance successfully provided"
              icon={CheckCircle2}
              variant="emerald"
              isLoading={queriesLoading}
            />
          </div>

          {/* Queries Table */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Agent Ticket Consultations Queue</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review agent inquiries, provide technical clarification, authorize refunds, or reassign tickets
                </p>
              </div>

              <select
                value={queryStatusFilter}
                onChange={(e) => setQueryStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open (Needs Guidance)</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {queriesLoading ? (
              <LoadingState type="table" rows={4} />
            ) : queriesError ? (
              <div className="p-6">
                <ErrorState
                  title="Could not load agent queries"
                  message={(queriesError as Error).message}
                  onRetry={refetchQueries}
                />
              </div>
            ) : (queriesResult?.queries.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle}
                  title="All clear! No pending agent inquiries"
                  description="Frontline agents currently have zero blocking queries or approval requests."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Agent</th>
                      <th className="py-3 px-4">Inquiry Subject & Context</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Status</th>
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
                        <td className="py-3 px-4 text-xs font-medium text-slate-200">
                          {q.agentName}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-xs text-slate-100 group-hover:text-white line-clamp-1 max-w-sm">
                            {q.subject}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {q.messages?.[q.messages.length - 1]?.message || 'No messages'}
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
                        <td className="py-3 px-4 text-xs font-mono text-slate-400 text-right">
                          {q.messages?.length || 1}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveQuery(q);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
                          >
                            Review & Advise
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: ADMIN REPORTS & ESCALATIONS */}
      {/* ===================================================================== */}
      {activeSection === 'admin_reports' && (
        <div className="space-y-6">
          {/* Summary StatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Reports Submitted"
              value={adminReportsResult?.summary.total ?? 0}
              subtitle="Operational issues escalated"
              icon={ClipboardList}
              variant="purple"
              isLoading={adminReportsLoading}
            />
            <StatCard
              title="Awaiting Review"
              value={adminReportsResult?.summary.submitted ?? 0}
              subtitle="Pending Admin acknowledgment"
              icon={Clock}
              variant={(adminReportsResult?.summary.submitted ?? 0) > 0 ? 'amber' : 'default'}
              isLoading={adminReportsLoading}
            />
            <StatCard
              title="Critical Incidents"
              value={adminReportsResult?.summary.critical ?? 0}
              subtitle="High severity bottlenecks"
              icon={AlertCircle}
              variant={(adminReportsResult?.summary.critical ?? 0) > 0 ? 'rose' : 'default'}
              isLoading={adminReportsLoading}
            />
            <StatCard
              title="Resolved Escalations"
              value={adminReportsResult?.summary.resolved ?? 0}
              subtitle="Executive directives issued"
              icon={CheckCircle2}
              variant="emerald"
              isLoading={adminReportsLoading}
            />
          </div>

          {/* Admin Reports Table */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Reports & Inquiries to Workspace Administrator</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track operational incident escalations, capacity updates, and policy questions submitted to Admin
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>

                <button
                  onClick={() => setShowNewReportModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Report</span>
                </button>
              </div>
            </div>

            {adminReportsLoading ? (
              <LoadingState type="table" rows={4} />
            ) : adminReportsError ? (
              <div className="p-6">
                <ErrorState
                  title="Could not load admin reports"
                  message={(adminReportsError as Error).message}
                  onRetry={refetchAdminReports}
                />
              </div>
            ) : (adminReportsResult?.reports.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="No operational reports yet"
                  description="When systemic bottlenecks, outages, or staffing deficits arise, submit an executive report to Admin."
                  actionLabel="Submit Report to Admin"
                  onAction={() => setShowNewReportModal(true)}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4">Report Title & Summary</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ref Ticket</th>
                      <th className="py-3 px-4 text-right">Created</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminReportsResult?.reports.map((rep) => (
                      <tr
                        key={rep._id}
                        onClick={() => setActiveAdminReport(rep)}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-xs text-slate-100 group-hover:text-white line-clamp-1 max-w-md">
                            {rep.title}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {rep.summary}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {rep.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <UrgencyBadge urgency={rep.priority} />
                        </td>
                        <td className="py-3 px-4">
                          <QueryStatusBadge status={rep.status} />
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-300">
                          {rep.ticketNumber || <span className="text-slate-500 italic">None</span>}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-400 text-right whitespace-nowrap">
                          {new Date(rep.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAdminReport(rep);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 group-hover:bg-purple-600 text-slate-300 group-hover:text-white transition"
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: TEAM LEAD GUIDANCE & REASSIGNMENT CONSOLE */}
      {/* ===================================================================== */}
      {activeQuery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setActiveQuery(null);
                setQueryActionError(null);
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
                  Agent: <strong className="text-slate-200">{activeQuery.agentName}</strong>
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

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 max-h-80">
              {activeQuery.messages?.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  className={`p-3.5 rounded-2xl text-xs border ${
                    msg.senderRole === 'lead' || msg.senderRole === 'admin'
                      ? 'bg-indigo-950/40 border-indigo-800/40 ml-4'
                      : 'bg-slate-800/80 border-slate-700/80 mr-4'
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

            {/* Guidance Reply Composer */}
            {queryActionError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {queryActionError}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-slate-800 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leadGuidanceText}
                  onChange={(e) => setLeadGuidanceText(e.target.value)}
                  placeholder="Provide decision, advice, or approval directives to agent..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!leadGuidanceText.trim()) return;
                    replyQueryMutation.mutate({
                      id: activeQuery._id,
                      message: leadGuidanceText.trim(),
                    });
                  }}
                  disabled={replyQueryMutation.isPending || !leadGuidanceText.trim()}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Guidance</span>
                </button>
              </div>

              {/* Resolution options */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                {activeQuery.status !== 'resolved' ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={resolutionSummaryText}
                      onChange={(e) => setResolutionSummaryText(e.target.value)}
                      placeholder="Resolution summary (e.g. Approved $50 credit, applied code)..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        resolveQueryMutation.mutate({
                          id: activeQuery._id,
                          summary: resolutionSummaryText.trim() || 'Guidance provided by Team Lead',
                        })
                      }
                      disabled={resolveQueryMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition whitespace-nowrap"
                    >
                      Resolve Query
                    </button>
                  </div>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Query marked as resolved</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SUBMIT OPERATIONAL REPORT TO ADMIN */}
      {/* ===================================================================== */}
      {showNewReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowNewReportModal(false);
                setCreateReportError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white">Submit Report to Administrator</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Escalate operational bottlenecks, outages, staffing concerns, or policy inquiries to Admin.
            </p>

            {createReportError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {createReportError}
              </div>
            )}

            <form onSubmit={handleCreateReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Report Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. Rate-limit timeouts observed during peak shift"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as AdminReportCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="incident_escalation">Incident Escalation</option>
                    <option value="staffing_capacity">Staffing & Capacity</option>
                    <option value="policy_compliance">Policy & Compliance</option>
                    <option value="sla_bottleneck">SLA Bottleneck</option>
                    <option value="tooling_request">Tooling & Infrastructure</option>
                    <option value="general_update">Executive Update</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Urgency / Priority
                  </label>
                  <select
                    value={reportPriority}
                    onChange={(e) => setReportPriority(e.target.value as AdminReportPriority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Related Ticket ID
                </label>
                <input
                  type="text"
                  value={reportTicketId}
                  onChange={(e) => setReportTicketId(e.target.value)}
                  placeholder="e.g. Paste MongoDB ObjectId or leave blank"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Summary & Findings <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Describe what occurred, impacted customers, and root cause observations..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recommended Action / Decision Required
                </label>
                <input
                  type="text"
                  value={reportActionRequired}
                  onChange={(e) => setReportActionRequired(e.target.value)}
                  placeholder="e.g. Requesting permission to lift API export limits or approve overtime"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAdminReportMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
                >
                  {createAdminReportMutation.isPending ? 'Submitting...' : 'Submit to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: VIEW ADMIN REPORT DISCUSSION */}
      {/* ===================================================================== */}
      {activeAdminReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setActiveAdminReport(null);
                setLeadFollowUpError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="border-b border-slate-800 pb-4 mb-4 pr-8">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <QueryStatusBadge status={activeAdminReport.status} />
                <UrgencyBadge urgency={activeAdminReport.priority} />
                <span className="capitalize text-xs text-slate-400">
                  {activeAdminReport.category.replace('_', ' ')}
                </span>
                {activeAdminReport.ticketNumber && (
                  <span className="font-mono text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                    Ticket: {activeAdminReport.ticketNumber}
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white mb-1">{activeAdminReport.title}</h3>
              <p className="text-xs text-slate-400">{activeAdminReport.summary}</p>
            </div>

            {/* Admin Directive Banner if set */}
            {activeAdminReport.adminDirective && (
              <div className="mb-4 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200">
                <div className="font-bold flex items-center gap-1.5 text-purple-300 mb-1">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <span>Executive Admin Directive</span>
                </div>
                <p className="whitespace-pre-wrap">{activeAdminReport.adminDirective}</p>
              </div>
            )}

            {/* Conversation Thread with Admin */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 max-h-80">
              {activeAdminReport.messages?.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  className={`p-3.5 rounded-2xl text-xs border ${
                    msg.senderRole === 'admin'
                      ? 'bg-rose-950/30 border-rose-800/40 mr-4'
                      : 'bg-purple-950/30 border-purple-800/40 ml-4'
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

            {/* Reply Composer */}
            {leadFollowUpError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {leadFollowUpError}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leadFollowUpText}
                  onChange={(e) => setLeadFollowUpText(e.target.value)}
                  placeholder="Send an operational update or reply to Admin..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!leadFollowUpText.trim()) return;
                    replyAdminReportMutation.mutate({
                      id: activeAdminReport._id,
                      message: leadFollowUpText.trim(),
                    });
                  }}
                  disabled={replyAdminReportMutation.isPending || !leadFollowUpText.trim()}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-sm transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>

              <div className="flex justify-end mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveAdminReport(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
