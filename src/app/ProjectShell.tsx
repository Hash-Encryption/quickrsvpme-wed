import { useState } from 'react';
import {
  Home, LayoutTemplate, MessageCircle, MoreHorizontal, QrCode,
  Send, Settings, Shield, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'wouter';

import { buildProjectRoute, projectSections, type ProjectSection, type ProjectSummary } from './projects';
import { BottomNavigation, EmptyState, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const icons: Record<ProjectSection, LucideIcon> = {
  overview: Home,
  invitation: LayoutTemplate,
  guests: Users,
  send: Send,
  scanner: QrCode,
  settings: Settings,
};

const primarySections: readonly ProjectSection[] = ['overview', 'invitation', 'guests', 'send'];
const overflowSections: readonly ProjectSection[] = ['scanner', 'settings'];

export function ProjectShell({ project, section, children }: { project: ProjectSummary; section: ProjectSection; children: React.ReactNode }) {
  const sections = projectSections[project.type];
  const { t } = useAppLocale();
  const [moreOpen, setMoreOpen] = useState(false);

  const labels: Record<ProjectSection, string> = project.type === 'party'
    ? { overview: t('event'), invitation: t('designNav'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('settings') }
    : { overview: t('overview'), invitation: t('invitation'), guests: t('guests'), send: t('send'), scanner: t('scanner'), settings: t('settings') };

  const isOverflowActive = overflowSections.includes(section);

  // Contextual back destination
  const backTarget = section === 'overview'
    ? {
        href: project.type === 'wedding' ? '/planner/wedding' : '/planner/party',
        label: t(project.type === 'wedding' ? 'myWeddingsTitle' : 'myPartiesTitle'),
      }
    : {
        href: buildProjectRoute(project.type, project.id, 'overview'),
        label: labels.overview,
      };

  return (
    <PageShell className="qr-workspace">
      {/* Desktop Sidebar */}
      <aside className="qr-sidebar">
        <Link href="/" dir="ltr" className="focus-ring text-xl font-semibold tracking-[-.04em]">
          Quick<span className="text-[var(--qr-gold)]">RSVP</span>
        </Link>
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.06] p-4">
          <p className="qr-caption text-[var(--qr-gold)]">{t(project.type)} · {t('project')}</p>
          <p className="mt-2 break-words text-sm font-semibold leading-5">{project.name}</p>
          <p className="mt-2 break-words text-xs leading-5 text-white/80">
            <bdi>{project.date}</bdi><br />{project.venue}
          </p>
        </div>
        <nav className="mt-7 space-y-1" aria-label={t('projectNavigation')}>
          {sections.map((item) => {
            const Icon = icons[item];
            return (
              <Link
                key={item}
                href={buildProjectRoute(project.type, project.id, item)}
                aria-current={section === item ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                {labels[item]}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2">
          <AppLanguageControl />
          <Link
            href="/admin"
            className="focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/80 hover:bg-white/[.06] hover:text-white"
          >
            <Shield size={17} />
            {t('superAdmin')}
          </Link>
        </div>
      </aside>

      {/* Main Workspace Content */}
      <div className="qr-workspace-content">
        <div className="qr-project-header">
          <MobileHeader
            back={backTarget}
            title={project.name}
            description={<>{t(project.type)} · {labels[section]}</>}
            actions={
              <div className="flex items-center gap-2 md:hidden">
                <AppLanguageControl compact />
                <Link
                  href={project.type === 'wedding' ? '/planner/wedding' : '/planner/party'}
                  className="qr-button qr-button--secondary text-xs"
                >
                  {t('projects')}
                </Link>
              </div>
            }
          />
        </div>
        <main className="qr-container">{children}</main>
      </div>

      {/* Mobile Overflow Drawer / Sheet */}
      <div
        id="mobile-nav-overflow"
        className={`md:hidden ${moreOpen ? 'fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs' : 'hidden'}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMoreOpen(false);
        }}
      >
        <div className="w-full rounded-t-3xl border-t border-[#E8E2D8] bg-white p-5 shadow-2xl space-y-3 pb-8">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
              {t('moreNavigation')}
            </p>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#756F66] hover:bg-[#F5F2EC]"
              aria-label={t('closeMenu')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {overflowSections.map((item) => {
              const Icon = icons[item];
              return (
                <Link
                  key={item}
                  href={buildProjectRoute(project.type, project.id, item)}
                  onClick={() => setMoreOpen(false)}
                  aria-current={section === item ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3.5 text-xs font-bold transition ${
                    section === item
                      ? 'border-[var(--qr-primary)] bg-[var(--qr-primary-subtle)] text-[var(--qr-primary)]'
                      : 'border-[#E8E2D8] bg-[#FAF8F4] text-[#17251F] hover:border-[var(--qr-primary)]'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{labels[item]}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation (4 Primary Tabs + More) */}
      <BottomNavigation label={t('projectNavigation')}>
        {primarySections.map((item) => {
          const Icon = icons[item];
          return (
            <Link
              key={item}
              href={buildProjectRoute(project.type, project.id, item)}
              aria-current={section === item ? 'page' : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{labels[item]}</span>
            </Link>
          );
        })}

        {/* More Tab Button */}
        <button
          type="button"
          data-testid="button-mobile-nav-more"
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
          aria-controls="mobile-nav-overflow"
          className={`flex min-w-0 min-h-[64px] flex-col items-center justify-center gap-1 p-1 rounded-xl text-[0.6875rem] font-semibold transition ${
            isOverflowActive ? 'bg-[var(--qr-primary-subtle)] text-[var(--qr-primary)]' : 'text-[#756F66] hover:text-[var(--qr-primary)]'
          }`}
        >
          <div className="relative">
            <MoreHorizontal size={19} aria-hidden="true" />
            {isOverflowActive && (
              <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-[var(--qr-primary)]" />
            )}
          </div>
          <span>{isOverflowActive ? labels[section] : t('moreNavigation')}</span>
        </button>
      </BottomNavigation>
    </PageShell>
  );
}

export function EmptyProjectSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <EmptyState heading="h1" title={title} description={children} icon={<MessageCircle size={24} aria-hidden="true" />} />;
}
