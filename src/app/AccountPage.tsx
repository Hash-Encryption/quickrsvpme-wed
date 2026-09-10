import { useState } from 'react';
import { CheckCircle2, LogOut, UserRound } from 'lucide-react';
import { Link } from 'wouter';

import type { CommercialSummary } from './commercial';
import type { ProductId } from '@/backend/types';
import { Button, CustomerBottomNav, MobileHeader, PageShell, StatusPill } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const entitlementKeys = {
  active: 'entitlementActive',
  suspended: 'entitlementSuspended',
  cancelled: 'entitlementCancelled',
  expired: 'entitlementExpired',
  none: 'notAvailable',
} as const;

export type AccountPageProps = {
  name: string;
  email: string;
  commercial: Partial<Record<ProductId, CommercialSummary>>;
  onSave: (name: string) => Promise<void>;
  onSignOut?: () => void;
  degraded?: boolean;
  onRefresh?: () => Promise<void>;
};

export function AccountPage({
  name,
  email,
  commercial,
  onSave,
  onSignOut,
  degraded = false,
  onRefresh,
}: AccountPageProps) {
  const { t, locale } = useAppLocale();
  const [displayName, setDisplayName] = useState(name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en') : '—';

  const save = async () => {
    if (!displayName.trim() || displayName.trim() === name) return;
    setStatus('saving');
    try {
      await onSave(displayName.trim());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <PageShell className="qr-has-bottom-nav">
      <MobileHeader
        back={{ href: '/', label: t('dashboard') }}
        title={
          <Link href="/" dir="ltr" className="qr-card-title text-xl font-semibold tracking-[-0.03em]">
            Quick<span className="qr-gold-text">RSVP</span>
          </Link>
        }
        actions={
          <>
            <AppLanguageControl compact />
            {onSignOut && (
              <Button
                variant="secondary"
                className="qr-icon-button"
                onClick={onSignOut}
                aria-label={t('signOut')}
              >
                <LogOut size={18} aria-hidden="true" />
              </Button>
            )}
          </>
        }
      />

      <main className="qr-container max-w-4xl">
        <header className="pt-2 pb-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] qr-gold-text">
            {t('manageProfile')}
          </p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-semibold qr-display">
            {t('account')}
          </h1>
          <p className="mt-2 text-sm text-[var(--qr-secondary)]">
            {t('accountHelp')}
          </p>
        </header>

        {degraded && (
          <div
            className="mb-6 qr-notice qr-notice--warning flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div>
              <p className="font-semibold text-sm">{t('entitlementsLoadFailed')}</p>
              <p className="text-xs opacity-90 mt-0.5">{t('operationFailed')}</p>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="qr-button qr-button--secondary self-start sm:self-auto text-xs font-semibold"
              >
                {t('retry')}
              </button>
            )}
          </div>
        )}

        {/* Profile Card */}
        <section className="qr-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--qr-primary)] text-[var(--qr-gold)]">
                <UserRound size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold qr-gold-text">{t('backendConnected')}</p>
                <p className="text-sm font-medium" dir="ltr">{email}</p>
              </div>
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="qr-button qr-button--ghost self-start sm:self-auto text-xs text-[var(--qr-secondary)] hover:text-[var(--qr-primary)] flex items-center gap-1.5"
              >
                <LogOut size={15} aria-hidden="true" />
                {t('signOut')}
              </button>
            )}
          </div>

          <div className="mt-7 border-t border-[var(--qr-divider)] pt-6">
            <label className="block text-xs font-semibold text-[var(--qr-primary)]" htmlFor="account-name">
              {t('displayName')}
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="account-name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setStatus('idle');
                }}
                className="qr-field flex-1"
              />
              <Button
                disabled={!displayName.trim() || displayName.trim() === name || status === 'saving'}
                loading={status === 'saving'}
                onClick={() => void save()}
                className="sm:self-auto"
              >
                {t('saveChanges')}
              </Button>
            </div>
            {status === 'saved' && (
              <p className="mt-3 flex items-center gap-2 text-sm text-[var(--qr-success)]" role="status">
                <CheckCircle2 size={16} aria-hidden="true" />
                {t('profileUpdated')}
              </p>
            )}
            {status === 'error' && (
              <p className="mt-3 text-sm text-[var(--qr-error)]" role="alert">
                {t('operationFailed')}
              </p>
            )}
          </div>
        </section>

        {/* Commercial & Entitlement Summaries */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {(['wedding', 'party'] as const).map((product) => {
            const item = commercial[product];
            const pillTone =
              item?.status === 'active'
                ? 'success'
                : item?.status === 'suspended'
                  ? 'warning'
                  : item?.status === 'expired' || item?.status === 'cancelled'
                    ? 'error'
                    : 'neutral';

            return (
              <article key={product} className="qr-card">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[.16em] qr-gold-text">
                    {t(product === 'wedding' ? 'weddingAccess' : 'partyAccess')}
                  </p>
                  <StatusPill tone={pillTone}>
                    {t(entitlementKeys[item?.status ?? 'none'])}
                  </StatusPill>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-[var(--qr-secondary)]">{t('entitlementStarts')}</dt>
                    <dd className="mt-1 font-semibold text-[var(--qr-primary)]">
                      {formatDate(item?.startsAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--qr-secondary)]">{t('entitlementEnds')}</dt>
                    <dd className="mt-1 font-semibold text-[var(--qr-primary)]">
                      {formatDate(item?.endsAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--qr-secondary)]">{t('allowance')}</dt>
                    <dd className="mt-1 font-semibold text-[var(--qr-primary)]">
                      {item?.unlimited ? t('unlimited') : item?.limit ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--qr-secondary)]">{t('remaining')}</dt>
                    <dd className="mt-1 font-semibold text-[var(--qr-primary)]">
                      {item?.unlimited ? t('unlimited') : item?.remaining ?? '—'}
                    </dd>
                  </div>
                </dl>
                {item?.used === null && (
                  <p className="mt-4 text-xs text-[var(--qr-secondary)]">{t('usageUnavailable')}</p>
                )}
              </article>
            );
          })}
        </section>

        {/* Truthful Payment Notice */}
        <p className="mt-6 qr-card bg-[var(--qr-subtle)] text-xs sm:text-sm leading-relaxed text-[var(--qr-secondary)] border-[var(--qr-divider)]">
          {t('paymentUnavailable')}
        </p>
      </main>

      <CustomerBottomNav active="account" />
    </PageShell>
  );
}
