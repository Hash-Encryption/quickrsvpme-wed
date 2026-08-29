import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';

import { signIn, signUp } from '@/backend/auth';
import { toBackendError } from '@/backend/errors';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { useAuth } from './AuthProvider';
import { anonymousWeddingTransferKey, anonymousWeddingTransferResultKey, anonymousWeddingTransferredEvent } from '@/wedding/anonymous-transfer';

export function AuthPage() {
  const auth = useAuth();
  const { t } = useAppLocale();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const finish = () => {
      if (sessionStorage.getItem(anonymousWeddingTransferKey) === '1') return;
      const eventId = sessionStorage.getItem(anonymousWeddingTransferResultKey);
      if (eventId) {
        sessionStorage.removeItem(anonymousWeddingTransferResultKey);
        navigate(`/weddings/${eventId}/invitation`, { replace: true });
      } else navigate('/', { replace: true });
    };
    if (!auth.loading && auth.session) finish();
    window.addEventListener(anonymousWeddingTransferredEvent, finish);
    return () => window.removeEventListener(anonymousWeddingTransferredEvent, finish);
  }, [auth.loading, auth.session, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setMessage('');
    try {
      if (mode === 'signIn') await signIn(email.trim(), password);
      else if (await signUp(email.trim(), password, displayName)) setMessage(t('checkEmail'));
    } catch (caught) {
      const error = toBackendError(caught);
      setMessage(t(error.code === 'network' ? 'networkError' : 'authError'));
    } finally { setSubmitting(false); }
  };

  return <main className="min-h-[100dvh] bg-[#F5F2EC] p-5 text-[#17251F] sm:p-10"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/i/demo" className="text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[#A4813C]">RSVP</span></Link><AppLanguageControl compact /></div><section className="mx-auto mt-12 w-full max-w-md rounded-3xl border border-[#D9D2C5] bg-white p-7 shadow-sm sm:p-9"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('account')}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em]">{t(mode)}</h1><p className="mt-3 text-sm leading-6 text-[#756F66]">{t('authHelp')}</p><form className="mt-7 space-y-4" onSubmit={submit}>{mode === 'signUp' && <label className="block text-xs font-semibold">{t('displayName')}<input required maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="focus-ring mt-2 min-h-12 w-full rounded-2xl border border-[#D9D2C5] px-4 text-sm" /></label>}<label className="block text-xs font-semibold">{t('email')}<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="focus-ring mt-2 min-h-12 w-full rounded-2xl border border-[#D9D2C5] px-4 text-sm" /></label><label className="block text-xs font-semibold">{t('password')}<input required minLength={6} type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-2 min-h-12 w-full rounded-2xl border border-[#D9D2C5] px-4 text-sm" /></label>{message && <p className="rounded-2xl bg-[#F5F2EC] p-3 text-sm" role="status">{message}</p>}<button disabled={submitting} className="focus-ring min-h-12 w-full rounded-full bg-[#0C2D24] px-5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? t('loading') : t(mode)}</button></form><button className="focus-ring mt-5 w-full rounded-full px-4 py-3 text-xs font-semibold text-[#8B7040]" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setMessage(''); }}>{t(mode === 'signIn' ? 'needAccount' : 'haveAccount')}</button></section></main>;
}
