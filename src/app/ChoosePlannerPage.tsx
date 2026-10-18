import { ArrowRight, Heart, HelpCircle, LogOut, PartyPopper, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { Button, CustomerBottomNav, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { useAuth } from '@/auth/AuthProvider';

export function ChoosePlannerPage() {
  const { t, dir } = useAppLocale();
  const auth = useAuth();

  return (
    <PageShell className="qr-has-bottom-nav">
      <MobileHeader
        title={
          <Link href="/" dir="ltr" className="qr-card-title text-xl font-semibold tracking-[-0.03em]">
            Quick<span className="qr-gold-text">RSVP</span>
          </Link>
        }
        actions={
          <>
            <AppLanguageControl compact />
            <Link href="/account" className="qr-button qr-button--secondary qr-icon-button" aria-label={t('account')}>
              <UserRound size={18} aria-hidden="true" />
            </Link>
            <Button
              variant="secondary"
              className="qr-icon-button"
              onClick={() => void auth.signOut()}
              aria-label={t('signOut')}
            >
              <LogOut size={18} aria-hidden="true" />
            </Button>
          </>
        }
      />

      <main className="qr-container max-w-4xl">
        <header className="text-center pt-4 pb-8 sm:pt-8 sm:pb-12">
          <p className="qr-caption qr-gold-text tracking-[.16em] uppercase font-semibold">
            {t('manageEvents')}
          </p>
          <h1 className="qr-display mt-2 font-display text-4xl sm:text-5xl lg:text-6xl text-[var(--qr-primary)]">
            {t('welcomeTitle')}
          </h1>
          <p className="qr-secondary mt-3 text-sm sm:text-base max-w-md mx-auto">
            {t('choosePlannerSubtitle')}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 mt-2">
          {/* Wedding Planner Card */}
          <Link
            href="/planner/wedding"
            data-testid="link-choose-wedding"
            className="qr-card group relative flex flex-col justify-between overflow-hidden p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#C29B61]/40 focus-visible:outline-2 focus-visible:outline-[var(--qr-primary)]"
          >
            <div>
              {/* Tasteful Visual Header Banner: warm champagne & emerald arch motif */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0C2D24] via-[#143D32] to-[#1F5445] p-5 sm:p-6 text-white shadow-inner">
                <div className="pointer-events-none absolute -end-6 -top-6 h-28 w-28 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 blur-sm" />
                <div className="pointer-events-none absolute end-10 bottom-0 h-16 w-24 rounded-t-full border-t border-s border-e border-[#D4AF37]/30 bg-white/[0.04]" />
                <div className="relative flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#E8D4A8] backdrop-blur-md border border-white/15 shadow-sm">
                    <Heart size={24} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-200 group-hover:scale-110 group-hover:bg-[#D4AF37] group-hover:text-[#0C2D24]">
                    <ArrowRight
                      size={16}
                      className={`transition-transform duration-200 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <div className="relative mt-4">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-[.14em] text-[#E8D4A8]/90">
                    {t('weddingSuite')}
                  </span>
                </div>
              </div>

              <h2 className="qr-card-title mt-5 text-2xl font-bold text-[var(--qr-primary)]">
                {t('weddingPlanner')}
              </h2>
              <p className="qr-secondary mt-1.5 text-sm leading-6">
                {t('weddingPlannerCardSubtitle')}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[rgba(194,155,97,0.16)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--qr-secondary)] font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] px-3 py-1 text-[11px] font-semibold text-[#0C2D24] border border-[rgba(194,155,97,0.22)]">
                {t('weddingBadgeLuxury')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] px-3 py-1 text-[11px] font-semibold text-[#8B7040] border border-[rgba(194,155,97,0.22)]">
                {t('weddingBadgeGuests')}
              </span>
            </div>
          </Link>

          {/* Party Planner Card */}
          <Link
            href="/planner/party"
            data-testid="link-choose-party"
            className="qr-card group relative flex flex-col justify-between overflow-hidden p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#C29B61]/40 focus-visible:outline-2 focus-visible:outline-[var(--qr-primary)]"
          >
            <div>
              {/* Tasteful Visual Header Banner: deep midnight/gold & celebratory motif */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#0F172A] p-5 sm:p-6 text-white shadow-inner">
                <div className="pointer-events-none absolute -end-6 -top-6 h-28 w-28 rounded-full border border-amber-400/20 bg-amber-400/10 blur-sm" />
                <div className="pointer-events-none absolute end-8 -bottom-4 h-20 w-20 rounded-full border border-white/10 bg-white/[0.04]" />
                <div className="relative flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300 backdrop-blur-md border border-white/15 shadow-sm">
                    <PartyPopper size={24} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-200 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-[#111827]">
                    <ArrowRight
                      size={16}
                      className={`transition-transform duration-200 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <div className="relative mt-4">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-[.14em] text-amber-300/90">
                    {t('partyEvents')}
                  </span>
                </div>
              </div>

              <h2 className="qr-card-title mt-5 text-2xl font-bold text-[var(--qr-primary)]">
                {t('partyPlanner')}
              </h2>
              <p className="qr-secondary mt-1.5 text-sm leading-6">
                {t('partyPlannerCardSubtitle')}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[rgba(194,155,97,0.16)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--qr-secondary)] font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] px-3 py-1 text-[11px] font-semibold text-[#0C2D24] border border-[rgba(194,155,97,0.22)]">
                {t('partyBadgeCelebrations')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] px-3 py-1 text-[11px] font-semibold text-[#8B7040] border border-[rgba(194,155,97,0.22)]">
                {t('partyBadgeBranding')}
              </span>
            </div>
          </Link>
        </div>

        <footer className="mt-12 text-center text-xs text-[var(--qr-secondary)] pb-6 flex items-center justify-center gap-2">
          <HelpCircle size={14} aria-hidden="true" />
          <span>{t('support')}</span>
          <span className="mx-1">·</span>
          <Link href="/account" className="underline hover:text-[var(--qr-primary)]">
            {t('manageProfile')}
          </Link>
        </footer>
      </main>

      <CustomerBottomNav active="home" />
    </PageShell>
  );
}
