import { Types } from 'mongoose';
import { Ticket, ITicket } from '../tickets/ticket.model';
import { User, IUser } from '../users/user.model';
import { Workspace } from '../workspaces/workspace.model';
import { AuditEvent, IAuditEvent } from '../audit/audit.model';
import { getOverdueFilter } from '../tickets/ticket.service';

export interface AgentSummaryData {
  myOpenCount: number;
  myInProgressCount: number;
  myHighPriorityCount: number;
  myOverdueCount: number;
  highPriorityTickets: ITicket[];
  overdueTickets: ITicket[];
  recentActivity: IAuditEvent[];
}

export interface AgentWorkloadItem {
  user: {
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: string;
  };
  totalAssigned: number;
  openCount: number;
  inProgressCount: number;
  pendingCount: number;
  resolvedCount: number;
}

export interface TeamLeadReportData {
  teamWorkload: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    pendingTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    unassignedTickets: number;
    overdueTickets: number;
    highPriorityTickets: number;
  };
  agentWorkloads: AgentWorkloadItem[];
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  unassignedTickets: ITicket[];
  overdueTickets: ITicket[];
}

export interface AdminOverviewData {
  workspace: {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    ticketCounter: number;
    settings: {
      defaultPriority: string;
      allowCustomerReopen: boolean;
    };
    createdAt: Date;
  };
  ticketCounts: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  };
  teamStats: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    byRole: {
      admin: number;
      lead: number;
      agent: number;
    };
  };
  resolutionMetrics: {
    totalResolved: number;
    resolutionRate: number;
  };
  recentAuditEvents: IAuditEvent[];
}

