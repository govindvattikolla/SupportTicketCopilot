import {
  IBusinessHoursConfig,
  ISLASettings,
  SLAPriorityKey,
  SLAEvaluationResult,
  SLAMetricStatus,
  ITicketSLA,
} from './sla.types';

export const DEFAULT_SLA_SETTINGS: ISLASettings = {
  enabled: true,
  warningThresholdPercent: 80,
  businessHours: {
    enabled: true,
    timeZone: 'UTC',
    operatingHours: {
      start: '09:00',
      end: '18:00',
    },
    workingDays: [1, 2, 3, 4, 5], // Monday through Friday
    holidays: [],
  },
  priorities: {
    P1: { firstResponseMinutes: 60, resolutionMinutes: 240 },     // 1h / 4h
    P2: { firstResponseMinutes: 240, resolutionMinutes: 1440 },   // 4h / 24h
    P3: { firstResponseMinutes: 1440, resolutionMinutes: 2880 },  // 24h / 48h
    P4: { firstResponseMinutes: 2880, resolutionMinutes: 4320 },  // 48h / 72h
  },
};

/**
 * Parses "HH:mm" into minutes from midnight
 */
export const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = isNaN(parts[0]) ? 9 : parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
};

/**
 * Formats a Date into "YYYY-MM-DD" string for the target timezone
 */
export const formatDateInZone = (date: Date, timeZone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // outputs "YYYY-MM-DD"
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/**
 * Gets day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) in the target timezone
 */
export const getDayOfWeekInZone = (date: Date, timeZone: string): number => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    });
    const weekdayStr = formatter.format(date);
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return dayMap[weekdayStr] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
};

/**
 * Gets hours and minutes as total minutes from midnight in the target timezone
 */
export const getMinutesOfDayInZone = (date: Date, timeZone: string): number => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }
    // Handle midnight 24
    if (hour === 24) hour = 0;
    return hour * 60 + minute;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
};

/**
 * Checks if a given date is a working day (in workingDays and not in holidays)
 */
export const isWorkingDay = (date: Date, config: IBusinessHoursConfig): boolean => {
  const dayOfWeek = getDayOfWeekInZone(date, config.timeZone);
  if (!config.workingDays.includes(dayOfWeek)) {
    return false;
  }

  const dateStr = formatDateInZone(date, config.timeZone);
  if (config.holidays && config.holidays.includes(dateStr)) {
    return false;
  }

  return true;
};

/**
 * Adds business minutes to a start date according to the configured business hours,
 * timezone, working days, and holidays.
 *
 * If businessHours.enabled is false, acts as a standard 24/7 calendar clock.
 */
