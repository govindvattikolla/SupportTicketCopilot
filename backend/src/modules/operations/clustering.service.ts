import crypto from 'crypto';
import { Types } from 'mongoose';
import { Ticket, ITicket, TicketCategory, TicketPriority } from '../tickets/ticket.model';
import {
  ClusterTicketItem,
  RecurringIssueCluster,
  RecurringIssuesResult,
} from './operations.types';

// Standard English stop words
export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren', 'arent', 'as', 'at', 'be', 'because', 'been', 'before',
  'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'isn', 'isnt', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn', 'wasnt', 'we',
  'were', 'weren', 'werent', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'please', 'help', 'issue', 'ticket', 'problem', 'support', 'hello', 'hi', 'thanks',
]);

/**
 * Tokenizes and normalizes text into a set of clean, meaningful terms.
 */
export const tokenizeText = (text: string): Set<string> => {
  if (!text) return new Set();

  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawTokens = cleaned.split(' ');
  const result = new Set<string>();

  for (const token of rawTokens) {
    if (token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)) {
      result.add(token);
    }
  }

  return result;
};

/**
 * Calculates Jaccard similarity between two token sets: |A ∩ B| / |A ∪ B|.
 */
export const calculateJaccardSimilarity = (
  setA: Set<string>,
  setB: Set<string>
): { similarity: number; sharedTokens: string[] } => {
  if (setA.size === 0 || setB.size === 0) {
    return { similarity: 0, sharedTokens: [] };
  }

  const sharedTokens: string[] = [];
  for (const token of setA) {
    if (setB.has(token)) {
      sharedTokens.push(token);
    }
  }

  const unionSize = setA.size + setB.size - sharedTokens.length;
  const similarity = unionSize > 0 ? sharedTokens.length / unionSize : 0;

  return { similarity, sharedTokens };
};

/**
 * Groups tickets into connected components based on category and text similarity.
 */
