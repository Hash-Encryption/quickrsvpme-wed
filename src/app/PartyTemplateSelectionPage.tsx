import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useLocation, useParams } from 'wouter';
import { Button, LoadingState, MobileHeader, PageShell } from '@/components/customer-ui';
import { AppLanguageControl, useAppLocale } from '@/i18n/app-locale';
import { partyTemplates, type PartyTemplateId } from '@/party/model';
import { listDesignDrafts, updateDesignDraft, type DesignDraft } from '@/backend/phase2';

export function PartyTemplateSelectionPage() {
  const { t, locale } = useAppLocale();
  const [, navigate] = useLocation();
  const { draftId: routeDraftId } = useParams<{ draftId?: string }>();

  // Support route parameter or query string
  const draftId = routeDraftId || new URLSearchParams(window.location.search).get('draftId') || '';

  const [selectedTemplate, setSelectedTemplate] = useState<PartyTemplateId>('birthday');
  const [draft, setDraft] = useState<DesignDraft<Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    let live = true;
    listDesignDrafts<Record<string, unknown>>('party')
      .then((drafts) => {
        if (!live) return;
        const found = drafts.find((d) => d.id === draftId);
        if (found) {
          setDraft(found);
          const config = found.configuration as Record<string, unknown> | undefined;
          if (typeof config?.templateId === 'string' && config.templateId in partyTemplates) {
            setSelectedTemplate(config.templateId as PartyTemplateId);
          }
        }
      })
      .catch(() => {
        if (live) setErrorMessage(t('operationFailed'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [draftId, t]);

  const handleContinue = async () => {
    if (!draft) {
      if (draftId) {
        navigate(`/drafts/party/${draftId}`);
      } else {
        navigate('/planner/party');
      }
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const updatedConfig = {
        ...draft.configuration,
        templateId: selectedTemplate,
      };

      await updateDesignDraft(draft, draft.title, updatedConfig);
      // Navigate directly into Party Studio
      navigate(`/drafts/party/${draft.id}`);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : t('operationFailed'));
      setSubmitting(false);
    }
  };

  const templatesList = Object.values(partyTemplates);

  return (
    <PageShell>
      <MobileHeader
        back={{ href: '/planner/party', label: t('myPartiesTitle') }}
        title={t('partyTemplateSelectionTitle')}
        actions={<AppLanguageControl compact />}
      />

      <main className="qr-container max-w-3xl">
        <header className="text-center pt-2 pb-6 sm:pt-6 sm:pb-8">
          <p className="qr-caption qr-gold-text tracking-[.14em] uppercase font-semibold">
            {t('designNav')}
          </p>
          <h1 className="qr-card-title text-2xl sm:text-3xl font-bold text-[var(--qr-primary)] mt-1">
            {t('partyTemplateSelectionTitle')}
          </h1>
          <p className="qr-secondary text-sm max-w-md mx-auto mt-2">
            {t('partyTemplateSelectionSubtitle')}
          </p>
        </header>

        {loading ? (
          <div className="py-12">
            <LoadingState label={t('loading')} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label={t('partyTemplateSelectionTitle')}>
              {templatesList.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                const name = locale === 'ar' ? tpl.nameAr : tpl.name;
                const desc = locale === 'ar' ? tpl.descriptionAr : tpl.description;

                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`template-card-${tpl.id}`}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`qr-card relative flex flex-col justify-between p-7 text-start transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[var(--qr-primary)] bg-[var(--qr-primary-subtle)]/40 shadow-md ring-2 ring-[var(--qr-primary)]/20'
                        : 'border border-[var(--qr-border)] hover:border-[var(--qr-primary)]/60 hover:bg-[var(--qr-subtle)]/40 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`party-template-swatch party-template-swatch--${tpl.id}`} />
                        {isSelected ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--qr-primary)] bg-white px-3 py-1 rounded-full border border-[var(--qr-primary)]/25 shadow-xs">
                            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                            <span>{t('templateSelected')}</span>
                          </span>
                        ) : (
                          <span className="h-6 w-6 rounded-full border-2 border-[#d1c7b7]" aria-hidden="true" />
                        )}
                      </div>

                      <h3 className="qr-card-title text-lg font-bold text-[var(--qr-primary)] mt-2">
                        {name}
                      </h3>
                      <p className="qr-secondary text-xs leading-5 mt-1.5">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-6 pt-3.5 border-t border-[var(--qr-divider)] flex items-center justify-between text-[11px] font-semibold text-[var(--qr-secondary)]">
                      <span>
                        {tpl.id === 'corporate' && 'Professional · Brand-focused'}
                        {tpl.id === 'birthday' && 'Festive · Warm & joyful'}
                        {tpl.id === 'baby-shower' && 'Delicate · Soft & sweet'}
                        {tpl.id === 'custom' && 'Universal · General events'}
                      </span>
                      <span className="text-[10px] tracking-wider uppercase opacity-70 font-mono">{tpl.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {errorMessage && (
              <div className="qr-notice qr-notice--error" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                variant="primary"
                loading={submitting}
                disabled={submitting}
                onClick={() => void handleContinue()}
                data-testid="button-continue-party-template"
                className="w-full sm:w-auto min-w-48 min-h-12 text-sm font-bold shadow-sm"
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>{t('continueToDesign')}</span>
              </Button>

              <p className="qr-secondary text-xs text-center sm:text-start">
                {t('canEditLater')}
              </p>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  );
}
