import { ArrowRight, CalendarDays, Heart, LogOut, PartyPopper, Shield, UserRound } from 'lucide-react';
import { Link } from 'wouter';

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

export function DashboardPage({ projects, account, onSignOut }: { projects: ProjectSummary[]; account: DashboardAccount; onSignOut: () => void }) {
  const { t, dir } = useAppLocale();
  const accessLabel = (status: DashboardAccount['access']['wedding']) => status ? t(entitlementKeys[status]) : t('notAvailable');
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]">
    <header className="flex min-h-16 items-center justify-between border-b border-[#D9D2C5] bg-[#FAF8F4] px-5 sm:px-10"><p className="text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[#A4813C]">RSVP</span></p><div className="flex items-center gap-2"><AppLanguageControl compact />{account.admin && <Link href="/admin" className="focus-ring flex min-h-11 items-center gap-2 rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold"><Shield size={15} />{t('admin')}</Link>}<button onClick={onSignOut} className="focus-ring flex min-h-11 items-center gap-2 rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold"><LogOut size={15} /><span className="hidden sm:inline">{t('signOut')}</span></button></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('dashboard')}</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.055em] sm:text-6xl">{t('manageEvents')}</h1>
      <section className="mt-8 rounded-3xl border border-[#D9D2C5] bg-white p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><UserRound size={19} /></span><div className="min-w-0"><p className="text-xs font-semibold text-[#8B7040]">{t('backendConnected')}</p><p className="truncate font-semibold">{account.name}</p><p className="truncate text-xs text-[#756F66]" dir="ltr">{account.email}</p></div></div><div className="grid grid-cols-3 gap-2 text-center text-[10px]"><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('weddingAccess')}<b className="mt-1 block text-[#17251F]">{accessLabel(account.access.wedding)}</b></span><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('partyAccess')}<b className="mt-1 block text-[#17251F]">{accessLabel(account.access.party)}</b></span><span className="rounded-xl bg-[#F5F2EC] px-3 py-2">{t('eventShells')}<b className="mt-1 block text-[#17251F]">{account.eventCount}</b></span></div></div><p className="mt-5 border-t border-[#E8E2D8] pt-4 text-xs leading-5 text-[#756F66]">{t('localBuilderBoundary')}</p></section>
      <div className="mt-10 grid gap-4 md:grid-cols-2">{projects.map((project) => {
        const Icon = project.type === 'wedding' ? Heart : PartyPopper;
        return <Link key={`${project.type}-${project.id}`} href={buildProjectRoute(project.type, project.id, 'overview')} className="focus-ring group rounded-3xl border border-[#D9D2C5] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#A4813C] sm:p-8"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><Icon size={20} /></span><ArrowRight className={`text-[#A4813C] transition group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} /></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(project.type)}</p><h2 className="mt-2 break-words text-2xl font-semibold tracking-[-.035em]">{project.name}</h2><p className="mt-4 flex items-start gap-2 break-words text-xs text-[#756F66]"><CalendarDays className="mt-0.5 shrink-0" size={14} /><bdi>{project.date} · {project.venue}</bdi></p></Link>;
      })}</div>
      <p className="mt-8 text-xs text-[#756F66]">{t('frontendOnly')}</p>
    </main>
  </div>;
}
