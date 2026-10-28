import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignTicketApi, User } from '../api/client';
import { UserCheck, Loader2 } from 'lucide-react';

interface ReassignDropdownProps {
  ticketId: string;
  currentAssigneeId?: string | null;
  agents: User[];
  onAssigned?: () => void;
  compact?: boolean;
}

export const ReassignDropdown: React.FC<ReassignDropdownProps> = ({
  ticketId,
  currentAssigneeId,
  agents,
  onAssigned,
  compact = false,
}) => {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState(currentAssigneeId || 'unassigned');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (newAgentId: string | null) => assignTicketApi(ticketId, newAgentId),
    onSuccess: () => {
      setErrorMessage(null);
      // Invalidate relevant queries to keep all views synchronized with real backend data
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['teamLeadReport'] });
      queryClient.invalidateQueries({ queryKey: ['agentSummary'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      if (onAssigned) onAssigned();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to reassign ticket');
      // Revert select state
      setSelectedAgent(currentAssigneeId || 'unassigned');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAgent(val);
    const targetId = val === 'unassigned' ? null : val;
    mutation.mutate(targetId);
  };

  return (
    <div className="relative inline-flex items-center">
      <div className="relative flex items-center">
        <select
          value={selectedAgent}
          onChange={handleChange}
          disabled={mutation.isPending}
          className={`appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 transition cursor-pointer pr-7 ${
            compact ? 'py-1 pl-2.5 text-[11px]' : 'py-1.5 pl-3'
          } ${mutation.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}
        >
          <option value="unassigned">— Unassigned —</option>
          {agents.map((ag) => (
            <option key={ag._id} value={ag._id}>
              {ag.name} ({ag.role})
            </option>
          ))}
        </select>

        <div className="absolute right-2 pointer-events-none text-slate-400">
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
          ) : (
            <UserCheck className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {errorMessage && (
        <span className="text-[10px] text-rose-400 ml-2 font-medium" title={errorMessage}>
          Error!
        </span>
      )}
    </div>
  );
};
