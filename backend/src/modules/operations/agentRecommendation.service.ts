import { Types } from 'mongoose';
import { User, IUser } from '../users/user.model';
import { Ticket, ITicket, TicketCategory, TicketPriority } from '../tickets/ticket.model';
import { NotFoundError } from '../../shared/errors/AppError';
import {
  AgentRecommendation,
  AgentRecommendationFactor,
  AgentRecommendationResult,
} from './operations.types';

/**
 * Calculates expertise score and explanation for an agent relative to a category.
 */
export const calculateExpertiseScore = (
  agentSkills: string[] = [],
  ticketCategory: TicketCategory,
  resolvedCountInCategory: number = 0
): { score: number; details: string } => {
  const hasSkill = agentSkills.includes(ticketCategory);

  let score = 0;
  const reasons: string[] = [];

  if (hasSkill) {
    score += 30;
    reasons.push(`Designated skill badge in "${ticketCategory}" (+30 pts)`);
  }

  if (resolvedCountInCategory >= 5) {
    score += 10;
    reasons.push(`Extensive resolution history (${resolvedCountInCategory} resolved) (+10 pts)`);
  } else if (resolvedCountInCategory >= 1) {
    score += 5;
    reasons.push(`Prior resolution experience (${resolvedCountInCategory} resolved) (+5 pts)`);
  }

  // If no specific skills or history, provide baseline general capability
  if (score === 0) {
    score = 15;
    reasons.push(`General support profile without specific "${ticketCategory}" specialization (+15 pts)`);
  }

  return {
    score: Math.min(40, score),
    details: reasons.join('; '),
  };
};

/**
 * Calculates workload bandwidth score and explanation based on active ticket count and capacity.
 */
export const calculateWorkloadScore = (
  activeCount: number,
  maxCapacity: number = 5
): { score: number; details: string; utilizationPercent: number } => {
  const utilizationPercent = Math.round((activeCount / Math.max(1, maxCapacity)) * 100);

  let score = 0;
  let details = '';

  if (activeCount === 0) {
    score = 40;
    details = `Zero active tickets — immediate bandwidth available (0% capacity) (+40 pts)`;
  } else if (activeCount === 1) {
    score = 35;
    details = `1 active ticket — abundant bandwidth (${utilizationPercent}% capacity) (+35 pts)`;
  } else if (activeCount === 2) {
    score = 28;
    details = `2 active tickets — healthy operational workload (${utilizationPercent}% capacity) (+28 pts)`;
  } else if (activeCount === 3) {
    score = 20;
    details = `3 active tickets — moderate queue (${utilizationPercent}% capacity) (+20 pts)`;
  } else if (activeCount === 4) {
    score = 10;
    details = `4 active tickets — nearing capacity threshold (${utilizationPercent}% capacity) (+10 pts)`;
  } else {
    score = 0;
    details = `At/exceeding capacity (${activeCount} active tickets, ${utilizationPercent}% capacity) (0 pts)`;
  }

  return { score, details, utilizationPercent };
};

/**
 * Calculates availability score and explanation.
 */
export const calculateAvailabilityScore = (
  isActive: boolean
): { score: number; details: string } => {
  if (isActive) {
    return {
      score: 20,
      details: 'Agent is active, on-duty, and eligible for assignment (+20 pts)',
    };
  }
  return {
    score: 0,
    details: 'Agent is marked inactive or off-duty (0 pts)',
  };
};

/**
 * Evaluates candidate agents for a ticket and returns explainable recommendations.
 */
export const getAgentRecommendationsForTicket = async (
  workspaceId: Types.ObjectId,
  ticketId: string
): Promise<AgentRecommendationResult> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new NotFoundError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId }).populate(
    'assignedTo',
    'name email'
  );

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  return recommendAgentsForCategory(
    workspaceId,
    ticket.category,
    ticket.priority,
    {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      currentAssignee: ticket.assignedTo
        ? {
            _id: (ticket.assignedTo as any)._id,
            name: (ticket.assignedTo as any).name,
          }
        : null,
    }
  );
};

