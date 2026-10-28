import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RoleRouteProps {
  allowedRoles: ('admin' | 'lead' | 'agent')[];
  children: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs text-slate-400">Verifying role permissions...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const homePath =
      user.role === 'admin'
        ? '/admin/dashboard'
        : user.role === 'lead'
        ? '/lead/dashboard'
        : '/agent/dashboard';

    const homeLabel =
      user.role === 'admin'
        ? 'Go to Admin Portal'
        : user.role === 'lead'
        ? 'Go to Team Lead Portal'
        : 'Go to Agent Dashboard';

    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access Restricted (403 Forbidden)</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
          Your current staff role is <span className="font-semibold text-rose-300 capitalize">{user.role}</span>.
          Access to this area requires authorization as <strong className="text-slate-200">{allowedRoles.join(' or ')}</strong>.
        </p>

        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 max-w-md mx-auto mb-8 text-xs text-slate-400 text-left">
          <p className="font-semibold text-slate-300 mb-1">Backend Authorization Security Note:</p>
          <p>
            In SupportFlow, frontend route checks are strictly mirrored by Express RBAC guards on the API server. Direct HTTP requests without the required role header are rejected with HTTP 403.
          </p>
        </div>

        <Link
          to={homePath}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-medium transition shadow-lg shadow-brand-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{homeLabel}</span>
        </Link>
      </main>
    );
  }

  return <>{children}</>;
};
