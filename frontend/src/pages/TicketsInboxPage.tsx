import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listTicketsApi, TicketStatus, TicketPriority } from '../api/client';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../components/Badges';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Inbox, 
  RefreshCw,
  Plus
} from 'lucide-react';

export const TicketsInboxPage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['staffTickets', statusFilter, priorityFilter, categoryFilter, search, page],
    queryFn: () =>
      listTicketsApi({
        status: statusFilter !== 'all' ? (statusFilter as TicketStatus) : undefined,
        priority: priorityFilter !== 'all' ? (priorityFilter as TicketPriority) : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: search.trim() || undefined,
        page,
        limit: 10,
      }),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const statusTabs = [
    { label: 'All Tickets', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Pending', value: 'pending' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-brand-400" />
            Support Ticket Inbox
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage customer conversations, ticket assignments, and workflow statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Ticket</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-800 mb-6">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition ${
              statusFilter === tab.value
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Secondary Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="w-full md:w-96 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference #, subject, customer..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
        </form>

        {/* Priority & Category Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
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
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Categories</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="general">General</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
          </select>
        </div>
      </div>

      {/* Tickets Data Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-16 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-xs text-slate-400">Loading workspace tickets...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-rose-400 text-sm">
            Failed to load tickets: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : data?.tickets.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-300 text-sm">No tickets found</p>
            <p className="text-xs text-slate-500 mt-1">
              {search || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Your inbox is clear! Submit a new test ticket to populate.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-700/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Ref Code</th>
                  <th className="py-3 px-4">Subject & Requester</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-200">
                {data?.tickets.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => navigate(`/agent/tickets/${t._id}`)}
                    className="hover:bg-slate-700/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-400">
                      {t.ticketNumber}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                      <div className="font-medium text-white truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {t.customer.name} • {t.customer.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className="py-3.5 px-4">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="w-3.5 h-3.5 text-brand-400" />
                          <span className="font-medium">{t.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-amber-400/90 font-medium text-[11px]">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="bg-slate-900/60 border-t border-slate-700/80 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing page <strong className="text-white">{data.page}</strong> of{' '}
              <strong className="text-white">{data.totalPages}</strong> ({data.total} total tickets)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
