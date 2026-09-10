import { useState } from 'react';
import { AlertTriangle, Calendar, Globe, Info, Lock, MapPin, ShieldAlert } from 'lucide-react';

import { updateEvent } from '@/backend/events';
import type { BackendEvent, EventLifecycle } from '@/backend/types';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { allowedEventTransitions, isTerminalEvent } from '../lifecycle';
import type { ProjectSummary } from '../projects';

interface EventSettingsProps {
  project: ProjectSummary;
  event?: BackendEvent;
  onRefresh?: () => Promise<void>;
}

const lifecycleLabels: Record<EventLifecycle, 'lifecyclePlanning' | 'lifecycleActive' | 'lifecycleEnded' | 'lifecycleArchived' | 'lifecycleCancelled'> = {
  planning: 'lifecyclePlanning',
  active: 'lifecycleActive',
  ended: 'lifecycleEnded',
  archived: 'lifecycleArchived',
  cancelled: 'lifecycleCancelled',
};

export function EventSettings({ project, event, onRefresh }: EventSettingsProps) {
  const { t, locale } = useAppLocale();
  const [status, setStatus] = useState<EventLifecycle>(event?.lifecycle_status ?? 'planning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const allowedTransitions = event ? allowedEventTransitions(event.lifecycle_status) : [];
  const isTerminal = event ? isTerminalEvent(event.lifecycle_status) : false;

  const handleStatusSave = async () => {
    if (!event || status === event.lifecycle_status) return;

    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      await updateEvent(event.id, { lifecycle_status: status });
      if (onRefresh) await onRefresh();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return Number.isNaN(date.getTime())
        ? dateStr
        : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--qr-primary)]">
          {t('eventSettingsAction')}
        </h1>
        <p className="mt-1 text-xs text-[#756F66]">
          {t('settingsHelp')}
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-2xl bg-[#EBF5F0] p-4 text-sm text-[#1B6344] font-medium" role="status">
          {t('saved')}
        </p>
      )}

      {/* 2. Event Information Card */}
      <section className="rounded-3xl border border-[#E8E2D8] bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#17251F]">
          {t('eventInformation')}
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-2xl bg-[#FAF8F4] p-3.5 border border-[#E8E2D8]">
            <span className="text-[#756F66]">{t('operationName')}</span>
            <p className="text-sm font-bold text-[#17251F] mt-1">{project.name}</p>
          </div>

          <div className="rounded-2xl bg-[#FAF8F4] p-3.5 border border-[#E8E2D8]">
            <span className="text-[#756F66]">{t('project')}</span>
            <p className="text-sm font-bold text-[#17251F] mt-1 capitalize">{t(project.type)}</p>
          </div>

          <div className="rounded-2xl bg-[#FAF8F4] p-3.5 border border-[#E8E2D8]">
            <span className="text-[#756F66]">{t('date')}</span>
            <p className="text-sm font-bold text-[#17251F] mt-1"><bdi>{formatDate(project.date)}</bdi></p>
          </div>

          <div className="rounded-2xl bg-[#FAF8F4] p-3.5 border border-[#E8E2D8]">
            <span className="text-[#756F66]">{t('venue')}</span>
            <p className="text-sm font-bold text-[#17251F] mt-1">{project.venue || '—'}</p>
          </div>
        </div>
      </section>

      {/* 3. Event Lifecycle Control */}
      {event && (
        <section className="rounded-3xl border border-[#E8E2D8] bg-white p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#17251F]">
              {t('eventStatus')}
            </h2>
            <p className="mt-1 text-xs text-[#756F66]">
              {t('eventLifecycleExplanation')}
            </p>
          </div>

          {isTerminal ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[#FAF8F4] p-4 border border-[#E8E2D8] text-xs text-[#564F46]">
              <Lock size={16} className="text-[#8B7040]" aria-hidden="true" />
              <span>{t('eventReadOnlyHelp')}</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                aria-label={t('eventStatus')}
                value={status}
                disabled={busy || allowedTransitions.length <= 1}
                onChange={(e) => setStatus(e.target.value as EventLifecycle)}
                className="qr-field-inline min-h-12 w-full sm:flex-1 rounded-xl px-4 text-xs font-semibold border border-[#D9D2C5]"
              >
                {allowedTransitions.map((st) => (
                  <option key={st} value={st}>
                    {t(lifecycleLabels[st])}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy || status === event.lifecycle_status || allowedTransitions.length <= 1}
                onClick={() => void handleStatusSave()}
                className="min-h-12 w-full sm:w-auto rounded-xl bg-[#0C2D24] px-6 text-xs font-bold text-white transition hover:bg-[#174839] disabled:opacity-40"
              >
                {busy ? t('saving') : t('saveChanges')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. Global Application Language Control (Correction 5) */}
      <section className="rounded-3xl border border-[#E8E2D8] bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Globe size={18} className="text-[var(--qr-primary)]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#17251F]">
              {t('appLanguage')}
            </h2>
          </div>
          <AppLanguageControl />
        </div>

        <p className="text-xs text-[#756F66] leading-relaxed pt-1">
          {t('independentLanguageNotice')}
        </p>
      </section>
    </div>
  );
}
