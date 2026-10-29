import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAgentRecommendationsApi,
  getUrgencyRankingApi,
  assignTicketApi,
  RankedTicket,
} from '../api/client';
import { AttentionScoreBadge, PriorityBadge } from './Badges';
import {
  Sparkles,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Flame,
  Briefcase,
  Zap,
} from 'lucide-react';

interface AgentRecommendationCardProps {
  ticketId: string;
  userRole?: string;
  onAssigned?: () => void;
}

export const AgentRecommendationCard: React.FC<AgentRecommendationCardProps> = ({
  ticketId,
  userRole,
  onAssigned,
}) => {
  const queryClient = useQueryClient();
  const [showFactors, setShowFactors] = useState(false);

  // Fetch Agent Recommendations for this ticket
  const { data: recommendationsData, isLoading: isLoadingRecs } = useQuery({
    queryKey: ['agentRecommendations', ticketId],
    queryFn: () => getAgentRecommendationsApi(ticketId),
    enabled: Boolean(ticketId),
  });

  // Fetch Urgency Ranking (to retrieve this ticket's attention score and factor breakdown)
  const { data: rankingData } = useQuery({
    queryKey: ['urgencyRanking'],
    queryFn: () => getUrgencyRankingApi({ limit: 200 }),
  });

  const rankedTicket: RankedTicket | undefined = rankingData?.tickets.find(
    (t) => t.ticketId === ticketId
  );

  // Assign ticket mutation
  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) => assignTicketApi(ticketId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketDetails', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['agentRecommendations', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['urgencyRanking'] });
      queryClient.invalidateQueries({ queryKey: ['bottlenecks'] });
      if (onAssigned) onAssigned();
    },
  });

  const canAssign = userRole === 'admin' || userRole === 'lead';

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header: Attention Score & Operational Urgency */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Operational Attention
            </h3>
          </div>
          {rankedTicket && (
            <AttentionScoreBadge
              score={rankedTicket.attentionScore}
              tier={rankedTicket.urgencyTier}
            />
          )}
        </div>

        {rankedTicket ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span>Original Priority:</span>
              <PriorityBadge priority={rankedTicket.originalPriority} />
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              {rankedTicket.explanation}
            </p>

            <button
              onClick={() => setShowFactors(!showFactors)}
              className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition"
            >
              <span>{showFactors ? 'Hide Factor Breakdown' : 'Show Explainable Factors'}</span>
              {showFactors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showFactors && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                {rankedTicket.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{f.name}:</span>
                    <span className="text-slate-200 font-medium">{f.details}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Evaluating ticket urgency factors...</p>
        )}
      </div>

      {/* Section 2: Workload-Aware Agent Recommendations */}
      <div className="pt-2 border-t border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Recommended Assignees
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            Workload-Aware
          </span>
        </div>

        {isLoadingRecs ? (
          <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
            Calculating expertise & bandwidth matches...
          </div>
        ) : !recommendationsData?.recommendations || recommendationsData.recommendations.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No active agents available for recommendation.</p>
        ) : (
          <div className="space-y-2.5">
            {recommendationsData.recommendations.slice(0, 3).map((rec) => {
              const isCurrentAssignee =
                recommendationsData.ticket.currentAssignee?._id === rec.agent._id;

              return (
                <div
                  key={rec.agent._id}
                  className={`p-3 rounded-xl border text-xs transition relative ${
                    rec.isRecommended
                      ? 'bg-brand-950/40 border-brand-500/40 shadow-sm shadow-brand-900/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-100">{rec.agent.name}</span>
                        {rec.isRecommended && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                            ★ Top Match
                          </span>
                        )}
                        {isCurrentAssignee && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 capitalize">{rec.agent.role}</span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                          rec.matchScore >= 80
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : rec.matchScore >= 60
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {rec.matchScore}%
                      </span>
                    </div>
                  </div>

                  {/* Factor Breakdown tags */}
                  <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                      <Briefcase className="w-3 h-3 text-brand-400 shrink-0" />
                      <span className="truncate">{rec.activeTicketCount} active tickets</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                      <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{rec.capacityUtilizationPercent}% cap</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug mb-2 font-sans">
                    {rec.explanation}
                  </p>

                  {/* Quick Assign Button for Leads and Admins */}
                  {canAssign && !isCurrentAssignee && (
                    <button
                      onClick={() => assignMutation.mutate(rec.agent._id)}
                      disabled={assignMutation.isPending}
                      className="w-full mt-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-700 hover:border-brand-500 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Assign to {rec.agent.name.split(' ')[0]}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
