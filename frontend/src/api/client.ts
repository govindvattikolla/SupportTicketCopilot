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
  createdAt: string;
  updatedAt: string;
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

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Include Bearer token from localStorage if present
  const token = localStorage.getItem('supportflow_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

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
  token: string;
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
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  return apiClient<ListTicketsResult>(`/api/tickets?${query.toString()}`);
};

export const getTicketDetailsApi = async (
  id: string
): Promise<{ ticket: Ticket; messages: Message[]; auditEvents: AuditEvent[] }> => {
  return apiClient<{ ticket: Ticket; messages: Message[]; auditEvents: AuditEvent[] }>(
    `/api/tickets/${id}`
  );
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
