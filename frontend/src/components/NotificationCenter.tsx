import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  AlertOctagon,
  MessageSquare,
  UserCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  getNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  AppNotification,
} from '../api/client';
import { getSocket } from '../realtime/socket';

export interface NotificationCenterProps {
  popoverPlacement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  popoverPlacement = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => getNotificationsApi({ unreadOnly, limit: 20 }),
    refetchInterval: 60000, // Poll every minute as fallback
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Real-time socket event listeners
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleNotificationRead = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:read_all', handleNotificationRead);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleNotificationRead);
      socket.off('notification:read_all', handleNotificationRead);
    };
  }, [queryClient]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'sla_breached':
        return <AlertOctagon className="w-4 h-4 text-rose-400" />;
      case 'sla_warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'ticket_reply':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'ticket_assigned':
      case 'ticket_reassigned':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      case 'status_changed':
        return <RefreshCw className="w-4 h-4 text-indigo-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      markReadMutation.mutate(n._id);
    }
    if (n.ticketId) {
      setIsOpen(false);
      navigate(`/agent/tickets/${n.ticketId}`);
    }
  };

  const getPlacementClass = () => {
    switch (popoverPlacement) {
      case 'top-left':
        return 'bottom-full left-0 mb-2';
      case 'top-right':
        return 'bottom-full right-0 mb-2';
      case 'bottom-left':
        return 'top-full left-0 mt-2';
      case 'bottom-right':
      default:
        return 'top-full right-0 mt-2';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${getPlacementClass()} w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[520px]`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition ${
                  unreadOnly
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                {unreadOnly ? 'Unread Only' : 'All'}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-[11px] text-slate-400 hover:text-brand-400 inline-flex items-center gap-1 font-medium transition disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* List of Notifications */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-slate-400">No notifications yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  You're all caught up with your tickets and SLA alerts!
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 text-xs transition cursor-pointer flex items-start gap-3 hover:bg-slate-800/50 ${
                    !n.isRead ? 'bg-slate-800/30' : 'opacity-85'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-800 border border-slate-700/60">
                    {getIconForType(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`font-semibold text-xs truncate ${!n.isRead ? 'text-white' : 'text-slate-300'}`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1">
                      {n.ticketNumber ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-brand-400 hover:text-brand-300">
                          <span>{n.ticketNumber}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      ) : (
                        <span />
                      )}

                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(n._id);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-medium transition"
                          title="Mark read"
                        >
                          <Check className="w-3 h-3 text-brand-400" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
