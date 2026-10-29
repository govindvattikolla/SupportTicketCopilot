import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Layers,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';

export interface DashboardSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: {
    text: string | number;
    variant?: 'brand' | 'danger' | 'warning' | 'info' | 'default';
  };
}

export interface DashboardLayoutProps {
  portalTitle: string;
  roleBadgeText: string;
  roleBadgeVariant?: 'agent' | 'lead' | 'admin';
  accentColor?: 'brand' | 'indigo' | 'rose';
  items: DashboardSidebarItem[];
  activeItemId: string;
  onSelectItemId: (id: string) => void;
  headerTitle: string;
  headerSubtitle?: string;
  headerActions?: React.ReactNode;
  sidebarFooterAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  portalTitle,
  roleBadgeText,
  roleBadgeVariant = 'agent',
  accentColor = 'brand',
  items,
  activeItemId,
  onSelectItemId,
  headerTitle,
  headerSubtitle,
  headerActions,
  sidebarFooterAction,
  children,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const homePath = user
    ? user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'lead'
      ? '/lead/dashboard'
      : '/agent/dashboard'
    : '/';

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const userRoleDisplay =
    user?.role === 'admin'
      ? 'Workspace Admin'
      : user?.role === 'lead'
      ? 'Team Lead'
      : 'Support Agent';

  const activeItem = items.find((item) => item.id === activeItemId) || items[0];

  const getAccentClass = (active: boolean) => {
    if (!active) {
      return 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60';
    }
    switch (accentColor) {
      case 'indigo':
        return 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/10';
      case 'rose':
        return 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-1 ring-white/10';
      case 'brand':
      default:
        return 'bg-brand-600 text-white shadow-md shadow-brand-600/25 ring-1 ring-white/10';
    }
  };

  const getRoleBadgeStyle = () => {
    switch (roleBadgeVariant) {
      case 'admin':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'lead':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'agent':
      default:
        return 'bg-brand-500/15 text-brand-300 border-brand-500/30';
    }
  };

  const getBadgeStyle = (
    variant: 'brand' | 'danger' | 'warning' | 'info' | 'default' = 'default',
    isActive: boolean
  ) => {
    if (isActive) {
      return 'bg-white/20 text-white';
    }
    switch (variant) {
      case 'danger':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'info':
        return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
      case 'brand':
        return 'bg-brand-500/20 text-brand-300 border border-brand-500/30';
      case 'default':
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const renderNavItems = (isDrawer = false) => (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const isActive = item.id === activeItemId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectItemId(item.id);
              if (isDrawer) setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${getAccentClass(
              isActive
            )}`}
          >
            <div className="flex items-center gap-3 truncate">
              <span className={isActive ? 'text-white' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeStyle(
                  item.badge.variant,
                  isActive
                )}`}
              >
                {item.badge.text}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row w-full h-screen overflow-hidden">
      {/* ===================================================================== */}
      {/* 1. DESKTOP PERMANENT LEFT SIDEBAR */}
      {/* ===================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 bg-slate-950/85 border-r border-slate-800/80 sticky top-0 h-screen p-4 z-20 backdrop-blur justify-between">
        {/* Top Header & Branding */}
        <div>
          <div className="pb-4 border-b border-slate-800/80">
            <Link to={homePath} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition shrink-0">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-white block">
                  SupportFlow
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {portalTitle}
                </span>
              </div>
            </Link>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Portal Role
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeStyle()}`}
              >
                {roleBadgeText}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Navigation Items List (Scrolls if viewport is short) */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-1">
          <div>{renderNavItems(false)}</div>

          {/* Sidebar Quick Action Button */}
          {sidebarFooterAction && (
            <div className="pt-2">
              <button
                type="button"
                onClick={sidebarFooterAction.onClick}
                className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white transition shadow-sm ${
                  accentColor === 'indigo'
                    ? 'bg-indigo-600 hover:bg-indigo-500'
                    : accentColor === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-brand-600 hover:bg-brand-500'
                }`}
              >
                {sidebarFooterAction.icon}
                <span>{sidebarFooterAction.label}</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Section: Customer Portal Link & Staff User Profile Panel */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
          {/* Customer Help Center Link */}
        

          {/* Logged-In User Profile & Controls */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
            {/* User Avatar & Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate" title={user?.name}>
                  {user?.name || 'Staff User'}
                </p>
                <p className="text-[10px] text-slate-400 truncate capitalize">
                  {userRoleDisplay}
                </p>
              </div>
            </div>

            {/* In-App Notifications & Logout Button */}
            <div className="flex items-center gap-1 shrink-0">
              <NotificationCenter popoverPlacement="top-left" />
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* 2. MOBILE RESPONSIVE TOP BAR & DRAWER */}
      {/* ===================================================================== */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur">
        {/* Mobile Hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800/90 text-slate-200 hover:text-white border border-slate-700 transition"
            aria-label="Open dashboard menu"
          >
            <Menu className="w-5 h-5 text-brand-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-white">SupportFlow</span>
          </div>
        </div>

        {/* Mobile Header Right: Current View & Notifications */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 max-w-[120px] truncate">
            {activeItem.label}
          </span>
          <NotificationCenter popoverPlacement="bottom-right" />
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-5 shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">SupportFlow</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getRoleBadgeStyle()}`}
                    >
                      {roleBadgeText}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Close navigation drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items in Drawer */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Navigation
                </p>
                {renderNavItems(true)}
              </div>

              {/* Sidebar Action Button */}
              {sidebarFooterAction && (
                <div className="pt-4 mt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileOpen(false);
                      sidebarFooterAction.onClick();
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white transition shadow-sm ${
                      accentColor === 'indigo'
                        ? 'bg-indigo-600 hover:bg-indigo-500'
                        : accentColor === 'rose'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-brand-600 hover:bg-brand-500'
                    }`}
                  >
                    {sidebarFooterAction.icon}
                    <span>{sidebarFooterAction.label}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Drawer Bottom Section */}
            <div className="pt-4 mt-6 border-t border-slate-800 space-y-3">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700/60"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Help Center View</span>
                </span>
                <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                  Public
                </span>
              </Link>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize truncate">
                      {userRoleDisplay}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      {/* ===================================================================== */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col bg-slate-900">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {headerTitle}
              </h1>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${getRoleBadgeStyle()}`}
              >
                {roleBadgeText}
              </span>
            </div>
            {headerSubtitle && (
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {headerSubtitle}
              </p>
            )}
          </div>

          {headerActions && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {headerActions}
            </div>
          )}
        </div>

        {/* Dashboard Active View Content */}
        <div className="flex-1 w-full max-w-7xl mx-auto space-y-8">{children}</div>
      </main>
    </div>
  );
};
