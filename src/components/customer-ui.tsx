import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, CircleAlert, Inbox } from 'lucide-react';
import { Link } from 'wouter';

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

export function MobileHeader({ title, description, back, actions }: { title: ReactNode; description?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return <header className="qr-header">
    {back && <Link href={back.href} className="qr-button qr-button--ghost qr-icon-button" aria-label={back.label}><ArrowLeft className="qr-back-icon" size={20} aria-hidden="true" /></Link>}
    <div className="qr-header-title">{title}{description && <p className="qr-caption qr-secondary">{description}</p>}</div>
    {actions && <div className="qr-header-actions">{actions}</div>}
  </header>;
}

export function EmptyState({ title, description, icon = <Inbox size={24} aria-hidden="true" />, action, secondaryAction, heading: Heading = 'h2' }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; secondaryAction?: ReactNode; heading?: 'h1' | 'h2' | 'h3' }) {
  return <section className="qr-card qr-state">
    <div className="qr-state-icon">{icon}</div><Heading className="qr-card-title">{title}</Heading>
    {description && <p className="qr-secondary">{description}</p>}
    {(action || secondaryAction) && <div className="qr-state-actions">{action}{secondaryAction}</div>}
  </section>;
}

// Pass localized customer copy, never an Error.message or backend response.
export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <section className="qr-card qr-state" role="alert">
    <CircleAlert className="qr-error-text" size={24} aria-hidden="true" /><h1 className="qr-page-title">{title}</h1>
    {description && <p className="qr-secondary">{description}</p>}{action && <div className="qr-state-actions">{action}</div>}
  </section>;
}

export function LoadingState({ label }: { label: string }) {
  return <div className="qr-loading" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">{label}</span><div aria-hidden="true" className="qr-skeleton qr-skeleton--title" /><div aria-hidden="true" className="qr-skeleton qr-skeleton--card" /><div aria-hidden="true" className="qr-skeleton qr-skeleton--row" /></div>;
}
