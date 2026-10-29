import { describe, it, expect } from 'vitest';
import {
  addBusinessMinutes,
  calculateBusinessMinutesElapsed,
  calculateInitialSLADeadlines,
  evaluateTicketSLA,
  DEFAULT_SLA_SETTINGS,
} from '../src/modules/sla/slaEngine';
import { IBusinessHoursConfig } from '../src/modules/sla/sla.types';

describe('Phase 4 - SLA Engine & Business Hours Calculations', () => {
  const standardConfig: IBusinessHoursConfig = {
    enabled: true,
    timeZone: 'UTC',
    operatingHours: {
      start: '09:00',
      end: '18:00', // 9 hours = 540 operating minutes per day
    },
    workingDays: [1, 2, 3, 4, 5], // Monday through Friday
    holidays: ['2026-12-25'],    // Friday Christmas holiday
  };

  it('should add minutes within the same business day correctly', () => {
    // Wednesday 2026-10-14 at 10:00 UTC + 120 mins => 12:00 UTC
    const start = new Date('2026-10-14T10:00:00.000Z');
    const result = addBusinessMinutes(start, 120, standardConfig);

    expect(result.toISOString()).toBe('2026-10-14T12:00:00.000Z');
  });

  it('should roll over to the next business day when exceeding daily operating hours', () => {
    // Wednesday 2026-10-14 at 17:00 UTC (1 hour before close at 18:00) + 120 mins
    // 60 mins consumed today (until 18:00), remaining 60 mins start next day at 09:00 => Thursday 10:00
    const start = new Date('2026-10-14T17:00:00.000Z');
    const result = addBusinessMinutes(start, 120, standardConfig);

    expect(result.toISOString()).toBe('2026-10-15T10:00:00.000Z');
  });

  it('should roll over the weekend from Friday to Monday', () => {
    // Friday 2026-10-16 at 17:00 UTC + 120 mins
    // 60 mins on Friday, 60 mins on Monday 2026-10-19 at 09:00 => Monday 10:00
    const start = new Date('2026-10-16T17:00:00.000Z');
    const result = addBusinessMinutes(start, 120, standardConfig);

    expect(result.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('should skip configured holidays', () => {
    // Thursday 2026-12-24 at 17:00 UTC + 120 mins
    // Friday 2026-12-25 is a holiday! Weekend is 26-27.
    // Next working day is Monday 2026-12-28 at 09:00 => Monday 10:00
    const start = new Date('2026-12-24T17:00:00.000Z');
    const result = addBusinessMinutes(start, 120, standardConfig);

    expect(result.toISOString()).toBe('2026-12-28T10:00:00.000Z');
  });

  it('should advance to start of next working day if ticket created after hours or weekend', () => {
    // Saturday 2026-10-17 at 14:00 UTC + 60 mins
    // Starts Monday 2026-10-19 at 09:00 => Monday 10:00
    const start = new Date('2026-10-17T14:00:00.000Z');
    const result = addBusinessMinutes(start, 60, standardConfig);

    expect(result.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('should act as standard 24/7 calendar clock when businessHours.enabled is false', () => {
    const calendarConfig: IBusinessHoursConfig = {
      ...standardConfig,
      enabled: false,
    };

    const start = new Date('2026-10-16T22:00:00.000Z'); // Friday night
    const result = addBusinessMinutes(start, 180, calendarConfig); // + 3 hours

    expect(result.toISOString()).toBe('2026-10-17T01:00:00.000Z');
  });

  it('should calculate initial SLA deadlines by priority targets', () => {
    const createdAt = new Date('2026-10-14T09:00:00.000Z');
    const deadlines = calculateInitialSLADeadlines(createdAt, 'P1', DEFAULT_SLA_SETTINGS);

    // P1 target: 60 mins first response, 240 mins resolution
    expect(deadlines.firstResponseDeadline.toISOString()).toBe('2026-10-14T10:00:00.000Z');
    expect(deadlines.resolutionDeadline.toISOString()).toBe('2026-10-14T13:00:00.000Z');
  });

  it('should correctly evaluate SLA status: healthy, warning, and breached', () => {
    const createdAt = new Date('2026-10-14T09:00:00.000Z');
    const frDeadline = new Date('2026-10-14T10:00:00.000Z'); // 60 min window
    const resDeadline = new Date('2026-10-14T13:00:00.000Z');

    // Scenario 1: At 09:10 (10 mins in) => healthy (16% elapsed)
    const earlyEvaluation = evaluateTicketSLA(
      {
        status: 'open',
        createdAt,
        sla: {
          firstResponseDeadline: frDeadline,
          resolutionDeadline: resDeadline,
          isFirstResponseBreached: false,
          isResolutionBreached: false,
          isWarningSent: false,
          isEscalated: false,
          totalPausedMinutes: 0,
          pauseHistory: [],
        },
      },
      DEFAULT_SLA_SETTINGS,
      new Date('2026-10-14T09:10:00.000Z')
    );
    expect(earlyEvaluation.firstResponse.status).toBe('healthy');
    expect(earlyEvaluation.overallStatus).toBe('healthy');

    // Scenario 2: At 09:50 (50 mins in out of 60) => warning (83% elapsed >= 80% threshold)
    const warningEvaluation = evaluateTicketSLA(
      {
        status: 'open',
        createdAt,
        sla: {
          firstResponseDeadline: frDeadline,
          resolutionDeadline: resDeadline,
          isFirstResponseBreached: false,
          isResolutionBreached: false,
          isWarningSent: false,
          isEscalated: false,
          totalPausedMinutes: 0,
          pauseHistory: [],
        },
      },
      DEFAULT_SLA_SETTINGS,
      new Date('2026-10-14T09:50:00.000Z')
    );
    expect(warningEvaluation.firstResponse.status).toBe('warning');
    expect(warningEvaluation.overallStatus).toBe('warning');

    // Scenario 3: At 10:05 (past 10:00 deadline) => breached
    const breachedEvaluation = evaluateTicketSLA(
      {
        status: 'open',
        createdAt,
        sla: {
          firstResponseDeadline: frDeadline,
          resolutionDeadline: resDeadline,
          isFirstResponseBreached: false,
          isResolutionBreached: false,
          isWarningSent: false,
          isEscalated: false,
          totalPausedMinutes: 0,
          pauseHistory: [],
        },
      },
      DEFAULT_SLA_SETTINGS,
      new Date('2026-10-14T10:05:00.000Z')
    );
    expect(breachedEvaluation.firstResponse.status).toBe('breached');
    expect(breachedEvaluation.firstResponse.isBreached).toBe(true);
    expect(breachedEvaluation.overallStatus).toBe('breached');

    // Scenario 4: Paused state (pending status)
    const pausedEvaluation = evaluateTicketSLA(
      {
        status: 'pending',
        createdAt,
        sla: {
          firstResponseDeadline: frDeadline,
          resolutionDeadline: resDeadline,
          isFirstResponseBreached: false,
          isResolutionBreached: false,
          isWarningSent: false,
          isEscalated: false,
          pausedAt: new Date('2026-10-14T09:30:00.000Z'),
          totalPausedMinutes: 0,
          pauseHistory: [],
        },
      },
      DEFAULT_SLA_SETTINGS,
      new Date('2026-10-14T09:35:00.000Z')
    );
    expect(pausedEvaluation.firstResponse.status).toBe('paused');
    expect(pausedEvaluation.overallStatus).toBe('paused');
  });
});
