import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { SupportPage } from './pages/SupportPage';
import { TrackTicketPage } from './pages/TrackTicketPage';
import { LoginPage } from './pages/LoginPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { AgentDashboardPage } from './pages/AgentDashboardPage';
import { TeamLeadDashboardPage } from './pages/TeamLeadDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { RoleRoute } from './components/RoleRoute';
import {
  LifeBuoy,
  Search,
  ArrowRight,
  ShieldCheck,
  Headphones,
  CheckCircle2,
  FileText,
  CreditCard,
  Users,
  Code,
} from 'lucide-react';

// Protected Route wrapper for Staff pages
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs text-slate-400">Verifying staff session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Customer-Facing Help Center Home Page
function HelpCenterHome() {
  const [tokenInput, setTokenInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) {
      setInputError('Please enter your tracking token to look up your ticket.');
      return;
    }

    // If the customer pasted a full URL like http://.../track/:token, extract just the token
    const tokenMatch = cleaned.match(/track\/([a-f0-9]+)/i);
    const token = tokenMatch ? tokenMatch[1] : cleaned;

    navigate(`/track/${token}`);
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-950 via-slate-800 to-slate-900 p-8 sm:p-12 border border-slate-800 shadow-2xl mb-10 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-4">
            <LifeBuoy className="w-3.5 h-3.5 text-brand-400" />
            SupportFlow Help Desk
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            How can our support team assist you?
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl mx-auto">
            Submit a support ticket for technical assistance, billing questions, or bug reports. If you already submitted a request, track its real-time status below.
          </p>

          {/* Direct Ticket Lookup Bar */}
          <form onSubmit={handleTrackSubmit} className="max-w-xl mx-auto mb-4">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-500 absolute left-4" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setInputError(null);
                }}
                placeholder="Enter your secure tracking token (e.g. 64-character token)..."
                className="w-full pl-11 pr-28 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-sm"
              >
                Track Ticket
              </button>
            </div>
            {inputError && (
              <p className="text-xs text-rose-400 mt-2 text-left px-2">{inputError}</p>
            )}
          </form>

          <p className="text-xs text-slate-400">
            Received a link after submitting? You can also click the link directly in your browser.
          </p>
        </div>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Card 1: Customer Ticket Submission */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl hover:border-slate-600 transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-brand-600/15 text-brand-400 border border-brand-500/20 flex items-center justify-center mb-4">
              <Headphones className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Submit a Support Ticket</h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              Experiencing an issue with your account, integration, or invoices? Fill out our simple support form to receive priority assistance from an agent.
            </p>
            <ul className="space-y-2 mb-6 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No internal staff account required</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Direct tracking reference and conversation thread</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Categorized and prioritized by urgency</span>
              </li>
            </ul>
          </div>

          <Link
            to="/support"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs sm:text-sm transition shadow-lg shadow-brand-600/20"
          >
            <span>Open New Support Ticket</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 2: Staff Operations Portal */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl hover:border-slate-600 transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Staff Operations Portal</h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              Workspace administrators, support leads, and agents can sign in to view the ticket queue, assign tickets, manage statuses, and collaborate.
            </p>
            <ul className="space-y-2 mb-6 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Centralized inbox with real-time status transitions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Customer replies & confidential internal notes</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Multi-tenant workspace isolation & audit logs</span>
              </li>
            </ul>
          </div>

          <Link
            to={
              user
                ? user.role === 'admin'
                  ? '/admin/dashboard'
                  : user.role === 'lead'
                  ? '/lead/dashboard'
                  : '/agent/dashboard'
                : '/login'
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs sm:text-sm border border-slate-600 transition shadow-sm"
          >
            <span>{user ? 'Go to Staff Portal' : 'Sign In as Staff'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Support Categories Section */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Common Support Categories
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Code className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Technical & APIs</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Webhooks, REST endpoints, and authentication tokens.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Billing & Plans</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Invoices, payment updates, and subscription tiers.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Account Access</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Team member invites, permissions, and password recovery.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">General Questions</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Product guidance, documentation, and feature requests.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isDashboard =
    normalizedPath === '/agent/dashboard' ||
    normalizedPath === '/agent/tickets' ||
    normalizedPath === '/lead/dashboard' ||
    normalizedPath === '/admin/dashboard';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-['Inter',sans-serif]">
      <Navbar />

      <Routes>
        <Route path="/" element={<HelpCenterHome />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/track/:token" element={<TrackTicketPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Agent Portal Routes (strictly for agent role) */}
        <Route
          path="/agent/dashboard"
          element={
            <RoleRoute allowedRoles={['agent']}>
              <AgentDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/agent/tickets"
          element={
            <RoleRoute allowedRoles={['agent']}>
              <AgentDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/agent/tickets/:id"
          element={
            <ProtectedRoute>
              <TicketDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Team Lead Portal Routes (strictly for team lead role) */}
        <Route
          path="/lead/dashboard"
          element={
            <RoleRoute allowedRoles={['lead']}>
              <TeamLeadDashboardPage />
            </RoleRoute>
          }
        />

        {/* Workspace Admin Portal Routes (strictly admin) */}
        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </RoleRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isDashboard && (
        <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 mt-auto">
          SupportFlow Customer Support Operations Platform • All rights reserved
        </footer>
      )}
    </div>
  );
}
