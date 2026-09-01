import type { ReactNode } from 'react';
import { Link, Redirect } from 'wouter';

import { useAuth } from './AuthProvider';
import { useAppLocale } from '@/i18n/app-locale';
import { authErrorMessageKey } from '@/backend/errors';

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const auth = useAuth();
  const { t } = useAppLocale();
  if (auth.loading) return <AuthState title={t('loading')} />;
  if (!auth.session) return <Redirect to="/auth" />;
  if (auth.error) return <AuthState title={t('authFailed')} detail={t(authErrorMessageKey(auth.error.code))} action={<div className="flex justify-center gap-2"><button className="focus-ring rounded-full bg-[#0C2D24] px-5 py-3 text-xs font-semibold text-white" onClick={() => void auth.refresh()}>{t('retry')}</button><button className="focus-ring rounded-full border border-[#D9D2C5] px-5 py-3 text-xs font-semibold" onClick={() => void auth.signOut()}>{t('signOut')}</button></div>} />;
  if (admin && auth.dataLoading) return <AuthState title={t('loading')} />;
  if (admin && !auth.admin) return <AuthState title={t('accessDeniedTitle')} detail={t('accessDeniedHelp')} action={<Link href="/" className="focus-ring rounded-full bg-[#0C2D24] px-5 py-3 text-xs font-semibold text-white">{t('backToProjects')}</Link>} />;
  return children;
}

function AuthState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#F5F2EC] p-5 text-[#17251F]"><section className="w-full max-w-md rounded-3xl border border-[#D9D2C5] bg-white p-8 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">QuickRSVP</p><h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">{title}</h1>{detail && <p className="mt-3 text-sm leading-6 text-[#756F66]">{detail}</p>}{action && <div className="mt-6">{action}</div>}</section></main>;
}
