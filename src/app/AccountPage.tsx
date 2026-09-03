import { ArrowLeft, CheckCircle2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

import type { CommercialSummary } from './commercial';
import type { ProductId } from '@/backend/types';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';

const entitlementKeys = { active: 'entitlementActive', suspended: 'entitlementSuspended', cancelled: 'entitlementCancelled', expired: 'entitlementExpired', none: 'notAvailable' } as const;

export function AccountPage({ name, email, commercial, onSave }: { name: string; email: string; commercial: Partial<Record<ProductId, CommercialSummary>>; onSave: (name: string) => Promise<void> }) {
  const { t, dir, locale } = useAppLocale();
  const [displayName, setDisplayName] = useState(name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en') : '—';
  const save = async () => {
    if (!displayName.trim() || displayName.trim() === name) return;
    setStatus('saving');
    try { await onSave(displayName.trim()); setStatus('saved'); }
    catch { setStatus('error'); }
  };
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]">
    <header className="flex min-h-16 items-center justify-between border-b border-[#D9D2C5] bg-[#FAF8F4] px-5 sm:px-10"><Link href="/" className="focus-ring flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''} size={17} />{t('dashboard')}</Link><AppLanguageControl compact /></header>
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('manageProfile')}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{t('account')}</h1><p className="mt-4 text-sm text-[#756F66]">{t('accountHelp')}</p>
      <section className="mt-8 rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><UserRound size={21} /></span><div><p className="text-xs font-semibold text-[#8B7040]">{t('backendConnected')}</p><p className="text-sm" dir="ltr">{email}</p></div></div><label className="mt-7 block text-xs font-semibold" htmlFor="account-name">{t('displayName')}</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="account-name" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus('idle'); }} className="min-h-12 flex-1 rounded-xl border border-[#D9D2C5] px-4" /><button disabled={!displayName.trim() || displayName.trim() === name || status === 'saving'} onClick={() => void save()} className="min-h-12 rounded-full bg-[#0C2D24] px-6 text-xs font-semibold text-white disabled:opacity-40">{status === 'saving' ? t('saving') : t('saveChanges')}</button></div>{status === 'saved' && <p className="mt-3 flex items-center gap-2 text-sm text-[#24634F]" role="status"><CheckCircle2 size={16} />{t('profileUpdated')}</p>}{status === 'error' && <p className="mt-3 text-sm text-[#8c302b]" role="alert">{t('operationFailed')}</p>}</section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">{(['wedding', 'party'] as const).map((product) => { const item = commercial[product]; return <article key={product} className="rounded-3xl border border-[#D9D2C5] bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(product === 'wedding' ? 'weddingAccess' : 'partyAccess')}</p><h2 className="mt-3 text-2xl font-semibold">{t(entitlementKeys[item?.status ?? 'none'])}</h2><dl className="mt-6 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-[#756F66]">{t('entitlementStarts')}</dt><dd className="mt-1 font-semibold">{formatDate(item?.startsAt)}</dd></div><div><dt className="text-[#756F66]">{t('entitlementEnds')}</dt><dd className="mt-1 font-semibold">{formatDate(item?.endsAt)}</dd></div><div><dt className="text-[#756F66]">{t('allowance')}</dt><dd className="mt-1 font-semibold">{item?.unlimited ? t('unlimited') : item?.limit ?? '—'}</dd></div><div><dt className="text-[#756F66]">{t('remaining')}</dt><dd className="mt-1 font-semibold">{item?.unlimited ? t('unlimited') : item?.remaining ?? '—'}</dd></div></dl>{item?.used === null && <p className="mt-4 text-xs text-[#756F66]">{t('usageUnavailable')}</p>}</article>; })}</section>
      <p className="mt-6 rounded-2xl border border-[#D9D2C5] bg-[#FAF8F4] p-5 text-sm leading-6 text-[#756F66]">{t('paymentUnavailable')}</p>
    </main>
  </div>;
}
