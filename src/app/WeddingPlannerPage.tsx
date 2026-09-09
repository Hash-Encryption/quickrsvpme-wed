import { useEffect, useState } from 'react';
import { CalendarDays, Heart, Plus, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { CustomerBottomNav, EmptyState, ErrorState, LoadingState, MobileHeader, PageShell, StatusPill } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { useAuth } from '@/auth/AuthProvider';
import { deleteDesignDraft, listDesignDrafts, type DesignDraft } from '@/backend/phase2';
import { buildProjectRoute } from './projects';

export function WeddingPlannerPage() {
  const { t, locale } = useAppLocale();
  const auth = useAuth();
  const [drafts, setDrafts] = useState<DesignDraft<Record<string, unknown>>[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError('');
    try {
      const result = await listDesignDrafts<Record<string, unknown>>('wedding');
      setDrafts(result);
    } catch (caught) {
      setError(t('operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.loading) {
      void loadData();
    }
  }, [auth.loading]);

  const liveEvents = auth.events.filter((event) => event.product_id === 'wedding' && !event.deleted_at);
  const totalCount = drafts.length + liveEvents.length;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
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
        title={t('myWeddingsTitle')}
        description={t('myWeddingsSubtitle')}
        actions={<AppLanguageControl compact />}
      />

      <main className="qr-container max-w-4xl">
        {/* Prominent Create Wedding Card */}
        <section className="mb-8">
          <Link
            href="/planner/wedding/new"
            data-testid="link-create-wedding"
            className="qr-card group flex flex-col items-center justify-center border-2 border-dashed border-[#d1c7b7] bg-[var(--qr-surface)] p-8 sm:p-10 text-center transition-all duration-200 hover:border-[var(--qr-primary)] hover:bg-[var(--qr-primary-subtle)]/25 hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--qr-primary)] text-white shadow-sm transition-transform group-hover:scale-105">
              <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <h2 className="qr-card-title mt-4 text-xl font-bold text-[var(--qr-primary)]">
              {t('createNewWedding')}
            </h2>
            <p className="qr-secondary mt-1 text-xs sm:text-sm">
              {t('startWithExceptionalInvitation')}
            </p>
          </Link>
        </section>

        {/* Weddings List Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="qr-section-title text-lg font-bold text-[var(--qr-text)] flex items-center gap-2">
              <span>{t('myWeddingsCount')}</span>
              <span className="text-xs font-normal text-[var(--qr-secondary)]">({totalCount})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-8">
              <LoadingState label={t('loading')} />
            </div>
          ) : error ? (
            <ErrorState title={t('appErrorTitle')} description={error} />
          ) : totalCount === 0 ? (
            /* State A — No Weddings Empty State */
            <div className="qr-card py-12 px-6 text-center">
              <EmptyState
                icon={<Heart size={36} strokeWidth={1.5} className="qr-gold-text mx-auto" aria-hidden="true" />}
                title={t('noWeddingsYet')}
                description={t('noWeddingsYetSubtitle')}
                action={
                  <Link href="/planner/wedding/new" className="qr-button qr-button--primary mt-2">
                    <Sparkles size={16} aria-hidden="true" />
                    {t('createNewWedding')}
                  </Link>
                }
              />
            </div>
          ) : (
            /* State B — Existing Weddings List */
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Draft Weddings */}
              {drafts.map((draft) => {
                const draftConfig = draft.configuration as Record<string, unknown> | undefined;
                const draftDate = typeof draftConfig?.gregorianDate === 'string' ? draftConfig.gregorianDate : undefined;

                return (
                  <article
                    key={`draft-${draft.id}`}
                    data-testid={`wedding-draft-${draft.id}`}
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
                        href={`/drafts/wedding/${draft.id}`}
                        data-testid={`link-continue-wedding-${draft.id}`}
                        className="qr-button qr-button--primary text-xs flex-1 justify-center"
                      >
                        {t('continueInvitation')}
                      </Link>
                      <button
                        type="button"
                        data-testid={`button-delete-wedding-draft-${draft.id}`}
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

              {/* Published Wedding Events */}
              {liveEvents.map((event) => (
                <article
                  key={`event-${event.id}`}
                  data-testid={`wedding-event-${event.id}`}
                  className="qr-card flex flex-col justify-between p-5 hover:border-[var(--qr-primary)] transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill tone="success">{t('live')}</StatusPill>
                      <span className="text-xs text-[var(--qr-secondary)]">
                        {event.city || event.venue_name || '—'}
                      </span>
                    </div>
                    <Link
                      href={buildProjectRoute('wedding', event.id, 'overview')}
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

                  <div className="mt-6 pt-4 border-t border-[var(--qr-divider)] flex items-center justify-between">
                    <Link
                      href={buildProjectRoute('wedding', event.id, 'overview')}
                      data-testid={`link-open-wedding-${event.id}`}
                      className="qr-button qr-button--secondary text-xs w-full justify-center"
                    >
                      {t('openWedding')}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <CustomerBottomNav active="wedding" />
    </PageShell>
  );
}
