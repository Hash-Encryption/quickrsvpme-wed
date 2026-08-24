import {
  CalendarDays, Home, LayoutTemplate, ListChecks, MessageCircle, QrCode,
  Send, Settings, Shield, Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'wouter';

import { buildProjectRoute, projectSections, type ProjectSection, type ProjectSummary } from './projects';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import type { OperationalStats } from './operations';

const icons: Record<ProjectSection, LucideIcon> = {
  overview: Home, invitation: LayoutTemplate, guests: Users, send: Send, scanner: QrCode, settings: Settings,
};

export function ProjectShell({ project, section, children }: { project: ProjectSummary; section: ProjectSection; children: React.ReactNode }) {
  const sections = projectSections[project.type];
  const { t } = useAppLocale();
  const labels: Record<ProjectSection, string> = project.type === 'party'
    ? { overview: t('event'), invitation: t('designNav'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('more') }
    : { overview: t('overview'), invitation: t('invitation'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('settings') };
  return <div className="project-shell min-h-[100dvh] bg-[#F5F2EC] text-[#17251F] md:grid md:grid-cols-[248px_minmax(0,1fr)]">
    <aside className="project-sidebar hidden min-h-[100dvh] border-r border-[#D9D2C5] bg-[#0C2D24] px-5 py-7 text-[#F9F6F0] md:flex md:flex-col">
      <Link href="/" className="focus-ring text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[#C8A75A]">RSVP</span></Link>
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.06] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#C8A75A]">{t(project.type)} · {t('project')}</p>
        <p className="mt-2 text-sm font-semibold leading-5">{project.name}</p>
        <p className="mt-2 text-[11px] leading-5 text-white/55">{project.date}<br />{project.venue}</p>
      </div>
      <nav className="mt-7 space-y-1" aria-label="Project navigation">{sections.map((item) => {
        const Icon = icons[item];
        return <Link key={item} href={buildProjectRoute(project.type, project.id, item)} className={`focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${section === item ? 'bg-[#C8A75A] text-[#10271F]' : 'text-white/65 hover:bg-white/[.06] hover:text-white'}`}><Icon size={17} />{labels[item]}</Link>;
      })}</nav>
      <div className="mt-auto space-y-2"><AppLanguageControl /><Link href="/admin" className="focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/55 hover:bg-white/[.06] hover:text-white"><Shield size={17} />{t('superAdmin')}</Link></div>
    </aside>
    <div className="min-w-0 pb-24 md:pb-0">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-[#D9D2C5] bg-[#F9F7F2]/95 px-4 backdrop-blur sm:px-7 md:px-10">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8B7040]">{t(project.type)} · {labels[section]}</p></div>
        <div className="flex items-center gap-2 md:hidden"><AppLanguageControl compact /><Link href="/" className="focus-ring rounded-full border border-[#D9D2C5] px-4 py-2 text-xs font-semibold">{t('projects')}</Link></div>
      </header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-7 md:p-10">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid min-h-[72px] border-t border-[#D9D2C5] bg-[#FCFAF6]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }} aria-label="Mobile project navigation">{sections.map((item) => {
      const Icon = icons[item];
      return <Link key={item} href={buildProjectRoute(project.type, project.id, item)} aria-current={section === item ? 'page' : undefined} className={`focus-ring flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[9px] font-semibold ${section === item ? 'text-[#0C2D24]' : 'text-[#756F66]'}`}><Icon size={19} /><span className="max-w-full truncate">{labels[item]}</span></Link>;
    })}</nav>
  </div>;
}

export function ProjectOverview({ project, stats, rsvpDeadline }: { project: ProjectSummary; stats: OperationalStats; rsvpDeadline: string }) {
  const { t } = useAppLocale();
  const items: [string, string, LucideIcon][] = [
    [t('invitation'), t('localInvitationReady'), LayoutTemplate],
    [t('guests'), String(stats.guests), Users],
    [t('invitedSeats'), String(stats.invitedSeats), ListChecks],
    [t('localCheckIns'), String(stats.checkedIn), QrCode],
  ];
  const responses = [[t('accepted'), stats.accepted], [t('declined'), stats.declined], [t('pending'), stats.pending]] as const;
  const actions: [ProjectSection, string, LucideIcon][] = [['invitation', t('invitation'), LayoutTemplate], ['guests', t('guests'), Users], ['send', t('send'), Send], ['scanner', t('scanner'), QrCode]];
  return <div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('eventOverview')}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{project.name}</h1></div><span className="w-fit rounded-full border border-[#D9D2C5] bg-white px-3 py-2 text-[10px] font-semibold text-[#756F66]">{t('localBrowserData')}</span></div><div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><Icon size={18} className="text-[#A4813C]" /><p className="mt-5 text-xs text-[#756F66]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]"><section className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-[#756F66]">{t('eventOverview')}</p><p className="mt-1 font-semibold"><bdi>{project.date}</bdi></p><p className="text-sm text-[#756F66]"><bdi>{project.venue}</bdi></p>{rsvpDeadline && <p className="mt-3 text-xs text-[#756F66]">{t('rsvpDeadline')}: <bdi>{rsvpDeadline}</bdi></p>}</div><CalendarDays className="text-[#A4813C]" /></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E8E2D8] pt-4">{responses.map(([label, value]) => <div key={label}><p className="text-[10px] text-[#756F66]">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div></section><section className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><p className="text-xs font-semibold">{t('quickActions')}</p><div className="mt-4 grid grid-cols-2 gap-2">{actions.map(([section, label, Icon]) => <Link key={section} href={buildProjectRoute(project.type, project.id, section)} className="focus-ring flex min-h-12 items-center gap-2 rounded-xl border border-[#D9D2C5] px-3 text-xs font-semibold hover:border-[#A4813C]"><Icon size={15} className="text-[#A4813C]" />{label}</Link>)}</div></section></div></div>;
}

export function EmptyProjectSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl rounded-3xl border border-[#D9D2C5] bg-white p-7 sm:p-10"><MessageCircle className="text-[#A4813C]" /><h1 className="mt-6 text-3xl font-semibold tracking-[-.04em]">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#756F66]">{children}</p></div>;
}