export const addBusinessMinutes = (
  startDate: Date,
  minutesToAdd: number,
  config: IBusinessHoursConfig
): Date => {
  if (minutesToAdd <= 0) return new Date(startDate);

  // 24/7 calendar mode fallback
  if (!config.enabled) {
    return new Date(startDate.getTime() + minutesToAdd * 60 * 1000);
  }

  const startMinutes = parseTimeToMinutes(config.operatingHours.start);
  const endMinutes = parseTimeToMinutes(config.operatingHours.end);

  if (endMinutes <= startMinutes) {
    // Invalid operating hours fallback
    return new Date(startDate.getTime() + minutesToAdd * 60 * 1000);
  }

  let current = new Date(startDate);
  let remainingMinutes = minutesToAdd;

  // Maximum loop guard to prevent infinite loops (e.g. 500 calendar days)
  let loopCount = 0;
  const MAX_LOOPS = 500 * 24 * 60;

  while (remainingMinutes > 0 && loopCount < MAX_LOOPS) {
    loopCount++;

    const isWorkDay = isWorkingDay(current, config);
    const minuteOfDay = getMinutesOfDayInZone(current, config.timeZone);

    if (!isWorkDay) {
      // Fast forward to next day midnight or next hour to find next working day
      const minutesToMidnight = 1440 - minuteOfDay;
      current = new Date(current.getTime() + minutesToMidnight * 60 * 1000);
      continue;
    }

    if (minuteOfDay < startMinutes) {
      // Before operating hours start today: advance to start of operating hours
      const diff = startMinutes - minuteOfDay;
      current = new Date(current.getTime() + diff * 60 * 1000);
      continue;
    }

    if (minuteOfDay >= endMinutes) {
      // After operating hours end today: advance to tomorrow
      const minutesToMidnight = 1440 - minuteOfDay;
      current = new Date(current.getTime() + minutesToMidnight * 60 * 1000);
      continue;
    }

    // Inside operating hours
    const minutesLeftToday = endMinutes - minuteOfDay;
    if (remainingMinutes <= minutesLeftToday) {
      // Remainder fits within today's working window
      current = new Date(current.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
      break;
    } else {
      // Consume the rest of today and advance to tomorrow
      remainingMinutes -= minutesLeftToday;
      const minutesToMidnight = 1440 - endMinutes;
      current = new Date(current.getTime() + (minutesLeftToday + minutesToMidnight) * 60 * 1000);
    }
  }

  return current;
};

/**
 * Calculates business minutes elapsed between two dates.
 */
export const calculateBusinessMinutesElapsed = (
  from: Date,
  to: Date,
  config: IBusinessHoursConfig
): number => {
  if (to <= from) return 0;
  if (!config.enabled) {
    return Math.floor((to.getTime() - from.getTime()) / (60 * 1000));
  }

  const startMinutes = parseTimeToMinutes(config.operatingHours.start);
  const endMinutes = parseTimeToMinutes(config.operatingHours.end);

  let elapsed = 0;
  let cursor = new Date(from);

  // Advance cursor minute by minute or in daily blocks for accuracy
  while (cursor < to) {
    if (isWorkingDay(cursor, config)) {
      const minOfDay = getMinutesOfDayInZone(cursor, config.timeZone);
      if (minOfDay >= startMinutes && minOfDay < endMinutes) {
        elapsed++;
      }
    }
    cursor = new Date(cursor.getTime() + 60 * 1000);
  }

  return elapsed;
};

/**
 * Computes initial SLA deadlines for a ticket given its priority and creation date
 */
export const calculateInitialSLADeadlines = (
  createdAt: Date,
  priority: SLAPriorityKey,
  slaSettings: ISLASettings = DEFAULT_SLA_SETTINGS
): { firstResponseDeadline: Date; resolutionDeadline: Date } => {
  const targets = slaSettings.priorities[priority] || slaSettings.priorities.P3;

  const firstResponseDeadline = addBusinessMinutes(
    createdAt,
    targets.firstResponseMinutes,
    slaSettings.businessHours
  );

  const resolutionDeadline = addBusinessMinutes(
    createdAt,
    targets.resolutionMinutes,
    slaSettings.businessHours
  );

  return { firstResponseDeadline, resolutionDeadline };
};

/**
 * Evaluates a ticket's current SLA status for both First Response and Resolution.
 */
export const evaluateTicketSLA = (
  ticket: {
    status: string;
    createdAt: Date;
    firstResponseAt?: Date;
    resolvedAt?: Date;
    sla?: ITicketSLA;
  },
  slaSettings: ISLASettings = DEFAULT_SLA_SETTINGS,
  now: Date = new Date()
): SLAEvaluationResult => {
  const warningPercent = slaSettings.warningThresholdPercent || 80;
  const isPaused = ticket.status === 'pending' || !!ticket.sla?.pausedAt;

  // 1. Evaluate First Response
  let frStatus: SLAMetricStatus = 'healthy';
  let frBreached = !!ticket.sla?.isFirstResponseBreached;
  const frDeadline = ticket.sla?.firstResponseDeadline;
  let frRemainingMinutes = 0;
  let frPercentElapsed = 0;

  if (ticket.firstResponseAt || ticket.sla?.firstResponseAchievedAt) {
    frStatus = 'satisfied';
    const achieved = ticket.sla?.firstResponseAchievedAt || ticket.firstResponseAt;
    if (achieved && frDeadline && achieved > frDeadline) {
      frBreached = true;
    }
  } else if (frDeadline) {
    if (isPaused) {
      frStatus = 'paused';
    } else if (now > frDeadline) {
      frStatus = 'breached';
      frBreached = true;
    } else {
      const totalAllocated = Math.max(1, (frDeadline.getTime() - ticket.createdAt.getTime()) / 60000);
      const elapsed = Math.max(0, (now.getTime() - ticket.createdAt.getTime()) / 60000);
      frPercentElapsed = Math.min(100, Math.round((elapsed / totalAllocated) * 100));
      frRemainingMinutes = Math.max(0, Math.round((frDeadline.getTime() - now.getTime()) / 60000));

      if (frPercentElapsed >= warningPercent) {
        frStatus = 'warning';
      }
    }
  }

  // 2. Evaluate Resolution
  let resStatus: SLAMetricStatus = 'healthy';
  let resBreached = !!ticket.sla?.isResolutionBreached;
  const resDeadline = ticket.sla?.resolutionDeadline;
  let resRemainingMinutes = 0;
  let resPercentElapsed = 0;

  if (ticket.status === 'resolved' || ticket.status === 'closed' || ticket.sla?.resolutionAchievedAt) {
    resStatus = 'satisfied';
    const achieved = ticket.sla?.resolutionAchievedAt || ticket.resolvedAt;
    if (achieved && resDeadline && achieved > resDeadline) {
      resBreached = true;
    }
  } else if (resDeadline) {
    if (isPaused) {
      resStatus = 'paused';
    } else if (now > resDeadline) {
      resStatus = 'breached';
      resBreached = true;
    } else {
      const totalAllocated = Math.max(1, (resDeadline.getTime() - ticket.createdAt.getTime()) / 60000);
      const elapsed = Math.max(0, (now.getTime() - ticket.createdAt.getTime()) / 60000);
      resPercentElapsed = Math.min(100, Math.round((elapsed / totalAllocated) * 100));
      resRemainingMinutes = Math.max(0, Math.round((resDeadline.getTime() - now.getTime()) / 60000));

      if (resPercentElapsed >= warningPercent) {
        resStatus = 'warning';
      }
    }
  }

  // Overall status rollup (most severe status wins)
  let overallStatus: SLAMetricStatus = 'healthy';
  if (frStatus === 'breached' || resStatus === 'breached') {
    overallStatus = 'breached';
  } else if (frStatus === 'warning' || resStatus === 'warning') {
    overallStatus = 'warning';
  } else if (isPaused) {
    overallStatus = 'paused';
  } else if (frStatus === 'satisfied' && resStatus === 'satisfied') {
    overallStatus = 'satisfied';
  }

  return {
    firstResponse: {
      status: frStatus,
      deadline: frDeadline,
      achievedAt: ticket.sla?.firstResponseAchievedAt || ticket.firstResponseAt,
      isBreached: frBreached,
      remainingMinutes: frRemainingMinutes,
      percentElapsed: frPercentElapsed,
    },
    resolution: {
      status: resStatus,
      deadline: resDeadline,
      achievedAt: ticket.sla?.resolutionAchievedAt || ticket.resolvedAt,
      isBreached: resBreached,
      remainingMinutes: resRemainingMinutes,
      percentElapsed: resPercentElapsed,
    },
    overallStatus,
  };
};
