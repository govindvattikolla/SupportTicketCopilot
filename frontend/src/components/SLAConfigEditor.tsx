import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkspaceSLASettingsApi,
  updateWorkspaceSLASettingsApi,
  ISLASettings,
} from '../api/client';
import {
  Clock,
  Calendar,
  Save,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Timer,
} from 'lucide-react';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export const SLAConfigEditor: React.FC = () => {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState('');

  // Local state for SLA settings form
  const [settings, setSettings] = useState<ISLASettings | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['workspaceSLASettings'],
    queryFn: getWorkspaceSLASettingsApi,
  });

  useEffect(() => {
    if (data) {
      setSettings(JSON.parse(JSON.stringify(data)));
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: updateWorkspaceSLASettingsApi,
    onSuccess: (updated) => {
      setSettings(JSON.parse(JSON.stringify(updated)));
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3500);
      queryClient.invalidateQueries({ queryKey: ['workspaceSLASettings'] });
      queryClient.invalidateQueries({ queryKey: ['currentWorkspace'] });
    },
    onError: (err: any) => {
      setSaveError(err.message || 'Failed to update SLA settings');
    },
  });

  if (isLoading || !settings) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading SLA policy and business hours configuration...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>Failed to load SLA settings: {(error as Error).message}</span>
      </div>
    );
  }

  const handlePriorityChange = (
    priority: 'P1' | 'P2' | 'P3' | 'P4',
    field: 'firstResponseMinutes' | 'resolutionMinutes',
    value: number
  ) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        priorities: {
          ...prev.priorities,
          [priority]: {
            ...prev.priorities[priority],
            [field]: Math.max(1, value),
          },
        },
      };
    });
  };

  const toggleWorkingDay = (day: number) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const currentDays = prev.businessHours.workingDays || [];
      const updatedDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort();
      return {
        ...prev,
        businessHours: {
          ...prev.businessHours,
          workingDays: updatedDays,
        },
      };
    });
  };

  const handleAddHoliday = () => {
    if (!newHoliday || !/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) {
      alert('Please enter a valid date in YYYY-MM-DD format');
      return;
    }
    setSettings((prev) => {
      if (!prev) return prev;
      const holidays = prev.businessHours.holidays || [];
      if (holidays.includes(newHoliday)) return prev;
      return {
        ...prev,
        businessHours: {
          ...prev.businessHours,
          holidays: [...holidays, newHoliday].sort(),
        },
      };
    });
    setNewHoliday('');
  };

  const handleRemoveHoliday = (date: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        businessHours: {
          ...prev.businessHours,
          holidays: (prev.businessHours.holidays || []).filter((h) => h !== date),
        },
      };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    updateMutation.mutate(settings);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Policy Master Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle SLA Policy */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">
              SLA Policy Enforcement
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Automatically calculate response & resolution deadlines for all incoming tickets.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className="text-slate-300 hover:text-white transition"
          >
            {settings.enabled ? (
              <ToggleRight className="w-8 h-8 text-brand-500" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-600" />
            )}
          </button>
        </div>

        {/* Warning Threshold */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200">
              Approaching SLA Warning Threshold
            </span>
            <span className="text-xs font-bold text-amber-400">
              {settings.warningThresholdPercent}% elapsed
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={settings.warningThresholdPercent}
            onChange={(e) =>
              setSettings({ ...settings, warningThresholdPercent: Number(e.target.value) })
            }
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block mt-1">
            Sends reminders and updates badge when ticket consumes this percentage of deadline.
          </span>
        </div>
      </div>

      {/* Target Durations per Priority */}
      <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-5">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-brand-400" />
          <span>Priority Target Deadlines (in Minutes)</span>
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          Define SLA clocks for first response and complete resolution across all priority tiers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['P1', 'P2', 'P3', 'P4'] as const).map((priority) => {
            const targets = settings.priorities[priority];
            const badgeColor =
              priority === 'P1'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : priority === 'P2'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : priority === 'P3'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-300';

            return (
              <div
                key={priority}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}>
                    {priority} Tier
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {targets.resolutionMinutes / 60}h max
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    First Response (mins)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={targets.firstResponseMinutes}
                    onChange={(e) =>
                      handlePriorityChange(priority, 'firstResponseMinutes', Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {targets.firstResponseMinutes >= 60
                      ? `(${Math.floor(targets.firstResponseMinutes / 60)}h ${targets.firstResponseMinutes % 60}m)`
                      : `(${targets.firstResponseMinutes} mins)`}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Resolution (mins)
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={targets.resolutionMinutes}
                    onChange={(e) =>
                      handlePriorityChange(priority, 'resolutionMinutes', Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {targets.resolutionMinutes >= 60
                      ? `(${Math.floor(targets.resolutionMinutes / 60)}h ${targets.resolutionMinutes % 60}m)`
                      : `(${targets.resolutionMinutes} mins)`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Business Hours & Operating Schedule */}
      <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Operating Schedule & Business Hours
            </h4>
          </div>

          <button
            type="button"
            onClick={() =>
              setSettings({
                ...settings,
                businessHours: {
                  ...settings.businessHours,
                  enabled: !settings.businessHours.enabled,
                },
              })
            }
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
          >
            <span>{settings.businessHours.enabled ? 'Business Hours Only' : '24/7 Calendar Clock'}</span>
            {settings.businessHours.enabled ? (
              <ToggleRight className="w-7 h-7 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-slate-600" />
            )}
          </button>
        </div>

        {settings.businessHours.enabled ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Time Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Workspace Time Zone
                </label>
                <select
                  value={settings.businessHours.timeZone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHours: {
                        ...settings.businessHours,
                        timeZone: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Hour */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Daily Start Time (HH:MM)
                </label>
                <input
                  type="time"
                  value={settings.businessHours.operatingHours.start}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHours: {
                        ...settings.businessHours,
                        operatingHours: {
                          ...settings.businessHours.operatingHours,
                          start: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* End Hour */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Daily End Time (HH:MM)
                </label>
                <input
                  type="time"
                  value={settings.businessHours.operatingHours.end}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHours: {
                        ...settings.businessHours,
                        operatingHours: {
                          ...settings.businessHours.operatingHours,
                          end: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Working Days */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Working Days (Days SLA Clock Ticks)
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(({ label, value }) => {
                  const isSelected = (settings.businessHours.workingDays || []).includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleWorkingDay(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Holidays */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Observed Holidays (Clock Paused All Day)</span>
              </label>

              <div className="flex gap-2 max-w-sm mb-3">
                <input
                  type="date"
                  value={newHoliday}
                  onChange={(e) => setNewHoliday(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {(settings.businessHours.holidays || []).length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No holidays configured yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(settings.businessHours.holidays || []).map((holiday) => (
                    <span
                      key={holiday}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                    >
                      <span>{holiday}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(holiday)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Remove holiday"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
            Clock operates 24/7 continuously. Deadlines expire around the clock regardless of weekends or holidays.
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>SLA policies & business hours updated successfully!</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-brand-600/20 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        <span>{updateMutation.isPending ? 'Saving SLA Policy...' : 'Save SLA Policy & Hours'}</span>
      </button>
    </form>
  );
};
