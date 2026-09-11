import { FormEvent, useState } from 'react';
import { useParams } from 'wouter';
import { Lock, QrCode, ShieldAlert } from 'lucide-react';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { verifyStaffPin } from '@/backend/staff-scanner';
import { EventScanner } from './EventScanner';

export function StaffScannerPage() {
  const { token: rawToken = '' } = useParams<{ token?: string }>();
  const { t } = useAppLocale();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  const handlePinSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!rawToken || busy) return;

    setBusy(true);
    setError('');

    try {
      const res = await verifyStaffPin(rawToken, pin);

      if (res.success) {
        setIsUnlocked(true);
        if (res.event_title) {
          setEventTitle(res.event_title);
        }
      } else if (res.error === 'locked_out') {
        const mins = res.minutes_remaining ?? 15;
        setError(t('lockoutRemaining').replace('{m}', String(mins)) || t('tooManyAttempts'));
      } else if (res.error === 'incorrect_pin') {
        const remaining = res.attempts_remaining;
        const msg = remaining !== undefined
          ? `${t('incorrectPin')} (${t('attemptsRemaining').replace('{n}', String(remaining))})`
          : t('incorrectPin');
        setError(msg);
      } else if (res.error === 'backend_pending') {
        setError(t('staffBackendPending'));
      } else {
        setError(t('invalidOrExpiredStaffLink'));
      }
    } catch {
      setError(t('invalidOrExpiredStaffLink'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevokedOrExpired = () => {
    setPin('');
    setIsUnlocked(false);
    setError(t('accessExpired'));
  };

  if (!rawToken) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-5">
        <div className="w-full max-w-md rounded-3xl border border-[#F8D8D3] bg-white p-7 text-center shadow-xs">
          <ShieldAlert size={36} className="mx-auto text-[#9C382A]" />
          <h1 className="mt-3 text-lg font-bold text-[#17251F]">{t('invalidOrExpiredStaffLink')}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAF7F2] text-[#17251F]">
      {/* Top minimal staff bar */}
      <header className="border-b border-[#E8E2D8] bg-[#FAF8F4]/95 px-4 sm:px-8 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0C2D24] text-[#D4B363]">
              <QrCode size={18} />
            </span>
            <div>
              <p className="text-xs font-bold leading-tight text-[#17251F]">
                {eventTitle || t('staffScannerBadge')}
              </p>
              <span className="text-[10px] font-semibold text-[#756F66]">
                {t('staffScannerBadge')}
              </span>
            </div>
          </div>
          <AppLanguageControl compact />
        </div>
      </header>

      <main className="mx-auto max-w-xl p-4 sm:p-6">
        {!isUnlocked ? (
          /* PIN Gate View */
          <div className="mt-8 rounded-3xl border border-[#E8E2D8] bg-white p-6 sm:p-8 shadow-xs text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0C2D24]/5 text-[#0C2D24]">
              <Lock size={28} />
            </div>

            <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-[#17251F]">
              {eventTitle ? eventTitle : t('staffScanner')}
            </h1>
            <p className="mt-1 text-xs text-[#756F66]">
              {t('staffScanner')}
            </p>

            <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="staff-pin-input"
                  className="block text-xs font-bold text-[#17251F] mb-2"
                >
                  {t('enterPin')}
                </label>
                <input
                  id="staff-pin-input"
                  data-testid="input-staff-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoFocus
                  dir="ltr"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  placeholder="••••"
                  className="qr-field-inline min-h-14 w-full rounded-2xl px-4 text-center text-3xl font-bold tracking-widest border border-[#D9D2C5]"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  data-testid="text-pin-error"
                  className="rounded-xl bg-[#FDF0ED] p-3 text-xs font-bold text-[#9C382A] border border-[#F8D8D3]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                data-testid="button-continue-pin"
                disabled={busy || !pin.trim()}
                className="qr-button qr-button--primary min-h-12 w-full justify-center text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {busy ? t('loading') : t('continueAction')}
              </button>
            </form>
          </div>
        ) : (
          /* Unlocked Scanner View - PIN retained in runtime memory only */
          <EventScanner
            project={{ name: eventTitle }}
            isStaffMode={true}
            staffToken={rawToken}
            staffPin={pin}
            onStaffRevokedOrExpired={handleRevokedOrExpired}
          />
        )}
      </main>
    </div>
  );
}
