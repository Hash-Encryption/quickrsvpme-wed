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
            className="qr-card group relative flex flex-col justify-between overflow-hidden p-7 sm:p-9 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--qr-primary)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--qr-primary)]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--qr-gold-subtle)] text-[var(--qr-on-gold)] shadow-sm">
                  <Heart size={32} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--qr-primary)] text-white transition group-hover:scale-105">
                  <ArrowRight
                    size={18}
                    className={`transition-transform duration-200 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <h2 className="qr-card-title mt-7 text-2xl font-bold text-[var(--qr-primary)]">
                {t('weddingPlanner')}
              </h2>
              <p className="qr-secondary mt-2 text-sm leading-6">
                {t('weddingPlannerCardSubtitle')}
              </p>
            </div>

            <div className="mt-8 pt-5 border-t border-[var(--qr-divider)] flex items-center justify-between text-xs text-[var(--qr-secondary)] font-medium">
              <span>{t('weddingInvitation')}</span>
              <span className="qr-gold-text font-semibold">9:16 Mobile-First</span>
            </div>
          </Link>

          {/* Party Planner Card */}
          <Link
            href="/planner/party"
            data-testid="link-choose-party"
            className="qr-card group relative flex flex-col justify-between overflow-hidden p-7 sm:p-9 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--qr-primary)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--qr-primary)]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--qr-primary-subtle)] text-[var(--qr-primary)] shadow-sm">
                  <PartyPopper size={32} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--qr-primary)] text-white transition group-hover:scale-105">
                  <ArrowRight
                    size={18}
                    className={`transition-transform duration-200 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <h2 className="qr-card-title mt-7 text-2xl font-bold text-[var(--qr-primary)]">
                {t('partyPlanner')}
              </h2>
              <p className="qr-secondary mt-2 text-sm leading-6">
                {t('partyPlannerCardSubtitle')}
              </p>
            </div>

            <div className="mt-8 pt-5 border-t border-[var(--qr-divider)] flex items-center justify-between text-xs text-[var(--qr-secondary)] font-medium">
              <span>{t('partyEvents')}</span>
              <span className="text-[var(--qr-primary)] font-semibold">Modular Blocks</span>
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
