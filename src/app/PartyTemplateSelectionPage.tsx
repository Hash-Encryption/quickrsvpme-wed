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

                const tagLabel = {
                  corporate: locale === 'ar' ? 'مهني ورسمي · تركيز على الهوية' : 'Professional · Brand-focused',
                  birthday: locale === 'ar' ? 'احتفالي · دافئ ومبهج' : 'Festive · Warm & joyful',
                  'baby-shower': locale === 'ar' ? 'ناعم وأنيق · استقبال ومواليد' : 'Delicate · Soft & sweet',
                  custom: locale === 'ar' ? 'شامل · تجمعات، عشاء وتخرج' : 'Universal · General events',
                }[tpl.id as PartyTemplateId] || '';

                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`template-card-${tpl.id}`}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`qr-card relative flex flex-col justify-between p-5 text-start transition-all cursor-pointer rounded-2xl ${
                      isSelected
                        ? 'border-2 border-[#0C2D24] bg-white shadow-lg ring-2 ring-[#0C2D24]'
                        : 'border border-[rgba(194,155,97,0.22)] bg-white/95 hover:border-[var(--qr-primary)]/60 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Top Action & Selection Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-[#8B7040] uppercase tracking-wider">
                          {tpl.id}
                        </span>
                        {isSelected ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[#0C2D24] bg-[#F5EFE6] px-2.5 py-1 rounded-full border border-[#C29B61]/30 shadow-xs">
                            <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                            <span>{t('templateSelected')}</span>
                          </span>
                        ) : (
                          <span className="h-5 w-5 rounded-full border border-[#d1c7b7] bg-white/80" aria-hidden="true" />
                        )}
                      </div>

                      {/* Visual Miniature Invitation Preview */}
                      <div className="mb-4">
                        {tpl.id === 'corporate' && (
                          <div className="h-28 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden bg-[#0F1E2E] text-white border border-[#1E3A54] shadow-inner relative">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold tracking-wider text-[#C29B61] uppercase bg-[#C29B61]/15 px-2 py-0.5 rounded">
                                {locale === 'ar' ? 'أعمال' : 'Executive'}
                              </span>
                              <span className="h-2 w-2 rounded-full bg-[#C29B61]" />
                            </div>
                            <div className="space-y-1">
                              <div className="h-2 w-3/4 rounded bg-white/80" />
                              <div className="h-1.5 w-1/2 rounded bg-white/40" />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[9px] text-[#A0B0C0] tabular-nums">
                              <span>{locale === 'ar' ? 'دعوة رسمية' : 'Formal Invitation'}</span>
                              <span className="text-[#C29B61]">★ VIP</span>
                            </div>
                          </div>
                        )}

                        {tpl.id === 'birthday' && (
                          <div className="h-28 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden bg-[#FFF6ED] text-[#2D2421] border border-[#F3D7C5] shadow-inner relative">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold tracking-wider text-[#C86D51] uppercase bg-[#C86D51]/15 px-2 py-0.5 rounded">
                                {locale === 'ar' ? 'احتفال' : 'Festive'}
                              </span>
                              <span className="text-sm">✨</span>
                            </div>
                            <div className="space-y-1">
                              <div className="h-2 w-2/3 rounded bg-[#C86D51]/90" />
                              <div className="h-1.5 w-1/3 rounded bg-[#C86D51]/40" />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-[#C86D51]/20 text-[9px] text-[#8C5D4E] tabular-nums">
                              <span>{locale === 'ar' ? 'حفلة خاصة' : 'Private Party'}</span>
                              <span className="font-bold text-[#C86D51]">RSVP</span>
                            </div>
                          </div>
                        )}

                        {tpl.id === 'baby-shower' && (
                          <div className="h-28 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden bg-[#F2F6F3] text-[#1E3025] border border-[#CFDFD4] shadow-inner relative">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold tracking-wider text-[#5E826B] uppercase bg-[#5E826B]/15 px-2 py-0.5 rounded">
                                {locale === 'ar' ? 'مواليد' : 'Delicate'}
                              </span>
                              <span className="h-2 w-2 rounded-full bg-[#5E826B]" />
                            </div>
                            <div className="space-y-1 text-center">
                              <div className="h-2 w-1/2 mx-auto rounded bg-[#5E826B]/80" />
                              <div className="h-1.5 w-1/3 mx-auto rounded bg-[#5E826B]/40" />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-[#5E826B]/20 text-[9px] text-[#4E6B58] tabular-nums">
                              <span>{locale === 'ar' ? 'استقبال مولود' : 'Welcome Baby'}</span>
                              <span className="text-[#5E826B]">🌿</span>
                            </div>
                          </div>
                        )}

                        {tpl.id === 'custom' && (
                          <div className="h-28 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden bg-[#F8F4EC] text-[#1E242B] border border-[#DFD7C7] shadow-inner relative">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold tracking-wider text-[#8B7040] uppercase bg-[#8B7040]/15 px-2 py-0.5 rounded">
                                {locale === 'ar' ? 'عام' : 'Universal'}
                              </span>
                              <span className="text-sm">✦</span>
                            </div>
                            <div className="space-y-1">
                              <div className="h-2 w-3/5 rounded bg-[#1E242B]/80" />
                              <div className="h-1.5 w-2/5 rounded bg-[#1E242B]/40" />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-[#8B7040]/20 text-[9px] text-[#7A6A53] tabular-nums">
                              <span>{locale === 'ar' ? 'تجمع & استراحة' : 'Gathering & Dinner'}</span>
                              <span className="font-semibold text-[#8B7040]">Entry Pass</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <h3 className="qr-card-title text-base sm:text-lg font-bold text-[var(--qr-primary)]">
                        {name}
                      </h3>
                      <p className="qr-secondary text-xs leading-5 mt-1">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-[rgba(194,155,97,0.16)] flex items-center justify-between text-[11px] font-medium text-[var(--qr-secondary)]">
                      <span>{tagLabel}</span>
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
