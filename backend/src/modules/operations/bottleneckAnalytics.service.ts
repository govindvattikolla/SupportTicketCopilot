import { Types } from 'mongoose';
import { Ticket, ITicket, TicketPriority, TicketCategory, TicketStatus } from '../tickets/ticket.model';
import { User, IUser } from '../users/user.model';
import { TicketQuery } from '../ticketQueries/ticketQuery.model';
import {
  UnassignedBottleneck,
  PendingCustomerBottleneck,
  EngineeringBottleneck,
  SLABreachBottleneck,
  AgentWorkloadMetric,
  WorkloadImbalanceMetric,
  BottleneckAnalyticsResult,
} from './operations.types';

/**
 * Computes Unassigned Tickets Bottleneck metrics using efficient database queries.
 */
export const getUnassignedBottleneck = async (
  workspaceId: Types.ObjectId,
  now: Date = new Date()
): Promise<UnassignedBottleneck> => {
  const unassignedTickets = await Ticket.find({
    workspaceId,
    status: { $in: ['open', 'in_progress'] },
    $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
  })
    .sort({ createdAt: 1 }) // Oldest first
    .lean();

  const totalCount = unassignedTickets.length;
  const byPriority: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };

  let totalWaitingMs = 0;
  let maxWaitingMs = 0;

  for (const t of unassignedTickets) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    const diff = Math.max(0, now.getTime() - new Date(t.createdAt).getTime());
    totalWaitingMs += diff;
    if (diff > maxWaitingMs) {
      maxWaitingMs = diff;
    }
  }

  const avgWaitingHours =
    totalCount > 0 ? parseFloat((totalWaitingMs / totalCount / (1000 * 60 * 60)).toFixed(1)) : 0;
  const maxWaitingHours = parseFloat((maxWaitingMs / (1000 * 60 * 60)).toFixed(1));

  const oldestTickets = unassignedTickets.slice(0, 10).map((t) => ({
    ticketId: t._id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    priority: t.priority,
    waitingHours: parseFloat(
      (Math.max(0, now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1)
    ),
  }));

  return {
    totalCount,
    avgWaitingHours,
    maxWaitingHours,
    byPriority,
    oldestTickets,
  };
};

/**
 * Computes Tickets Waiting for Customers Bottleneck metrics.
 */
export const getPendingCustomerBottleneck = async (
  workspaceId: Types.ObjectId,
  now: Date = new Date()
): Promise<PendingCustomerBottleneck> => {
  const pendingTickets = await Ticket.find({
    workspaceId,
    status: 'pending',
  })
    .sort({ updatedAt: 1 })
    .lean();

  const totalCount = pendingTickets.length;
  let totalPendingMs = 0;
  let staleCount = 0;

  const ticketItems = pendingTickets.map((t) => {
    // Reference pausedAt if available, otherwise updatedAt
    const refDate = t.sla?.pausedAt ? new Date(t.sla.pausedAt) : new Date(t.updatedAt);
    const diff = Math.max(0, now.getTime() - refDate.getTime());
    totalPendingMs += diff;
    const pendingHours = parseFloat((diff / (1000 * 60 * 60)).toFixed(1));

    if (pendingHours >= 72) {
      staleCount++;
    }

    return {
      ticketId: t._id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      pendingHours,
      customerEmail: t.customer?.email || 'unknown',
    };
  });

  const avgPendingHours =
    totalCount > 0 ? parseFloat((totalPendingMs / totalCount / (1000 * 60 * 60)).toFixed(1)) : 0;

  return {
    totalCount,
    avgPendingHours,
    staleCount,
    tickets: ticketItems.slice(0, 20),
  };
};

/**
 * Computes Tickets Awaiting Engineering Bottleneck metrics.
 * Evaluates tickets marked as 'bug', flagged with 'awaitingEngineering', or with active technical queries.
 */
