import { BarChart3, CalendarDays, CreditCard, Headphones, LayoutTemplate, Users } from 'lucide-react';
import { Link } from 'wouter';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

export function AdminPage() {
  const { t } = useAppLocale();
  const areas = [[t('customers'), t('customersHelp'), Users], [t('events'), t('eventsHelp'), CalendarDays], [t('templates'), t('templatesHelp'), LayoutTemplate], [t('usage'), t('usageHelp'), BarChart3], [t('support'), t('supportHelp'), Headphones], [t('subscriptions'), t('subscriptionsHelp'), CreditCard]] as const;
  return <div className="min-h-[100dvh] bg-[#0C2D24] px-5 py-8 text-[#F9F6F0] sm:px-10"><header className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-xl font-semibold">Quick<span className="text-[#D4B363]">RSVP</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">{t('superAdmin')}</p></div><div className="flex items-center gap-2"><AppLanguageControl compact /><Link href="/" className="focus-ring rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">{t('projects')}</Link></div></header><main className="mx-auto max-w-6xl py-12"><h1 className="text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{t('adminTitle')}</h1><p className="mt-5 max-w-xl text-sm leading-6 text-white/55">{t('adminHelp')}</p><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{areas.map(([title, note, Icon]) => <section key={title} className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><Icon size={19} className="text-[#D4B363]" /><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-white/45">{note}</p></section>)}</div></main></div>;
}
