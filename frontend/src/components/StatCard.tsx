import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatCardVariant = 'default' | 'brand' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: StatCardVariant;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info';
  };
  onClick?: () => void;
  isLoading?: boolean;
}

const variantStyles: Record<
  StatCardVariant,
  {
    border: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    glow: string;
  }
> = {
  default: {
    border: 'border-slate-800 hover:border-slate-700',
    iconBg: 'bg-slate-800 text-slate-300',
    iconColor: 'text-slate-300',
    valueColor: 'text-white',
    glow: 'hover:shadow-slate-800/30',
  },
  brand: {
    border: 'border-brand-500/30 hover:border-brand-500/50',
    iconBg: 'bg-brand-500/10 text-brand-400 border border-brand-500/20',
    iconColor: 'text-brand-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-brand-500/10',
  },
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    iconColor: 'text-emerald-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-emerald-500/10',
  },
  amber: {
    border: 'border-amber-500/30 hover:border-amber-500/50',
    iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    iconColor: 'text-amber-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-amber-500/10',
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-500/50',
    iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    iconColor: 'text-rose-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-rose-500/10',
  },
  indigo: {
    border: 'border-indigo-500/30 hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    iconColor: 'text-indigo-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-indigo-500/10',
  },
  purple: {
    border: 'border-purple-500/30 hover:border-purple-500/50',
    iconBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    iconColor: 'text-purple-400',
    valueColor: 'text-white',
    glow: 'hover:shadow-purple-500/10',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  badge,
  onClick,
  isLoading = false,
}) => {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`relative bg-slate-900/90 border rounded-2xl p-5 shadow-lg transition duration-200 ${
        styles.border
      } ${styles.glow} ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 block mb-1">{title}</span>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-800 animate-pulse rounded my-1" />
          ) : (
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${styles.valueColor}`}>
              {value}
            </div>
          )}
          {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
        </div>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              badge.variant === 'danger'
                ? 'bg-rose-500/15 text-rose-300'
                : badge.variant === 'warning'
                ? 'bg-amber-500/15 text-amber-300'
                : badge.variant === 'success'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-brand-500/15 text-brand-300'
            }`}
          >
            {badge.text}
          </span>
        </div>
      )}
    </div>
  );
};
