import type { ReactNode } from 'react';
import { Link, Redirect } from 'wouter';

import { ErrorState, LoadingState, PageShell } from '@/components/customer-ui';
import { useAuth } from './AuthProvider';
import { useAppLocale } from '@/i18n/app-locale';
import { authErrorMessageKey } from '@/backend/errors';

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const auth = useAuth();
  const { t } = useAppLocale();
  if (auth.loading) return <PageShell className="qr-center"><LoadingState label={t('loading')} /></PageShell>;
  if (!auth.session) return <Redirect to="/auth" />;
  if (auth.error) return <AuthState title={t('authFailed')} detail={t(authErrorMessageKey(auth.error.code))} action={<div className="flex flex-wrap justify-center gap-2"><button className="qr-button qr-button--primary" onClick={() => void auth.refresh()}>{t('retry')}</button><button className="qr-button qr-button--secondary" onClick={() => void auth.signOut()}>{t('signOut')}</button></div>} />;
  if (admin && auth.dataLoading) return <PageShell className="qr-center"><LoadingState label={t('loading')} /></PageShell>;
  if (admin && !auth.admin) return <AuthState title={t('accessDeniedTitle')} detail={t('accessDeniedHelp')} action={<Link href="/" className="qr-button qr-button--primary">{t('backToProjects')}</Link>} />;
  return children;
}

function AuthState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <PageShell className="qr-center"><ErrorState title={title} description={detail} action={action} /></PageShell>;
}
