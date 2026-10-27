import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  trackPublicTicketApi, 
  submitCustomerMessageApi, 
  Ticket, 
  Message 
} from '../api/client';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../components/Badges';
import { 
  Send, 
  Clock, 
  User, 
  Headphones, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw 
} from 'lucide-react';

export const TrackTicketPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [replyContent, setReplyContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<{ ticket: Ticket; messages: Message[] }>({
    queryKey: ['trackTicket', token],
    queryFn: () => trackPublicTicketApi(token!),
    enabled: Boolean(token),
    refetchInterval: 10000, // Poll for agent replies every 10s
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => submitCustomerMessageApi(token!, content),
    onSuccess: () => {
      setReplyContent('');
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['trackTicket', token] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to post reply');
    },
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    sendMutation.mutate(replyContent);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm">Retrieving secure ticket details...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Invalid Tracking Reference</h2>
        <p className="text-slate-400 text-sm mb-6">
          {error instanceof Error ? error.message : 'We could not locate a ticket with this secure tracking token.'}
        </p>
        <Link
          to="/support"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Submit a New Support Ticket</span>
        </Link>
      </div>
    );
  }

  const { ticket, messages } = data;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/support"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Customer Help Desk</span>
        </Link>
        <span className="text-xs text-slate-500">Auto-refreshing every 10s</span>
      </div>

      {/* Ticket Overview Card */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
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
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="text-xs text-slate-400 flex items-center sm:justify-end gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Requester: <span className="text-slate-300 font-medium">{ticket.customer.name}</span>
            </p>
          </div>
        </div>

        {/* Original Description */}
        <div className="pt-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Initial Issue Description
          </h3>
          <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            {ticket.description}
          </p>
        </div>
      </div>

      {/* Conversation Thread */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Conversation History</span>
          <span className="text-xs font-normal text-slate-500">
            ({messages.length} {messages.length === 1 ? 'message' : 'messages'})
          </span>
        </h3>

        {messages.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-medium text-slate-300">Your ticket is currently queued.</p>
            <p className="text-xs text-slate-500 mt-1">
              A support specialist will review your request and post a reply here shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAgent = msg.sender.type === 'agent' || msg.sender.type === 'system';

              return (
                <div
                  key={msg._id}
                  className={`flex gap-3.5 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isAgent
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isAgent ? <Headphones className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                      isAgent
                        ? 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-tl-sm'
                        : 'bg-brand-900/40 border border-brand-800/50 text-slate-100 rounded-tr-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-700/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">
                          {msg.sender.name}
                        </span>
                        {isAgent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 font-medium">
                            Support Team
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reply Box */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 backdrop-blur">
        {isResolved && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              This ticket is currently marked as <strong className="capitalize">{ticket.status}</strong>. Sending a message will automatically reopen it for further support.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSendReply}>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Post a Customer Follow-Up
          </label>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={3}
            placeholder="Type your reply, additional logs, or confirmation here..."
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-y mb-3"
          ></textarea>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Only public customer and agent replies are visible in this thread.
            </span>
            <button
              type="submit"
              disabled={sendMutation.isPending || !replyContent.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-md disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendMutation.isPending ? 'Sending...' : 'Send Follow-up'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
