import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localeDirection, persistAppLocale, readPersistedAppLocale, type AppLocale } from './locale';

const en = {
  language: 'العربية',
  dashboard: 'Dashboard', projects: 'Projects', overview: 'Overview', invitation: 'Invitation', guests: 'Guests', send: 'Send', scanner: 'Scanner', settings: 'Settings', admin: 'Admin', superAdmin: 'Super Admin',
  manageEvents: 'Manage every invitation from one calm workspace.', openProject: 'Open project', wedding: 'Wedding', party: 'Party',
  eventOverview: 'Event overview', invitationStatus: 'Invitation status', live: 'Live', responses: 'Responses', doorPass: 'Door pass', ready: 'Ready', used: 'Used',
  project: 'Project', preview: 'Preview', doorScanner: 'Door scanner', switchType: 'Switch type', invitationLanguage: 'Invitation language', appLanguage: 'Application language', arabic: 'Arabic', english: 'English',
  event: 'Event', designNav: 'Design', more: 'More', editView: 'Edit', previewView: 'Preview', eventDetails: 'Event details', eventTitle: 'Event title', invitationWording: 'Invitation wording', date: 'Date', startTime: 'Start time', venue: 'Venue', city: 'City', rsvpDeadline: 'RSVP deadline', chooseTemplate: 'Choose a template', moveUp: 'Move up', moveDown: 'Move down',
  template: 'Template', details: 'Details', style: 'Style', presentation: 'Layout & motion', next: 'Next', previous: 'Previous', guestPreview: 'Guest preview',
  guestsTitle: 'Guest list', guestsHelp: 'Private invitation links and RSVP status stay with this event.', sendTitle: 'Send invitation', sendHelp: 'Share the private guest link when the invitation is ready.', settingsTitle: 'Project settings', settingsHelp: 'Language choices are saved independently for the app and invitation.',
  frontendOnly: 'Frontend demo only · no camera or secure database verification', verify: 'Verify', checkIn: 'Check in', checkedIn: 'Checked in', notRecognized: 'Not recognized', tryAgain: 'Try the guest token again.',
  scannerTitle: 'Welcome them by name.', scannerHelp: 'Demo verification for', scannerPlaceholder: 'Enter guest token', verified: 'Verified', invitationFor: 'Invitation for',
  partyStudio: 'Party Studio', weddingStudio: 'Wedding Studio', hostStudio: 'Host Studio',
  partyStudioTitle: 'Your suite, in your hands.', partyStudioHelp: 'Shape the guest experience, then send a private link that feels like yours.', weddingStudioTitle: 'Wedding mode, Arabic first.', weddingStudioHelp: 'Create a refined cinematic invitation while keeping the same guest links, responses, and entry pass.', guestExperience: 'Guest experience', invitationBlocks: 'Invitation blocks', blocksHelp: 'Drag to reorder. Hide anything that does not belong.', visible: 'visible', makePersonal: 'Make it personal.', makePersonalHelp: 'Select any block to edit its wording, menu, colors, or questions.',
  chooseStudio: 'Choose your invitation studio.', chooseStudioHelp: 'Wedding and Party keep independent creation experiences while sharing RSVP tracking, guest links, and check-in.', partyEvents: 'Party & Events', standardInvitation: 'Standard invitation', standardHelp: 'For birthdays, dinners, graduations, and celebrations with modular guest blocks.', weddingSuite: 'Wedding suite', weddingInvitation: 'Wedding invitation', weddingHelp: 'Arabic-first 9:16 Wedding experience with templates, layouts, motion, and RSVP.', openPartyStudio: 'Open Party Studio', openWeddingStudio: 'Open Wedding Studio', sharedState: 'RSVP state, private guest links, and door scanner remain synced across both studios.',
  privateLinkActive: 'private link active', awaitingReply: 'awaiting first reply', webQrEnabled: 'web QR enabled',
  saveChanges: 'Save changes', edit: 'Edit', hide: 'Hide', show: 'Show', heading: 'Heading', description: 'Description', questions: 'Questions', selected: 'Selected', notSelected: 'Not selected',
  catering: 'Catering', dress: 'Dress code', schedule: 'Schedule', registry: 'Registry', song: 'Song request', faq: 'FAQ', entrees: 'Entrées', menuSwatches: 'Menu swatches', guest: 'Guest', response: 'Response', invite: 'Invite', catererExport: 'Caterer export', guestList: 'Guest list', guestListTitle: 'The people who matter.', personalLink: 'Personal link ready',
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined',
  adminTitle: 'Frontend admin', adminHelp: 'A responsive operational view of the demo projects. Authentication and backend actions are intentionally out of scope.',
  customers: 'Customers', customersHelp: 'Future customer support workspace', events: 'Events', eventsHelp: 'Wedding and Party inventory', templates: 'Templates', templatesHelp: 'Invitation catalog management', usage: 'Usage', usageHelp: 'Future product activity', support: 'Support', supportHelp: 'Troubleshooting workspace', subscriptions: 'Subscriptions', subscriptionsHelp: 'Reserved for a later backend phase',
  operationName: 'Name', namePlaceholder: 'Wedding or design name', currentWedding: 'Current wedding', createWedding: 'Create wedding', newWedding: 'New wedding', saveNow: 'Save now', rename: 'Rename', duplicate: 'Duplicate', copy: 'Copy', delete: 'Delete', confirmDelete: 'Confirm delete', cancel: 'Cancel', saved: 'Saved', saving: 'Saving…', saveError: 'Save error', savedDesigns: 'Saved designs — appearance only', chooseDesign: 'Choose a saved design', saveAppearance: 'Save appearance', apply: 'Apply', design: 'Design',
  appLanguageHelp: 'Changes only the QuickRSVP workspace. Invitation language is set inside each event.',
  localInvitationReady: 'Local invitation ready', invitedSeats: 'Invited seats', localCheckIns: 'Local check-ins', localBrowserData: 'Local browser data', quickActions: 'Quick actions',
  localGuestData: 'Guest, RSVP, and check-in data is stored locally in this browser.', searchGuests: 'Search guests', allResponses: 'All responses', noGuests: 'No local guests for this project yet.', missingPhone: 'No phone', copyLink: 'Copy link', linkCopied: 'Link copied', openInvitation: 'Open invitation',
  sendLocalHelp: 'Prepare and share each guest’s personal invitation using the links already available in QuickRSVP.', recipient: 'Recipient', invitationOpened: 'Invitation opened', whatsappOpened: 'WhatsApp opened', prepareWhatsApp: 'Prepare WhatsApp', preparedNotDelivered: 'Prepared, not delivered', sendBoundary: 'QuickRSVP copies or opens an invitation link. It does not send messages or track delivery, opens, or reads.',
  scannerBoundary: 'Local frontend demo · manual token verification · no camera or secure server verification · check-in stays in this browser', alreadyCheckedIn: 'Already checked in', scanNextGuest: 'Scan next guest',
  loading: 'Loading…', projectNavigation: 'Project navigation', sessionOnlyData: 'Browser persistence is unavailable. Changes remain available only for this session.', invalidInvitationTitle: 'This invitation is unavailable.', invalidInvitationHelp: 'Check the invitation link or ask the hosts to send it again.', openDemoInvitation: 'Open demo invitation', notFoundTitle: 'Page not found', notFoundHelp: 'The requested QuickRSVP page or project is unavailable.', backToProjects: 'Back to projects', appErrorTitle: 'Something went wrong', appErrorHelp: 'This part of QuickRSVP could not load. You can try again safely.',
  localDemo: 'Local demo', frontendAdmin: 'Frontend admin', thisBrowser: 'This browser', demoWorkspace: 'Demo workspace', customerBoundary: 'Customer authentication, ownership, accounts, and support history do not exist in this frontend phase.', scenes: 'scenes', usageBoundary: 'Derived local browser totals only. No production analytics or message activity.', direction: 'Direction', weddingWorkspace: 'Wedding workspace', browserPersistence: 'Browser persistence', publicRoute: 'Public route', manualLocalOnly: 'Manual and local only', readOnlyDiagnostics: 'Read-only diagnostics', supportBoundary: 'No backend logs, secrets, account resets, or production health claims are available.', notImplemented: 'Not implemented', subscriptionsBoundary: 'Reserved for a future backend billing phase. No plans, prices, trials, invoices, payment methods, or entitlements exist.',
} as const;

