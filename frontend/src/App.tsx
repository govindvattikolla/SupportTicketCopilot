import React, { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchHealthCheck, HealthCheckData } from './api/client';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { SupportPage } from './pages/SupportPage';
import { TrackTicketPage } from './pages/TrackTicketPage';
import { LoginPage } from './pages/LoginPage';
import { TicketsInboxPage } from './pages/TicketsInboxPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import {
  Activity,
  Database,
  Server,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Ticket,
  LifeBuoy,
} from 'lucide-react';

// Protected Route wrapper for Staff pages
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs text-slate-400">Verifying staff workspace session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// System Health Dashboard (Home page view)
function TelemetryDashboard() {
  const [retryCount, setRetryCount] = useState(0);

  const {
    data: health,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<HealthCheckData>({
    queryKey: ['health', retryCount],
    queryFn: fetchHealthCheck,
    retry: 1,
    refetchInterval: 15000,
  });

  const handleManualRefresh = () => {
    setRetryCount((prev) => prev + 1);
    refetch();
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-950 via-slate-800 to-slate-900 p-8 border border-slate-800 shadow-2xl mb-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Phase 2 Active: Complete Ticket Lifecycle & Multi-Tenant Support
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            SupportFlow Operational Portal
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Customer ticket intake, unguessable cryptographic tracking, staff assignment, role-scoped inbox, public replies, and private internal notes are live.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/support"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Customer Support Intake</span>
            </Link>

            <Link
              to="/agent/tickets"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Ticket className="w-4 h-4 text-brand-400" />
              <span>Staff Ticket Inbox</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Telemetry Status Grid */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Backend & Database Telemetry
          </h3>
          <div className="flex items-center gap-3">
            {health?.timestamp && (
              <span className="text-xs text-slate-500">
                Last ping: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-brand-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Backend */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backend API</span>
              <Server className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <span className="text-sm text-slate-400 animate-pulse">Connecting...</span>
              ) : isError ? (
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-base">
                  <AlertTriangle className="w-4 h-4" />
                  Offline
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
                  <CheckCircle2 className="w-4 h-4" />
                  Online ({health?.service})
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">Express HTTP server on port 5000</p>
          </div>

          {/* Card 2: Database */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Database</span>
              <Database className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <span className="text-sm text-slate-400 animate-pulse">Querying...</span>
              ) : isError ? (
                <div className="flex items-center gap-2 text-slate-400 font-semibold text-base">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Awaiting
                </div>
              ) : health?.database.healthy ? (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
                  <CheckCircle2 className="w-4 h-4" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-base">
                  <AlertTriangle className="w-4 h-4" />
                  {health?.database.status.toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">MongoDB Atlas: {health?.database.status}</p>
          </div>

          {/* Card 3: Environment */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Environment</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                {health?.environment || 'development'}
              </span>
            </div>
            <div className="text-base font-semibold text-slate-200">
              React 18 + Node.js 20
            </div>
            <p className="text-xs text-slate-500 mt-2">TanStack Query + Tailwind CSS</p>
          </div>

          {/* Card 4: Uptime */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Uptime</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-base font-semibold text-slate-200">
              {health ? `${health.uptime}s` : '0s'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Monitored live via /api/health</p>
          </div>
        </div>

        {isError && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Backend API could not be reached.</p>
              <p className="mt-1 text-slate-300">
                {error instanceof Error ? error.message : 'Ensure the backend server is running on http://localhost:5000'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Feature Highlights Card */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Phase 2 Implemented Workflows
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
              Public Ticket Intake
            </h4>
            <p className="text-slate-400">
              Customers submit requests without accounts and receive cryptographically unguessable tracking links.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
              Replies vs. Internal Notes
            </h4>
            <p className="text-slate-400">
              Strict message separation: customers only see public replies; internal staff notes are confidential.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
              Validated State Machine
            </h4>
            <p className="text-slate-400">
              Strict ticket lifecycle enforcement with automatic customer reopen triggers and immutable audit logging.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-['Inter',sans-serif]">
      <Navbar />

      <Routes>
        <Route path="/" element={<TelemetryDashboard />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/track/:token" element={<TrackTicketPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/agent/tickets"
          element={
            <ProtectedRoute>
              <TicketsInboxPage />
            </ProtectedRoute>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 mt-auto">
        SupportFlow — Phase 2 Production Ticket Lifecycle • Modular Monolith Architecture
      </footer>
    </div>
  );
}