/**
 * Core recommendation algorithm querying real database data.
 */
export const recommendAgentsForCategory = async (
  workspaceId: Types.ObjectId,
  category: TicketCategory,
  priority: TicketPriority,
  ticketInfo: {
    _id: Types.ObjectId;
    ticketNumber: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    currentAssignee?: { _id: Types.ObjectId; name: string } | null;
  }
): Promise<AgentRecommendationResult> => {
  // 1. Fetch all eligible staff in workspace (agents and leads)
  const staffMembers = await User.find({
    workspaceId,
    role: { $in: ['agent', 'lead'] },
    isActive: true,
  }).lean();

  if (staffMembers.length === 0) {
    return {
      ticket: ticketInfo,
      recommendations: [],
    };
  }

  const staffIds = staffMembers.map((s) => s._id);

  // 2. Efficient aggregation: Active ticket counts per agent
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

  const activeCountMap = new Map<string, number>();
  for (const item of activeTicketCountsAgg) {
    activeCountMap.set(item._id.toString(), item.count);
  }

  // 3. Efficient aggregation: Resolved tickets per agent in this specific category
  const resolvedCategoryCountsAgg = await Ticket.aggregate([
    {
      $match: {
        workspaceId,
        assignedTo: { $in: staffIds },
        status: 'resolved',
        category,
      },
    },
    {
      $group: {
        _id: '$assignedTo',
        resolvedCount: { $sum: 1 },
      },
    },
  ]);

  const resolvedCountMap = new Map<string, number>();
  for (const item of resolvedCategoryCountsAgg) {
    resolvedCountMap.set(item._id.toString(), item.resolvedCount);
  }

  // 4. Calculate explainable match score for each candidate
  const candidateRecommendations: AgentRecommendation[] = staffMembers.map((staff) => {
    const activeCount = activeCountMap.get(staff._id.toString()) || 0;
    const resolvedInCategory = resolvedCountMap.get(staff._id.toString()) || 0;
    const skills = staff.skills || [];
    const maxCapacity = staff.maxCapacity || 5;

    const expertise = calculateExpertiseScore(skills, category, resolvedInCategory);
    const workload = calculateWorkloadScore(activeCount, maxCapacity);
    const availability = calculateAvailabilityScore(staff.isActive);

    const matchScore = Math.min(100, expertise.score + workload.score + availability.score);

    const factors: AgentRecommendationFactor[] = [
      {
        name: 'Expertise Match',
        score: expertise.score,
        maxScore: 40,
        details: expertise.details,
      },
      {
        name: 'Workload Bandwidth',
        score: workload.score,
        maxScore: 40,
        details: workload.details,
      },
      {
        name: 'Availability Status',
        score: availability.score,
        maxScore: 20,
        details: availability.details,
      },
    ];

    const explanation = `Match Score ${matchScore}%: ${expertise.details}; ${workload.details}; ${availability.details}.`;

    return {
      agent: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        skills,
        maxCapacity,
      },
      activeTicketCount: activeCount,
      capacityUtilizationPercent: workload.utilizationPercent,
      matchScore,
      isRecommended: false, // will mark top candidate
      factors,
      explanation,
    };
  });

  // Sort descending by matchScore (tie-break by lower active ticket count, then higher expertise)
  candidateRecommendations.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    if (a.activeTicketCount !== b.activeTicketCount) {
      return a.activeTicketCount - b.activeTicketCount;
    }
    return b.factors[0].score - a.factors[0].score;
  });

  // Mark top candidate as recommended
  if (candidateRecommendations.length > 0) {
    candidateRecommendations[0].isRecommended = true;
  }

  return {
    ticket: ticketInfo,
    recommendations: candidateRecommendations,
  };
};
