import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getTicketDetailsApi,
  updateTicketStatusApi,
  updateTicketPriorityApi,
  assignTicketApi,
  addStaffMessageApi,
  getWorkspaceAgentsApi,
  createTicketQueryApi,
  listTicketQueriesApi,
  addTicketQueryMessageApi,
  updateTicketQueryStatusApi,
  TicketStatus,
  TicketPriority,
  TicketQuery,
  TicketQueryCategory,
  TicketQueryUrgency,
} from '../api/client';
import {
  StatusBadge,
  PriorityBadge,
  CategoryBadge,
  QueryStatusBadge,
  UrgencyBadge,
  RoleBadge,
  SLABadge,
} from '../components/Badges';
import {
  ArrowLeft,
  Send,
  Lock,
  MessageSquare,
  ShieldAlert,
  History,
  ExternalLink,
  ChevronDown,
  MessageSquareShare,
  Plus,
  X,
  CheckCircle,
  Timer,
  AlertOctagon,
  PauseCircle,
  Clock,
} from 'lucide-react';
import { subscribeToTicket, unsubscribeFromTicket, getSocket } from '../realtime/socket';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const backPath = user?.role === 'admin'
    ? '/admin/dashboard'
    : user?.role === 'lead'
    ? '/lead/dashboard'
    : '/agent/dashboard';

  const backLabel = user?.role === 'admin'
    ? 'Back to Admin Portal'
    : user?.role === 'lead'
    ? 'Back to Team Lead Portal'
    : 'Back to Agent Dashboard';

  const [messageType, setMessageType] = useState<'reply' | 'internal_note'>('reply');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'replies' | 'notes'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal states for Consult Team Lead
  const [showNewQueryModal, setShowNewQueryModal] = useState(false);
  const [querySubject, setQuerySubject] = useState('');
  const [queryCategory, setQueryCategory] = useState<TicketQueryCategory>('technical');
  const [queryUrgency, setQueryUrgency] = useState<TicketQueryUrgency>('medium');
  const [queryMessage, setQueryMessage] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);

  const [activeQuery, setActiveQuery] = useState<TicketQuery | null>(null);
  const [queryReplyText, setQueryReplyText] = useState('');
  const [queryReplyError, setQueryReplyError] = useState<string | null>(null);

  // Fetch ticket details
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ticketDetails', id],
    queryFn: () => getTicketDetailsApi(id!),
    enabled: Boolean(id),
  });

  // Fetch queries attached to this ticket
  const { data: ticketQueriesResult, refetch: refetchTicketQueries } = useQuery({
    queryKey: ['ticketQueries', id],
    queryFn: () => listTicketQueriesApi({ ticketId: id }),
    enabled: Boolean(id),
  });

  // Fetch workspace agents for assignment dropdown
  const { data: agents } = useQuery({
    queryKey: ['workspaceAgents'],
    queryFn: getWorkspaceAgentsApi,
  });

  // Real-time Socket.IO room subscription and updates
  useEffect(() => {
    if (!id) return;
    subscribeToTicket(id);

    const socket = getSocket();
    const handleTicketUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['ticketQueries', id] });
    };
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
    };

    socket.on('ticket:updated', handleTicketUpdated);
    socket.on('message:new', handleNewMessage);

    return () => {
      unsubscribeFromTicket(id);
      socket.off('ticket:updated', handleTicketUpdated);
      socket.off('message:new', handleNewMessage);
    };
  }, [id, queryClient]);

  // Mutations
  const statusMutation = useMutation({
    mutationFn: (newStatus: TicketStatus) => updateTicketStatusApi(id!, newStatus),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['staffTickets'] });
    },
    onError: (err: any) => setActionError(err.message),
  });

  const priorityMutation = useMutation({
    mutationFn: (newPriority: TicketPriority) => updateTicketPriorityApi(id!, newPriority),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['staffTickets'] });
    },
    onError: (err: any) => setActionError(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) => assignTicketApi(id!, agentId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['staffTickets'] });
    },
    onError: (err: any) => setActionError(err.message),
  });

  const messageMutation = useMutation({
    mutationFn: () => addStaffMessageApi(id!, messageType, content),
    onSuccess: () => {
      setContent('');
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', id] });
    },
    onError: (err: any) => setActionError(err.message),
  });

  const createQueryMutation = useMutation({
    mutationFn: createTicketQueryApi,
    onSuccess: (newQ) => {
      setShowNewQueryModal(false);
      setQuerySubject('');
      setQueryMessage('');
      setQueryError(null);
      refetchTicketQueries();
      queryClient.invalidateQueries({ queryKey: ['agentTicketQueries'] });
      setActiveQuery(newQ);
    },
    onError: (err: any) => setQueryError(err.message || 'Failed to submit query'),
  });

  const replyQueryMutation = useMutation({
    mutationFn: ({ qId, text }: { qId: string; text: string }) =>
      addTicketQueryMessageApi(qId, text),
    onSuccess: (updated) => {
      setQueryReplyText('');
      setQueryReplyError(null);
      setActiveQuery(updated);
      refetchTicketQueries();
    },
    onError: (err: any) => setQueryReplyError(err.message || 'Failed to send message'),
  });

  const resolveQueryMutation = useMutation({
    mutationFn: (qId: string) =>
      updateTicketQueryStatusApi(qId, 'resolved', 'Resolved on ticket page'),
    onSuccess: (updated) => {
      setActiveQuery(updated);
      refetchTicketQueries();
    },
  });

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    messageMutation.mutate();
  };

  const handleCreateQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!querySubject.trim()) {
      setQueryError('Please enter a query subject');
      return;
    }
    if (!queryMessage.trim()) {
      setQueryError('Please describe your question for the Team Lead');
      return;
    }

    createQueryMutation.mutate({
      ticketId: id,
      subject: querySubject.trim(),
      category: queryCategory,
      urgency: queryUrgency,
      message: queryMessage.trim(),
    });
  };

  const handleReplyQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuery || !queryReplyText.trim()) return;
    replyQueryMutation.mutate({
      qId: activeQuery._id,
      text: queryReplyText.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs text-slate-400">Loading ticket details...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Ticket Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">
          {(error as Error)?.message || 'This ticket does not exist or you do not have permission to access it.'}
        </p>
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-xs text-white hover:bg-slate-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      </div>
    );
  }

  const { ticket, messages = [], auditEvents = [] } = data;

  const filteredMessages = messages.filter((m) => {
    if (activeTab === 'replies') return m.type === 'reply';
    if (activeTab === 'notes') return m.type === 'internal_note';
    return true;
  });

  const queries = ticketQueriesResult?.queries || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Consult Team Lead Action Button */}
          <button
            onClick={() => {
              setQuerySubject(`Inquiry on ${ticket.ticketNumber}: ${ticket.subject}`);
              setShowNewQueryModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-medium border border-indigo-500/30 transition shadow-sm"
          >
            <MessageSquareShare className="w-3.5 h-3.5" />
            <span>Consult Team Lead</span>
          </button>

          <Link
            to={`/track/${ticket.trackingToken}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <span>Customer View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {/* Ticket Header & Metadata */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 mb-8 backdrop-blur shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="font-mono text-xs font-bold text-brand-400 bg-brand-500/10 px-2.5 py-0.5 rounded border border-brand-500/20">
                {ticket.ticketNumber}
              </span>
              <CategoryBadge category={ticket.category} />
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>

            <h1 className="text-xl font-bold text-white tracking-tight">{ticket.subject}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Submitted by <strong className="text-slate-200">{ticket.customer.name}</strong> ({ticket.customer.email}) •{' '}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Quick Action Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Status Transition
              </label>
              <div className="relative">
                <select
                  value={ticket.status}
                  onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
                  disabled={statusMutation.isPending}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Priority
              </label>
              <div className="relative">
                <select
                  value={ticket.priority}
                  onChange={(e) => priorityMutation.mutate(e.target.value as TicketPriority)}
                  disabled={priorityMutation.isPending}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition cursor-pointer"
                >
                  <option value="P1">P1 Critical</option>
                  <option value="P2">P2 High</option>
                  <option value="P3">P3 Normal</option>
                  <option value="P4">P4 Low</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Assignee Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Assigned Staff
              </label>
              <div className="relative">
                <select
                  value={ticket.assignedTo?._id || ''}
                  onChange={(e) => assignMutation.mutate(e.target.value || null)}
                  disabled={assignMutation.isPending}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {agents?.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Description body */}
        <div className="pt-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Ticket Problem Statement
          </h3>
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            {ticket.description}
          </p>
        </div>
      </div>

      {/* Main Grid: Discussion + Consultations & Audit Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Conversation & Message Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thread Filter Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Messages ({messages.length})
              </button>

              <button
                onClick={() => setActiveTab('replies')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === 'replies'
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Customer Visible ({messages.filter((m) => m.type === 'reply').length})
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === 'notes'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Internal Notes ({messages.filter((m) => m.type === 'internal_note').length})
              </button>
            </div>
          </div>

          {/* Conversation Feed */}
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-10 bg-slate-800/30 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">No messages in this filter.</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg._id}
                  className={`rounded-2xl p-5 border transition ${
                    msg.type === 'internal_note'
                      ? 'bg-amber-950/20 border-amber-500/30 shadow-inner'
                      : msg.sender.type === 'customer'
                      ? 'bg-slate-800/50 border-slate-700/60'
                      : 'bg-brand-950/20 border-brand-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          msg.type === 'internal_note'
                            ? 'bg-amber-500/20 text-amber-400'
                            : msg.sender.type === 'customer'
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-brand-500/20 text-brand-400'
                        }`}
                      >
                        {msg.type === 'internal_note' ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          msg.sender.name.charAt(0)
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-white">{msg.sender.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {msg.type === 'internal_note' ? (
                            <span className="text-[10px] font-semibold text-amber-400">
                              🔒 Confidential Internal Staff Note
                            </span>
                          ) : msg.sender.type === 'customer' ? (
                            <span className="text-[10px] text-slate-400">Customer Reply</span>
                          ) : (
                            <span className="text-[10px] text-brand-400 font-medium">
                              Support Agent Public Reply
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed pl-9">
                    {msg.content}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Unified Composer: Public Reply vs Internal Note */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMessageType('reply')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  messageType === 'reply'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Customer Reply</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('internal_note')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  messageType === 'internal_note'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Internal Staff Note</span>
              </button>
            </div>

            <form onSubmit={handlePostMessage}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={
                  messageType === 'internal_note'
                    ? 'Record private notes, logs, or handoff details visible ONLY to workspace staff...'
                    : 'Compose a helpful, courteous response sent directly to the customer...'
                }
                className={`w-full p-4 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                  messageType === 'internal_note'
                    ? 'bg-amber-950/20 border border-amber-500/40 focus:ring-1 focus:ring-amber-500'
                    : 'bg-slate-900 border border-slate-700 focus:ring-1 focus:ring-brand-500'
                }`}
              />

              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-slate-500">
                  {messageType === 'internal_note'
                    ? '🔒 Internal notes are never visible to customers.'
                    : '✉️ Reply will be visible on the public ticket tracker.'}
                </span>

                <button
                  type="submit"
                  disabled={messageMutation.isPending || !content.trim()}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-xs text-white shadow-md transition disabled:opacity-50 ${
                    messageType === 'internal_note'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-brand-600 hover:bg-brand-500'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {messageMutation.isPending
                    ? 'Submitting...'
                    : messageType === 'reply'
                    ? 'Send Public Reply'
                    : 'Save Internal Note'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Column: Metadata, Team Lead Consultations & Audit */}
        <div className="space-y-6">
          {/* Team Lead Consultations Card (NEW FEATURE) */}
          <div className="bg-slate-800/80 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareShare className="w-4 h-4 text-indigo-400" />
                <span>Team Lead Inquiries</span>
              </h3>

              <button
                onClick={() => {
                  setQuerySubject(`Inquiry on ${ticket.ticketNumber}: ${ticket.subject}`);
                  setShowNewQueryModal(true);
                }}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium inline-flex items-center gap-1"
                title="Consult Team Lead about this ticket"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ask Lead</span>
              </button>
            </div>

            {queries.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400 text-center">
                <p className="mb-2">No active consultations on this ticket.</p>
                <button
                  onClick={() => {
                    setQuerySubject(`Inquiry on ${ticket.ticketNumber}: ${ticket.subject}`);
                    setShowNewQueryModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition"
                >
                  Consult Team Lead
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <div
                    key={q._id}
                    onClick={() => setActiveQuery(q)}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/70 hover:border-indigo-500/50 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <QueryStatusBadge status={q.status} />
                      <UrgencyBadge urgency={q.urgency} />
                    </div>
                    <div className="font-semibold text-xs text-slate-200 line-clamp-1">
                      {q.subject}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {q.messages?.[q.messages.length - 1]?.message || 'No messages'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-800">
                      <span>Lead: {q.leadName || 'Unassigned'}</span>
                      <span>{q.messages?.length || 1} messages</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SLA Tracking & Deadlines Card */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-brand-400" />
                <span>SLA Policy & Deadlines</span>
              </h3>
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

            {ticket.sla?.isEscalated && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-semibold">Escalated due to SLA breach</span>
              </div>
            )}

            {ticket.status === 'pending' && (
              <div className="mb-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2 text-purple-300 text-xs">
                <PauseCircle className="w-4 h-4 shrink-0 text-purple-400" />
                <span>SLA clock paused (awaiting customer reply)</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* First Response SLA */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-300">First Response</span>
                  {ticket.sla?.firstResponseAchievedAt ? (
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Met
                    </span>
                  ) : ticket.sla?.isFirstResponseBreached ? (
                    <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3" /> Breached
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {ticket.sla?.firstResponseAchievedAt ? (
                    <span>Achieved: {new Date(ticket.sla.firstResponseAchievedAt).toLocaleString()}</span>
                  ) : ticket.sla?.firstResponseDeadline ? (
                    <span>Target: {new Date(ticket.sla.firstResponseDeadline).toLocaleString()}</span>
                  ) : (
                    <span>No target set</span>
                  )}
                </div>
              </div>

              {/* Resolution SLA */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-300">Resolution</span>
                  {ticket.sla?.resolutionAchievedAt ? (
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Met
                    </span>
                  ) : ticket.sla?.isResolutionBreached ? (
                    <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3" /> Breached
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> In Progress
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {ticket.sla?.resolutionAchievedAt ? (
                    <span>Achieved: {new Date(ticket.sla.resolutionAchievedAt).toLocaleString()}</span>
                  ) : ticket.sla?.resolutionDeadline ? (
                    <span>Target: {new Date(ticket.sla.resolutionDeadline).toLocaleString()}</span>
                  ) : (
                    <span>No target set</span>
                  )}
                </div>
              </div>

              {Boolean(ticket.sla?.totalPausedMinutes) && (
                <div className="flex justify-between py-1 text-slate-400 text-[11px]">
                  <span>Total Paused Duration</span>
                  <span className="text-slate-300 font-mono">{ticket.sla?.totalPausedMinutes} mins</span>
                </div>
              )}
            </div>
          </div>

          {/* Ticket Information Summary */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Ticket Details
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Status</span>
                <span className="capitalize font-semibold text-white">{ticket.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Priority</span>
                <span className="font-semibold text-white">{ticket.priority}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Assignee</span>
                <span className="font-semibold text-brand-400">
                  {ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">First Response</span>
                <span className="text-slate-300">
                  {ticket.firstResponseAt ? new Date(ticket.firstResponseAt).toLocaleTimeString() : 'Awaiting'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Resolution</span>
                <span className="text-slate-300">
                  {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : 'Unresolved'}
                </span>
              </div>
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-brand-400" />
              <span>Activity & Audit History</span>
            </h3>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              {auditEvents.map((evt) => (
                <div key={evt._id} className="relative pl-4 border-l border-slate-700 pb-2">
                  <div className="absolute -left-1.5 top-0.5 w-2.5 h-2.5 rounded-full bg-brand-500/80"></div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-semibold text-slate-300 capitalize">
                      {evt.action.replace(/_/g, ' ')}
                    </span>
                    <span>{new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    By <strong className="text-slate-200">{evt.actor.name}</strong>
                  </p>
                  {evt.details && Object.keys(evt.details).length > 0 && (
                    <div className="mt-1 text-[10px] font-mono bg-slate-900/80 p-1.5 rounded text-slate-300">
                      {JSON.stringify(evt.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CONSULT TEAM LEAD MODAL */}
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
              <h3 className="text-lg font-bold text-white">Consult Team Lead on {ticket.ticketNumber}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Submit your question or approval request to your Team Lead regarding this ticket.
            </p>

            {queryError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {queryError}
              </div>
            )}

            <form onSubmit={handleCreateQuerySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
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
                  placeholder="e.g. Need approval for $50 invoice credit"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Question for Team Lead <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={queryMessage}
                  onChange={(e) => setQueryMessage(e.target.value)}
                  placeholder="Explain what specific guidance or approval you need..."
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
                  {createQueryMutation.isPending ? 'Sending...' : 'Send to Team Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INTERACTIVE CONSULTATION DISCUSSION */}
      {/* ========================================================================= */}
      {activeQuery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setActiveQuery(null);
                setQueryReplyError(null);
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
              </div>
            </div>

            {/* Resolution Banner */}
            {activeQuery.status === 'resolved' && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <div className="font-semibold mb-0.5">Resolved Consultation</div>
                <p>{activeQuery.resolutionSummary || 'Guidance provided.'}</p>
              </div>
            )}

            {/* Conversation Messages */}
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

            {/* Follow-up Reply Input */}
            {queryReplyError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {queryReplyError}
              </div>
            )}

            <form onSubmit={handleReplyQuerySubmit} className="mt-auto pt-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryReplyText}
                  onChange={(e) => setQueryReplyText(e.target.value)}
                  placeholder="Ask a follow-up or provide ticket updates..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={replyQueryMutation.isPending || !queryReplyText.trim()}
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
    </div>
  );
};
