// Local Vite fixture only: not imported by the app or production entry point.
// Sample props exercise real customer components without authentication or RPCs.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { Home, Users } from 'lucide-react';
import { AppLanguageControl, AppLocaleProvider, useAppLocale } from '../src/i18n/app-locale';
import { DashboardPage } from '../src/app/DashboardPage';
import { EmptyProjectSection, ProjectShell } from '../src/app/ProjectShell';
import { Button, Chip, EmptyState, ErrorState, LoadingState, MobileHeader, PageShell, StatusPill } from '../src/components/customer-ui';
import '../src/index.css';

export function FoundationFixture() {
  const { t, locale } = useAppLocale();
  const [screen, setScreen] = useState('controls');
  const [selected, setSelected] = useState('all');
  const [clicks, setClicks] = useState(0);
  const [loading, setLoading] = useState(false);
  const ar = locale === 'ar';
  const project = { id: 'fixture', type: 'wedding' as const, name: ar ? 'حفل زفاف أحمد وسارة — عنوان طويل لاختبار الالتفاف' : 'Ahmed and Sara Wedding — a long title to check wrapping', date: '2026-10-14', venue: ar ? 'الرياض' : 'Riyadh', lifecycleStatus: 'active' as const };
  const noOperation = async () => {};
  return <>
    <div className="qr-customer"><div className="qr-container flex flex-wrap items-center gap-3" style={{ paddingBlock: 12 }}><label className="qr-label">Local fixture / اختبار محلي<select className="qr-field" value={screen} onChange={event => setScreen(event.target.value)}><option value="controls">Controls</option><option value="dashboard">Dashboard sample</option><option value="empty">Dashboard empty</option><option value="wedding">Wedding shell</option><option value="party">Party shell</option></select></label><AppLanguageControl compact /></div></div>
    {(screen === 'dashboard' || screen === 'empty') ? <DashboardPage projects={screen === 'empty' ? [] : [project]} drafts={screen === 'empty' ? [] : [{ id: 'fixture-draft', type: 'party', name: ar ? 'مسودة عيد ميلاد' : 'Birthday draft', updatedAt: '2026-09-07' }]} account={{ name: ar ? 'حساب تجريبي' : 'Sample account', email: 'sample@example.test', admin: true, eventCount: screen === 'empty' ? 0 : 1, access: { wedding: 'active', party: 'none' } }} commercial={{}} onSignOut={() => {}} onCreate={noOperation} onRename={noOperation} onArchive={noOperation} onDelete={noOperation} onDeleteDraft={noOperation} />
      : (screen === 'wedding' || screen === 'party') ? <ProjectShell project={{ ...project, type: screen }} section="guests"><EmptyProjectSection title={t('guests')}>{ar ? 'هذا اختبار مرئي للمكونات الحالية فقط.' : 'Visual fixture of existing components only.'}</EmptyProjectSection></ProjectShell>
      : <PageShell><MobileHeader title={ar ? 'أساس تصميم QuickRSVP' : 'QuickRSVP design foundation'} description={ar ? 'مكونات مشتركة، تجربة بسيطة' : 'Shared controls, a simple experience'} back={{ href: '/tests/customer-ui.html', label: t('backToProjects') }} actions={<Button variant="ghost" className="qr-icon-button" aria-label={t('guests')}><Users size={20} aria-hidden="true" /></Button>} />
        <main className="qr-container space-y-8">
          <section className="qr-card space-y-4"><h1 className="qr-page-title">{ar ? 'دعوة تبدأ بلحظة جميلة' : 'An invitation to something lovely'}</h1><p className="qr-secondary">{ar ? 'ألوان هادئة ومساحات واضحة وخط مقروء.' : 'Calm colors, clear spacing, and readable typography.'}</p><div className="flex flex-wrap gap-3"><Button onClick={() => setClicks(clicks + 1)}>{t('saveChanges')}</Button><Button variant="secondary">{t('preview')}</Button><Button variant="ghost">{t('cancel')}</Button><Button variant="danger">{t('delete')}</Button><Button disabled>{t('publish')}</Button><Button loading>{t('saving')}</Button></div><p role="status">{clicks}</p></section>
          <section className="qr-card space-y-4"><h2 className="qr-section-title">{t('eventDetails')}</h2><label className="qr-label">{t('eventTitle')}<input className="qr-field" placeholder={t('newWedding')} /></label><label className="qr-label">{t('date')}<input className="qr-field" type="date" /></label><label className="qr-label">{(ar ? 'رقم الجوال' : 'Phone number')}<input className="qr-field" type="tel" dir="ltr" inputMode="tel" defaultValue="+966 50 123 4567" /></label><label className="qr-label">{t('description')}<textarea className="qr-field" /></label><label className="qr-label">{t('email')}<input className="qr-field" type="email" dir="ltr" aria-invalid="true" aria-describedby="fixture-email-error" defaultValue="invalid" /></label><p className="qr-field-error" id="fixture-email-error">{ar ? 'أدخل بريداً إلكترونياً صحيحاً.' : 'Enter a valid email address.'}</p><label className="qr-label">{t('eventTitle')}<input className="qr-field" disabled value={t('saved')} readOnly /></label><label className="qr-choice"><input type="checkbox" />{t('selected')}</label><fieldset><legend className="qr-label">{t('switchType')}</legend><label className="qr-choice"><input type="radio" name="product" defaultChecked />{t('wedding')}</label><label className="qr-choice"><input type="radio" name="product" />{t('party')}</label></fieldset></section>
          <section className="space-y-4"><h2 className="qr-section-title">{t('eventStatus')}</h2><div className="flex flex-wrap gap-2"><StatusPill>{t('draft')}</StatusPill><StatusPill tone="success">{t('live')}</StatusPill><StatusPill tone="warning">{t('pending')}</StatusPill><StatusPill tone="error">{t('declined')}</StatusPill><StatusPill tone="info">{t('saving')}</StatusPill></div><div className="qr-chips" aria-label={t('eventStatus')}>{['all', 'accepted', 'pending', 'declined'].map(key => <Chip key={key} selected={selected === key} onClick={() => setSelected(key)}>{key === 'all' ? (ar ? 'الكل' : 'All') : t(key as 'accepted' | 'pending' | 'declined')}</Chip>)}<Chip selected={false} disabled>{t('notAvailable')}</Chip></div></section>
          <EmptyState title={t('noDrafts')} description={t('plannerWorkspace')} icon={<Home size={24} aria-hidden="true" />} action={<Button>{t('startDraft')}</Button>} />
          <ErrorState title={t('appErrorTitle')} description={t('appErrorHelp')} action={<Button loading={loading} onClick={() => setLoading(true)}>{t('retry')}</Button>} />
          <LoadingState label={t('loading')} />
        </main></PageShell>}
  </>;
}

if (typeof document !== 'undefined') createRoot(document.getElementById('root')!).render(<AppLocaleProvider><Router><FoundationFixture /></Router></AppLocaleProvider>);

