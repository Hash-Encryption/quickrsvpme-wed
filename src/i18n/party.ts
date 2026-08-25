import { normalizeLocale, type InvitationLocale } from './locale.ts';

const en = {
  privateFor: 'A private invitation for', replyBy: 'Please reply by', noAccount: 'No account required',
  missedTitle: 'We will miss you.', missedBody: 'Thank you for letting us know. You will be with us in spirit.', changeResponse: 'Change your response',
  onList: 'You are on the list', acceptedTitle: 'With pleasure.', acceptedBody: 'Your place is reserved for the celebration.', confirmed: 'Confirmed',
  details: 'The details', detailsTitle: 'A few things for your celebration.', digitalPass: 'Your digital pass', passTitle: 'See you there.', passBody: 'Present this pass at the door. A screenshot works beautifully.', madeFor: 'made for the moments that matter',
  choosePlate: 'Choose the plate that feels most like you.', selected: 'Selected', notSelected: 'Not selected', registryBody: 'If you would like to bring a gift, the hosts have shared their registry.', viewRegistry: 'View registry', songHelp: 'Share the song you hope finds you on the dance floor.', songPlaceholder: 'Artist — song title', saveSong: 'Save song',
  arrival: 'Arrival & welcome', ceremony: 'Celebration begins', dinner: 'Dinner', dancing: 'Dancing & dessert', guest: 'guest', token: 'token', suggestedColors: 'Suggested colors',
} as const;

export type PartyInvitationKey = keyof typeof en;

const ar: Record<PartyInvitationKey, string> = {
  privateFor: 'دعوة خاصة إلى', replyBy: 'يرجى الرد قبل', noAccount: 'لا يلزم إنشاء حساب',
  missedTitle: 'سنفتقد حضورك.', missedBody: 'شكراً لإبلاغنا. ستبقى معنا بالمحبة والذكرى.', changeResponse: 'تعديل الرد',
  onList: 'تم تأكيد حضورك', acceptedTitle: 'بكل سرور.', acceptedBody: 'تم حجز مكانك في هذه المناسبة.', confirmed: 'مؤكد',
  details: 'تفاصيل المناسبة', detailsTitle: 'كل ما تحتاج معرفته قبل حضورك.', digitalPass: 'بطاقة الدخول الرقمية', passTitle: 'نراك قريباً.', passBody: 'أبرز هذه البطاقة عند الدخول. يمكنك الاحتفاظ بلقطة شاشة.', madeFor: 'صُنعت للحظات التي تستحق الاحتفاء',
  choosePlate: 'اختر الطبق الذي يناسبك وسنتولى الباقي.', selected: 'المحدد', notSelected: 'لم يُحدد', registryBody: 'إن رغبت بإحضار هدية، فقد شارك المضيفون قائمة الهدايا.', viewRegistry: 'عرض القائمة', songHelp: 'شارك الأغنية التي تتمنى سماعها في المناسبة.', songPlaceholder: 'اسم الفنان — عنوان الأغنية', saveSong: 'حفظ الأغنية',
  arrival: 'الوصول والترحيب', ceremony: 'بداية الاحتفال', dinner: 'العشاء', dancing: 'الرقص والحلوى', guest: 'ضيف', token: 'الرمز', suggestedColors: 'الألوان المقترحة',
};

export function resolvePartyInvitationLocale(state: { invitationLocale?: unknown } | null | undefined): InvitationLocale {
  return normalizeLocale(state?.invitationLocale);
}

export const partyInvitationT = (locale: InvitationLocale, key: PartyInvitationKey): string => ({ ar, en })[locale][key];