export const clusterTickets = (
  tickets: ITicket[],
  similarityThreshold: number = 0.25,
  minSharedKeywords: number = 2
): RecurringIssueCluster[] => {
  if (tickets.length < 2) return [];

  // 1. Group tickets by structured category
  const categoryGroups = new Map<TicketCategory, ITicket[]>();
  for (const ticket of tickets) {
    const list = categoryGroups.get(ticket.category) || [];
    list.push(ticket);
    categoryGroups.set(ticket.category, list);
  }

  const clusters: RecurringIssueCluster[] = [];

  // 2. Process each category independently
  for (const [category, groupTickets] of categoryGroups.entries()) {
    if (groupTickets.length < 2) continue;

    // Tokenize each ticket's combined subject & description
    const tokenized = groupTickets.map((t) => ({
      ticket: t,
      tokens: tokenizeText(`${t.subject} ${t.description}`),
    }));

    // Build adjacency list for graph clustering
    const n = tokenized.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    const pairwiseSims: Map<string, number> = new Map();

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const { similarity, sharedTokens } = calculateJaccardSimilarity(
          tokenized[i].tokens,
          tokenized[j].tokens
        );

        // Connected if similarity >= threshold and at least minSharedKeywords shared,
        // or very high standalone similarity
        if (
          (similarity >= similarityThreshold && sharedTokens.length >= minSharedKeywords) ||
          similarity >= 0.4
        ) {
          adj[i].push(j);
          adj[j].push(i);
          pairwiseSims.set(`${i}-${j}`, similarity);
        }
      }
    }

    // Find connected components (BFS/DFS)
    const visited = new Array(n).fill(false);

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      const componentIndices: number[] = [];
      const queue = [i];
      visited[i] = true;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        componentIndices.push(curr);

        for (const neighbor of adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }

      // Only clusters with at least 2 tickets are meaningful recurring patterns
      if (componentIndices.length >= 2) {
        const clusterTicketsList = componentIndices.map((idx) => tokenized[idx].ticket);

        // Aggregate keyword frequencies
        const keywordFreq = new Map<string, number>();
        for (const idx of componentIndices) {
          for (const token of tokenized[idx].tokens) {
            keywordFreq.set(token, (keywordFreq.get(token) || 0) + 1);
          }
        }

        // Top shared keywords sorted by frequency
        const sortedKeywords = Array.from(keywordFreq.entries())
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .map(([token]) => token)
          .slice(0, 5);

        // Compute average pairwise similarity within component
        let simSum = 0;
        let simPairs = 0;
        for (let a = 0; a < componentIndices.length; a++) {
          for (let b = a + 1; b < componentIndices.length; b++) {
            const idx1 = Math.min(componentIndices[a], componentIndices[b]);
            const idx2 = Math.max(componentIndices[a], componentIndices[b]);
            const s = pairwiseSims.get(`${idx1}-${idx2}`);
            if (s !== undefined) {
              simSum += s;
              simPairs++;
            }
          }
        }
        const avgSim = simPairs > 0 ? parseFloat((simSum / simPairs).toFixed(3)) : similarityThreshold;

        // Highest priority in cluster
        const priorityOrder: Record<TicketPriority, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
        let highestPriority: TicketPriority = 'P4';
        for (const t of clusterTicketsList) {
          if (priorityOrder[t.priority] > priorityOrder[highestPriority]) {
            highestPriority = t.priority;
          }
        }

        // Timeframe
        const sortedDates = clusterTicketsList
          .map((t) => new Date(t.createdAt).getTime())
          .sort((a, b) => a - b);
        const firstSeenAt = new Date(sortedDates[0]);
        const lastSeenAt = new Date(sortedDates[sortedDates.length - 1]);

        const themeKeywords =
          sortedKeywords.length > 0 ? sortedKeywords.slice(0, 3).join(', ') : 'correlated symptoms';
        const themeTitle = `Potential ${category.toUpperCase()} Pattern: [${themeKeywords}]`;

        const clusterId = `cluster_${category}_${crypto
          .createHash('md5')
          .update(sortedKeywords.join('_') + firstSeenAt.toISOString())
          .digest('hex')
          .slice(0, 8)}`;

        const clusterItems: ClusterTicketItem[] = clusterTicketsList.map((t) => ({
          ticketId: t._id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          category: t.category,
          priority: t.priority,
          status: t.status,
          createdAt: t.createdAt,
          customerEmail: t.customer?.email || 'unknown',
        }));

        clusters.push({
          clusterId,
          category,
          themeTitle,
          ticketCount: clusterTicketsList.length,
          tickets: clusterItems,
          sharedKeywords: sortedKeywords,
          averageSimilarity: avgSim,
          highestPriority,
          firstSeenAt,
          lastSeenAt,
          isPotentialIncident: true,
          disclaimer:
            'Treat as potential incident requiring human review. Text similarity indicates correlated wording and symptom overlap, but does not prove a shared technical root cause. Manual investigation is required.',
          recommendedAction: `Review the ${clusterTicketsList.length} correlated tickets with your engineering or support leads to determine whether an active platform issue or regression is occurring.`,
        });
      }
    }
  }

  // Sort clusters by highest priority first, then ticket count descending
  const priorityRank: Record<TicketPriority, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
  clusters.sort((a, b) => {
    if (priorityRank[b.highestPriority] !== priorityRank[a.highestPriority]) {
      return priorityRank[b.highestPriority] - priorityRank[a.highestPriority];
    }
    return b.ticketCount - a.ticketCount;
  });

  return clusters;
};

/**
 * Detects recurring issue clusters across workspace tickets.
 */
export const detectRecurringIssues = async (
  workspaceId: Types.ObjectId,
  options: {
    daysLookback?: number;
    similarityThreshold?: number;
    category?: TicketCategory;
  } = {}
): Promise<RecurringIssuesResult> => {
  const days = options.daysLookback || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query: any = {
    workspaceId,
    createdAt: { $gte: cutoff },
  };

  if (options.category) {
    query.category = options.category;
  }

  const tickets = await Ticket.find(query).sort({ createdAt: -1 }).lean();

  const threshold = options.similarityThreshold || 0.25;
  const clusters = clusterTickets(tickets as unknown as ITicket[], threshold);

  const totalTicketsClustered = clusters.reduce((acc, c) => acc + c.ticketCount, 0);

  return {
    totalClusters: clusters.length,
    potentialIncidentCount: clusters.length,
    totalTicketsClustered,
    methodology: {
      algorithm: 'Graph-Connected Components via Category Partitioning and Token Normalization',
      similarityMetric: 'Jaccard Token Similarity (subject + description)',
      similarityThreshold: threshold,
      llmEmployed: false,
      nonLlmRationale: {
        cost: 'Zero operational API charges or GPU compute requirements. Operates entirely locally.',
        privacy:
          'Customer ticket contents and PII never leave the tenant database or boundary.',
        failureHandling:
          '100% deterministic, high-throughput, offline execution with zero rate-limiting or network outage risks.',
        explainability:
          'Transparent keyword overlap provides clear, verifiable justification for every cluster grouping.',
      },
    },
    clusters,
  };
};
