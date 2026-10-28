import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAdminOverviewApi,
  getCurrentWorkspaceApi,
  updateWorkspaceSettingsApi,
  getWorkspaceUsersApi,
  createWorkspaceUserApi,
  updateWorkspaceUserApi,
  listTicketsApi,
  getWorkspaceAuditEventsApi,
  getWorkspaceAgentsApi,
  listAdminReportsApi,
  addAdminReportMessageApi,
  updateAdminReportStatusApi,
  AdminReport,
  AdminReportStatus,
} from '../api/client';
import { StatCard } from '../components/StatCard';
import {
  StatusBadge,
  PriorityBadge,
  RoleBadge,
  QueryStatusBadge,
  UrgencyBadge,
} from '../components/Badges';
import { ReassignDropdown } from '../components/ReassignDropdown';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import {
  Building2,
  Users,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Activity,
  UserPlus,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  ArrowRight,
  Lock,
  ClipboardList,
  Send,
  X,
  ShieldAlert,
  Clock,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Admin Tab: 'overview' | 'reports' | 'team' | 'reassign' | 'settings' | 'audit'
  const tabParam = searchParams.get('tab');
  const [adminTab, setAdminTab] = useState<'overview' | 'reports' | 'team' | 'reassign' | 'settings' | 'audit'>(
    tabParam === 'reports' ? 'reports' : tabParam === 'users' ? 'team' : tabParam === 'audit' ? 'audit' : 'overview'
  );

  useEffect(() => {
    if (tabParam === 'reports') setAdminTab('reports');
    else if (tabParam === 'users') setAdminTab('team');
    else if (tabParam === 'audit') setAdminTab('audit');
  }, [tabParam]);

  const handleTabChange = (tab: 'overview' | 'reports' | 'team' | 'reassign' | 'settings' | 'audit') => {
    setAdminTab(tab);
    if (tab === 'reports') setSearchParams({ tab: 'reports' });
    else if (tab === 'team') setSearchParams({ tab: 'users' });
    else if (tab === 'audit') setSearchParams({ tab: 'audit' });
    else setSearchParams({});
  };

  // Reports Tab state
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('all');
  const [activeReport, setActiveReport] = useState<AdminReport | null>(null);
  const [adminDirectiveInput, setAdminDirectiveInput] = useState('');
  const [adminReplyMessage, setAdminReplyMessage] = useState('');
  const [reportActionError, setReportActionError] = useState<string | null>(null);

  // Audit table pagination and action filter
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  // Ticket reassignment tab search & status filter
  const [reassignSearch, setReassignSearch] = useState('');
  const [reassignStatusFilter, setReassignStatusFilter] = useState('all');

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'lead' | 'agent'>('agent');
  const [memberError, setMemberError] = useState<string | null>(null);

  // Settings Form State
  const [settingsFormInitialized, setSettingsFormInitialized] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [defaultPriorityInput, setDefaultPriorityInput] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');
  const [allowCustomerReopenInput, setAllowCustomerReopenInput] = useState(true);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
  // Query 1: Admin Overview Data
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['adminOverview'],
    queryFn: getAdminOverviewApi,
  });

  // Query 2: Current Workspace Details & Settings
  const {
    data: workspace,
    refetch: refetchWorkspace,
  } = useQuery({
    queryKey: ['currentWorkspace'],
    queryFn: async () => {
      const ws = await getCurrentWorkspaceApi();
      if (!settingsFormInitialized && ws) {
        setWorkspaceNameInput(ws.name);
        setDefaultPriorityInput(ws.settings?.defaultPriority || 'P3');
        setAllowCustomerReopenInput(ws.settings?.allowCustomerReopen ?? true);
        setSettingsFormInitialized(true);
      }
      return ws;
    },
  });

  // Query 3: Workspace Team Members
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['workspaceUsers'],
    queryFn: getWorkspaceUsersApi,
    enabled: adminTab === 'team' || adminTab === 'overview',
  });

  // Query 4: Active Agents for Reassignment Selectors
  const { data: agents = [] } = useQuery({
    queryKey: ['workspaceAgents'],
    queryFn: getWorkspaceAgentsApi,
  });

  // Query 5: Tickets for Reassignment Tab
  const {
    data: ticketsResult,
    isLoading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['adminReassignTickets', reassignStatusFilter, reassignSearch],
    queryFn: () =>
      listTicketsApi({
        status: reassignStatusFilter,
        search: reassignSearch,
        limit: 25,
      }),
    enabled: adminTab === 'reassign',
  });

  // Query 6: Workspace Audit Events
  const {
    data: auditResult,
    isLoading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['workspaceAudit', auditPage, auditActionFilter],
    queryFn: () =>
      getWorkspaceAuditEventsApi({
        page: auditPage,
        limit: 15,
        action: auditActionFilter !== 'all' ? auditActionFilter : undefined,
      }),
    enabled: adminTab === 'audit',
  });

  // Query 7: Team Lead Operational Reports & Escalations
  const {
    data: adminReportsResult,
    isLoading: adminReportsLoading,
    error: adminReportsError,
    refetch: refetchAdminReports,
  } = useQuery({
    queryKey: ['adminReportsList', reportStatusFilter, reportPriorityFilter],
    queryFn: () =>
      listAdminReportsApi({
        status: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
        priority: reportPriorityFilter !== 'all' ? reportPriorityFilter : undefined,
      }),
    enabled: adminTab === 'reports' || adminTab === 'overview',
  });

  // ---------------------------------------------------------------------------
  // MUTATIONS
  // ---------------------------------------------------------------------------
  // Mutation 1: Update Workspace Settings
  const settingsMutation = useMutation({
    mutationFn: updateWorkspaceSettingsApi,
    onSuccess: () => {
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['currentWorkspace'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
  });

  // Mutation 2: Create Team Member
  const createMemberMutation = useMutation({
    mutationFn: createWorkspaceUserApi,
    onSuccess: () => {
      setShowAddMemberModal(false);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setMemberRole('agent');
      setMemberError(null);
      queryClient.invalidateQueries({ queryKey: ['workspaceUsers'] });
      queryClient.invalidateQueries({ queryKey: ['workspaceAgents'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (err: any) => {
      setMemberError(err.message || 'Failed to create team member');
    },
  });

  // Mutation 3: Update Team Member Role / Active Status
  const updateUserMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { role?: any; isActive?: boolean } }) =>
      updateWorkspaceUserApi(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceUsers'] });
      queryClient.invalidateQueries({ queryKey: ['workspaceAgents'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (err: any) => {
      alert(`Update failed: ${err.message}`);
    },
  });

  // Mutation 4: Reply to Team Lead Report
  const replyReportMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      addAdminReportMessageApi(id, message),
    onSuccess: (updated) => {
      setAdminReplyMessage('');
      setReportActionError(null);
      setActiveReport(updated);
      refetchAdminReports();
    },
    onError: (err: any) => setReportActionError(err.message || 'Failed to send reply'),
  });

  // Mutation 5: Issue Directive & Update Report Status
  const updateReportStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      directive,
    }: {
      id: string;
      status: AdminReportStatus;
      directive?: string;
    }) => updateAdminReportStatusApi(id, status, directive),
    onSuccess: (updated) => {
      setActiveReport(updated);
      setAdminDirectiveInput('');
      setReportActionError(null);
      refetchAdminReports();
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (err: any) => setReportActionError(err.message || 'Failed to update report status'),
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    settingsMutation.mutate({
      name: workspaceNameInput,
      defaultPriority: defaultPriorityInput,
      allowCustomerReopen: allowCustomerReopenInput,
    });
  };

  const handleCreateMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim() || !memberPassword.trim()) {
      setMemberError('All fields are required');
      return;
    }
    createMemberMutation.mutate({
      name: memberName.trim(),
      email: memberEmail.trim(),
      password: memberPassword,
      role: memberRole,
    });
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchWorkspace();
    refetchAdminReports();
    if (adminTab === 'team') refetchUsers();
    if (adminTab === 'reassign') refetchTickets();
    if (adminTab === 'audit') refetchAudit();
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Workspace Administration
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Admin Portal
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Manage workspace configuration, team member roster, global assignment queue, and audit ledger.
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Workspace</span>
        </button>
      </div>

      {/* Workspace Overview & Aggregated Statistics Cards */}
      {overviewError ? (
        <ErrorState
          title="Could not load workspace overview"
          message={(overviewError as Error).message}
          onRetry={refetchOverview}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Workspace Tickets"
            value={overview?.ticketCounts?.total ?? 0}
            subtitle={`Counter sequence #${overview?.workspace?.ticketCounter ?? 1000}`}
            icon={Layers}
            variant="brand"
            isLoading={overviewLoading}
            onClick={() => setAdminTab('overview')}
          />
          <StatCard
            title="Active Team Members"
            value={overview?.teamStats?.activeMembers ?? 0}
            subtitle={`${overview?.teamStats?.byRole?.admin ?? 0} Admins • ${overview?.teamStats?.byRole?.lead ?? 0} Leads • ${overview?.teamStats?.byRole?.agent ?? 0} Agents`}
            icon={Users}
            variant="indigo"
            isLoading={overviewLoading}
            onClick={() => setAdminTab('team')}
          />
          <StatCard
            title="Ticket Resolution Rate"
            value={`${overview?.resolutionMetrics?.resolutionRate ?? 0}%`}
            subtitle={`${overview?.resolutionMetrics?.totalResolved ?? 0} tickets resolved or closed`}
            icon={CheckCircle2}
            variant="emerald"
            isLoading={overviewLoading}
          />
          <StatCard
            title="Active Workload"
            value={
              (overview?.ticketCounts?.byStatus?.open ?? 0) +
              (overview?.ticketCounts?.byStatus?.in_progress ?? 0)
            }
            subtitle={`${overview?.ticketCounts?.byStatus?.open ?? 0} open, ${overview?.ticketCounts?.byStatus?.in_progress ?? 0} in progress`}
            icon={Activity}
            variant="amber"
            isLoading={overviewLoading}
            onClick={() => setAdminTab('reassign')}
          />
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2 sm:gap-4 overflow-x-auto">
        <button
          onClick={() => handleTabChange('overview')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'overview'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Workspace Overview</span>
        </button>

        <button
          onClick={() => handleTabChange('reports')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'reports'
              ? 'border-rose-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-rose-400" />
          <span>Team Lead Reports & Escalations</span>
          {adminReportsResult?.summary && adminReportsResult.summary.submitted > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold">
              {adminReportsResult.summary.submitted} New
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('team')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'team'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Member Management</span>
          {users.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {users.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('reassign')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'reassign'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Assignment & Reassignment</span>
        </button>

        <button
          onClick={() => handleTabChange('settings')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'settings'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Workspace Settings</span>
        </button>

        <button
          onClick={() => handleTabChange('audit')}
          className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'audit'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Audit History</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* Workspace Metadata Banner */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Tenant
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  {overview?.workspace?.name || 'Workspace'}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>
                    Workspace Slug: <code className="text-brand-300 font-mono">{overview?.workspace?.slug}</code>
                  </span>
                  <span>•</span>
                  <span>
                    Default Priority:{' '}
                    <strong className="text-slate-200">{overview?.workspace?.settings?.defaultPriority}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Customer Reopening:{' '}
                    <strong className="text-slate-200">
                      {overview?.workspace?.settings?.allowCustomerReopen ? 'Enabled' : 'Disabled'}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setAdminTab('settings')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition"
              >
                <Settings className="w-4 h-4" />
                <span>Configure Settings</span>
              </button>
            </div>
          </section>

          {/* Ticket Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Counts by Status */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4">Ticket Volume by Status</h3>
              <div className="space-y-3">
                {Object.entries(overview?.ticketCounts?.byStatus || {}).map(([st, count]) => (
                  <div key={st} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                    <StatusBadge status={st as any} />
                    <span className="font-bold text-slate-200 font-mono text-sm">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Counts by Priority */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4">Ticket Volume by Priority</h3>
              <div className="space-y-3">
                {Object.entries(overview?.ticketCounts?.byPriority || {}).map(([pr, count]) => (
                  <div key={pr} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                    <PriorityBadge priority={pr as any} />
                    <span className="font-bold text-slate-200 font-mono text-sm">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TEAM LEAD REPORTS & OPERATIONAL ESCALATIONS */}
      {adminTab === 'reports' && (
        <div className="space-y-6">
          {/* StatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Team Lead Reports"
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
              variant={(adminReportsResult?.summary.submitted ?? 0) > 0 ? 'rose' : 'default'}
              isLoading={adminReportsLoading}
              badge={
                (adminReportsResult?.summary.submitted ?? 0) > 0
                  ? { text: 'Needs Directive', variant: 'danger' }
                  : undefined
              }
            />
            <StatCard
              title="Critical Incidents"
              value={adminReportsResult?.summary.critical ?? 0}
              subtitle="High severity bottlenecks"
              icon={ShieldAlert}
              variant={(adminReportsResult?.summary.critical ?? 0) > 0 ? 'rose' : 'default'}
              isLoading={adminReportsLoading}
            />
            <StatCard
              title="Resolved Escalations"
              value={adminReportsResult?.summary.resolved ?? 0}
              subtitle="Directives successfully issued"
              icon={CheckCircle2}
              variant="emerald"
              isLoading={adminReportsLoading}
            />
          </div>

          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Team Lead Operational Reports & Escalations</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review incident reports, capacity concerns, and policy inquiries submitted by Team Leads, and issue executive directives
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted (Pending Review)</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>

                <select
                  value={reportPriorityFilter}
                  onChange={(e) => setReportPriorityFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {adminReportsLoading ? (
              <LoadingState type="table" rows={4} />
            ) : adminReportsError ? (
              <div className="p-6">
                <ErrorState
                  title="Could not load reports"
                  message={(adminReportsError as Error).message}
                  onRetry={refetchAdminReports}
                />
              </div>
            ) : (adminReportsResult?.reports.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle2}
                  title="No operational reports found"
                  description="All systems normal! No pending incident escalations or operational bottlenecks from Team Leads."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Lead Author</th>
                      <th className="py-3 px-4">Report Title & Summary</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ref Ticket</th>
                      <th className="py-3 px-4 text-right">Date</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminReportsResult?.reports.map((rep) => (
                      <tr
                        key={rep._id}
                        onClick={() => setActiveReport(rep)}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {rep.leadName}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100 group-hover:text-white line-clamp-1 max-w-sm">
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
                        <td className="py-3 px-4 font-mono text-slate-300">
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
                              setActiveReport(rep);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition"
                          >
                            Review & Direct
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

      {/* TAB 2: TEAM MEMBER MANAGEMENT */}
      {adminTab === 'team' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Workspace Staff Roster</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage accounts, assign roles (Admin, Team Lead, Agent), and toggle active access
              </p>
            </div>

            <button
              onClick={() => setShowAddMemberModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Team Member</span>
            </button>
          </div>

          {usersLoading ? (
            <LoadingState type="table" rows={4} />
          ) : usersError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load team members"
                message={(usersError as Error).message}
                onRetry={refetchUsers}
              />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No members found"
                description="Invite staff to collaborate on tickets."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((mem) => (
                    <tr
                      key={mem._id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100">{mem.name}</div>
                        <div className="text-[11px] text-slate-400">{mem.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <RoleBadge role={mem.role} />
                      </td>

                      <td className="py-3.5 px-4">
                        {mem.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            Deactivated
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(mem.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Role selector */}
                          <select
                            value={mem.role}
                            onChange={(e) =>
                              updateUserMutation.mutate({
                                id: mem._id,
                                dto: { role: e.target.value as any },
                              })
                            }
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="agent">Agent</option>
                            <option value="lead">Lead</option>
                            <option value="admin">Admin</option>
                          </select>

                          {/* Toggle Active Button */}
                          <button
                            onClick={() =>
                              updateUserMutation.mutate({
                                id: mem._id,
                                dto: { isActive: !mem.isActive },
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              mem.isActive
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                            }`}
                          >
                            {mem.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: TICKET ASSIGNMENT & REASSIGNMENT QUEUE */}
      {adminTab === 'reassign' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Global Assignment Queue</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign or reassign any active ticket to an available agent
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reassignSearch}
                  onChange={(e) => setReassignSearch(e.target.value)}
                  placeholder="Search tickets to assign..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <select
                value={reassignStatusFilter}
                onChange={(e) => setReassignStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 w-full sm:w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {ticketsLoading ? (
            <LoadingState type="table" rows={4} />
          ) : (ticketsResult?.tickets?.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No tickets match filter"
                description="Try changing the status filter."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Subject & Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4 text-right">Created</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsResult?.tickets.map((t) => (
                    <tr
                      key={t._id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs"
                    >
                      <td
                        onClick={() => navigate(`/agent/tickets/${t._id}`)}
                        className="py-3 px-4 font-mono font-semibold text-brand-400 cursor-pointer"
                      >
                        {t.ticketNumber}
                      </td>

                      <td
                        onClick={() => navigate(`/agent/tickets/${t._id}`)}
                        className="py-3 px-4 cursor-pointer"
                      >
                        <div className="font-medium text-slate-100 line-clamp-1 max-w-xs sm:max-w-md">
                          {t.subject}
                        </div>
                        <div className="text-[11px] text-slate-400">{t.customer.name}</div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} />
                      </td>

                      <td className="py-3 px-4">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      <td className="py-3 px-4">
                        <ReassignDropdown
                          ticketId={t._id}
                          currentAssigneeId={t.assignedTo?._id || null}
                          agents={agents}
                          compact
                        />
                      </td>

                      <td className="py-3 px-4 text-[11px] text-slate-400 text-right whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => navigate(`/agent/tickets/${t._id}`)}
                          className="text-slate-500 hover:text-brand-400 transition"
                          title="Open Ticket"
                        >
                          <ArrowRight className="w-4 h-4" />
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

      {/* TAB 4: WORKSPACE SETTINGS */}
      {adminTab === 'settings' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-2xl shadow-xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Workspace Configuration</h2>
              <p className="text-xs text-slate-400">
                Modify tenant defaults and customer reopening policies
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Workspace Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Workspace Display Name
              </label>
              <input
                type="text"
                value={workspaceNameInput}
                onChange={(e) => setWorkspaceNameInput(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Workspace Slug (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Workspace Slug (Immutable)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={workspace?.slug || ''}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs sm:text-sm font-mono cursor-not-allowed"
                />
                <Lock className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Default Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Default Priority for New Tickets
              </label>
              <select
                value={defaultPriorityInput}
                onChange={(e) => setDefaultPriorityInput(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Normal</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>

            {/* Allow Customer Reopen */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
              <input
                type="checkbox"
                id="reopenCheckbox"
                checked={allowCustomerReopenInput}
                onChange={(e) => setAllowCustomerReopenInput(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand-600 bg-slate-900 border-slate-700 focus:ring-brand-500"
              />
              <label htmlFor="reopenCheckbox" className="text-xs cursor-pointer">
                <span className="font-semibold text-slate-200 block">
                  Allow Customers to Reopen Resolved Tickets
                </span>
                <span className="text-slate-400 block mt-0.5">
                  When enabled, any customer message posted to a resolved ticket automatically transitions its status back to 'open'.
                </span>
              </label>
            </div>

            {settingsSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Workspace settings saved and audit event recorded!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={settingsMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-brand-600/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{settingsMutation.isPending ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </form>
        </section>
      )}

      {/* TAB 5: AUDIT HISTORY */}
      {adminTab === 'audit' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Immutable Audit Ledger</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographic timeline of workspace mutations, actor identities, and status transitions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Actions</option>
                <option value="ticket_created">ticket_created</option>
                <option value="status_changed">status_changed</option>
                <option value="priority_changed">priority_changed</option>
                <option value="ticket_assigned">ticket_assigned</option>
                <option value="team_member_created">team_member_created</option>
                <option value="team_member_updated">team_member_updated</option>
                <option value="workspace_settings_updated">workspace_settings_updated</option>
              </select>
            </div>
          </div>

          {auditLoading ? (
            <LoadingState type="table" rows={6} />
          ) : auditError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load audit log"
                message={(auditError as Error).message}
                onRetry={refetchAudit}
              />
            </div>
          ) : (auditResult?.events?.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No audit events found"
                description="No recorded events match the selected criteria."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target Context</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResult?.events.map((evt) => (
                      <tr
                        key={evt._id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs"
                      >
                        <td className="py-3 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(evt.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{evt.actor.name}</div>
                          <div className="text-[10px] uppercase font-mono text-slate-500">
                            {evt.actor.type}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-brand-300 border border-slate-700">
                            {evt.action}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          {evt.ticketId && typeof evt.ticketId === 'object' && (evt.ticketId as any).ticketNumber ? (
                            <button
                              onClick={() => navigate(`/agent/tickets/${(evt.ticketId as any)._id}`)}
                              className="font-mono text-brand-400 hover:underline"
                            >
                              {(evt.ticketId as any).ticketNumber}
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-400 font-mono max-w-xs truncate">
                          {evt.details ? JSON.stringify(evt.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Page <strong className="text-slate-200">{auditPage}</strong> of{' '}
                  <strong className="text-slate-200">{auditResult?.totalPages || 1}</strong> (
                  {auditResult?.total || 0} total events)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setAuditPage((p) => Math.min(auditResult?.totalPages || 1, p + 1))}
                    disabled={auditPage >= (auditResult?.totalPages || 1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Modal: Add Team Member */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Add Team Member</h3>
              </div>

              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="e.g. John Miller"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="e.g. john@supportflow.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Initial Password
                </label>
                <input
                  type="password"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="agent">Agent (Ticket Triage & Responses)</option>
                  <option value="lead">Team Lead (Workload & Reassignment)</option>
                  <option value="admin">Admin (Full Workspace Management)</option>
                </select>
              </div>

              {memberError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {memberError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMemberMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {createMemberMutation.isPending ? 'Adding Member...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN DIRECTIVE & RESOLUTION CONSOLE */}
      {activeReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setActiveReport(null);
                setReportActionError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="border-b border-slate-800 pb-4 mb-4 pr-8">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <QueryStatusBadge status={activeReport.status} />
                <UrgencyBadge urgency={activeReport.priority} />
                <span className="capitalize text-xs text-slate-400">
                  {activeReport.category.replace('_', ' ')}
                </span>
                {activeReport.ticketNumber && (
                  <span className="font-mono text-xs text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                    Ticket: {activeReport.ticketNumber}
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white mb-1">{activeReport.title}</h3>

              <div className="text-xs text-slate-400 flex items-center gap-4">
                <span>
                  Submitted by: <strong className="text-slate-200">{activeReport.leadName}</strong>
                </span>
                <span>• {new Date(activeReport.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Findings & Action Required Boxes */}
            <div className="space-y-2 mb-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="font-semibold text-slate-300 mb-1">Observations / Findings:</div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{activeReport.summary}</p>
              </div>

              {activeReport.actionRequired && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                  <div className="font-semibold mb-0.5">Recommended Action / Request:</div>
                  <p>{activeReport.actionRequired}</p>
                </div>
              )}

              {activeReport.adminDirective && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-purple-200">
                  <div className="font-bold mb-0.5">Current Admin Directive:</div>
                  <p>{activeReport.adminDirective}</p>
                </div>
              )}
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 max-h-60">
              {activeReport.messages?.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  className={`p-3 rounded-xl text-xs border ${
                    msg.senderRole === 'admin'
                      ? 'bg-rose-950/30 border-rose-800/40 ml-4'
                      : 'bg-purple-950/30 border-purple-800/40 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
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

            {/* Directive & Actions Section */}
            {reportActionError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {reportActionError}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-slate-800 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminReplyMessage}
                  onChange={(e) => setAdminReplyMessage(e.target.value)}
                  placeholder="Post an update or reply in thread with Team Lead..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!adminReplyMessage.trim()) return;
                    replyReportMutation.mutate({
                      id: activeReport._id,
                      message: adminReplyMessage.trim(),
                    });
                  }}
                  disabled={replyReportMutation.isPending || !adminReplyMessage.trim()}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </div>

              {/* Status Transition & Directive Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminDirectiveInput}
                    onChange={(e) => setAdminDirectiveInput(e.target.value)}
                    placeholder="Executive Directive (e.g. Approved autoscale expansion, DevOps deployed hotfix)..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateReportStatusMutation.mutate({
                        id: activeReport._id,
                        status: 'resolved',
                        directive: adminDirectiveInput.trim() || undefined,
                      })
                    }
                    disabled={updateReportStatusMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition whitespace-nowrap"
                  >
                    Resolve Escalation
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Quick status:</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateReportStatusMutation.mutate({
                          id: activeReport._id,
                          status: 'acknowledged',
                          directive: adminDirectiveInput.trim() || undefined,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateReportStatusMutation.mutate({
                          id: activeReport._id,
                          status: 'in_progress',
                          directive: adminDirectiveInput.trim() || undefined,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                    >
                      In Progress
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveReport(null)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
