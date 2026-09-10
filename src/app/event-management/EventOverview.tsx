import { useEffect, useState } from 'react';
import { ChevronRight, Edit3, Eye, Mail, QrCode, Send, Settings, UserPlus, Users } from 'lucide-react';
import { Link } from 'wouter';

import { getEventOperationalSummary, type EventOperationalSummary } from '@/backend/phase3';
import { useAppLocale } from '@/i18n/app-locale';
import { buildProjectRoute, type ProjectSummary } from '../projects';
import { EventCountdown } from './EventCountdown';

const emptySummary: EventOperationalSummary = {
  guest_records: 0,
  invitation_not_opened: 0,
  opened_no_rsvp: 0,
  accepted: 0,
  declined: 0,
  pending: 0,
  confirmed_headcount: 0,
  checked_in_headcount: 0,
  remaining_expected: 0,
  custom_messages: 0,
};

export function EventOverview({ project, rsvpDeadline }: { project: ProjectSummary; rsvpDeadline: string }) {
  const { t, dir, locale } = useAppLocale();
  const [summary, setSummary] = useState<EventOperationalSummary>(emptySummary);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError('');
    setLoading(true);
    getEventOperationalSummary(project.id)
      .then((data) => {
        setSummary(data);
      })
      .catch(() => setError(t('operationFailed')))
      .finally(() => setLoading(false));
  }, [project.id, t]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return Number.isNaN(date.getTime())
        ? dateStr
        : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(date);
    } catch {
      return dateStr;
    }
  };

  const chevronClass = dir === 'rtl' ? 'rotate-180' : '';

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      {/* Event Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8B7040]">
            {t(project.type)} · {t('eventOverview')}
          </p>
          <span className="rounded-full bg-[#EBF5F0] px-3 py-1 text-[11px] font-bold text-[#1B6344]">
            {t('live')}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--qr-primary)] break-words">
          {project.name}
        </h1>
        <p className="text-xs sm:text-sm text-[#756F66]">
          <bdi>{formatDate(project.date)}</bdi>
          {project.venue && <> · {project.venue}</>}
          {rsvpDeadline && <> · {t('rsvpDeadline')}: <bdi>{rsvpDeadline}</bdi></>}
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">
          {error}
        </p>
      )}

      {/* 1. Countdown Hero Card */}
      <EventCountdown dateStr={project.date} />

      {/* 2. Quick RSVP Snapshot (3 Soft Metric Cards) */}
      <section aria-labelledby="rsvp-snapshot-heading">
        <h2 id="rsvp-snapshot-heading" className="text-sm font-bold text-[#17251F] mb-3">
          {t('quickRsvpOverview')}
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {/* Confirmed / Accepted */}
          <div className="rounded-2xl border border-[#D5EADF] bg-[#EBF5F0] p-4 transition hover:shadow-xs">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#1B6344] tabular-nums">
              {summary.accepted}
            </p>
            <p className="mt-1 text-xs font-bold text-[#1B6344]/90">
              {t('confirmedGuestsPill')}
            </p>
          </div>

          {/* Pending / No response */}
          <div className="rounded-2xl border border-[#F6E9C8] bg-[#FDF6E2] p-4 transition hover:shadow-xs">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#8B7040] tabular-nums">
              {summary.pending}
            </p>
            <p className="mt-1 text-xs font-bold text-[#8B7040]/90">
              {t('pendingGuestsPill')}
            </p>
          </div>

          {/* Declined */}
          <div className="rounded-2xl border border-[#F8D8D3] bg-[#FDF0ED] p-4 transition hover:shadow-xs">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#9C382A] tabular-nums">
              {summary.declined}
            </p>
            <p className="mt-1 text-xs font-bold text-[#9C382A]/90">
              {t('declinedGuestsPill')}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Primary Contextual CTA Button (Emerald) */}
      <section>
        {summary.guest_records === 0 ? (
          <Link
            href={buildProjectRoute(project.type, project.id, 'guests')}
            data-testid="button-overview-add-guests"
            className="qr-button qr-button--primary min-h-14 w-full justify-center text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition"
          >
            <UserPlus size={18} aria-hidden="true" />
            <span>{t('addGuests')}</span>
          </Link>
        ) : (
          <Link
            href={buildProjectRoute(project.type, project.id, 'send')}
            data-testid="button-overview-send-invitations"
            className="qr-button qr-button--primary min-h-14 w-full justify-center text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition"
          >
            <Send size={18} aria-hidden="true" />
            <span>{t('sendInvitations')}</span>
          </Link>
        )}
      </section>

      {/* 4. Quick Navigation List Rows */}
      <nav className="space-y-2.5 pt-2" aria-label={t('quickActions')}>
        {/* Manage Guests */}
        <Link
          href={buildProjectRoute(project.type, project.id, 'guests')}
          data-testid="button-overview-nav-guests"
          className="group flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2EC] text-[var(--qr-primary)] group-hover:bg-[var(--qr-primary)] group-hover:text-white transition">
              <Users size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('manageGuestsAction')}
              </p>
              <p className="text-xs text-[#756F66]">
                {summary.guest_records} {t('guestRecords')}
                {summary.confirmed_headcount > 0 && <> · {summary.confirmed_headcount} {t('confirmedHeadcount')}</>}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className={`text-[#A49D93] group-hover:text-[var(--qr-primary)] transition ${chevronClass}`} aria-hidden="true" />
        </Link>

        {/* Share Invitation */}
        <Link
          href={buildProjectRoute(project.type, project.id, 'send')}
          data-testid="button-overview-nav-send"
          className="group flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2EC] text-[var(--qr-primary)] group-hover:bg-[var(--qr-primary)] group-hover:text-white transition">
              <Send size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('shareInvitationAction')}
              </p>
              <p className="text-xs text-[#756F66]">
                {t('sendLocalHelp')}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className={`text-[#A49D93] group-hover:text-[var(--qr-primary)] transition ${chevronClass}`} aria-hidden="true" />
        </Link>

        {/* Event Day Door Scanner */}
        <Link
          href={buildProjectRoute(project.type, project.id, 'scanner')}
          data-testid="button-overview-nav-scanner"
          className="group flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2EC] text-[var(--qr-primary)] group-hover:bg-[var(--qr-primary)] group-hover:text-white transition">
              <QrCode size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('eventDayScannerAction')}
              </p>
              <p className="text-xs text-[#756F66]">
                {summary.checked_in_headcount} / {summary.confirmed_headcount || 0} {t('checkedIn')}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className={`text-[#A49D93] group-hover:text-[var(--qr-primary)] transition ${chevronClass}`} aria-hidden="true" />
        </Link>

        {/* Edit / Preview Invitation */}
        <Link
          href={buildProjectRoute(project.type, project.id, 'invitation')}
          data-testid="button-overview-nav-invitation"
          className="group flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2EC] text-[var(--qr-primary)] group-hover:bg-[var(--qr-primary)] group-hover:text-white transition">
              <Edit3 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('editInvitationAction')}
              </p>
              <p className="text-xs text-[#756F66]">
                {t('localInvitationReady')}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className={`text-[#A49D93] group-hover:text-[var(--qr-primary)] transition ${chevronClass}`} aria-hidden="true" />
        </Link>

        {/* Event Settings */}
        <Link
          href={buildProjectRoute(project.type, project.id, 'settings')}
          data-testid="button-overview-nav-settings"
          className="group flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2EC] text-[var(--qr-primary)] group-hover:bg-[var(--qr-primary)] group-hover:text-white transition">
              <Settings size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('eventSettingsAction')}
              </p>
              <p className="text-xs text-[#756F66]">
                {t('settingsHelp')}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className={`text-[#A49D93] group-hover:text-[var(--qr-primary)] transition ${chevronClass}`} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
