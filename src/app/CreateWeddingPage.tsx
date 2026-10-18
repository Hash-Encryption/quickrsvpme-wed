import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { defaultWeddingEvent, deriveHijriDateFromGregorian, deriveDayOfWeekFromGregorian, type WeddingEventData } from '@/wedding/model';
import { createEvent } from '@/backend/events';
import { saveWeddingConfig } from '@/backend/phase2';
import { useAuth } from '@/auth/AuthProvider';
import { buildProjectRoute } from './projects';

import { DualHijriCalendar } from '@/components/DualHijriCalendar';
import { SAUDI_TIME_ANCHORS } from '@/utils/saudiCalendar';

export function CreateWeddingPage() {
  const { t, locale } = useAppLocale();
  const [, navigate] = useLocation();
  const auth = useAuth();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [selectedTimeAnchor, setSelectedTimeAnchor] = useState<string>('after-isha');
  const [showHijriDate, setShowHijriDate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [touched, setTouched] = useState({ name: false, date: false });

  const nameError = touched.name && !name.trim() ? t('weddingNameRequired') : '';
  const dateError = touched.date && !date.trim() ? t('weddingDateRequired') : '';

  const derivedHijri = date.trim() ? deriveHijriDateFromGregorian(date.trim(), 'ar') : '';
  const derivedDay = date.trim() ? deriveDayOfWeekFromGregorian(date.trim(), 'ar') : '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, date: true });

    if (!name.trim() || !date.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const activeAnchor = SAUDI_TIME_ANCHORS.find((a) => a.id === selectedTimeAnchor);
      const chosenTime = activeAnchor ? (locale === 'ar' ? activeAnchor.labelAr : activeAnchor.labelEn) : defaultWeddingEvent.startTime;

      const configuration = {
        ...(structuredClone(defaultWeddingEvent) as WeddingEventData & Record<string, unknown>),
        gregorianDate: date.trim(),
        hijriDate: derivedHijri || defaultWeddingEvent.hijriDate,
        eventDay: derivedDay || defaultWeddingEvent.eventDay,
        startTime: chosenTime,
        showHijriDate,
        title: name.trim(),
      };

      const startsAt = date.trim()
        ? new Date(`${date.trim()}T${activeAnchor?.time || '20:00'}:00Z`).toISOString()
        : null;
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

            {/* Wedding Date (Dual Gregorian-Hijri Calendar) */}
            <div className="space-y-3">
              <label className="qr-label block" htmlFor="wedding-date">
                <span>{t('weddingDateLabel')}</span>
                <span className="qr-gold-text ms-1" aria-hidden="true">*</span>
              </label>

              <DualHijriCalendar
                id="wedding-date"
                testId="input-wedding-date"
                value={date}
                onChange={(newDate) => {
                  setDate(newDate);
                  if (errorMessage) setErrorMessage('');
                  setTouched((prev) => ({ ...prev, date: true }));
                }}
                locale={locale}
                showHijri={showHijriDate}
                disabled={submitting}
              />
              {dateError && (
                <p id="wedding-date-error" className="qr-field-error" role="alert">
                  {dateError}
                </p>
              )}

              {/* Saudi Time Anchors */}
              <div className="pt-2">
                <span className="qr-label block mb-2 text-xs font-semibold text-[var(--qr-secondary)]">
                  {locale === 'ar' ? 'توقيت بدء الحفل' : 'Ceremony Timing'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {SAUDI_TIME_ANCHORS.map((anchor) => {
                    const active = selectedTimeAnchor === anchor.id;
                    return (
                      <button
                        key={anchor.id}
                        type="button"
                        onClick={() => setSelectedTimeAnchor(anchor.id)}
                        className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${
                          active
                            ? 'bg-[#0C2D24] text-white shadow-xs'
                            : 'bg-[#FAF7F2] border border-[rgba(194,155,97,0.22)] text-[#17251F] hover:bg-[#F5EFE6]'
                        }`}
                      >
                        {locale === 'ar' ? anchor.labelAr : anchor.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="show-hijri-date"
                  data-testid="checkbox-show-hijri"
                  type="checkbox"
                  checked={showHijriDate}
                  onChange={(e) => setShowHijriDate(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--qr-primary)] focus:ring-[var(--qr-primary)] cursor-pointer"
                />
                <label htmlFor="show-hijri-date" className="text-xs sm:text-sm cursor-pointer select-none font-medium text-[#17251F]">
                  {t('showHijriOnInvitation')}
                </label>
              </div>
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
