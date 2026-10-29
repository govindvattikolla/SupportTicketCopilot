export type SLAPriorityKey = 'P1' | 'P2' | 'P3' | 'P4';

export interface ISLAPriorityTargets {
  firstResponseMinutes: number; // Max minutes to send first staff reply
  resolutionMinutes: number;    // Max minutes to resolve ticket
}

export interface IOperatingHours {
  start: string; // "HH:MM", e.g. "09:00"
  end: string;   // "HH:MM", e.g. "18:00"
}

export interface IBusinessHoursConfig {
  enabled: boolean;          // true = use business hours; false = 24/7 calendar clock
  timeZone: string;          // IANA timezone identifier, e.g. "America/New_York", "UTC", "Asia/Kolkata"
  operatingHours: IOperatingHours;
  workingDays: number[];     // Array of days: 0 = Sun, 1 = Mon, ..., 6 = Sat. Default: [1,2,3,4,5]
  holidays: string[];        // Array of ISO dates "YYYY-MM-DD"
}

export interface ISLASettings {
  enabled: boolean;
  warningThresholdPercent: number; // e.g. 80 (%)
  businessHours: IBusinessHoursConfig;
  priorities: Record<SLAPriorityKey, ISLAPriorityTargets>;
}

export interface ITicketSLAPauseHistory {
  pausedAt: Date;
  resumedAt?: Date;
  reason?: string;
  pausedBusinessMinutes?: number;
}

export interface ITicketSLA {
  firstResponseDeadline?: Date;
  resolutionDeadline?: Date;
  firstResponseAchievedAt?: Date;
  resolutionAchievedAt?: Date;
  isFirstResponseBreached: boolean;
  isResolutionBreached: boolean;
  isWarningSent: boolean;
  isEscalated: boolean;
  pausedAt?: Date;
  totalPausedMinutes: number;
  pauseHistory: ITicketSLAPauseHistory[];
}

export type SLAMetricStatus = 'healthy' | 'warning' | 'breached' | 'paused' | 'satisfied';

export interface SLAEvaluationResult {
  firstResponse: {
    status: SLAMetricStatus;
    deadline?: Date;
    achievedAt?: Date;
    isBreached: boolean;
    remainingMinutes: number;
    percentElapsed: number;
  };
  resolution: {
    status: SLAMetricStatus;
    deadline?: Date;
    achievedAt?: Date;
    isBreached: boolean;
    remainingMinutes: number;
    percentElapsed: number;
  };
  overallStatus: SLAMetricStatus;
}
