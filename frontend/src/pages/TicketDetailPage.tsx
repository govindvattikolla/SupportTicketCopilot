import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTicketDetailsApi,
  updateTicketStatusApi,
  updateTicketPriorityApi,
  assignTicketApi,
  addStaffMessageApi,
  getWorkspaceAgentsApi,
  TicketStatus,
  TicketPriority,
} from '../api/client';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../components/Badges';
import {
  ArrowLeft,
  Send,
  Lock,
  MessageSquare,
  ShieldAlert,
  History,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [messageType, setMessageType] = useState<'reply' | 'internal_note'>('reply');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'replies' | 'notes'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch ticket details
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ticketDetails', id],
    queryFn: () => getTicketDetailsApi(id!),
    enabled: Boolean(id),
  });

  // Fetch workspace agents for assignment dropdown
  const { data: agents } = useQuery({
    queryKey: ['workspaceAgents'],
    queryFn: getWorkspaceAgentsApi,
  });

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

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    messageMutation.mutate();
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
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Ticket Not Found</h2>
        <p className="text-slate-400 text-xs mb-4">
          {error instanceof Error ? error.message : 'Ticket not found or inaccessible in this workspace.'}
        </p>
        <Link
          to="/agent/tickets"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Ticket Inbox</span>
        </Link>
      </div>
    );
  }

  const { ticket, messages, auditEvents } = data;

  const filteredMessages = messages.filter((m) => {
    if (activeTab === 'replies') return m.type === 'reply';
    if (activeTab === 'notes') return m.type === 'internal_note';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Back button and quick reference */}
      <div className="flex items-center justify-between mb-5">
        <Link
          to="/agent/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tickets Inbox</span>
        </Link>

        <a
          href={`/track/${ticket.trackingToken}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium transition"
        >
          <span>Open Customer View</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Error alert if state transition or mutation fails */}
      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-rose-400 hover:text-rose-200 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 backdrop-blur shadow-xl mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-700/60">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-brand-400 border border-slate-700">
                {ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {ticket.subject}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Requester: <strong className="text-slate-200">{ticket.customer.name}</strong> ({ticket.customer.email})
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

      {/* Main Grid: Discussion + Audit Sidebar */}
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
                Customer Replies ({messages.filter((m) => m.type === 'reply').length})
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

          {/* Messages Stream */}
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-800/30 rounded-xl border border-slate-800">
                No messages in this tab yet.
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isInternal = msg.type === 'internal_note';
                const isCustomer = msg.sender.type === 'customer';

                return (
                  <div
                    key={msg._id}
                    className={`rounded-2xl p-4 border transition ${
                      isInternal
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-100'
                        : isCustomer
                        ? 'bg-slate-900 border-slate-800 text-slate-200'
                        : 'bg-slate-800 border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        {isInternal ? (
                          <div className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" />
                            Internal Note (Staff Only)
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                            <MessageSquare className="w-3 h-3" />
                            {isCustomer ? 'Customer Reply' : 'Public Reply to Customer'}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-white">
                          {msg.sender.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer Card */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl">
            {/* Type selector toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMessageType('reply')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  messageType === 'reply'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Customer-Visible Reply</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('internal_note')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  messageType === 'internal_note'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Private Internal Note</span>
              </button>
            </div>

            <form onSubmit={handlePostMessage}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={
                  messageType === 'reply'
                    ? 'Compose public message to the customer...'
                    : 'Add a private note for other support agents & leads (customer cannot see this)...'
                }
                className={`w-full px-4 py-3 rounded-xl border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition resize-y mb-3 ${
                  messageType === 'internal_note'
                    ? 'bg-amber-950/20 border-amber-500/40 focus:ring-amber-500'
                    : 'bg-slate-900 border-slate-700 focus:ring-brand-500'
                }`}
              ></textarea>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {messageType === 'reply'
                    ? 'This response will be visible on the customer tracking page.'
                    : 'Confidential: strictly hidden from the customer.'}
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

        {/* Right 1 Column: Metadata & Audit Timeline */}
        <div className="space-y-6">
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
    </div>
  );
};
