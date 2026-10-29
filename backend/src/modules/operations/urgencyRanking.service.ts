import { Types } from 'mongoose';
import { Ticket, ITicket, TicketPriority } from '../tickets/ticket.model';
import {
  UrgencyFactor,
  UrgencyTier,
  RankedTicket,
  UrgencyRankingResult,
} from './operations.types';

// Priority points mapping
export const PRIORITY_WEIGHTS: Record<TicketPriority, number> = {
  P1: 40,
  P2: 25,
  P3: 15,
  P4: 5,
};

/**
 * Calculate waiting time points and explanation.
 * Evaluates how long the customer has waited since creation or last update.
 */
export const calculateWaitingTimeScore = (
  createdAt: Date,
  updatedAt: Date,
  status: string,
  now: Date = new Date()
): { score: number; hours: number; details: string } => {
  const diffMs = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const hours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));

  let score = 5;
  if (hours > 24) {
    score = 25;
  } else if (hours > 6) {
    score = 18;
  } else if (hours > 2) {
    score = 10;
  }

  const details =
    hours >= 1
      ? `Customer waiting for ${hours} hours without final resolution (+${score} pts)`
      : `Recently submitted (${Math.round(hours * 60)} mins ago) (+${score} pts)`;

  return { score, hours, details };
};

/**
 * Calculate SLA pressure points and explanation.
 * Evaluates nearest active deadline (first response or resolution).
 */
export const calculateSLAPressureScore = (
  ticket: ITicket,
  now: Date = new Date()
): { score: number; remainingMinutes: number | null; isBreached: boolean; details: string } => {
  const sla = ticket.sla;
  if (!sla) {
    return {
      score: 0,
      remainingMinutes: null,
      isBreached: false,
      details: 'No SLA policy configured for this ticket (0 pts)',
    };
  }

  // Check if already breached
  const isBreached =
    Boolean(sla.isFirstResponseBreached || sla.isResolutionBreached) ||
    (Boolean(sla.firstResponseDeadline) &&
      !ticket.firstResponseAt &&
      now > new Date(sla.firstResponseDeadline!)) ||
    (Boolean(sla.resolutionDeadline) &&
      !ticket.resolvedAt &&
      now > new Date(sla.resolutionDeadline!));

  if (isBreached) {
    return {
      score: 30,
      remainingMinutes: -1,
      isBreached: true,
      details: 'SLA target commitment has breached (+30 pts)',
    };
  }

  // Find nearest active upcoming deadline
  let targetDeadline: Date | null = null;
  if (!ticket.firstResponseAt && sla.firstResponseDeadline) {
    targetDeadline = new Date(sla.firstResponseDeadline);
  } else if (!ticket.resolvedAt && sla.resolutionDeadline) {
    targetDeadline = new Date(sla.resolutionDeadline);
  }

  if (!targetDeadline) {
    return {
      score: 0,
      remainingMinutes: null,
      isBreached: false,
      details: 'All SLA targets have been met or closed (0 pts)',
    };
  }

  const remainingMs = targetDeadline.getTime() - now.getTime();
  const remainingMinutes = Math.round(remainingMs / (1000 * 60));

  if (remainingMinutes <= 0) {
    return {
      score: 30,
      remainingMinutes: 0,
      isBreached: true,
      details: 'SLA target commitment has expired (+30 pts)',
    };
  } else if (remainingMinutes <= 60) {
    return {
      score: 20,
      remainingMinutes,
      isBreached: false,
      details: `Critical SLA threshold: ${remainingMinutes}m remaining before breach (+20 pts)`,
    };
  } else if (remainingMinutes <= 240) {
    return {
      score: 12,
      remainingMinutes,
      isBreached: false,
      details: `Approaching SLA deadline: ${(remainingMinutes / 60).toFixed(1)}h remaining (+12 pts)`,
    };
  } else {
    return {
      score: 3,
      remainingMinutes,
      isBreached: false,
      details: `SLA target on track: ${(remainingMinutes / 60).toFixed(1)}h remaining (+3 pts)`,
    };
  }
};

/**
 * Calculate Assignment State points and explanation.
 */
export const calculateAssignmentScore = (
  assignedTo?: Types.ObjectId | null
): { score: number; details: string } => {
  if (!assignedTo) {
    return {
      score: 15,
      details: 'Unassigned ticket requires staff triage (+15 pts)',
    };
  }
  return {
    score: 0,
    details: 'Ticket assigned to an agent (0 pts)',
  };
};

/**
 * Evaluates a ticket's operational attention score and explanation.
 * NOTE: The original priority is kept strictly untouched and returned alongside the calculated attention score.
 */
