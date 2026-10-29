export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  service: string;
  database: {
    status: string;
    healthy: boolean;
  };
}

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketCategory = 'technical' | 'billing' | 'general' | 'feature_request' | 'bug';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'lead' | 'agent';
  workspaceId: string;
}

export interface Ticket {
  _id: string;
  workspaceId: string;
  ticketNumber: string;
  trackingToken: string;
  customer: {
    name: string;
    email: string;
  };
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  sla?: TicketSLA;
  createdAt: string;
  updatedAt: string;
}

export type SLAMetricStatus = 'healthy' | 'warning' | 'breached' | 'paused' | 'satisfied';

export interface TicketSLA {
  firstResponseDeadline?: string;
  resolutionDeadline?: string;
  firstResponseAchievedAt?: string;
  resolutionAchievedAt?: string;
  isFirstResponseBreached: boolean;
  isResolutionBreached: boolean;
  isWarningSent: boolean;
  isEscalated: boolean;
  pausedAt?: string;
  totalPausedMinutes: number;
}

export interface SLAEvaluationResult {
  firstResponse: {
    status: SLAMetricStatus;
    deadline?: string;
    achievedAt?: string;
    isBreached: boolean;
    remainingMinutes: number;
    percentElapsed: number;
  };
  resolution: {
    status: SLAMetricStatus;
    deadline?: string;
    achievedAt?: string;
    isBreached: boolean;
    remainingMinutes: number;
    percentElapsed: number;
  };
  overallStatus: SLAMetricStatus;
}

export interface Message {
  _id: string;
  ticketId: string;
  workspaceId: string;
  type: 'reply' | 'internal_note';
  sender: {
    type: 'customer' | 'agent' | 'system';
    userId?: string;
    name: string;
    email?: string;
  };
  content: string;
  createdAt: string;
}

