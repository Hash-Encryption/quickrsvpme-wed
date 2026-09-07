import {
  Home, LayoutTemplate, MessageCircle, QrCode,
  Send, Settings, Shield, Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'wouter';

import { buildProjectRoute, projectSections, type ProjectSection, type ProjectSummary } from './projects';
import { BottomNavigation, EmptyState, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const icons: Record<ProjectSection, LucideIcon> = {
  overview: Home, invitation: LayoutTemplate, guests: Users, send: Send, scanner: QrCode, settings: Settings,
};

export function ProjectShell({ project, section, children }: { project: ProjectSummary; section: ProjectSection; children: React.ReactNode }) {
  const sections = projectSections[project.type];
  const { t } = useAppLocale();
  const labels: Record<ProjectSection, string> = project.type === 'party'
    ? { overview: t('event'), invitation: t('designNav'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('more') }
    : { overview: t('overview'), invitation: t('invitation'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('settings') };
  return <PageShell className="qr-workspace">
    <aside className="qr-sidebar">
      <Link href="/" dir="ltr" className="focus-ring text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[var(--qr-gold)]">RSVP</span></Link>
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.06] p-4">
        <p className="qr-caption text-[var(--qr-gold)]">{t(project.type)} · {t('project')}</p>
        <p className="mt-2 break-words text-sm font-semibold leading-5">{project.name}</p>
        <p className="mt-2 break-words text-xs leading-5 text-white/80"><bdi>{project.date}</bdi><br />{project.venue}</p>
      </div>
      <nav className="mt-7 space-y-1" aria-label={t('projectNavigation')}>{sections.map((item) => {
        const Icon = icons[item];
        return <Link key={item} href={buildProjectRoute(project.type, project.id, item)} aria-current={section === item ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{labels[item]}</Link>;
      })}</nav>
      <div className="mt-auto space-y-2"><AppLanguageControl /><Link href="/admin" className="focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/80 hover:bg-white/[.06] hover:text-white"><Shield size={17} />{t('superAdmin')}</Link></div>
    </aside>
    <div className="qr-workspace-content">
      <div className="qr-project-header"><MobileHeader title={project.name} description={<>{t(project.type)} · {labels[section]}</>} actions={<div className="flex items-center gap-2 md:hidden"><AppLanguageControl compact /><Link href="/" className="qr-button qr-button--secondary">{t('projects')}</Link></div>} /></div>
      <main className="qr-container">{children}</main>
    </div>
    <BottomNavigation label={t('projectNavigation')}>{sections.map((item) => {
      const Icon = icons[item];
      return <Link key={item} href={buildProjectRoute(project.type, project.id, item)} aria-current={section === item ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span>{labels[item]}</span></Link>;
    })}</BottomNavigation>
  </PageShell>;
}

export function EmptyProjectSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <EmptyState heading="h1" title={title} description={children} icon={<MessageCircle size={24} aria-hidden="true" />} />;
}
