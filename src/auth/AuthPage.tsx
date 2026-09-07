import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';

import { signIn, signUp } from '@/backend/auth';
import { authErrorMessageKey, toBackendError } from '@/backend/errors';
import { Button, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { useAuth } from './AuthProvider';
import { anonymousDesignTransferFailedEvent, anonymousDesignTransferKey, anonymousDesignTransferResultKey, anonymousDesignTransferredEvent, readTransferredDraftResult } from '@/wedding/anonymous-transfer';

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
      if (sessionStorage.getItem(anonymousDesignTransferKey)) return;
      const result = readTransferredDraftResult(sessionStorage.getItem(anonymousDesignTransferResultKey));
      if (result) {
        sessionStorage.removeItem(anonymousDesignTransferResultKey);
        navigate(`/drafts/${result.product}/${result.draftId}`, { replace: true });
      } else navigate('/', { replace: true });
    };
    if (!auth.loading && auth.session) finish();
    window.addEventListener(anonymousDesignTransferredEvent, finish);
    const failed = (event: Event) => {
      console.error('Anonymous invitation transfer failed', (event as CustomEvent<unknown>).detail);
      setMessage(t('operationFailed'));
    };
    window.addEventListener(anonymousDesignTransferFailedEvent, failed);
    return () => { window.removeEventListener(anonymousDesignTransferredEvent, finish); window.removeEventListener(anonymousDesignTransferFailedEvent, failed); };
  }, [auth.loading, auth.session, navigate, t]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setMessage('');
    try {
      if (mode === 'signIn') await signIn(email.trim(), password);
      else if (await signUp(email.trim(), password, displayName)) setMessage(t('checkEmail'));
    } catch (caught) {
      const error = toBackendError(caught);
      setMessage(t(authErrorMessageKey(error.code)));
    } finally { setSubmitting(false); }
  };

  return <PageShell>
    <MobileHeader title={<Link href="/i/demo" dir="ltr" className="text-xl font-semibold">Quick<span className="qr-gold-text">RSVP</span></Link>} actions={<AppLanguageControl compact />} />
    <main className="qr-container"><section className="qr-card qr-auth-card p-7 sm:p-9 shadow-md">
      <p className="qr-caption qr-gold-text">{t('account')}</p><h1 className="qr-page-title mt-2">{t(mode)}</h1><p className="qr-secondary mt-3">{t('authHelp')}</p>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        {mode === 'signUp' && <label className="qr-label">{t('displayName')}<input required autoComplete="name" maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="qr-field" /></label>}
        <label className="qr-label">{t('email')}<input required type="email" inputMode="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="qr-field" /></label>
        <label className="qr-label">{t('password')}<input required minLength={6} type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="qr-field" /></label>
        {message && <div className="qr-notice" role="status"><p>{message}</p>{auth.session && sessionStorage.getItem(anonymousDesignTransferKey) && <Button variant="secondary" onClick={() => window.location.reload()} className="mt-2">{t('retry')}</Button>}</div>}
        <Button type="submit" loading={submitting} className="w-full">{submitting ? t('loading') : t(mode)}</Button>
      </form>
      <Button variant="ghost" className="mt-5 w-full" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setMessage(''); }}>{t(mode === 'signIn' ? 'needAccount' : 'haveAccount')}</Button>
    </section></main>
  </PageShell>;
}
