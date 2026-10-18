import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronRight, Clock, Edit3, MapPin, QrCode, Send, Settings, UserPlus, Users } from 'lucide-react';
import { Link } from 'wouter';

import { getEventOperationalSummary, type EventOperationalSummary } from '@/backend/phase3';
import { useAppLocale } from '@/i18n/app-locale';
import { formatDualDateSummary } from '@/utils/saudiCalendar';
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

  // Clean rsvpDeadline: filter out default Arabic placeholder when in English mode
  const cleanRsvpDeadline = useMemo(() => {
    if (!rsvpDeadline) return '';
    if (locale === 'en' && /[\u0600-\u06FF]/.test(rsvpDeadline)) {
      if (rsvpDeadline.includes('10 مايو')) {
        return '10 May';
      }
      return '';
    }
    return rsvpDeadline;
  }, [rsvpDeadline, locale]);

  const chevronClass = dir === 'rtl' ? 'rotate-180' : '';

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      {/* Event Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8B7040]">
            {t(project.type)} · {t('eventOverview')}
          </p>
          {project.invitationPublishedAt ? (
            <span className="rounded-full bg-[#EBF5F0] px-3 py-1 text-[11px] font-bold text-[#1B6344]">
              {t('published')}
            </span>
          ) : (
            <span className="rounded-full bg-[#FAF0E6] px-3 py-1 text-[11px] font-bold text-[#8B7040]">
              {t('notPublished')}
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--qr-primary)] break-words">
          {project.name}
        </h1>

        {/* Sleek Metadata Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {project.date && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-[rgba(194,155,97,0.22)] px-3 py-1 text-xs font-semibold text-[#17251F] tabular-nums shadow-xs">
              <Calendar size={13} className="text-[#8B7040] shrink-0" aria-hidden="true" />
              <span>{formatDualDateSummary(project.date, locale)}</span>
            </span>
          )}
          {project.venue && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-[rgba(194,155,97,0.22)] px-3 py-1 text-xs font-semibold text-[#17251F] shadow-xs">
              <MapPin size={13} className="text-[#8B7040] shrink-0" aria-hidden="true" />
              <span>{project.venue}</span>
            </span>
          )}
          {cleanRsvpDeadline && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-[rgba(194,155,97,0.22)] px-3 py-1 text-xs font-semibold text-[#17251F] shadow-xs">
              <Clock size={13} className="text-[#8B7040] shrink-0" aria-hidden="true" />
              <span>{t('rsvpDeadline')}: {cleanRsvpDeadline}</span>
            </span>
          )}
        </div>
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
          <div data-testid="overview-stat-attending" className="qr-card relative overflow-hidden rounded-2xl border border-[#D5EADF] bg-white p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1B6344]" aria-hidden="true" />
              <p className="text-xs font-bold text-[#1B6344]">
                {t('confirmedGuestsPill')}
              </p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#1B6344] tabular-nums">
              {summary.accepted}
            </p>
          </div>

          {/* Pending / No response */}
          <div data-testid="overview-stat-awaiting" className="qr-card relative overflow-hidden rounded-2xl border border-[#F6E9C8] bg-white p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-[#8B7040]" aria-hidden="true" />
              <p className="text-xs font-bold text-[#8B7040]">
                {t('pendingGuestsPill')}
              </p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#8B7040] tabular-nums">
              {summary.pending}
            </p>
          </div>

          {/* Declined */}
          <div data-testid="overview-stat-declined" className="qr-card relative overflow-hidden rounded-2xl border border-[#F8D8D3] bg-white p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-[#9C382A]" aria-hidden="true" />
              <p className="text-xs font-bold text-[#9C382A]">
                {t('declinedGuestsPill')}
              </p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#9C382A] tabular-nums">
              {summary.declined}
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
