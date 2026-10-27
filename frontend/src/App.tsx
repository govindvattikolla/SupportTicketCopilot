import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealthCheck, HealthCheckData } from './api/client';
import { 
  Activity, 
  Database, 
  Server, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  ArrowRight
} from 'lucide-react';

export function App() {
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
    refetchInterval: 15000, // polls every 15s
  });

  const handleManualRefresh = () => {
    setRetryCount((prev) => prev + 1);
    refetch();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SupportFlow
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Phase 0 Active
                </span>
              </h1>
              <p className="text-xs text-slate-400">Customer Support Operations Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-400' : ''}`} />
              {isFetching ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-950 via-slate-800 to-slate-900 p-8 border border-slate-800 shadow-2xl mb-8">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Phase 0: Environment & Core Health Foundation
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              System Initialization & Health Monitor
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Full-stack scaffolding is active. The Vite + React + TypeScript frontend communicates with the Node.js + Express + TypeScript backend, continuously monitoring database connectivity and system telemetry.
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Modular Monolith Architecture
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Strict TypeScript Layering
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Tenant Isolation Ready
              </div>
            </div>
          </div>
        </div>

        {/* Status Dashboard Grid */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              Live Telemetry & Component Status
            </h3>
            {health?.timestamp && (
              <span className="text-xs text-slate-500">
                Last verified: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Backend API Status */}
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
                    Offline / Unreachable
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
                    <CheckCircle2 className="w-4 h-4" />
                    Online ({health?.service})
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Target: Express HTTP server on port 5000
              </p>
            </div>

            {/* Card 2: MongoDB Atlas Status */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Database Status</span>
                <Database className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <span className="text-sm text-slate-400 animate-pulse">Querying...</span>
                ) : isError ? (
                  <div className="flex items-center gap-2 text-slate-400 font-semibold text-base">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Awaiting API
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
              <p className="text-xs text-slate-500 mt-2">
                State: {health?.database.status || 'Checking connection'}
              </p>
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
                Node.js + Vite Dev
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Client: React 18 + TS • Server: Express + TS
              </p>
            </div>

            {/* Card 4: Uptime */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backend Uptime</span>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-base font-semibold text-slate-200">
                {health ? `${health.uptime}s` : '0s'}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Monitored through /api/health
              </p>
            </div>
          </div>

          {/* Connection Troubleshooting Note if Degraded */}
          {health && !health.database.healthy && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Database connection is currently in '{health.database.status}' state.</p>
                <p className="mt-1 text-slate-300">
                  To connect to your live MongoDB Atlas cluster, add your credentials into <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">backend/.env</code> in the variable <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">MONGODB_URI</code>. The test suite uses an in-memory database to run automated unit and API integration tests without needing cloud credentials.
                </p>
              </div>
            </div>
          )}

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

        {/* Project Roadmap Next Steps */}
        <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Next Up: Phase 1 Scope
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                Data Models & Multi-Tenancy
              </h4>
              <p className="text-slate-400">
                Workspace and User schemas with tenant-scoped indexes and strict workspace validation.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                Authentication & RBAC
              </h4>
              <p className="text-slate-400">
                Password hashing, JWT/cookie session handling, and role-based permissions (admin, lead, agent).
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                Admin Bootstrap CLI
              </h4>
              <p className="text-slate-400">
                Secure workspace & initial admin seed script without exposing public staff registration.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        SupportFlow — Phase 0 Complete Foundation • Clean Architecture & Test Verification
      </footer>
    </div>
  );
}