export const getAgentDashboardSummary = async (
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<AgentSummaryData> => {
  const overdueCond = getOverdueFilter();

  const [
    myOpenCount,
    myInProgressCount,
    myHighPriorityCount,
    myOverdueCount,
    highPriorityTickets,
    overdueTickets,
    recentActivity,
  ] = await Promise.all([
    Ticket.countDocuments({ workspaceId, assignedTo: userId, status: 'open' }),
    Ticket.countDocuments({ workspaceId, assignedTo: userId, status: 'in_progress' }),
    Ticket.countDocuments({
      workspaceId,
      assignedTo: userId,
      priority: { $in: ['P1', 'P2'] },
      status: { $nin: ['resolved', 'closed'] },
    }),
    Ticket.countDocuments({
      workspaceId,
      assignedTo: userId,
      ...overdueCond,
    }),
    Ticket.find({
      workspaceId,
      assignedTo: userId,
      priority: { $in: ['P1', 'P2'] },
      status: { $nin: ['resolved', 'closed'] },
    })
      .populate('assignedTo', '_id name email role')
      .sort({ priority: 1, createdAt: -1 })
      .limit(5),
    Ticket.find({
      workspaceId,
      assignedTo: userId,
      ...overdueCond,
    })
      .populate('assignedTo', '_id name email role')
      .sort({ createdAt: 1 })
      .limit(5),
    AuditEvent.find({
      workspaceId,
      $or: [{ 'actor.userId': userId }],
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('ticketId', 'ticketNumber subject status priority'),
  ]);

  return {
    myOpenCount,
    myInProgressCount,
    myHighPriorityCount,
    myOverdueCount,
    highPriorityTickets,
    overdueTickets,
    recentActivity,
  };
};

export const getTeamLeadReport = async (
  workspaceId: Types.ObjectId
): Promise<TeamLeadReportData> => {
  const overdueCond = getOverdueFilter();

  const [
    allTickets,
    agents,
    unassignedTickets,
    overdueTickets,
  ] = await Promise.all([
    Ticket.find({ workspaceId }).select('status priority category assignedTo createdAt'),
    User.find({ workspaceId, isActive: true }).select('_id name email role'),
    Ticket.find({
      workspaceId,
      assignedTo: { $exists: false },
      status: { $nin: ['resolved', 'closed'] },
    })
      .sort({ priority: 1, createdAt: -1 })
      .limit(10),
    Ticket.find({
      workspaceId,
      ...overdueCond,
    })
      .populate('assignedTo', '_id name email role')
      .sort({ createdAt: 1 })
      .limit(10),
  ]);

  const statusBreakdown: Record<string, number> = {
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  };

  const priorityBreakdown: Record<string, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };

  const categoryBreakdown: Record<string, number> = {
    technical: 0,
    billing: 0,
    general: 0,
    feature_request: 0,
    bug: 0,
  };

  let unassignedCount = 0;
  let overdueCount = 0;
  let highPriorityCount = 0;

  // Initialize agent workload map
  const agentMap = new Map<string, AgentWorkloadItem>();
  for (const ag of agents) {
    agentMap.set(ag._id.toString(), {
      user: {
        _id: ag._id,
        name: ag.name,
        email: ag.email,
        role: ag.role,
      },
      totalAssigned: 0,
      openCount: 0,
      inProgressCount: 0,
      pendingCount: 0,
      resolvedCount: 0,
    });
  }

  for (const t of allTickets) {
    // Status breakdown
    if (statusBreakdown[t.status] !== undefined) {
      statusBreakdown[t.status]++;
    } else {
      statusBreakdown[t.status] = 1;
    }

    // Priority breakdown
    if (priorityBreakdown[t.priority] !== undefined) {
      priorityBreakdown[t.priority]++;
    } else {
      priorityBreakdown[t.priority] = 1;
    }

    // Category breakdown
    if (categoryBreakdown[t.category] !== undefined) {
      categoryBreakdown[t.category]++;
    } else {
      categoryBreakdown[t.category] = 1;
    }

    const isActive = t.status !== 'resolved' && t.status !== 'closed';

    if (!t.assignedTo && isActive) {
      unassignedCount++;
    }

    if (isActive && (t.priority === 'P1' || t.priority === 'P2')) {
      highPriorityCount++;
    }

    // Agent breakdown
    if (t.assignedTo) {
      const assignedId = t.assignedTo.toString();
      const workload = agentMap.get(assignedId);
      if (workload) {
        workload.totalAssigned++;
        if (t.status === 'open') workload.openCount++;
        else if (t.status === 'in_progress') workload.inProgressCount++;
        else if (t.status === 'pending') workload.pendingCount++;
        else if (t.status === 'resolved' || t.status === 'closed') workload.resolvedCount++;
      }
    }
  }

  // Count overdue matching tickets count
  overdueCount = await Ticket.countDocuments({ workspaceId, ...overdueCond });

  return {
    teamWorkload: {
      totalTickets: allTickets.length,
      openTickets: statusBreakdown.open || 0,
      inProgressTickets: statusBreakdown.in_progress || 0,
      pendingTickets: statusBreakdown.pending || 0,
      resolvedTickets: statusBreakdown.resolved || 0,
      closedTickets: statusBreakdown.closed || 0,
      unassignedTickets: unassignedCount,
      overdueTickets: overdueCount,
      highPriorityTickets: highPriorityCount,
    },
    agentWorkloads: Array.from(agentMap.values()),
    categoryBreakdown,
    priorityBreakdown,
    statusBreakdown,
    unassignedTickets,
    overdueTickets,
  };
};

export const getAdminOverview = async (
  workspaceId: Types.ObjectId
): Promise<AdminOverviewData> => {
  const [workspace, tickets, users, recentAuditEvents] = await Promise.all([
    Workspace.findById(workspaceId),
    Ticket.find({ workspaceId }).select('status priority category'),
    User.find({ workspaceId }).select('role isActive'),
    AuditEvent.find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('ticketId', 'ticketNumber subject'),
  ]);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const byStatus: Record<string, number> = {
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  };
  const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const byCategory: Record<string, number> = {
    technical: 0,
    billing: 0,
    general: 0,
    feature_request: 0,
    bug: 0,
  };

  for (const t of tickets) {
    if (byStatus[t.status] !== undefined) byStatus[t.status]++;
    if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    if (byCategory[t.category] !== undefined) byCategory[t.category]++;
  }

  let totalMembers = users.length;
  let activeMembers = 0;
  let inactiveMembers = 0;
  const byRole = { admin: 0, lead: 0, agent: 0 };

  for (const u of users) {
    if (u.isActive) activeMembers++;
    else inactiveMembers++;

    if (u.role === 'admin') byRole.admin++;
    else if (u.role === 'lead') byRole.lead++;
    else if (u.role === 'agent') byRole.agent++;
  }

  const totalResolved = (byStatus.resolved || 0) + (byStatus.closed || 0);
  const totalTickets = tickets.length;
  const resolutionRate =
    totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 100) : 0;

  return {
    workspace: {
      _id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      ticketCounter: workspace.ticketCounter,
      settings: workspace.settings,
      createdAt: workspace.createdAt,
    },
    ticketCounts: {
      total: totalTickets,
      byStatus,
      byPriority,
      byCategory,
    },
    teamStats: {
      totalMembers,
      activeMembers,
      inactiveMembers,
      byRole,
    },
    resolutionMetrics: {
      totalResolved,
      resolutionRate,
    },
    recentAuditEvents,
  };
};
