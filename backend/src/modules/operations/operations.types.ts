import { Types } from 'mongoose';
import { TicketPriority, TicketStatus, TicketCategory } from '../tickets/ticket.model';

// ==========================================
// 1. URGENCY RANKING & ATTENTION SCORING
// ==========================================

export type UrgencyTier = 'critical' | 'high' | 'medium' | 'low';

export interface UrgencyFactor {
  name: 'Priority Weight' | 'Waiting Time' | 'SLA Pressure' | 'Assignment State';
  score: number;
  maxScore: number;
  details: string;
}

export interface RankedTicket {
  ticketId: Types.ObjectId;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  // Keep original ticket priority strictly separate from calculated attention score
  originalPriority: TicketPriority;
  status: TicketStatus;
  assignedTo?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  waitingHours: number;
  slaRemainingMinutes: number | null;
  isSlaBreached: boolean;
  attentionScore: number; // Calculated operational attention score (0-100)
  urgencyTier: UrgencyTier;
  factors: UrgencyFactor[];
  explanation: string;
}

export interface UrgencyRankingResult {
  totalAnalyzed: number;
  tierCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  tickets: RankedTicket[];
}

// ==========================================
// 2. WORKLOAD-AWARE AGENT RECOMMENDATIONS
// ==========================================

export interface AgentRecommendationFactor {
  name: 'Expertise Match' | 'Workload Bandwidth' | 'Availability Status';
  score: number;
  maxScore: number;
  details: string;
}

export interface AgentRecommendation {
  agent: {
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: string;
    skills: string[];
    maxCapacity: number;
  };
  activeTicketCount: number;
  capacityUtilizationPercent: number;
  matchScore: number; // 0 - 100
  isRecommended: boolean;
  factors: AgentRecommendationFactor[];
  explanation: string;
}

export interface AgentRecommendationResult {
  ticket: {
    _id: Types.ObjectId;
    ticketNumber: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    currentAssignee?: {
      _id: Types.ObjectId;
      name: string;
    } | null;
  };
  recommendations: AgentRecommendation[];
}

// ==========================================
// 3. RECURRING-ISSUE DETECTION & CLUSTERING
// ==========================================

export interface ClusterTicketItem {
  ticketId: Types.ObjectId;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  customerEmail: string;
}

export interface RecurringIssueCluster {
  clusterId: string;
  category: TicketCategory;
  themeTitle: string;
  ticketCount: number;
  tickets: ClusterTicketItem[];
  sharedKeywords: string[];
  averageSimilarity: number;
  highestPriority: TicketPriority;
  firstSeenAt: Date;
  lastSeenAt: Date;
  // Strict operational guidelines:
  isPotentialIncident: boolean; // Always true for clusters >= 2
  disclaimer: string; // Explains text similarity does NOT prove shared cause
  recommendedAction: string;
}

export interface RecurringIssuesResult {
  totalClusters: number;
  potentialIncidentCount: number;
  totalTicketsClustered: number;
  methodology: {
    algorithm: string;
    similarityMetric: string;
    similarityThreshold: number;
    llmEmployed: boolean;
    nonLlmRationale: {
      cost: string;
      privacy: string;
      failureHandling: string;
      explainability: string;
    };
  };
  clusters: RecurringIssueCluster[];
}

// ==========================================
// 4. BOTTLENECK ANALYTICS
// ==========================================

export interface UnassignedBottleneck {
  totalCount: number;
  avgWaitingHours: number;
  maxWaitingHours: number;
  byPriority: Record<TicketPriority, number>;
  oldestTickets: {
    ticketId: Types.ObjectId;
    ticketNumber: string;
    subject: string;
    priority: TicketPriority;
    waitingHours: number;
  }[];
}

export interface PendingCustomerBottleneck {
  totalCount: number;
  avgPendingHours: number;
  staleCount: number; // Waiting > 72 hours
  tickets: {
    ticketId: Types.ObjectId;
    ticketNumber: string;
    subject: string;
    pendingHours: number;
    customerEmail: string;
  }[];
}

export interface EngineeringBottleneck {
  totalCount: number;
  avgAgeHours: number;
  byPriority: Record<TicketPriority, number>;
  tickets: {
    ticketId: Types.ObjectId;
    ticketNumber: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    reason: string;
  }[];
}

export interface SLABreachBottleneck {
  totalBreached: number;
  firstResponseBreached: number;
  resolutionBreached: number;
  bothBreached: number;
  byPriority: Record<TicketPriority, number>;
  byAgent: {
    agentId: Types.ObjectId | null;
    agentName: string;
    breachCount: number;
  }[];
}

export interface AgentWorkloadMetric {
  agentId: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  activeTickets: number;
  maxCapacity: number;
  loadRatio: number;
  isOverloaded: boolean;
  isUnderutilized: boolean;
}

export interface WorkloadImbalanceMetric {
  totalActiveAgents: number;
  totalActiveTickets: number;
  meanActiveTickets: number;
  standardDeviation: number;
  imbalanceRatio: number; // maxLoad / minLoad
  status: 'balanced' | 'moderate_imbalance' | 'severe_imbalance';
  overloadedAgents: AgentWorkloadMetric[];
  underutilizedAgents: AgentWorkloadMetric[];
  agentDistribution: AgentWorkloadMetric[];
  explanation: string;
}

export interface BottleneckAnalyticsResult {
  workspaceId: Types.ObjectId;
  timestamp: Date;
  summary: {
    unassignedCount: number;
    waitingCustomerCount: number;
    awaitingEngineeringCount: number;
    slaBreachCount: number;
    workloadImbalanceStatus: 'balanced' | 'moderate_imbalance' | 'severe_imbalance';
  };
  unassigned: UnassignedBottleneck;
  waitingForCustomer: PendingCustomerBottleneck;
  awaitingEngineering: EngineeringBottleneck;
  slaBreaches: SLABreachBottleneck;
  workloadImbalance: WorkloadImbalanceMetric;
}
