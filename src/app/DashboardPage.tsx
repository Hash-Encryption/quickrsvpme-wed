import { ArrowRight, CalendarDays, Heart, History, LogOut, PartyPopper, Shield, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

import type { CommercialSummary } from './commercial';
import { buildProjectRoute, type ProjectSummary } from './projects';
import { Button, EmptyState, MobileHeader, PageShell, StatusPill } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const entitlementKeys = { active: 'entitlementActive', suspended: 'entitlementSuspended', cancelled: 'entitlementCancelled', expired: 'entitlementExpired', none: 'notAvailable' } as const;
const lifecycleKeys = { planning: 'lifecyclePlanning', active: 'lifecycleActive', ended: 'lifecycleEnded', archived: 'lifecycleArchived', cancelled: 'lifecycleCancelled' } as const;

type DashboardAccount = { name: string; email: string; admin: boolean; eventCount: number; access: Partial<Record<ProjectSummary['type'], keyof typeof entitlementKeys>> };
type DashboardProject = ProjectSummary & { lifecycleStatus: keyof typeof lifecycleKeys };
type DashboardDraft = Pick<ProjectSummary, 'id' | 'type' | 'name'> & { updatedAt: string };
type Props = {
  projects: DashboardProject[]; drafts: DashboardDraft[]; account: DashboardAccount;
  commercial: Partial<Record<ProjectSummary['type'], CommercialSummary>>; product?: ProjectSummary['type'];
  onSignOut: () => void; onCreate: (type: ProjectSummary['type'], title: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>; onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>; onDeleteDraft: (id: string) => Promise<void>;
  degradedEvents?: boolean; onRefresh?: () => Promise<void>;
};

export function DashboardPage({ projects, drafts, account, commercial, product, onSignOut, onCreate, onRename, onArchive, onDelete, onDeleteDraft, degradedEvents, onRefresh }: Props) {
  const { t, dir, locale } = useAppLocale();
  const [type, setType] = useState<ProjectSummary['type']>(product ?? 'wedding');
  const [title, setTitle] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const shownProjects = product ? projects.filter((item) => item.type === product) : projects;
  const shownDrafts = product ? drafts.filter((item) => item.type === product) : drafts;
  const current = shownProjects.filter((item) => item.lifecycleStatus === 'planning' || item.lifecycleStatus === 'active');
  const history = shownProjects.filter((item) => item.lifecycleStatus !== 'planning' && item.lifecycleStatus !== 'active');
  const run = async (key: string, operation: Promise<void>) => { setBusy(key); setError(''); try { await operation; } catch (caught) { const message = caught instanceof Error ? caught.message : ''; if (/linked|published|event/i.test(message)) { setError(t('cannotDeletePublishedDraft')); } else { setError(t('operationFailed')); } } finally { setBusy(''); } };
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en') : '—';

  const eventCards = (items: DashboardProject[], empty: string) => items.length === 0 ? <div className="mt-4"><EmptyState title={empty} /></div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{items.map((item) => {
    const Icon = item.type === 'wedding' ? Heart : PartyPopper;
    return <article key={`${item.type}-${item.id}`} className="qr-card"><Link href={buildProjectRoute(item.type, item.id, 'overview')} className="focus-ring group block"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--qr-primary)] text-[var(--qr-gold)]"><Icon size={20} /></span><ArrowRight className={`qr-gold-text transition group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} /></div><p className="mt-7 qr-caption qr-gold-text">{t(item.type)} · <StatusPill tone={item.lifecycleStatus === 'active' ? 'success' : 'neutral'}>{t(lifecycleKeys[item.lifecycleStatus])}</StatusPill></p><h3 className="mt-2 break-words qr-card-title">{item.name}</h3><p className="mt-4 flex items-start gap-2 break-words text-xs text-[var(--qr-secondary)]"><CalendarDays className="mt-0.5 shrink-0" size={14} /><bdi>{formatDate(item.date)} · {item.venue || '—'}</bdi></p></Link><div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--qr-divider)] pt-4"><input value={names[item.id] ?? item.name} onChange={(event) => setNames({ ...names, [item.id]: event.target.value })} className="qr-field basis-full sm:flex-1" aria-label={t('operationName')} /><button onClick={() => void run(item.id, onRename(item.id, names[item.id] ?? item.name))} className="qr-button qr-button--secondary">{t('rename')}</button>{(item.lifecycleStatus === 'planning' || item.lifecycleStatus === 'active') && <button onClick={() => void run(item.id, onArchive(item.id))} className="qr-button qr-button--secondary">{t('archive')}</button>}<button onClick={() => { if (window.confirm(t('confirmDelete'))) void run(item.id, onDelete(item.id)); }} className="qr-button qr-button--danger">{t('delete')}</button></div></article>;
  })}</div>;

  return <PageShell>
    <MobileHeader title={<Link href="/" dir="ltr" className="qr-card-title">Quick<span className="qr-gold-text">RSVP</span></Link>} actions={<><AppLanguageControl compact /><Link href="/account" className="qr-button qr-button--secondary qr-icon-button" aria-label={t('account')}><UserRound size={18} aria-hidden="true" /></Link>{account.admin && <Link href="/admin" className="qr-button qr-button--secondary qr-icon-button" aria-label={t('admin')}><Shield size={18} aria-hidden="true" /></Link>}<Button variant="secondary" className="qr-icon-button" onClick={onSignOut} aria-label={t('signOut')}><LogOut size={18} aria-hidden="true" /></Button></>} />
    <main className="qr-container">
      <p className="text-xs font-bold uppercase tracking-[.16em] qr-gold-text">{product ? t(product === 'wedding' ? 'weddingPlanner' : 'partyPlanner') : t('overallDashboard')}</p><h1 className="mt-3 max-w-2xl qr-display">{t('manageEvents')}</h1>
      <nav className="mt-7 grid gap-3 sm:grid-cols-3" aria-label={t('projects')}><Link href="/" aria-current={!product ? 'page' : undefined} className="qr-button qr-button--secondary">{t('overallDashboard')}</Link><Link href="/planner/wedding" aria-current={product === 'wedding' ? 'page' : undefined} className="qr-button qr-button--secondary">{t('weddingPlanner')}</Link><Link href="/planner/party" aria-current={product === 'party' ? 'page' : undefined} className="qr-button qr-button--secondary">{t('partyPlanner')}</Link></nav>
      <section className="mt-5 qr-card"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--qr-primary)] text-[var(--qr-gold)]"><UserRound size={19} /></span><div className="min-w-0"><p className="text-xs font-semibold qr-gold-text">{t('backendConnected')}</p><p className="truncate font-semibold">{account.name}</p><p className="truncate text-xs text-[var(--qr-secondary)]" dir="ltr">{account.email}</p></div></div><div className="grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-xl bg-[var(--qr-subtle)] px-3 py-2">{t('weddingAccess')}<b className="mt-1 block">{t(entitlementKeys[account.access.wedding ?? 'none'])}</b></span><span className="rounded-xl bg-[var(--qr-subtle)] px-3 py-2">{t('partyAccess')}<b className="mt-1 block">{t(entitlementKeys[account.access.party ?? 'none'])}</b></span><span className="rounded-xl bg-[var(--qr-subtle)] px-3 py-2">{t('eventShells')}<b className="mt-1 block">{account.eventCount}</b></span></div></div><p className="mt-5 border-t border-[var(--qr-divider)] pt-4 text-xs leading-5 text-[var(--qr-secondary)]">{t('localBuilderBoundary')}</p></section>
      <section className="mt-5 grid gap-4 md:grid-cols-2">{(['wedding', 'party'] as const).filter((item) => !product || product === item).map((item) => { const summary = commercial[item]; const productEvents = projects.filter((event) => event.type === item); const upcoming = productEvents.filter((event) => event.date && new Date(event.date).getTime() >= Date.now()).sort((a, b) => a.date.localeCompare(b.date))[0]; return <article key={item} className="qr-card qr-card--featured"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--qr-gold)]">{t(item === 'wedding' ? 'weddingPlanner' : 'partyPlanner')}</p><div className="mt-5 grid grid-cols-3 gap-2 text-xs"><span>{t('draftsCount')}<b className="mt-1 block text-lg">{drafts.filter((draft) => draft.type === item).length}</b></span><span>{t('publishedEvents')}<b className="mt-1 block text-lg">{productEvents.length}</b></span><span>{t('upcomingDate')}<b className="mt-1 block text-sm">{formatDate(upcoming?.date)}</b></span></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-5 text-xs"><span>{t('allowance')}<b className="mt-1 block">{summary?.unlimited ? t('unlimited') : summary?.limit ?? '—'}</b></span><span>{t('consumed')}<b className="mt-1 block">{summary?.used ?? '—'}</b></span><span>{t('remaining')}<b className="mt-1 block">{summary?.unlimited ? t('unlimited') : summary?.remaining ?? '—'}</b></span></div>{summary?.used === null && <p className="mt-3 text-xs text-white/80">{t('usageUnavailable')}</p>}<Link href={`/planner/${item}`} className="mt-5 inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-xs font-semibold">{t('openProject')}</Link></article>; })}</section>
      <section className={`mt-5 grid gap-3 qr-card ${product ? 'sm:grid-cols-[minmax(0,1fr)_auto]' : 'sm:grid-cols-[150px_minmax(0,1fr)_auto]'}`}>{!product && <select aria-label={t('switchType')} value={type} onChange={(event) => setType(event.target.value as ProjectSummary['type'])} className="qr-field"><option value="wedding">{t('wedding')}</option><option value="party">{t('party')}</option></select>}<label className="qr-label"><span className="sr-only">{t('operationName')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t((product ?? type) === 'wedding' ? 'newWedding' : 'newParty')} className="qr-field" /></label><Button loading={busy === 'create'} disabled={!title.trim() || busy === 'create'} onClick={() => void run('create', onCreate(product ?? type, title.trim()).then(() => setTitle('')))}>{t('startDraft')}</Button></section>
      {error && <p className="qr-notice qr-notice--error mt-3" role="alert">{error}</p>}
      <section className="mt-10"><h2 className="qr-section-title">{t('designDrafts')}</h2><p className="mt-2 text-sm text-[var(--qr-secondary)]">{t('plannerWorkspace')}</p>{shownDrafts.length === 0 && <div className="mt-4"><EmptyState title={t('noDrafts')} /></div>}<div className="mt-4 grid gap-4 md:grid-cols-2">{shownDrafts.map((draft) => { const Icon = draft.type === 'wedding' ? Heart : PartyPopper; return <article key={draft.id} className="qr-card"><Link href={`/drafts/${draft.type}/${encodeURIComponent(draft.id)}`} className="focus-ring block"><Icon className="qr-gold-text" /><p className="mt-5 qr-caption qr-gold-text">{t(draft.type)} · <StatusPill>{t('draft')}</StatusPill></p><h3 className="mt-2 qr-card-title">{draft.name}</h3><p className="mt-3 text-xs text-[var(--qr-secondary)]">{formatDate(draft.updatedAt)}</p></Link><button onClick={() => { if (window.confirm(t('confirmDelete'))) void run(draft.id, onDeleteDraft(draft.id)); }} className="qr-button qr-button--danger mt-4">{t('delete')}</button></article>; })}</div></section>
      {degradedEvents && (
        <div className="mt-8 qr-notice qr-notice--warning flex items-center justify-between gap-3" role="status">
          <span>{t('eventsLoadFailed')}</span>
          {onRefresh && (
            <button onClick={() => void onRefresh()} className="font-semibold underline text-xs">
              {t('retry')}
            </button>
          )}
        </div>
      )}
      <section className="mt-10"><h2 className="flex items-center gap-2 qr-section-title"><CalendarDays size={20} />{t('activeEvents')}</h2>{eventCards(current, t('noActiveEvents'))}</section>
      <section className="mt-10"><h2 className="flex items-center gap-2 qr-section-title"><History size={20} />{t('eventHistory')}</h2>{eventCards(history, t('noHistoricalEvents'))}</section>
    </main>
  </PageShell>;
}
