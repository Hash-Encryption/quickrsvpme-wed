import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { defaultPartyEvent, type PartyEventData } from '@/party/model';
import { createDesignDraft } from '@/backend/phase2';

export const initialPartyBlocks = [
  { id: 'catering', key: 'catering', enabled: true, label: 'Catering', eyebrow: 'YOUR TABLE', content: { heading: 'A seat at our table', entree: ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli'], swatches: ['#6D3F35', '#C48B63', '#34594B'] } },
  { id: 'dress', key: 'dress', enabled: true, label: 'Dress code', eyebrow: 'THE ATTIRE', content: { heading: 'Garden formal', note: 'A little polished, a little effortless. Suits, silk, and evening colors are encouraged.' } },
  { id: 'schedule', key: 'schedule', enabled: true, label: 'Schedule', eyebrow: 'THE EVENING', content: { heading: 'A day in full bloom' } },
  { id: 'registry', key: 'registry', enabled: true, label: 'Registry', eyebrow: 'A LITTLE SOMETHING', content: { heading: 'Your presence is enough' } },
  { id: 'song', key: 'song', enabled: true, label: 'Song request', eyebrow: 'SET THE TONE', content: { heading: 'Bring a song to the dance floor' } },
  { id: 'faq', key: 'faq', enabled: true, label: 'FAQ', eyebrow: 'GOOD TO KNOW', content: { heading: 'Before you join us', questions: [{ q: 'Can I bring a plus one?', a: 'Your invitation will note your guest count. For this invitation, we are looking forward to celebrating with you.' }, { q: 'Where should I park?', a: 'Valet parking will be available at the south entrance of The Grand Palace Hall from 5:00 PM.' }, { q: 'What time should I arrive?', a: 'Please arrive between 5:15 and 5:45 PM so we can welcome you before the ceremony.' }] } },
];

export function CreatePartyPage() {
  const { t } = useAppLocale();
  const [, navigate] = useLocation();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notSureYet, setNotSureYet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? t('partyNameRequired') : '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (!name.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const configuration = {
        ...(structuredClone(defaultPartyEvent) as PartyEventData & Record<string, unknown>),
        blocks: structuredClone(initialPartyBlocks),
        invitationLocale: 'ar',
        date: notSureYet ? '' : date.trim(),
      };

      const draft = await createDesignDraft('party', name.trim(), configuration);
      // Direct Entry Rule: Immediately navigate to Party template selection
      navigate(`/planner/party/templates/${draft.id}`);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : t('operationFailed'));
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <MobileHeader
        back={{ href: '/planner/party', label: t('myPartiesTitle') }}
        title={t('createPartyTitle')}
        actions={<AppLanguageControl compact />}
      />

      <main className="qr-container max-w-lg">
        <section className="qr-card p-6 sm:p-9 shadow-sm">
          <div className="mb-6">
            <h1 className="qr-card-title text-2xl font-bold text-[var(--qr-primary)]">
              {t('createPartyTitle')}
            </h1>
            <p className="qr-secondary mt-1 text-sm">
              {t('partyCardSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Event Name */}
            <div>
              <label className="qr-label" htmlFor="party-name">
                <span>{t('partyNameLabel')}</span>
                <span className="qr-gold-text ms-1" aria-hidden="true">*</span>
              </label>
              <input
                id="party-name"
                data-testid="input-party-name"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                onBlur={() => setTouched(true)}
                placeholder={t('partyNamePlaceholder')}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'party-name-error' : undefined}
                className="qr-field mt-2"
                disabled={submitting}
              />
              {nameError && (
                <p id="party-name-error" className="qr-field-error" role="alert">
                  {nameError}
                </p>
              )}
            </div>

            {/* Event Date (Optional) */}
            <div>
              <label className="qr-label" htmlFor="party-date">
                <span>{t('partyDateLabel')}</span>
              </label>
              <input
                id="party-date"
                data-testid="input-party-date"
                type="date"
                value={notSureYet ? '' : date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                disabled={submitting || notSureYet}
                className="qr-field mt-2 disabled:opacity-50"
              />

              {/* Not sure yet checkbox */}
              <label className="qr-choice mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="checkbox-not-sure-date"
                  checked={notSureYet}
                  onChange={(e) => {
                    setNotSureYet(e.target.checked);
                    if (e.target.checked) setDate('');
                  }}
                  disabled={submitting}
                />
                <span className="text-xs sm:text-sm text-[var(--qr-secondary)] font-medium">
                  {t('notSureYet')}
                </span>
              </label>
            </div>

            {errorMessage && (
              <div className="qr-notice qr-notice--error" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                type="submit"
                data-testid="button-create-party-submit"
                loading={submitting}
                disabled={submitting || !name.trim()}
                className="w-full min-h-12 text-sm font-bold shadow-sm"
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>{t('createAndStartInvitation')}</span>
              </Button>

              <p className="qr-secondary text-center mt-3 text-xs">
                {t('canEditLater')}
              </p>
            </div>
          </form>
        </section>
      </main>
    </PageShell>
  );
}
