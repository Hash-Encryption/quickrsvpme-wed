import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, CircleAlert, Heart, Home, Inbox, PartyPopper, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { useAppLocale } from '@/i18n/app-locale';

// Customer controls deliberately do not replace invitation-renderer controls.
export function Button({ variant = 'primary', loading = false, className = '', disabled, children, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`qr-button qr-button--${variant} ${className}`}>
    {loading && <span className="qr-progress" aria-hidden="true" />}{children}
  </button>;
}

export function StatusPill({ tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info' }) {
  return <span {...props} className={`qr-pill qr-pill--${tone} ${className}`} />;
}

export function Chip({ selected, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return <button {...props} type="button" aria-pressed={selected} className={`qr-chip ${className}`} />;
}

export function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`qr-customer qr-page ${className}`}>{children}</div>;
}

export function BottomNavigation({ label, children }: { label: string; children: ReactNode }) {
  return <nav className="qr-bottom-nav" aria-label={label}>{children}</nav>;
}

export function CustomerBottomNav({ active }: { active: 'home' | 'wedding' | 'party' | 'account' }) {
  const { t } = useAppLocale();
  return (
    <BottomNavigation label={t('projects')}>
      <Link href="/" aria-current={active === 'home' ? 'page' : undefined}>
        <Home size={18} aria-hidden="true" />
        <span>{t('dashboard')}</span>
      </Link>
      <Link href="/planner/wedding" aria-current={active === 'wedding' ? 'page' : undefined}>
        <Heart size={18} aria-hidden="true" />
        <span>{t('wedding')}</span>
      </Link>
      <Link href="/planner/party" aria-current={active === 'party' ? 'page' : undefined}>
        <PartyPopper size={18} aria-hidden="true" />
        <span>{t('party')}</span>
      </Link>
      <Link href="/account" aria-current={active === 'account' ? 'page' : undefined}>
        <UserRound size={18} aria-hidden="true" />
        <span>{t('account')}</span>
      </Link>
    </BottomNavigation>
  );
}

export function MobileHeader({ title, description, back, actions }: { title: ReactNode; description?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="qr-header">
      {back && (
        <Link
          href={back.href}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 border border-black/[0.06] shadow-xs text-[var(--qr-primary)] hover:bg-white active:scale-95 transition"
          aria-label={back.label}
        >
          <ArrowLeft className="qr-back-icon" size={17} aria-hidden="true" />
        </Link>
      )}
      <div className="qr-header-title flex items-center gap-2 min-w-0">
        <div className="font-semibold text-[15px] text-[var(--qr-primary)] truncate">{title}</div>
        {description && (
          <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-[var(--qr-secondary)] truncate shrink-0">
            {description}
          </span>
        )}
      </div>
      {actions && <div className="qr-header-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description, icon = <Inbox size={28} aria-hidden="true" />, action, secondaryAction, heading: Heading = 'h2' }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; secondaryAction?: ReactNode; heading?: 'h1' | 'h2' | 'h3' }) {
  return <section className="qr-state p-6 sm:p-10 text-center max-w-lg mx-auto">
    <div className="qr-state-icon flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--qr-gold-subtle)] text-[var(--qr-on-gold)] shadow-xs">{icon}</div>
    <Heading className="qr-card-title mt-4 text-xl font-bold text-[var(--qr-primary)]">{title}</Heading>
    {description && <p className="qr-secondary mt-2 text-sm leading-relaxed max-w-md">{description}</p>}
    {(action || secondaryAction) && <div className="qr-state-actions mt-6 flex flex-wrap justify-center gap-3">{action}{secondaryAction}</div>}
  </section>;
}

// Pass localized customer copy, never an Error.message or backend response.
export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <section className="qr-card qr-state p-8 sm:p-12 text-center max-w-lg mx-auto border-[var(--qr-error)]/30" role="alert">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--qr-error-subtle)] text-[var(--qr-error)] shadow-xs">
      <CircleAlert size={28} aria-hidden="true" />
    </div>
    <h1 className="qr-page-title mt-4 text-xl font-bold text-[var(--qr-primary)]">{title}</h1>
    {description && <p className="qr-secondary mt-2 text-sm leading-relaxed max-w-md">{description}</p>}
    {action && <div className="qr-state-actions mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
  </section>;
}

export function LoadingState({ label }: { label: string }) {
  return <div className="qr-loading" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">{label}</span><div aria-hidden="true" className="qr-skeleton qr-skeleton--title" /><div aria-hidden="true" className="qr-skeleton qr-skeleton--card" /><div aria-hidden="true" className="qr-skeleton qr-skeleton--row" /></div>;
}
