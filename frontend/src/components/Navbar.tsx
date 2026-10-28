import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  LogIn,
  LogOut,
  Ticket,
  PlusCircle,
  HelpCircle,
  Users,
  ShieldCheck,
  MessageSquareShare,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Determine home link depending on authentication
  const homePath = user
    ? user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'lead'
      ? '/lead/dashboard'
      : '/agent/dashboard'
    : '/';

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to={homePath} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">SupportFlow</span>
            <p className="text-[11px] text-slate-400">
              {user
                ? `${user.role === 'admin' ? 'Workspace Admin' : user.role === 'lead' ? 'Team Lead' : 'Agent'} Operations`
                : 'Customer Support Operations'}
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Unauthenticated Customer View */}
          {!user && (
            <>
              <Link
                to="/"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  isActive('/')
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Help Center</span>
              </Link>

              <Link
                to="/support"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  isActive('/support')
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </Link>
            </>
          )}

          {/* Authenticated Staff Navigation (Customized per Role) */}
          {user && (
            <>
              {/* Agent Navigation */}
              {user.role === 'agent' && (
                <>
                  <Link
                    to="/agent/dashboard"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.pathname.startsWith('/agent') && !location.search.includes('tab=queries')
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Agent Dashboard</span>
                  </Link>

                  <Link
                    to="/agent/dashboard?tab=queries"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.search.includes('tab=queries')
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <MessageSquareShare className="w-3.5 h-3.5" />
                    <span>Lead Consultations</span>
                  </Link>
                </>
              )}

              {/* Team Lead Navigation */}
              {user.role === 'lead' && (
                <>
                  <Link
                    to="/lead/dashboard"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.pathname.startsWith('/lead') && !location.search.includes('tab=')
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Team Lead Portal</span>
                  </Link>

                  <Link
                    to="/lead/dashboard?tab=queries"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.search.includes('tab=queries')
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <MessageSquareShare className="w-3.5 h-3.5" />
                    <span>Agent Inquiries</span>
                  </Link>

                  <Link
                    to="/lead/dashboard?tab=admin_reports"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.search.includes('tab=admin_reports')
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Admin Reports</span>
                  </Link>
                </>
              )}

              {/* Administrator Navigation */}
              {user.role === 'admin' && (
                <>
                  <Link
                    to="/admin/dashboard"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.pathname.startsWith('/admin') && !location.search.includes('tab=reports')
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Portal</span>
                  </Link>

                  <Link
                    to="/admin/dashboard?tab=reports"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      location.search.includes('tab=reports')
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Lead Escalations & Reports</span>
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        {/* User Session Area */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Customer Portal Preview Link for Staff */}
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-md transition"
                title="Open public customer help center in new tab"
              >
                <span>Help Center View</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-200">{user.name}</span>
                <span className="text-[10px] font-medium text-slate-400 capitalize">
                  {user.role === 'admin' ? 'Administrator' : user.role === 'lead' ? 'Team Lead' : 'Support Agent'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