export const evaluateTicketUrgency = (
  ticket: ITicket,
  now: Date = new Date()
): RankedTicket => {
  const priorityScore = PRIORITY_WEIGHTS[ticket.priority] || 15;
  const waitingResult = calculateWaitingTimeScore(ticket.createdAt, ticket.updatedAt, ticket.status, now);
  const slaResult = calculateSLAPressureScore(ticket, now);
  const assignmentResult = calculateAssignmentScore(ticket.assignedTo);

  const rawAttentionScore =
    priorityScore + waitingResult.score + slaResult.score + assignmentResult.score;
  const attentionScore = Math.min(100, rawAttentionScore);

  let urgencyTier: UrgencyTier = 'low';
  if (attentionScore >= 75) {
    urgencyTier = 'critical';
  } else if (attentionScore >= 50) {
    urgencyTier = 'high';
  } else if (attentionScore >= 25) {
    urgencyTier = 'medium';
  }

  const factors: UrgencyFactor[] = [
    {
      name: 'Priority Weight',
      score: priorityScore,
      maxScore: 40,
      details: `${ticket.priority} priority base weight (+${priorityScore} pts)`,
    },
    {
      name: 'Waiting Time',
      score: waitingResult.score,
      maxScore: 25,
      details: waitingResult.details,
    },
    {
      name: 'SLA Pressure',
      score: slaResult.score,
      maxScore: 30,
      details: slaResult.details,
    },
    {
      name: 'Assignment State',
      score: assignmentResult.score,
      maxScore: 15,
      details: assignmentResult.details,
    },
  ];

  const explanation = `Attention Score ${attentionScore}/100 (${urgencyTier.toUpperCase()}): ${
    ticket.priority
  } priority (+${priorityScore} pts), ${waitingResult.details.replace(
    /\s*\(\+\d+\s*pts\)/,
    ''
  )} (+${waitingResult.score} pts), ${slaResult.details.replace(
    /\s*\(\+\d+\s*pts\)/,
    ''
  )} (+${slaResult.score} pts), ${assignmentResult.details.replace(
    /\s*\(\+\d+\s*pts\)/,
    ''
  )} (+${assignmentResult.score} pts).`;

  const assignedUser = ticket.assignedTo && typeof ticket.assignedTo === 'object' && 'name' in (ticket.assignedTo as any)
    ? {
        _id: (ticket.assignedTo as any)._id,
        name: (ticket.assignedTo as any).name,
        email: (ticket.assignedTo as any).email,
      }
    : null;

  return {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    originalPriority: ticket.priority, // Preserved untouched
    status: ticket.status,
    assignedTo: assignedUser,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    waitingHours: waitingResult.hours,
    slaRemainingMinutes: slaResult.remainingMinutes,
    isSlaBreached: slaResult.isBreached,
    attentionScore,
    urgencyTier,
    factors,
    explanation,
  };
};

/**
 * Retrieves and ranks workspace tickets by attention score.
 */
export const getUrgencyRanking = async (
  workspaceId: Types.ObjectId,
  filters: {
    status?: string;
    assignedTo?: string;
    limit?: number;
    urgencyTier?: UrgencyTier;
  } = {}
): Promise<UrgencyRankingResult> => {
  const query: any = { workspaceId };

  if (filters.status) {
    if (filters.status === 'active') {
      query.status = { $in: ['open', 'in_progress', 'pending'] };
    } else {
      query.status = filters.status;
    }
  } else {
    // Default to active tickets (excluding resolved/closed unless requested)
    query.status = { $in: ['open', 'in_progress', 'pending'] };
  }

  if (filters.assignedTo) {
    if (filters.assignedTo === 'unassigned') {
      query.$or = [{ assignedTo: { $exists: false } }, { assignedTo: null }];
    } else if (Types.ObjectId.isValid(filters.assignedTo)) {
      query.assignedTo = new Types.ObjectId(filters.assignedTo);
    }
  }

  const tickets = await Ticket.find(query)
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  const rankedTickets = (tickets as unknown as ITicket[]).map((t) => evaluateTicketUrgency(t, now));

  // Sort descending by calculated attention score
  rankedTickets.sort((a, b) => b.attentionScore - a.attentionScore);

  const tierCounts = {
    critical: rankedTickets.filter((t) => t.urgencyTier === 'critical').length,
    high: rankedTickets.filter((t) => t.urgencyTier === 'high').length,
    medium: rankedTickets.filter((t) => t.urgencyTier === 'medium').length,
    low: rankedTickets.filter((t) => t.urgencyTier === 'low').length,
  };

  const filtered = filters.urgencyTier
    ? rankedTickets.filter((t) => t.urgencyTier === filters.urgencyTier)
    : rankedTickets;

  const limit = filters.limit && filters.limit > 0 ? filters.limit : 100;
  const paginatedTickets = filtered.slice(0, limit);

  return {
    totalAnalyzed: rankedTickets.length,
    tierCounts,
    tickets: paginatedTickets,
  };
};
