import { BarChart3, CalendarDays, CreditCard, Headphones, LayoutTemplate, Shield, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'wouter';

import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { adminSections, buildAdminRoute, buildProjectRoute, type AdminSection, type ProjectSummary } from '@/app/projects';
import { partyTemplates } from '@/party/model';
import { WeddingTemplateRegistry } from '@/wedding/model';

export type AdminEventRecord = ProjectSummary & { guests: number; checkedIn: number };
export type AdminSummary = { projects: number; guests: number; accepted: number; declined: number; pending: number; checkedIn: number };

const icons: Record<AdminSection, LucideIcon> = { customers: Users, events: CalendarDays, templates: LayoutTemplate, usage: BarChart3, support: Headphones, subscriptions: CreditCard };

export function AdminPage({ section, events, summary, saveStatus, storageError, engineStorageAvailable }: { section: AdminSection; events: AdminEventRecord[]; summary: AdminSummary; saveStatus: string; storageError: string; engineStorageAvailable: boolean }) {
  const { t, locale, dir } = useAppLocale();
  return <div className="min-h-[100dvh] bg-[#F3F0E9] text-[#17251F] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="hidden min-h-[100dvh] flex-col bg-[#0C2D24] p-5 text-white md:flex"><Link href="/" className="text-xl font-semibold">Quick<span className="text-[#D4B363]">RSVP</span></Link><p className="mt-2 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">{t('superAdmin')} · {t('localDemo')}</p><nav className="mt-8 space-y-1" aria-label={t('superAdmin')}>{adminSections.map((item) => { const Icon = icons[item]; return <Link key={item} href={buildAdminRoute(item)} aria-current={section === item ? 'page' : undefined} className={`focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${section === item ? 'bg-[#D4B363] text-[#10271F]' : 'text-white/65 hover:bg-white/[.06]'}`}><Icon size={16} />{t(item)}</Link>; })}</nav><div className="mt-auto space-y-2"><AppLanguageControl /><Link href="/" className="focus-ring flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-white/60"><Shield size={16} />{t('projects')}</Link></div></aside>
    <div className="min-w-0"><header className="sticky top-0 z-30 border-b border-[#D9D2C5] bg-[#FAF8F4]/95 px-4 py-3 backdrop-blur md:px-8"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold md:hidden">Quick<span className="text-[#A4813C]">RSVP</span></p><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8B7040]">{t('superAdmin')} · {t('localDemo')}</p></div><div className="flex items-center gap-2"><AppLanguageControl compact /><Link href="/" className="focus-ring rounded-full border border-[#D9D2C5] px-3 py-2 text-xs font-semibold">{t('projects')}</Link></div></div><nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label={t('superAdmin')}>{adminSections.map((item) => <Link key={item} href={buildAdminRoute(item)} aria-current={section === item ? 'page' : undefined} className={`focus-ring shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${section === item ? 'bg-[#0C2D24] text-white' : 'border border-[#D9D2C5] bg-white'}`}>{t(item)}</Link>)}</nav></header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-7 md:p-10"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('frontendAdmin')}</p><h1 className="mt-2 break-words text-4xl font-semibold tracking-[-.05em] sm:text-5xl">{t(section)}</h1></div><span className="w-fit rounded-full border border-[#D9D2C5] bg-white px-3 py-2 text-[10px] font-semibold text-[#756F66]">{t('thisBrowser')}</span></div><div className="mt-8">{section === 'customers' && <Customers summary={summary} />}{section === 'events' && <Events events={events} />}{section === 'templates' && <Templates />}{section === 'usage' && <Usage summary={summary} />}{section === 'support' && <Support locale={locale} dir={dir} projects={summary.projects} saveStatus={saveStatus} storageError={storageError} engineStorageAvailable={engineStorageAvailable} />}{section === 'subscriptions' && <Subscriptions />}</div></main>
    </div>
  </div>;
}

function Customers({ summary }: { summary: AdminSummary }) {
  const { t } = useAppLocale();
  return <section className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Users className="text-[#A4813C]" /><p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#8B7040]">{t('demoWorkspace')}</p><h2 className="mt-2 text-2xl font-semibold">QuickRSVP</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><Metric label={t('events')} value={summary.projects} /><Metric label={t('guests')} value={summary.guests} /></div><p className="mt-6 border-t border-[#E8E2D8] pt-5 text-sm leading-6 text-[#756F66]">{t('customerBoundary')}</p></section>;
}

function Events({ events }: { events: AdminEventRecord[] }) {
  const { t } = useAppLocale();
  return <div className="grid gap-3">{events.map((event) => <article key={`${event.type}-${event.id}`} className="rounded-2xl border border-[#D9D2C5] bg-white p-5 sm:flex sm:items-center sm:gap-5"><CalendarDays className="shrink-0 text-[#A4813C]" /><div className="mt-3 min-w-0 flex-1 sm:mt-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8B7040]">{t(event.type)}</p><h2 className="break-words font-semibold">{event.name}</h2><p className="mt-1 break-words text-xs text-[#756F66]"><bdi>{event.date} · {event.venue}</bdi></p></div><div className="mt-4 flex gap-4 text-xs text-[#756F66] sm:mt-0"><span>{event.guests} {t('guests')}</span><span>{event.checkedIn} {t('checkedIn')}</span></div><Link href={buildProjectRoute(event.type, event.id, 'overview')} className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold sm:mt-0">{t('overview')}</Link></article>)}</div>;
}

function Templates() {
  const { t, locale } = useAppLocale();
  const templates = [...Object.values(WeddingTemplateRegistry).map((item) => ({ id: item.id, type: t('wedding'), name: locale === 'ar' ? item.nameAr : item.name, note: `9:16 · ${item.scenes.length} ${t('scenes')}` })), ...Object.values(partyTemplates).map((item) => ({ id: item.id, type: t('party'), name: locale === 'ar' ? item.nameAr : item.name, note: locale === 'ar' ? item.descriptionAr : item.description }))];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article key={template.id} className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><LayoutTemplate className="text-[#A4813C]" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[.12em] text-[#8B7040]">{template.type}</p><h2 className="mt-1 font-semibold">{template.name}</h2><p className="mt-2 text-xs leading-5 text-[#756F66]">{template.note}</p><p className="mt-4 font-mono text-[10px] text-[#756F66]" dir="ltr">{template.id}</p></article>)}</div>;
}

function Usage({ summary }: { summary: AdminSummary }) {
  const { t } = useAppLocale();
  const values = [[t('events'), summary.projects], [t('guests'), summary.guests], [t('accepted'), summary.accepted], [t('declined'), summary.declined], [t('pending'), summary.pending], [t('localCheckIns'), summary.checkedIn]] as const;
  return <div><p className="mb-5 text-sm text-[#756F66]">{t('usageBoundary')}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{values.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div></div>;
}

function Support({ locale, dir, projects, saveStatus, storageError, engineStorageAvailable }: { locale: string; dir: string; projects: number; saveStatus: string; storageError: string; engineStorageAvailable: boolean }) {
  const { t } = useAppLocale();
  const rows = [[t('appLanguage'), locale], [t('direction'), dir], [t('events'), String(projects)], [t('weddingWorkspace'), saveStatus], [t('browserPersistence'), engineStorageAvailable ? 'IndexedDB + localStorage' : t('sessionOnlyData')], [t('publicRoute'), '/i/:token'], [t('scanner'), t('manualLocalOnly')]];
  return <section className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Headphones className="text-[#A4813C]" /><h2 className="mt-5 text-xl font-semibold">{t('readOnlyDiagnostics')}</h2><div className="mt-6 divide-y divide-[#E8E2D8]">{rows.map(([label, value]) => <div key={label} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between"><span className="text-[#756F66]">{label}</span><bdi className="font-medium">{value}</bdi></div>)}</div>{storageError && <p className="mt-5 rounded-xl bg-[#b4534b]/10 p-3 text-sm text-[#8c302b]">{storageError}</p>}<p className="mt-5 text-sm leading-6 text-[#756F66]">{t('supportBoundary')}</p></section>;
}

function Subscriptions() {
  const { t } = useAppLocale();
  return <section className="rounded-3xl border border-dashed border-[#C8BCA8] bg-white p-8 text-center sm:p-12"><CreditCard className="mx-auto text-[#A4813C]" /><h2 className="mt-5 text-2xl font-semibold">{t('notImplemented')}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#756F66]">{t('subscriptionsBoundary')}</p></section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><p className="text-xs text-[#756F66]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}
