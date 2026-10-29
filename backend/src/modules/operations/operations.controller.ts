import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { getUrgencyRanking } from './urgencyRanking.service';
import { getAgentRecommendationsForTicket } from './agentRecommendation.service';
import { detectRecurringIssues } from './clustering.service';
import { getBottleneckAnalytics } from './bottleneckAnalytics.service';
import { BadRequestError } from '../../shared/errors/AppError';
import { TicketCategory } from '../tickets/ticket.model';
import { UrgencyTier } from './operations.types';

export const getUrgencyRankingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { status, assignedTo, limit, urgencyTier } = req.query;

    const ranking = await getUrgencyRanking(workspaceId, {
      status: status as string,
      assignedTo: assignedTo as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      urgencyTier: urgencyTier as UrgencyTier,
    });

    res.status(200).json({
      success: true,
      data: ranking,
    });
  } catch (error) {
    next(error);
  }
};

export const getAgentRecommendationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { ticketId } = req.params;

    if (!ticketId || !Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestError('Valid ticketId parameter is required');
    }

    const recommendations = await getAgentRecommendationsForTicket(workspaceId, ticketId);

    res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

export const getRecurringIssuesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { daysLookback, similarityThreshold, category } = req.query;

    const issues = await detectRecurringIssues(workspaceId, {
      daysLookback: daysLookback ? parseInt(daysLookback as string, 10) : undefined,
      similarityThreshold: similarityThreshold
        ? parseFloat(similarityThreshold as string)
        : undefined,
      category: category as TicketCategory,
    });

    res.status(200).json({
      success: true,
      data: issues,
    });
  } catch (error) {
    next(error);
  }
};

export const getBottlenecksHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.user!.workspaceId;
    const bottlenecks = await getBottleneckAnalytics(workspaceId);

    res.status(200).json({
      success: true,
      data: bottlenecks,
    });
  } catch (error) {
    next(error);
  }
};
