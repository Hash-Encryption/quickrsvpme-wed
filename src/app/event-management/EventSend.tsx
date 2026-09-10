import { useEffect, useState } from 'react';
import {
  Check, Copy, ExternalLink, Link2, MessageCircle,
  QrCode, Search, Send, ShieldCheck, UserCheck, Users
} from 'lucide-react';
import { Link } from 'wouter';

import { createGeneralInvitation, listGuests, rotatePersonalInvitation } from '@/backend/phase2';
import type { EventGuest } from '@/backend/types';
import { useAppLocale } from '@/i18n/app-locale';
import { getWhatsAppShareUrl } from '@/wedding/model';
import { invitationUrl } from '../operations';
import { buildProjectRoute, type ProjectSummary } from '../projects';

export function EventSend({ project }: { project: ProjectSummary }) {
  const { t, dir } = useAppLocale();
  const [generalToken, setGeneralToken] = useState('');
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      createGeneralInvitation(project.id).catch(() => ''),
      listGuests(project.id).catch(() => []),
    ]).then(([genToken, guestList]) => {
      if (!active) return;
      setGeneralToken(genToken);
      setGuests(guestList);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [project.id]);

  const generalUrl = generalToken
    ? invitationUrl(window.location.origin, import.meta.env.BASE_URL, generalToken)
    : '';

  // Copy with temporary feedback
  const handleCopy = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      setError(t('operationFailed'));
    }
  };

  // Strict token isolation: Memoize and retrieve personal token strictly by guest.id
  const getGuestPersonalUrl = async (guest: EventGuest): Promise<string> => {
    let token = tokens[guest.id] || (guest as unknown as { token?: string }).token;
    if (!token) {
      token = await rotatePersonalInvitation(guest.id);
      if (token) {
        const resolvedToken = token;
        setTokens((prev) => ({ ...prev, [guest.id]: resolvedToken }));
      }
    }
    return token ? invitationUrl(window.location.origin, import.meta.env.BASE_URL, token) : '';
  };

  const handleGuestWhatsApp = async (guest: EventGuest) => {
    setBusy(`wa-${guest.id}`);
    try {
      const personalUrl = await getGuestPersonalUrl(guest);
      const waUrl = getWhatsAppShareUrl(
        project.type === 'wedding' ? 'wedding' : 'standard',
        project.name,
        guest.phone || '',
        personalUrl
      );
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const handleGuestCopy = async (guest: EventGuest) => {
    setBusy(`copy-${guest.id}`);
    try {
      const personalUrl = await getGuestPersonalUrl(guest);
      await handleCopy(`guest-${guest.id}`, personalUrl);
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const handleGeneralWhatsApp = () => {
    if (!generalUrl) return;
    const waUrl = getWhatsAppShareUrl(
      project.type === 'wedding' ? 'wedding' : 'standard',
      project.name,
      '',
      generalUrl
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const filteredGuests = guests.filter((g) => {
    const q = query.trim().toLowerCase();
    return !q || g.name.toLowerCase().includes(q) || (g.phone && g.phone.includes(q));
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--qr-primary)]">
          {t('shareInvitationAction')}
        </h1>
        <p className="mt-1 text-xs text-[#756F66]">
          {t('sendHelp')}
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">
          {error}
        </p>
      )}

      {/* 2. Main Invitation Link Card (Matches Mockup 7) */}
      <section className="rounded-3xl border border-[#E8E2D8] bg-white p-6 sm:p-8 shadow-xs text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F2EC] text-[var(--qr-primary)]">
          <Link2 size={26} aria-hidden="true" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-[#17251F]">
          {t('generalInvitationCardTitle')}
        </h2>

        {loading ? (
          <p className="mt-3 text-xs text-[#756F66]">{t('loading')}</p>
        ) : generalUrl ? (
          <div className="mt-3">
            <p className="rounded-xl bg-[#FAF8F4] border border-[#E8E2D8] px-3.5 py-2.5 text-xs text-[#564F46] font-mono break-all" dir="ltr">
              {generalUrl}
            </p>

            <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                data-testid="button-copy-general-link"
                onClick={() => void handleCopy('general', generalUrl)}
                className="qr-button qr-button--primary min-h-12 w-full sm:flex-1 justify-center text-xs font-bold rounded-xl"
              >
                {copiedKey === 'general' ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>{t('linkCopied')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    <span>{t('copyLink')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="button-preview-general-link"
                onClick={() => window.open(generalUrl, '_blank', 'noopener,noreferrer')}
                className="qr-button qr-button--secondary min-h-12 w-full sm:w-auto justify-center text-xs font-semibold rounded-xl"
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span>{t('preview')}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#8c302b]">{t('operationFailed')}</p>
        )}
      </section>

      {/* 3. Share Action Channels */}
      <section className="space-y-2.5" aria-label={t('shareViaWhatsAppTitle')}>
        {/* WhatsApp Share */}
        <button
          type="button"
          data-testid="button-share-whatsapp-general"
          onClick={handleGeneralWhatsApp}
          disabled={!generalUrl}
          className="group flex w-full items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 text-start transition hover:border-[var(--qr-primary)] hover:shadow-xs disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EBF5F0] text-[#1B6344]">
              <MessageCircle size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17251F]">
                {t('shareViaWhatsAppTitle')}
              </p>
              <p className="text-xs text-[#756F66]">
                {t('sendLocalHelp')}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[var(--qr-primary)] group-hover:underline">
            {t('prepareWhatsApp')}
          </span>
        </button>
      </section>

      {/* 4. Guest-Specific Personalized Invitations Section */}
      <section className="mt-8 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#17251F]">
              {t('personalizedGuestsSection')}
            </h2>
            <p className="mt-1 text-xs text-[#756F66]">
              {t('personalizedGuestsHelp')}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#EBF5F0] px-2.5 py-1 text-[10px] font-bold text-[#1B6344]">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>100% Isolated</span>
          </span>
        </div>

        {guests.length > 3 && (
          <div className="relative">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-[#9E988D]">
              <Search size={16} aria-hidden="true" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchGuestsPlaceholder')}
              className="qr-field-inline min-h-11 w-full rounded-xl bg-white ps-10 pe-4 text-xs text-[#17251F] border border-[#E8E2D8] placeholder:text-[#A8A196]"
            />
          </div>
        )}

        {guests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D9D2C5] bg-white p-8 text-center">
            <p className="text-xs text-[#756F66]">{t('noGuests')}</p>
            <Link
              href={buildProjectRoute(project.type, project.id, 'guests')}
              className="qr-button qr-button--primary mt-3 text-xs"
            >
              {t('addGuests')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredGuests.map((guest) => (
              <article
                key={guest.id}
                data-testid={`guest-send-row-${guest.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8E2D8] bg-white p-3.5 sm:p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#17251F] truncate">
                    {guest.name}
                  </p>
                  <p className="text-xs text-[#756F66]" dir="ltr">
                    {guest.phone || t('missingPhone')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Copy personalized link */}
                  <button
                    type="button"
                    data-testid={`button-copy-guest-link-${guest.id}`}
                    disabled={busy === `copy-${guest.id}`}
                    onClick={() => void handleGuestCopy(guest)}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E8E2D8] bg-[#FAF8F4] px-3 text-xs font-semibold text-[#564F46] hover:border-[#0C2D24] transition disabled:opacity-50"
                  >
                    {copiedKey === `guest-${guest.id}` ? (
                      <>
                        <Check size={14} className="text-[#1B6344]" aria-hidden="true" />
                        <span className="text-[#1B6344] font-bold">{t('linkCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" />
                        <span>{t('copyLink')}</span>
                      </>
                    )}
                  </button>

                  {/* Send via WhatsApp directly */}
                  <button
                    type="button"
                    data-testid={`button-whatsapp-guest-${guest.id}`}
                    disabled={busy === `wa-${guest.id}`}
                    onClick={() => void handleGuestWhatsApp(guest)}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#EBF5F0] px-3.5 text-xs font-bold text-[#1B6344] hover:bg-[#D5EADF] transition disabled:opacity-50"
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                    <span>{t('directWhatsApp')}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 5. Safe Delivery Boundary Note */}
      <aside className="rounded-2xl border border-[#E8E2D8] bg-[#FDFBF7] p-4 text-xs text-[#756F66] leading-relaxed">
        <p className="font-semibold text-[#17251F] mb-1">{t('preparedNotDelivered')}</p>
        <p>{t('sendBoundary')}</p>
      </aside>
    </div>
  );
}
