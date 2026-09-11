import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { defaultWeddingEvent, type WeddingEventData } from '@/wedding/model';
import { createEvent } from '@/backend/events';
import { saveWeddingConfig } from '@/backend/phase2';
import { useAuth } from '@/auth/AuthProvider';
import { buildProjectRoute } from './projects';

export function CreateWeddingPage() {
  const { t } = useAppLocale();
  const [, navigate] = useLocation();
  const auth = useAuth();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [touched, setTouched] = useState({ name: false, date: false });

  const nameError = touched.name && !name.trim() ? t('weddingNameRequired') : '';
  const dateError = touched.date && !date.trim() ? t('weddingDateRequired') : '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, date: true });

    if (!name.trim() || !date.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const configuration = {
        ...(structuredClone(defaultWeddingEvent) as WeddingEventData & Record<string, unknown>),
        gregorianDate: date.trim(),
        title: name.trim(),
      };

      const startsAt = date.trim() ? new Date(date.trim()).toISOString() : null;
      const newEvent = await createEvent({
        productId: 'wedding',
        title: name.trim(),
        startsAt,
        invitationLocale: 'ar',
      });
      await saveWeddingConfig(newEvent.id, configuration, 0, null);
      await auth.refresh();
      // Direct Entry Rule: Immediately navigate to Wedding invitation setup
      navigate(buildProjectRoute('wedding', newEvent.id, 'invitation'));
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : t('operationFailed'));
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <MobileHeader
        back={{ href: '/planner/wedding', label: t('myWeddingsTitle') }}
        title={t('createWeddingTitle')}
        actions={<AppLanguageControl compact />}
      />

      <main className="qr-container max-w-lg">
        <section className="qr-card p-6 sm:p-9 shadow-sm">
          <div className="mb-6">
            <h1 className="qr-card-title text-2xl font-bold text-[var(--qr-primary)]">
              {t('createWeddingTitle')}
            </h1>
            <p className="qr-secondary mt-1 text-sm">
              {t('startWithExceptionalInvitation')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Wedding Name */}
            <div>
              <label className="qr-label" htmlFor="wedding-name">
                <span>{t('weddingNameLabel')}</span>
                <span className="qr-gold-text ms-1" aria-hidden="true">*</span>
              </label>
              <input
                id="wedding-name"
                data-testid="input-wedding-name"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder={t('weddingNamePlaceholder')}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'wedding-name-error' : undefined}
                className="qr-field mt-2"
                disabled={submitting}
              />
              {nameError && (
                <p id="wedding-name-error" className="qr-field-error" role="alert">
                  {nameError}
                </p>
              )}
            </div>

            {/* Wedding Date */}
            <div>
              <label className="qr-label" htmlFor="wedding-date">
                <span>{t('weddingDateLabel')}</span>
                <span className="qr-gold-text ms-1" aria-hidden="true">*</span>
              </label>
              <input
                id="wedding-date"
                data-testid="input-wedding-date"
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, date: true }))}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? 'wedding-date-error' : undefined}
                className="qr-field mt-2"
                disabled={submitting}
              />
              {dateError && (
                <p id="wedding-date-error" className="qr-field-error" role="alert">
                  {dateError}
                </p>
              )}
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
                data-testid="button-create-wedding-submit"
                loading={submitting}
                disabled={submitting || !name.trim() || !date.trim()}
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
