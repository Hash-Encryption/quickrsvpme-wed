import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Crown, PartyPopper, Plus, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { CustomerBottomNav, EmptyState, ErrorState, LoadingState, MobileHeader, PageShell, StatusPill } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { useAuth } from '@/auth/AuthProvider';
import { deleteDesignDraft, listDesignDrafts, type DesignDraft } from '@/backend/phase2';
import { loadCommercialSource } from '@/backend/commercial';
import { commercialSummary, type CommercialSource, type CommercialSummary } from './commercial';
import { buildProjectRoute } from './projects';

export function PartyPlannerPage({ initialDrafts, initialCommercial }: { initialDrafts?: DesignDraft<Record<string, unknown>>[]; initialCommercial?: CommercialSource | null } = {}) {
  const { t, locale, dir } = useAppLocale();
  const auth = useAuth();

  const [drafts, setDrafts] = useState<DesignDraft<Record<string, unknown>>[]>(initialDrafts ?? []);
  const [commercial, setCommercial] = useState<CommercialSource | null>(initialCommercial ?? null);
  const [loading, setLoading] = useState(initialDrafts === undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    setDeletingId(id);
    setError('');
    try {
      await deleteDesignDraft(id);
      await loadData();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (/linked|published|event/i.test(message)) {
        setError(t('cannotDeletePublishedDraft'));
      } else {
        setError(t('operationFailed'));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const loadData = async () => {
    if (initialDrafts !== undefined) {
      setDrafts(initialDrafts);
      if (initialCommercial !== undefined) setCommercial(initialCommercial);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [draftsResult, commercialSource] = await Promise.all([
        listDesignDrafts<Record<string, unknown>>('party'),
        loadCommercialSource().catch(() => null),
      ]);
      setDrafts(draftsResult);
      setCommercial(commercialSource);
    } catch (caught) {
      setError(t('operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDrafts !== undefined) return;
    if (!auth.loading) {
      void loadData();
    }
  }, [auth.loading, initialDrafts]);

  const liveEvents = auth.events.filter((event) => event.product_id === 'party' && !event.deleted_at);
  const unlinkedDrafts = drafts.filter((draft) =>
    !auth.events.some((event) => !event.deleted_at && (event.id === draft.id || (Boolean(event.source_draft_id) && event.source_draft_id === draft.id)))
  );

  const partySummary: CommercialSummary | null = commercial
    ? commercialSummary('party', auth.entitlements, commercial, auth.events)
    : null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return t('dateNotSet');
    try {
      const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return Number.isNaN(date.getTime())
        ? dateStr
        : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <PageShell className="qr-has-bottom-nav">
      <MobileHeader
        back={{ href: '/', label: t('backToProjects') }}
        title={t('myPartiesTitle')}
        description={t('myPartiesSubtitle')}
        actions={<AppLanguageControl compact />}
      />

      <main className="qr-container max-w-4xl">
        {/* Customer-Friendly Commercial Card */}
        <section className="mb-6">
          <div className="qr-card qr-card--featured p-6 sm:p-7 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--qr-gold)]">
                  <Crown size={24} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[.14em] text-[var(--qr-gold)] font-bold">
                    {t('currentPlan')}
                  </p>
                  <p className="text-2xl font-bold mt-1 text-white">
                    {partySummary?.unlimited
                      ? t('unlimited')
                      : partySummary?.remaining !== null && partySummary?.remaining !== undefined
                        ? `${partySummary.remaining} ${t('eventsRemaining')}`
                        : t('partyEvents')}
                  </p>
                </div>
              </div>

              <Link
                href="/account"
                data-testid="link-party-upgrade"
                className="qr-button bg-[var(--qr-gold)] text-[#2D2421] hover:bg-[#e1c253] border-none font-bold text-xs self-start sm:self-auto"
              >
                <span>{t('upgradePlan')}</span>
                <ArrowRight
                  size={14}
                  className={`transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* Prominent Create Party Card */}
        <section className="mb-8">
          <Link
            href="/planner/party/new"
            data-testid="link-create-party"
            className="qr-card group flex flex-col items-center justify-center border-2 border-dashed border-[#d1c7b7] bg-[var(--qr-surface)] p-8 sm:p-10 text-center transition-all duration-200 hover:border-[var(--qr-primary)] hover:bg-[var(--qr-primary-subtle)]/25 hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--qr-primary)] text-white shadow-sm transition-transform group-hover:scale-105">
              <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <h2 className="qr-card-title mt-4 text-xl font-bold text-[var(--qr-primary)]">
              {t('createNewParty')}
            </h2>
            <p className="qr-secondary mt-1 text-xs sm:text-sm">
              {t('partyCardSubtitle')}
            </p>
          </Link>
        </section>

        {/* Real Backend Parties List Section */}
        <section data-testid="section-my-parties">
          {auth.degraded?.events && (
            <div className="mb-6 qr-notice qr-notice--warning flex items-center justify-between gap-3" role="status">
              <span>{t('eventsLoadFailed')}</span>
              <button type="button" onClick={() => void auth.refresh()} className="font-semibold underline text-xs">
                {t('retry')}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="qr-section-title text-lg font-bold text-[var(--qr-text)] flex items-center gap-2">
              <span>{t('myPartiesCount')}</span>
              <span className="text-xs font-normal text-[var(--qr-secondary)]">({liveEvents.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8">
              <LoadingState label={t('loading')} />
            </div>
          ) : error ? (
            <ErrorState title={t('appErrorTitle')} description={error} />
          ) : liveEvents.length === 0 ? (
            /* State A — No Parties Empty State */
            <div className="qr-card py-12 px-6 text-center">
              <EmptyState
                icon={<PartyPopper size={36} strokeWidth={1.5} className="qr-gold-text mx-auto" aria-hidden="true" />}
                title={t('noPartiesYet')}
                description={t('noPartiesYetSubtitle')}
                action={
                  <Link href="/planner/party/new" className="qr-button qr-button--primary mt-2">
                    <Sparkles size={16} aria-hidden="true" />
                    {t('createNewParty')}
                  </Link>
                }
              />
            </div>
          ) : (
            /* State B — Existing Parties List */
            <div className="grid gap-4 sm:grid-cols-2">
              {liveEvents.map((event) => {
                const statusTone =
                  event.lifecycle_status === 'active'
                    ? 'success'
                    : event.lifecycle_status === 'ended'
                      ? 'warning'
                      : 'neutral';
                const statusLabel =
                  event.lifecycle_status === 'active'
                    ? t('live')
                    : event.lifecycle_status === 'ended'
                      ? t('ended')
                      : event.lifecycle_status === 'archived'
                        ? t('archived')
                        : t('notPublished');

                return (
                  <article
                    key={`event-${event.id}`}
                    data-testid={`party-event-${event.id}`}
                    className="qr-card flex flex-col justify-between p-5 hover:border-[var(--qr-primary)] transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                        <span className="text-xs text-[var(--qr-secondary)]">
                          {event.city || event.venue_name || '—'}
                        </span>
                      </div>
                      <Link
                        href={buildProjectRoute('party', event.id, 'overview')}
                        className="focus-ring block mt-3"
                      >
                        <h3 className="qr-card-title text-lg font-bold text-[var(--qr-primary)] hover:underline break-words">
                          {event.title}
                        </h3>
                      </Link>
                      <p className="mt-2 flex items-center gap-2 text-xs text-[var(--qr-secondary)]">
                        <CalendarDays size={14} className="shrink-0 qr-gold-text" aria-hidden="true" />
                        <span>{formatDate(event.starts_at)}</span>
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[var(--qr-divider)] flex items-center justify-between gap-2">
                      <Link
                        href={buildProjectRoute('party', event.id, 'overview')}
                        data-testid={`link-overview-party-${event.id}`}
                        className="qr-button qr-button--primary text-xs flex-1 justify-center"
                      >
                        {t('overview')}
                      </Link>
                      <Link
                        href={buildProjectRoute('party', event.id, 'invitation')}
                        data-testid={`link-edit-party-invitation-${event.id}`}
                        className="qr-button qr-button--secondary text-xs flex-1 justify-center"
                      >
                        {t('editInvitation')}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Standalone Design Drafts Section */}
        {unlinkedDrafts.length > 0 && (
          <section className="mt-10" data-testid="section-party-drafts">
            <div className="flex items-center justify-between mb-2">
              <h2 className="qr-section-title text-lg font-bold text-[var(--qr-text)] flex items-center gap-2">
                <span>{t('draftInvitations')}</span>
                <span className="text-xs font-normal text-[var(--qr-secondary)]">({unlinkedDrafts.length})</span>
              </h2>
            </div>
            <p className="text-xs text-[var(--qr-secondary)] mb-4">
              {t('draftInvitationsHelp')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {unlinkedDrafts.map((draft) => {
                const draftConfig = draft.configuration as Record<string, unknown> | undefined;
                const draftDate = typeof draftConfig?.date === 'string' && draftConfig.date ? draftConfig.date : undefined;

                return (
                  <article
                    key={`draft-${draft.id}`}
                    data-testid={`party-draft-${draft.id}`}
                    className="qr-card flex flex-col justify-between p-5 hover:border-[var(--qr-primary)] transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill tone="neutral">{t('draft')}</StatusPill>
                        <span className="text-xs text-[var(--qr-secondary)]">
                          {formatDate(draft.updated_at)}
                        </span>
                      </div>
                      <h3 className="qr-card-title mt-3 text-lg font-bold text-[var(--qr-primary)] break-words">
                        {draft.title}
                      </h3>
                      <p className="mt-2 flex items-center gap-2 text-xs text-[var(--qr-secondary)]">
                        <CalendarDays size={14} className="shrink-0 qr-gold-text" aria-hidden="true" />
                        <span>{formatDate(draftDate)}</span>
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[var(--qr-divider)] flex items-center justify-between gap-2">
                      <Link
                        href={`/drafts/party/${draft.id}`}
                        data-testid={`link-edit-draft-party-${draft.id}`}
                        className="qr-button qr-button--primary text-xs flex-1 justify-center"
                      >
                        {t('editDraft')}
                      </Link>
                      <button
                        type="button"
                        data-testid={`button-delete-party-draft-${draft.id}`}
                        onClick={() => void handleDeleteDraft(draft.id)}
                        disabled={deletingId === draft.id}
                        className="qr-button qr-button--danger text-xs"
                      >
                        {deletingId === draft.id ? t('loading') : t('delete')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <CustomerBottomNav active="party" />
    </PageShell>
  );
}
