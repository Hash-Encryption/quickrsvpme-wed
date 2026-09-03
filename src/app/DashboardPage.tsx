import { ArrowRight, CalendarDays, Heart, LogOut, PartyPopper, Shield, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';

import { buildProjectRoute, type ProjectSummary } from './projects';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const entitlementKeys = { active: 'entitlementActive', suspended: 'entitlementSuspended', cancelled: 'entitlementCancelled', expired: 'entitlementExpired' } as const;

type DashboardAccount = {
  name: string;
  email: string;
  admin: boolean;
  eventCount: number;
  access: Partial<Record<ProjectSummary['type'], 'active' | 'suspended' | 'cancelled' | 'expired'>>;
};

type DashboardProject = ProjectSummary & { lifecycleStatus: string };
type DashboardDraft = Pick<ProjectSummary, 'id' | 'type' | 'name'> & { updatedAt: string };

export function DashboardPage({ projects, drafts, account, onSignOut, onCreate, onRename, onArchive, onDelete, onDeleteDraft }: { projects: DashboardProject[]; drafts: DashboardDraft[]; account: DashboardAccount; onSignOut: () => void; onCreate: (type: ProjectSummary['type'], title: string) => Promise<void>; onRename: (id: string, title: string) => Promise<void>; onArchive: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onDeleteDraft: (id: string) => Promise<void> }) {
  const { t, dir } = useAppLocale();
  const [type, setType] = useState<ProjectSummary['type']>('wedding');
  const [title, setTitle] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = async (key: string, operation: Promise<void>) => { setBusy(key); setError(''); try { await operation; } catch { setError(t('operationFailed')); } finally { setBusy(''); } };
  const accessLabel = (status: DashboardAccount['access']['wedding']) => status ? t(entitlementKeys[status]) : t('notAvailable');
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]">
    <header className="flex min-h-16 items-center justify-between border-b border-[#D9D2C5] bg-[#FAF8F4] px-5 sm:px-10"><p className="text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[#A4813C]">RSVP</span></p><div className="flex items-center gap-2"><AppLanguageControl compact />{account.admin && <Link href="/admin" className="focus-ring flex min-h-11 items-center gap-2 rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold"><Shield size={15} />{t('admin')}</Link>}<button onClick={onSignOut} className="focus-ring flex min-h-11 items-center gap-2 rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold"><LogOut size={15} /><span className="hidden sm:inline">{t('signOut')}</span></button></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('dashboard')}</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.055em] sm:text-6xl">{t('manageEvents')}</h1>
      <section className="mt-8 rounded-3xl border border-[#D9D2C5] bg-white p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><UserRound size={19} /></span><div className="min-w-0"><p className="text-xs font-semibold text-[#8B7040]">{t('backendConnected')}</p><p className="truncate font-semibold">{account.name}</p><p className="truncate text-xs text-[#756F66]" dir="ltr">{account.email}</p></div></div><div className="grid grid-cols-3 gap-2 text-center text-[10px]"><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('weddingAccess')}<b className="mt-1 block text-[#17251F]">{accessLabel(account.access.wedding)}</b></span><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('partyAccess')}<b className="mt-1 block text-[#17251F]">{accessLabel(account.access.party)}</b></span><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('eventShells')}<b className="mt-1 block text-[#17251F]">{account.eventCount}</b></span></div></div><p className="mt-5 border-t border-[#E8E2D8] pt-4 text-xs leading-5 text-[#756F66]">{t('localBuilderBoundary')}</p></section>
      <section className="mt-5 grid gap-3 rounded-3xl border border-[#D9D2C5] bg-white p-5 sm:grid-cols-[150px_minmax(0,1fr)_auto]"><select value={type} onChange={(event) => setType(event.target.value as ProjectSummary['type'])} className="min-h-11 rounded-xl border border-[#D9D2C5] px-3"><option value="wedding">{t('wedding')}</option><option value="party">{t('party')}</option></select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t(type === 'wedding' ? 'newWedding' : 'newParty')} className="min-h-11 rounded-xl border border-[#D9D2C5] px-4" /><button disabled={!title.trim() || busy === 'create'} onClick={() => void run('create', onCreate(type, title.trim()).then(() => setTitle('')))} className="min-h-11 rounded-full bg-[#0C2D24] px-5 text-xs font-semibold text-white disabled:opacity-40">{t('startDraft')}</button></section>
      {error && <p className="mt-3 rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">{error}</p>}
      <section className="mt-10"><h2 className="text-2xl font-semibold">{t('designDrafts')}</h2>{drafts.length === 0 && <p className="mt-3 text-sm text-[#756F66]">{t('noDrafts')}</p>}<div className="mt-4 grid gap-4 md:grid-cols-2">{drafts.map((draft) => {
        const Icon = draft.type === 'wedding' ? Heart : PartyPopper;
        return <article key={`draft-${draft.id}`} className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Link href={`/drafts/${draft.type}/${encodeURIComponent(draft.id)}`} className="focus-ring group block"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><Icon size={20} /></span><ArrowRight className={`text-[#A4813C] transition group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} /></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(draft.type)} · {t('draft')}</p><h3 className="mt-2 break-words text-2xl font-semibold tracking-[-.035em]">{draft.name}</h3><p className="mt-4 text-xs text-[#756F66]">{new Date(draft.updatedAt).toLocaleDateString()}</p></Link><div className="mt-5 border-t border-[#E8E2D8] pt-4"><button onClick={() => { if (window.confirm(t('confirmDelete'))) void run(draft.id, onDeleteDraft(draft.id)); }} className="min-h-11 rounded-full border px-4 text-xs text-[#8c302b]">{t('delete')}</button></div></article>;
      })}</div></section>
      <section className="mt-10"><h2 className="text-2xl font-semibold">{t('publishedEvents')}</h2>{projects.length === 0 && <p className="mt-3 text-sm text-[#756F66]">{t('noEvents')}</p>}<div className="mt-4 grid gap-4 md:grid-cols-2">{projects.map((project) => {
        const Icon = project.type === 'wedding' ? Heart : PartyPopper;
        return <article key={`${project.type}-${project.id}`} className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Link href={buildProjectRoute(project.type, project.id, 'overview')} className="focus-ring group block"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><Icon size={20} /></span><ArrowRight className={`text-[#A4813C] transition group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} /></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(project.type)} · {t('eventStatus')}: {project.lifecycleStatus}</p><h2 className="mt-2 break-words text-2xl font-semibold tracking-[-.035em]">{project.name}</h2><p className="mt-4 flex items-start gap-2 break-words text-xs text-[#756F66]"><CalendarDays className="mt-0.5 shrink-0" size={14} /><bdi>{project.date} · {project.venue}</bdi></p></Link><div className="mt-5 flex flex-wrap gap-2 border-t border-[#E8E2D8] pt-4"><input value={names[project.id] ?? project.name} onChange={(event) => setNames({ ...names, [project.id]: event.target.value })} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#D9D2C5] px-3 text-xs" /><button onClick={() => void run(project.id, onRename(project.id, names[project.id] ?? project.name))} className="rounded-full border px-3 text-xs">{t('rename')}</button><button onClick={() => void run(project.id, onArchive(project.id))} className="rounded-full border px-3 text-xs">{t('archive')}</button><button onClick={() => void run(project.id, onDelete(project.id))} className="rounded-full border px-3 text-xs text-[#8c302b]">{t('delete')}</button></div></article>;
      })}</div></section>
      <p className="mt-8 text-xs text-[#756F66]">{t('frontendOnly')}</p>
    </main>
  </div>;
}