export interface AuditEvent {
  _id: string;
  ticketId: string;
  workspaceId: string;
  actor: {
    type: 'customer' | 'user' | 'system';
    userId?: string;
    name: string;
  };
  action: string;
  details?: Record<string, any>;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

let isRefreshing = false;
let refreshSubscribers: Array<(err?: Error) => void> = [];

const subscribeTokenRefresh = (cb: (err?: Error) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (err?: Error) => {
  refreshSubscribers.forEach((cb) => cb(err));
  refreshSubscribers = [];
};

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Pure HTTP-only cookie authentication via credentials: 'include'.
  // No sensitive JWTs or secrets are stored in or read from localStorage.
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Check if access token expired (401) and request is not an auth lifecycle endpoint
  const isAuthRoute =
    endpoint.includes('/api/auth/login') ||
    endpoint.includes('/api/auth/refresh') ||
    endpoint.includes('/api/auth/logout');

  if (response.status === 401 && !isAuthRoute) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        await refreshTokenApi();
        isRefreshing = false;
        onRefreshed();
      } catch (refreshErr) {
        isRefreshing = false;
        onRefreshed(refreshErr as Error);
        const body = (await response.json().catch(() => ({}))) as ApiResponse<T>;
        const msg = body.error?.message || 'Session expired. Please log in again.';
        throw new Error(msg);
      }
    } else {
      // Queue concurrent requests while token is refreshing
      await new Promise<void>((resolve, reject) => {
        subscribeTokenRefresh((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Retry original request with refreshed HTTP-only cookie session
    const retryResponse = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const retryBody = (await retryResponse.json()) as ApiResponse<T>;
    if (!retryResponse.ok || !retryBody.success) {
      const errorMsg =
        retryBody.error?.message || `Request failed with status ${retryResponse.status}`;
      throw new Error(errorMsg);
    }
    return retryBody.data;
  }

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    const errorMessage = body.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return body.data;
}

// Health API
export const fetchHealthCheck = async (): Promise<HealthCheckData> => {
  return apiClient<HealthCheckData>('/api/health');
};

// Public Ticket APIs
export interface SubmitTicketDTO {
  workspaceSlug?: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}

export interface SubmitTicketResult {
  ticketNumber: string;
  trackingToken: string;
  trackingUrl: string;
  status: TicketStatus;
  subject: string;
  createdAt: string;
}

export const submitPublicTicketApi = async (dto: SubmitTicketDTO): Promise<SubmitTicketResult> => {
  return apiClient<SubmitTicketResult>('/api/public/tickets', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
};

export const trackPublicTicketApi = async (
  token: string
): Promise<{ ticket: Ticket; messages: Message[] }> => {
  return apiClient<{ ticket: Ticket; messages: Message[] }>(`/api/public/tickets/track/${token}`);
};

export const submitCustomerMessageApi = async (
  token: string,
  content: string
): Promise<Message> => {
  return apiClient<Message>(`/api/public/tickets/track/${token}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
};

// Staff Auth APIs
export interface LoginResult {
  user: User;
  token?: string;
  accessToken?: string;
}

export const loginApi = async (
  email: string,
  password: string,
  workspaceSlug?: string
): Promise<LoginResult> => {
  return apiClient<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, workspaceSlug }),
  });
};

export const refreshTokenApi = async (): Promise<{ user: User }> => {
  return apiClient<{ user: User }>('/api/auth/refresh', {
    method: 'POST',
  });
};

export const logoutApi = async (): Promise<void> => {
  await apiClient<null>('/api/auth/logout', { method: 'POST' });
};

export const getMeApi = async (): Promise<{ user: User; workspace: any }> => {
  return apiClient<{ user: User; workspace: any }>('/api/auth/me');
};

export const getWorkspaceAgentsApi = async (): Promise<User[]> => {
  return apiClient<User[]>('/api/auth/agents');
};

// Staff Ticket APIs
export interface ListTicketsParams {
  status?: string;
  priority?: string;
  assignedTo?: string;
  category?: string;
  search?: string;
  overdue?: string;
  highPriority?: string;
  page?: number;
  limit?: number;
}

export interface ListTicketsResult {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const listTicketsApi = async (params: ListTicketsParams): Promise<ListTicketsResult> => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.overdue) query.set('overdue', params.overdue);
  if (params.highPriority) query.set('highPriority', params.highPriority);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  return apiClient<ListTicketsResult>(`/api/tickets?${query.toString()}`);
};

export const getTicketDetailsApi = async (
  id: string
): Promise<{
  ticket: Ticket;
  messages: Message[];
  auditEvents: AuditEvent[];
  slaEvaluation?: SLAEvaluationResult;
}> => {
  return apiClient<{
    ticket: Ticket;
    messages: Message[];
    auditEvents: AuditEvent[];
    slaEvaluation?: SLAEvaluationResult;
  }>(`/api/tickets/${id}`);
};

export const updateTicketStatusApi = async (
  id: string,
  status: TicketStatus
): Promise<Ticket> => {
  return apiClient<Ticket>(`/api/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

export const updateTicketPriorityApi = async (
  id: string,
  priority: TicketPriority
): Promise<Ticket> => {
  return apiClient<Ticket>(`/api/tickets/${id}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority }),
  });
};

export const assignTicketApi = async (
  id: string,
  assignedTo: string | null
): Promise<Ticket> => {
  return apiClient<Ticket>(`/api/tickets/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo }),
  });
};

export const addStaffMessageApi = async (
  id: string,
  type: 'reply' | 'internal_note',
  content: string
): Promise<Message> => {
  return apiClient<Message>(`/api/tickets/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ type, content }),
  });
};

// Phase 3 Reporting & Dashboard APIs
export interface AgentSummaryData {
  myOpenCount: number;
  myInProgressCount: number;
  myHighPriorityCount: number;
  myOverdueCount: number;
  highPriorityTickets: Ticket[];
  overdueTickets: Ticket[];
  recentActivity: AuditEvent[];
}

export interface AgentWorkloadItem {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  totalAssigned: number;
  openCount: number;
  inProgressCount: number;
  pendingCount: number;
  resolvedCount: number;
}

export interface TeamLeadReportData {
  teamWorkload: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    pendingTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    unassignedTickets: number;
    overdueTickets: number;
    highPriorityTickets: number;
  };
  agentWorkloads: AgentWorkloadItem[];
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  unassignedTickets: Ticket[];
  overdueTickets: Ticket[];
}

export interface WorkspaceInfo {
  _id: string;
  name: string;
  slug: string;
  ticketCounter: number;
  settings: {
    defaultPriority: TicketPriority;
    allowCustomerReopen: boolean;
  };
  createdAt: string;
}

export interface AdminOverviewData {
  workspace: WorkspaceInfo;
  ticketCounts: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  };
  teamStats: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    byRole: {
      admin: number;
      lead: number;
      agent: number;
    };
  };
  resolutionMetrics: {
    totalResolved: number;
    resolutionRate: number;
  };
  recentAuditEvents: AuditEvent[];
}

export const getAgentSummaryApi = async (): Promise<AgentSummaryData> => {
  return apiClient<AgentSummaryData>('/api/reports/agent-summary');
};

export const getTeamLeadReportApi = async (): Promise<TeamLeadReportData> => {
  return apiClient<TeamLeadReportData>('/api/reports/team');
};

export const getAdminOverviewApi = async (): Promise<AdminOverviewData> => {
  return apiClient<AdminOverviewData>('/api/reports/admin');
};

// Workspace Management APIs
export const getCurrentWorkspaceApi = async (): Promise<WorkspaceInfo> => {
  return apiClient<WorkspaceInfo>('/api/workspaces/current');
};

export interface UpdateWorkspaceSettingsDTO {
  name?: string;
  defaultPriority?: TicketPriority;
  allowCustomerReopen?: boolean;
}

export const updateWorkspaceSettingsApi = async (
  dto: UpdateWorkspaceSettingsDTO
): Promise<WorkspaceInfo> => {
  return apiClient<WorkspaceInfo>('/api/workspaces/current/settings', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
};

// Team Member Management APIs
export interface TeamMember extends User {
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const getWorkspaceUsersApi = async (): Promise<TeamMember[]> => {
  return apiClient<TeamMember[]>('/api/users');
};

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'lead' | 'agent';
}

export const createWorkspaceUserApi = async (dto: CreateUserDTO): Promise<TeamMember> => {
  return apiClient<TeamMember>('/api/users', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
};

export interface UpdateUserDTO {
  name?: string;
  role?: 'admin' | 'lead' | 'agent';
  isActive?: boolean;
}

export const updateWorkspaceUserApi = async (
  id: string,
  dto: UpdateUserDTO
): Promise<TeamMember> => {
  return apiClient<TeamMember>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
};

// Audit Trail API
export interface ListAuditEventsParams {
  page?: number;
  limit?: number;
  action?: string;
  actorType?: string;
  ticketId?: string;
}

export interface ListAuditEventsResult {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getWorkspaceAuditEventsApi = async (
  params: ListAuditEventsParams = {}
): Promise<ListAuditEventsResult> => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.action) query.set('action', params.action);
  if (params.actorType) query.set('actorType', params.actorType);
  if (params.ticketId) query.set('ticketId', params.ticketId);

  return apiClient<ListAuditEventsResult>(`/api/audit?${query.toString()}`);
};

// ============================================================================
// AGENT <-> TEAM LEAD TICKET QUERIES & CONSULTATIONS
// ============================================================================
export type TicketQueryCategory =
  | 'technical'
  | 'refund_approval'
  | 'policy_guidance'
  | 'sla_escalation'
  | 'customer_dispute'
  | 'other';

export type TicketQueryUrgency = 'low' | 'medium' | 'high' | 'urgent';
export type TicketQueryStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export interface TicketQueryMessage {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: 'agent' | 'lead' | 'admin';
  message: string;
  createdAt: string;
}

export interface TicketQuery {
  _id: string;
  workspaceId: string;
  ticketId: string | Ticket;
  ticketNumber: string;
  agentId: string;
  agentName: string;
  leadId?: string;
  leadName?: string;
  subject: string;
  category: TicketQueryCategory;
  urgency: TicketQueryUrgency;
  status: TicketQueryStatus;
  messages: TicketQueryMessage[];
  resolutionSummary?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketQueryDTO {
  ticketId: string;
  subject: string;
  category: TicketQueryCategory;
  urgency: TicketQueryUrgency;
  message: string;
  leadId?: string;
}

export interface ListTicketQueriesResult {
  queries: TicketQuery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: {
    total: number;
    open: number;
    inReview: number;
    resolved: number;
    urgent: number;
  };
}

export const createTicketQueryApi = async (dto: CreateTicketQueryDTO): Promise<TicketQuery> => {
  return apiClient<TicketQuery>('/api/ticket-queries', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
};

export const listTicketQueriesApi = async (params: {
  status?: string;
  urgency?: string;
  category?: string;
  ticketId?: string;
  agentId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ListTicketQueriesResult> => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.urgency) query.set('urgency', params.urgency);
  if (params.category) query.set('category', params.category);
  if (params.ticketId) query.set('ticketId', params.ticketId);
  if (params.agentId) query.set('agentId', params.agentId);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  return apiClient<ListTicketQueriesResult>(`/api/ticket-queries?${query.toString()}`);
};

export const getTicketQueryApi = async (id: string): Promise<TicketQuery> => {
  return apiClient<TicketQuery>(`/api/ticket-queries/${id}`);
};

export const addTicketQueryMessageApi = async (
  id: string,
  message: string
): Promise<TicketQuery> => {
  return apiClient<TicketQuery>(`/api/ticket-queries/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

export const updateTicketQueryStatusApi = async (
  id: string,
  status: TicketQueryStatus,
  resolutionSummary?: string
): Promise<TicketQuery> => {
  return apiClient<TicketQuery>(`/api/ticket-queries/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, resolutionSummary }),
  });
};

// ============================================================================
// TEAM LEAD <-> ADMIN OPERATIONAL REPORTS & ESCALATIONS
// ============================================================================
export type AdminReportCategory =
  | 'incident_escalation'
  | 'staffing_capacity'
  | 'policy_compliance'
  | 'sla_bottleneck'
  | 'tooling_request'
  | 'general_update';

export type AdminReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type AdminReportStatus =
  | 'submitted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface AdminReportMessage {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: 'lead' | 'admin';
  message: string;
  createdAt: string;
}

export interface AdminReport {
  _id: string;
  workspaceId: string;
  leadId: string;
  leadName: string;
  title: string;
  category: AdminReportCategory;
  priority: AdminReportPriority;
  status: AdminReportStatus;
  summary: string;
  actionRequired?: string;
  ticketId?: string | Ticket;
  ticketNumber?: string;
  messages: AdminReportMessage[];
  adminDirective?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminReportDTO {
  title: string;
  category: AdminReportCategory;
  priority: AdminReportPriority;
  summary: string;
  actionRequired?: string;
  ticketId?: string;
}

export interface ListAdminReportsResult {
  reports: AdminReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: {
    total: number;
    submitted: number;
    critical: number;
    inProgress: number;
    resolved: number;
  };
}

export const createAdminReportApi = async (dto: CreateAdminReportDTO): Promise<AdminReport> => {
  return apiClient<AdminReport>('/api/admin-reports', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
};

export const listAdminReportsApi = async (params: {
  status?: string;
  priority?: string;
  category?: string;
  leadId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ListAdminReportsResult> => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.category) query.set('category', params.category);
  if (params.leadId) query.set('leadId', params.leadId);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  return apiClient<ListAdminReportsResult>(`/api/admin-reports?${query.toString()}`);
};

export const getAdminReportApi = async (id: string): Promise<AdminReport> => {
  return apiClient<AdminReport>(`/api/admin-reports/${id}`);
};

export const addAdminReportMessageApi = async (
  id: string,
  message: string
): Promise<AdminReport> => {
  return apiClient<AdminReport>(`/api/admin-reports/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

export const updateAdminReportStatusApi = async (
  id: string,
  status: AdminReportStatus,
  adminDirective?: string
): Promise<AdminReport> => {
  return apiClient<AdminReport>(`/api/admin-reports/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, adminDirective }),
  });
};

// ============================================================================
// IN-APP NOTIFICATIONS & ALERTS
// ============================================================================
export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'ticket_reply'
  | 'status_changed'
  | 'sla_warning'
  | 'sla_breached';

export interface AppNotification {
  _id: string;
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: string;
  ticketNumber?: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationsResult {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}

export const getNotificationsApi = async (params: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<ListNotificationsResult> => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.unreadOnly) query.set('unreadOnly', 'true');

  return apiClient<ListNotificationsResult>(`/api/notifications?${query.toString()}`);
};

export const markNotificationReadApi = async (id: string): Promise<AppNotification> => {
  return apiClient<AppNotification>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
};

export const markAllNotificationsReadApi = async (): Promise<{ modifiedCount: number }> => {
  return apiClient<{ modifiedCount: number }>(`/api/notifications/read-all`, {
    method: 'PATCH',
  });
};

// ============================================================================
// SLA POLICIES & BUSINESS HOURS
// ============================================================================
export interface ISLAPriorityTargets {
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface IBusinessHoursConfig {
  enabled: boolean;
  timeZone: string;
  operatingHours: {
    start: string;
    end: string;
  };
  workingDays: number[];
  holidays: string[];
}

export interface ISLASettings {
  enabled: boolean;
  warningThresholdPercent: number;
  businessHours: IBusinessHoursConfig;
  priorities: {
    P1: ISLAPriorityTargets;
    P2: ISLAPriorityTargets;
    P3: ISLAPriorityTargets;
    P4: ISLAPriorityTargets;
  };
}

export const getWorkspaceSLASettingsApi = async (): Promise<ISLASettings> => {
  return apiClient<ISLASettings>('/api/workspaces/current/sla');
};

export const updateWorkspaceSLASettingsApi = async (
  dto: Partial<ISLASettings>
): Promise<ISLASettings> => {
  return apiClient<ISLASettings>('/api/workspaces/current/sla', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
};

// ============================================================================
// PHASE 5: EXPLAINABLE OPERATIONAL INTELLIGENCE
// ============================================================================

export type UrgencyTier = 'critical' | 'high' | 'medium' | 'low';

export interface UrgencyFactor {
  name: 'Priority Weight' | 'Waiting Time' | 'SLA Pressure' | 'Assignment State';
  score: number;
  maxScore: number;
  details: string;
}

export interface RankedTicket {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  originalPriority: TicketPriority; // Keep original priority separate from attention score
  status: TicketStatus;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  waitingHours: number;
  slaRemainingMinutes: number | null;
  isSlaBreached: boolean;
  attentionScore: number;
  urgencyTier: UrgencyTier;
  factors: UrgencyFactor[];
  explanation: string;
}

export interface UrgencyRankingResult {
  totalAnalyzed: number;
  tierCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  tickets: RankedTicket[];
}

export interface AgentRecommendationFactor {
  name: 'Expertise Match' | 'Workload Bandwidth' | 'Availability Status';
  score: number;
  maxScore: number;
  details: string;
}

export interface AgentRecommendation {
  agent: {
    _id: string;
    name: string;
    email: string;
    role: string;
    skills: string[];
    maxCapacity: number;
  };
  activeTicketCount: number;
  capacityUtilizationPercent: number;
  matchScore: number;
  isRecommended: boolean;
  factors: AgentRecommendationFactor[];
  explanation: string;
}

export interface AgentRecommendationResult {
  ticket: {
    _id: string;
    ticketNumber: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    currentAssignee?: {
      _id: string;
      name: string;
    } | null;
  };
  recommendations: AgentRecommendation[];
}

export interface ClusterTicketItem {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  customerEmail: string;
}

export interface RecurringIssueCluster {
  clusterId: string;
  category: TicketCategory;
  themeTitle: string;
  ticketCount: number;
  tickets: ClusterTicketItem[];
  sharedKeywords: string[];
  averageSimilarity: number;
  highestPriority: TicketPriority;
  firstSeenAt: string;
  lastSeenAt: string;
  isPotentialIncident: boolean;
  disclaimer: string;
  recommendedAction: string;
}

export interface RecurringIssuesResult {
  totalClusters: number;
  potentialIncidentCount: number;
  totalTicketsClustered: number;
  methodology: {
    algorithm: string;
    similarityMetric: string;
    similarityThreshold: number;
    llmEmployed: boolean;
    nonLlmRationale: {
      cost: string;
      privacy: string;
      failureHandling: string;
      explainability: string;
    };
  };
  clusters: RecurringIssueCluster[];
}

export interface UnassignedBottleneck {
  totalCount: number;
  avgWaitingHours: number;
  maxWaitingHours: number;
  byPriority: Record<TicketPriority, number>;
  oldestTickets: {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    priority: TicketPriority;
    waitingHours: number;
  }[];
}

export interface PendingCustomerBottleneck {
  totalCount: number;
  avgPendingHours: number;
  staleCount: number;
  tickets: {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    pendingHours: number;
    customerEmail: string;
  }[];
}

export interface EngineeringBottleneck {
  totalCount: number;
  avgAgeHours: number;
  byPriority: Record<TicketPriority, number>;
  tickets: {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    reason: string;
  }[];
}

export interface SLABreachBottleneck {
  totalBreached: number;
  firstResponseBreached: number;
  resolutionBreached: number;
  bothBreached: number;
  byPriority: Record<TicketPriority, number>;
  byAgent: {
    agentId: string | null;
    agentName: string;
    breachCount: number;
  }[];
}

export interface AgentWorkloadMetric {
  agentId: string;
  name: string;
  email: string;
  role: string;
  activeTickets: number;
  maxCapacity: number;
  loadRatio: number;
  isOverloaded: boolean;
  isUnderutilized: boolean;
}

export interface WorkloadImbalanceMetric {
  totalActiveAgents: number;
  totalActiveTickets: number;
  meanActiveTickets: number;
  standardDeviation: number;
  imbalanceRatio: number;
  status: 'balanced' | 'moderate_imbalance' | 'severe_imbalance';
  overloadedAgents: AgentWorkloadMetric[];
  underutilizedAgents: AgentWorkloadMetric[];
  agentDistribution: AgentWorkloadMetric[];
  explanation: string;
}

export interface BottleneckAnalyticsResult {
  workspaceId: string;
  timestamp: string;
  summary: {
    unassignedCount: number;
    waitingCustomerCount: number;
    awaitingEngineeringCount: number;
    slaBreachCount: number;
    workloadImbalanceStatus: 'balanced' | 'moderate_imbalance' | 'severe_imbalance';
  };
  unassigned: UnassignedBottleneck;
  waitingForCustomer: PendingCustomerBottleneck;
  awaitingEngineering: EngineeringBottleneck;
  slaBreaches: SLABreachBottleneck;
  workloadImbalance: WorkloadImbalanceMetric;
}

export const getUrgencyRankingApi = async (params?: {
  status?: string;
  assignedTo?: string;
  urgencyTier?: string;
  limit?: number;
}): Promise<UrgencyRankingResult> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params?.urgencyTier) query.set('urgencyTier', params.urgencyTier);
  if (params?.limit) query.set('limit', params.limit.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiClient<UrgencyRankingResult>(`/api/operations/urgency-ranking${queryString}`);
};

export const getAgentRecommendationsApi = async (
  ticketId: string
): Promise<AgentRecommendationResult> => {
  return apiClient<AgentRecommendationResult>(`/api/operations/recommendations/${ticketId}`);
};

export const getRecurringIssuesApi = async (params?: {
  daysLookback?: number;
  category?: string;
  similarityThreshold?: number;
}): Promise<RecurringIssuesResult> => {
  const query = new URLSearchParams();
  if (params?.daysLookback) query.set('daysLookback', params.daysLookback.toString());
  if (params?.category) query.set('category', params.category);
  if (params?.similarityThreshold) query.set('similarityThreshold', params.similarityThreshold.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiClient<RecurringIssuesResult>(`/api/operations/recurring-issues${queryString}`);
};

export const getBottleneckAnalyticsApi = async (): Promise<BottleneckAnalyticsResult> => {
  return apiClient<BottleneckAnalyticsResult>('/api/operations/bottlenecks');
};