export const getEngineeringBottleneck = async (
  workspaceId: Types.ObjectId,
  now: Date = new Date()
): Promise<EngineeringBottleneck> => {
  // 1. Find tickets with active technical consultations
  const activeTechQueries = await TicketQuery.find({
    workspaceId,
    category: 'technical',
    status: { $in: ['open', 'in_review'] },
  })
    .select('ticketId')
    .lean();

  const techTicketIds = activeTechQueries.map((q) => q.ticketId);

  // 2. Query tickets awaiting engineering
  const engineeringTickets = await Ticket.find({
    workspaceId,
    status: { $in: ['open', 'in_progress'] },
    $or: [
      { category: 'bug' },
      { awaitingEngineering: true },
      { _id: { $in: techTicketIds } },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  const totalCount = engineeringTickets.length;
  const byPriority: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  let totalAgeMs = 0;

  const tickets = engineeringTickets.map((t) => {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    const diff = Math.max(0, now.getTime() - new Date(t.createdAt).getTime());
    totalAgeMs += diff;

    let reason = 'Flagged for engineering attention';
    if (t.category === 'bug') {
      reason = 'Software bug requiring developer fix';
    } else if (techTicketIds.some((id) => id.toString() === t._id.toString())) {
      reason = 'Active engineering escalation / technical query open';
    }

    return {
      ticketId: t._id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      reason,
    };
  });

  const avgAgeHours =
    totalCount > 0 ? parseFloat((totalAgeMs / totalCount / (1000 * 60 * 60)).toFixed(1)) : 0;

  return {
    totalCount,
    avgAgeHours,
    byPriority,
    tickets: tickets.slice(0, 20),
  };
};

/**
 * Computes SLA Breach Bottleneck metrics.
 */
export const getSLABreachBottleneck = async (
  workspaceId: Types.ObjectId,
  now: Date = new Date()
): Promise<SLABreachBottleneck> => {
  // Query non-resolved tickets with SLA breach flag or passed deadline
  const breachedTickets = await Ticket.find({
    workspaceId,
    status: { $nin: ['resolved', 'closed'] },
    $or: [
      { 'sla.isFirstResponseBreached': true },
      { 'sla.isResolutionBreached': true },
      {
        'sla.firstResponseDeadline': { $lt: now },
        firstResponseAt: { $exists: false },
      },
      {
        'sla.resolutionDeadline': { $lt: now },
        resolvedAt: { $exists: false },
      },
    ],
  })
    .populate('assignedTo', 'name')
    .lean();

  const totalBreached = breachedTickets.length;
  let firstResponseBreached = 0;
  let resolutionBreached = 0;
  let bothBreached = 0;
  const byPriority: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const agentMap = new Map<string, { agentId: Types.ObjectId | null; name: string; count: number }>();

  for (const t of breachedTickets) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

    const isFirstBreached =
      Boolean(t.sla?.isFirstResponseBreached) ||
      Boolean(t.sla?.firstResponseDeadline && !t.firstResponseAt && now > new Date(t.sla.firstResponseDeadline));

    const isResBreached =
      Boolean(t.sla?.isResolutionBreached) ||
      Boolean(t.sla?.resolutionDeadline && !t.resolvedAt && now > new Date(t.sla.resolutionDeadline));

    if (isFirstBreached && isResBreached) {
      bothBreached++;
      firstResponseBreached++;
      resolutionBreached++;
    } else if (isFirstBreached) {
      firstResponseBreached++;
    } else if (isResBreached) {
      resolutionBreached++;
    }

    const agentKey = t.assignedTo ? (t.assignedTo as any)._id.toString() : 'unassigned';
    const agentName = t.assignedTo ? (t.assignedTo as any).name : 'Unassigned';
    const existing = agentMap.get(agentKey) || {
      agentId: t.assignedTo ? (t.assignedTo as any)._id : null,
      name: agentName,
      count: 0,
    };
    existing.count++;
    agentMap.set(agentKey, existing);
  }

  const byAgent = Array.from(agentMap.values()).map((a) => ({
    agentId: a.agentId,
    agentName: a.name,
    breachCount: a.count,
  }));

  return {
    totalBreached,
    firstResponseBreached,
    resolutionBreached,
    bothBreached,
    byPriority,
    byAgent,
  };
};

/**
 * Computes Workload Imbalance metrics across active staff members.
 * Calculates mean, variance, standard deviation, and identifies overloaded/underutilized members.
 */
export const getWorkloadImbalanceMetric = async (
  workspaceId: Types.ObjectId
): Promise<WorkloadImbalanceMetric> => {
  // 1. Fetch active staff
  const activeStaff = await User.find({
    workspaceId,
    role: { $in: ['agent', 'lead'] },
    isActive: true,
  }).lean();

  if (activeStaff.length === 0) {
    return {
      totalActiveAgents: 0,
      totalActiveTickets: 0,
      meanActiveTickets: 0,
      standardDeviation: 0,
      imbalanceRatio: 1,
      status: 'balanced',
      overloadedAgents: [],
      underutilizedAgents: [],
      agentDistribution: [],
      explanation: 'No active agents available in this workspace to evaluate workload balance.',
    };
  }

  const staffIds = activeStaff.map((s) => s._id);

  // 2. Aggregate active tickets per agent
  const activeTicketCountsAgg = await Ticket.aggregate([
    {
      $match: {
        workspaceId,
        assignedTo: { $in: staffIds },
        status: { $in: ['open', 'in_progress'] },
      },
    },
    {
      $group: {
        _id: '$assignedTo',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map<string, number>();
  for (const item of activeTicketCountsAgg) {
    countMap.set(item._id.toString(), item.count);
  }

  const N = activeStaff.length;
  let totalActiveTickets = 0;

  const agentDistribution: AgentWorkloadMetric[] = activeStaff.map((staff) => {
    const activeTickets = countMap.get(staff._id.toString()) || 0;
    const maxCapacity = staff.maxCapacity || 5;
    const loadRatio = parseFloat((activeTickets / Math.max(1, maxCapacity)).toFixed(2));
    totalActiveTickets += activeTickets;

    return {
      agentId: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      activeTickets,
      maxCapacity,
      loadRatio,
      isOverloaded: activeTickets >= maxCapacity || (activeTickets >= 4 && activeTickets > 0),
      isUnderutilized: activeTickets === 0,
    };
  });

  const meanActiveTickets = parseFloat((totalActiveTickets / N).toFixed(2));

  // Compute variance & standard deviation: sigma = sqrt(sum((x - mean)^2) / N)
  let sumSquaredDiff = 0;
  for (const item of agentDistribution) {
    sumSquaredDiff += Math.pow(item.activeTickets - meanActiveTickets, 2);
  }
  const standardDeviation = parseFloat(Math.sqrt(sumSquaredDiff / N).toFixed(2));

  // Find min and max
  const counts = agentDistribution.map((a) => a.activeTickets);
  const maxLoad = Math.max(...counts);
  const minLoad = Math.min(...counts);
  const imbalanceRatio = parseFloat((maxLoad / Math.max(1, minLoad)).toFixed(2));

  let status: 'balanced' | 'moderate_imbalance' | 'severe_imbalance' = 'balanced';
  if (N >= 2) {
    if (standardDeviation > 3.0 || (maxLoad >= 6 && minLoad === 0)) {
      status = 'severe_imbalance';
    } else if (standardDeviation > 1.5 || (maxLoad >= 4 && minLoad === 0)) {
      status = 'moderate_imbalance';
    }
  }

  // Refine overloaded & underutilized based on deviation from mean
  for (const item of agentDistribution) {
    if (N >= 2 && standardDeviation > 0) {
      if (item.activeTickets >= meanActiveTickets + 1.2 && item.activeTickets >= 3) {
        item.isOverloaded = true;
      }
      if (item.activeTickets <= Math.max(0, meanActiveTickets - 1.2)) {
        item.isUnderutilized = true;
      }
    }
  }

  const overloadedAgents = agentDistribution.filter((a) => a.isOverloaded);
  const underutilizedAgents = agentDistribution.filter((a) => a.isUnderutilized);

  let explanation = '';
  if (status === 'severe_imbalance') {
    const highest = agentDistribution.reduce((prev, curr) => (curr.activeTickets > prev.activeTickets ? curr : prev));
    const lowest = agentDistribution.reduce((prev, curr) => (curr.activeTickets < prev.activeTickets ? curr : prev));
    explanation = `Severe workload disparity detected (σ=${standardDeviation}, max/min ratio=${imbalanceRatio}): ${highest.name} holds ${highest.activeTickets} active tickets while ${lowest.name} holds ${lowest.activeTickets}. Immediate ticket reassignment recommended.`;
  } else if (status === 'moderate_imbalance') {
    explanation = `Moderate workload variance (σ=${standardDeviation}): Average of ${meanActiveTickets} tickets per agent with ${overloadedAgents.length} overloaded and ${underutilizedAgents.length} underutilized. Rebalancing recommended.`;
  } else {
    explanation = `Workload is well-balanced across ${N} active staff members (mean: ${meanActiveTickets} tickets/agent, σ=${standardDeviation}).`;
  }

  return {
    totalActiveAgents: N,
    totalActiveTickets,
    meanActiveTickets,
    standardDeviation,
    imbalanceRatio,
    status,
    overloadedAgents,
    underutilizedAgents,
    agentDistribution,
    explanation,
  };
};

/**
 * Master aggregation consolidating all 5 operational bottleneck dimensions.
 */
export const getBottleneckAnalytics = async (
  workspaceId: Types.ObjectId
): Promise<BottleneckAnalyticsResult> => {
  const now = new Date();

  const [unassigned, waitingForCustomer, awaitingEngineering, slaBreaches, workloadImbalance] =
    await Promise.all([
      getUnassignedBottleneck(workspaceId, now),
      getPendingCustomerBottleneck(workspaceId, now),
      getEngineeringBottleneck(workspaceId, now),
      getSLABreachBottleneck(workspaceId, now),
      getWorkloadImbalanceMetric(workspaceId),
    ]);

  return {
    workspaceId,
    timestamp: now,
    summary: {
      unassignedCount: unassigned.totalCount,
      waitingCustomerCount: waitingForCustomer.totalCount,
      awaitingEngineeringCount: awaitingEngineering.totalCount,
      slaBreachCount: slaBreaches.totalBreached,
      workloadImbalanceStatus: workloadImbalance.status,
    },
    unassigned,
    waitingForCustomer,
    awaitingEngineering,
    slaBreaches,
    workloadImbalance,
  };
};