type AppTranslationKey = keyof typeof en;

const ar: Record<AppTranslationKey, string> = {
  language: 'English',
  dashboard: 'لوحة التحكم', projects: 'المناسبات', overview: 'نظرة عامة', invitation: 'الدعوة', guests: 'الضيوف', send: 'الإرسال', scanner: 'الماسح', settings: 'الإعدادات', admin: 'الإدارة', superAdmin: 'الإدارة العامة',
  manageEvents: 'أدِر جميع دعواتك من مساحة عمل هادئة وواضحة.', openProject: 'فتح المناسبة', wedding: 'زفاف', party: 'مناسبة',
  eventOverview: 'ملخص المناسبة', invitationStatus: 'حالة الدعوة', live: 'منشورة', responses: 'الردود', doorPass: 'بطاقة الدخول', ready: 'جاهزة', used: 'مستخدمة',
  project: 'المناسبة', preview: 'معاينة', doorScanner: 'ماسح الدخول', switchType: 'تغيير النوع', invitationLanguage: 'لغة الدعوة', appLanguage: 'لغة التطبيق', arabic: 'العربية', english: 'الإنجليزية',
  event: 'المناسبة', designNav: 'التصميم', more: 'المزيد', editView: 'تعديل', previewView: 'معاينة', eventDetails: 'تفاصيل المناسبة', eventTitle: 'اسم المناسبة', invitationWording: 'نص الدعوة', date: 'التاريخ', startTime: 'وقت البدء', venue: 'المكان', city: 'المدينة', rsvpDeadline: 'آخر موعد للرد', chooseTemplate: 'اختر قالباً', moveUp: 'تحريك لأعلى', moveDown: 'تحريك لأسفل',
  template: 'القالب', details: 'التفاصيل', style: 'النمط', presentation: 'التخطيط والحركة', next: 'التالي', previous: 'السابق', guestPreview: 'معاينة الضيف',
  guestsTitle: 'قائمة الضيوف', guestsHelp: 'روابط الدعوات الخاصة وحالة الرد مرتبطة بهذه المناسبة.', sendTitle: 'إرسال الدعوة', sendHelp: 'شارك رابط الضيف الخاص عندما تصبح الدعوة جاهزة.', settingsTitle: 'إعدادات المناسبة', settingsHelp: 'تُحفظ لغة التطبيق ولغة الدعوة بشكل مستقل.',
  frontendOnly: 'عرض تجريبي فقط · بلا كاميرا أو تحقق آمن من قاعدة بيانات', verify: 'تحقق', checkIn: 'تسجيل الدخول', checkedIn: 'تم الدخول', notRecognized: 'رمز غير معروف', tryAgain: 'أعد إدخال رمز الضيف.',
  scannerTitle: 'رحّب بهم بالاسم.', scannerHelp: 'تحقق تجريبي لمناسبة', scannerPlaceholder: 'أدخل رمز الضيف', verified: 'تم التحقق', invitationFor: 'دعوة لعدد',
  partyStudio: 'استوديو المناسبات', weddingStudio: 'استوديو الزفاف', hostStudio: 'استوديو المضيف',
  partyStudioTitle: 'دعوتك بين يديك.', partyStudioHelp: 'شكّل تجربة الضيف، ثم أرسل رابطاً خاصاً يعبّر عن مناسبتك.', weddingStudioTitle: 'تجربة زفاف تبدأ بالعربية.', weddingStudioHelp: 'أنشئ دعوة سينمائية راقية مع الحفاظ على روابط الضيوف والردود وبطاقة الدخول.', guestExperience: 'تجربة الضيف', invitationBlocks: 'أقسام الدعوة', blocksHelp: 'اسحب لإعادة الترتيب، وأخفِ ما لا يناسب مناسبتك.', visible: 'ظاهر', makePersonal: 'أضف لمستك.', makePersonalHelp: 'اختر أي قسم لتعديل نصه أو قائمته أو ألوانه أو أسئلته.',
  chooseStudio: 'اختر استوديو دعوتك.', chooseStudioHelp: 'يحافظ الزفاف والمناسبات على تجربتي إنشاء مستقلتين مع مشاركة الردود وروابط الضيوف وتسجيل الدخول.', partyEvents: 'الحفلات والمناسبات', standardInvitation: 'دعوة المناسبات', standardHelp: 'لأعياد الميلاد والعشاء والتخرج والاحتفالات، مع أقسام مرنة للضيوف.', weddingSuite: 'جناح الزفاف', weddingInvitation: 'دعوة زفاف', weddingHelp: 'تجربة زفاف عربية 9:16 مع القوالب والتخطيطات والحركة وتأكيد الحضور.', openPartyStudio: 'فتح استوديو المناسبات', openWeddingStudio: 'فتح استوديو الزفاف', sharedState: 'تبقى الردود وروابط الضيوف الخاصة وماسح الدخول متزامنة بين الاستوديوهين.',
  privateLinkActive: 'الرابط الخاص نشط', awaitingReply: 'بانتظار أول رد', webQrEnabled: 'رمز الدخول جاهز',
  saveChanges: 'حفظ التعديلات', edit: 'تعديل', hide: 'إخفاء', show: 'إظهار', heading: 'العنوان', description: 'الوصف', questions: 'الأسئلة', selected: 'المحدد', notSelected: 'لم يُحدد',
  catering: 'الضيافة', dress: 'اللباس', schedule: 'الجدول', registry: 'الهدايا', song: 'طلب أغنية', faq: 'الأسئلة الشائعة', entrees: 'الأطباق', menuSwatches: 'ألوان القائمة', guest: 'الضيف', response: 'الرد', invite: 'الدعوة', catererExport: 'تصدير للضيافة', guestList: 'قائمة الضيوف', guestListTitle: 'الأشخاص الأقرب إليك.', personalLink: 'الرابط الخاص جاهز',
  pending: 'بانتظار الرد', accepted: 'مؤكد', declined: 'معتذر',
  adminTitle: 'إدارة الواجهة', adminHelp: 'عرض تشغيلي متجاوب للمناسبات التجريبية. تسجيل الدخول وإجراءات الخادم خارج النطاق عمداً.',
  customers: 'العملاء', customersHelp: 'مساحة دعم العملاء المستقبلية', events: 'المناسبات', eventsHelp: 'سجل مناسبات الزفاف والحفلات', templates: 'القوالب', templatesHelp: 'إدارة كتالوج الدعوات', usage: 'الاستخدام', usageHelp: 'نشاط المنتج مستقبلاً', support: 'الدعم', supportHelp: 'مساحة معالجة المشكلات', subscriptions: 'الاشتراكات', subscriptionsHelp: 'محجوزة لمرحلة خادم لاحقة',
  operationName: 'الاسم', namePlaceholder: 'اسم الزفاف أو التصميم', currentWedding: 'الزفاف الحالي', createWedding: 'إنشاء زفاف', newWedding: 'زفاف جديد', saveNow: 'احفظ الآن', rename: 'إعادة تسمية', duplicate: 'تكرار', copy: 'نسخة', delete: 'حذف', confirmDelete: 'تأكيد الحذف', cancel: 'إلغاء', saved: 'تم الحفظ', saving: 'جارٍ الحفظ…', saveError: 'خطأ في الحفظ', savedDesigns: 'التصاميم المحفوظة — المظهر فقط', chooseDesign: 'اختر تصميماً محفوظاً', saveAppearance: 'حفظ المظهر', apply: 'تطبيق', design: 'تصميم',
  appLanguageHelp: 'تغيّر مساحة عمل QuickRSVP فقط. تُحدد لغة الدعوة داخل كل مناسبة.',
  localInvitationReady: 'الدعوة المحلية جاهزة', invitedSeats: 'المقاعد المدعوة', localCheckIns: 'تسجيلات الدخول المحلية', localBrowserData: 'بيانات هذا المتصفح', quickActions: 'إجراءات سريعة',
  localGuestData: 'تُحفظ بيانات الضيوف والردود وتسجيل الدخول محلياً في هذا المتصفح.', searchGuests: 'البحث عن ضيف', allResponses: 'كل الردود', noGuests: 'لا يوجد ضيوف محليون لهذه المناسبة بعد.', missingPhone: 'لا يوجد هاتف', copyLink: 'نسخ الرابط', linkCopied: 'تم نسخ الرابط', openInvitation: 'فتح الدعوة',
  sendLocalHelp: 'جهّز وشارك رابط الدعوة الشخصي لكل ضيف باستخدام الروابط المتاحة في QuickRSVP.', recipient: 'المستلم', invitationOpened: 'تم فتح الدعوة', whatsappOpened: 'تم فتح واتساب', prepareWhatsApp: 'تجهيز واتساب', preparedNotDelivered: 'مُجهّزة وليست مُرسلة', sendBoundary: 'ينسخ QuickRSVP رابط الدعوة أو يفتحه فقط. لا يرسل الرسائل ولا يتتبع التسليم أو الفتح أو القراءة.',
  scannerBoundary: 'عرض واجهة محلي · إدخال يدوي للرمز · بلا كاميرا أو تحقق آمن من الخادم · تسجيل الدخول محفوظ في هذا المتصفح', alreadyCheckedIn: 'تم تسجيل الدخول مسبقاً', scanNextGuest: 'مسح الضيف التالي',
  loading: 'جارٍ التحميل…', projectNavigation: 'التنقل في المناسبة', sessionOnlyData: 'التخزين الدائم في المتصفح غير متاح. ستبقى التغييرات متاحة خلال هذه الجلسة فقط.', invalidInvitationTitle: 'هذه الدعوة غير متاحة.', invalidInvitationHelp: 'تحقق من رابط الدعوة أو اطلب من المضيفين إرساله مرة أخرى.', openDemoInvitation: 'فتح الدعوة التجريبية', notFoundTitle: 'الصفحة غير موجودة', notFoundHelp: 'صفحة QuickRSVP أو المناسبة المطلوبة غير متاحة.', backToProjects: 'العودة إلى المناسبات', appErrorTitle: 'حدث خطأ', appErrorHelp: 'تعذر تحميل هذا الجزء من QuickRSVP. يمكنك المحاولة مرة أخرى بأمان.',
  localDemo: 'عرض محلي', frontendAdmin: 'إدارة الواجهة', thisBrowser: 'هذا المتصفح', demoWorkspace: 'مساحة عمل تجريبية', customerBoundary: 'لا توجد مصادقة أو ملكية أو حسابات عملاء أو سجل دعم حقيقي في هذه المرحلة.', scenes: 'مشاهد', usageBoundary: 'إجماليات مشتقة من هذا المتصفح فقط، بلا تحليلات إنتاجية أو نشاط رسائل.', direction: 'الاتجاه', weddingWorkspace: 'مساحة عمل الزفاف', browserPersistence: 'تخزين المتصفح', publicRoute: 'المسار العام', manualLocalOnly: 'يدوي ومحلي فقط', readOnlyDiagnostics: 'تشخيصات للقراءة فقط', supportBoundary: 'لا تتوفر سجلات خادم أو أسرار أو إعادة ضبط حسابات أو ادعاءات عن صحة الإنتاج.', notImplemented: 'غير منفذ', subscriptionsBoundary: 'محجوز لمرحلة فوترة خلفية مستقبلية. لا توجد خطط أو أسعار أو تجارب أو فواتير أو وسائل دفع أو صلاحيات.',
};

export const appTranslations = { ar, en } satisfies Record<AppLocale, Record<AppTranslationKey, string>>;

type AppLocaleContextValue = {
  locale: AppLocale;
  dir: 'rtl' | 'ltr';
  setLocale: (locale: AppLocale) => void;
  t: (key: AppTranslationKey) => string;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => {
    try { return readPersistedAppLocale(localStorage); } catch { return 'ar'; }
  });
  const dir = localeDirection(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try { persistAppLocale(localStorage, locale); } catch { /* Session state still works. */ }
  }, [dir, locale]);

  const value = useMemo(() => ({ locale, dir, setLocale, t: (key: AppTranslationKey) => appTranslations[locale][key] }), [dir, locale]);
  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale() {
  const value = useContext(AppLocaleContext);
  if (!value) throw new Error('App locale context unavailable');
  return value;
}

export function AppLanguageControl({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useAppLocale();
  return <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} className="focus-ring min-h-11 rounded-full border border-current/25 px-3 text-xs font-semibold" aria-label={t('appLanguage')} lang={locale === 'ar' ? 'en' : 'ar'}>{compact ? (locale === 'ar' ? 'EN' : 'ع') : t('language')}</button>;
}
