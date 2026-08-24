import type { InvitationLocale } from './locale';

const en = {
  invitation: 'Invitation', privateInvitation: 'A private invitation for', reception: 'Reception', dinner: 'Dinner', viewLocation: 'View location', confirmAttendance: 'Confirm attendance', editResponse: 'Edit response',
  rsvpTitle: 'Will you join us?', attending: 'Attending', declining: 'Unable to attend', guestCount: 'Guest count', allowed: 'Allowed', decreaseGuests: 'Decrease guest count', increaseGuests: 'Increase guest count', message: 'Message to the couple', optional: 'optional', messagePlaceholder: 'Write your message here', save: 'Save response', saving: 'Saving…', close: 'Close', saveError: 'Could not save your response. Please try again.', and: 'and',
  nextScene: 'Next scene', pause: 'Pause presentation', play: 'Play presentation', replay: 'Replay presentation', soundOn: 'Turn sound on', soundOff: 'Mute sound', controls: 'Invitation controls', scenes: 'Invitation scenes', scene: 'Scene', of: 'of',
} as const;
type InvitationKey = keyof typeof en;
const ar: Record<InvitationKey, string> = {
  invitation: 'دعوة', privateInvitation: 'دعوة خاصة إلى', reception: 'الاستقبال', dinner: 'العشاء', viewLocation: 'عرض الموقع', confirmAttendance: 'تأكيد الحضور', editResponse: 'تعديل الرد',
  rsvpTitle: 'هل ستشرفنا بالحضور؟', attending: 'حضور', declining: 'أعتذر عن الحضور', guestCount: 'عدد الحضور', allowed: 'الحد المسموح', decreaseGuests: 'تقليل عدد الحضور', increaseGuests: 'زيادة عدد الحضور', message: 'رسالة للعروسين', optional: 'اختياري', messagePlaceholder: 'اكتب رسالتك هنا', save: 'حفظ الرد', saving: 'جارٍ الحفظ…', close: 'إغلاق', saveError: 'تعذر حفظ الرد. يرجى المحاولة مرة أخرى.', and: 'و',
  nextScene: 'المشهد التالي', pause: 'إيقاف العرض مؤقتاً', play: 'تشغيل العرض', replay: 'إعادة العرض', soundOn: 'تشغيل الصوت', soundOff: 'كتم الصوت', controls: 'عناصر تحكم الدعوة', scenes: 'مشاهد الدعوة', scene: 'المشهد', of: 'من',
};
export const invitationTranslations = { ar, en } satisfies Record<InvitationLocale, Record<InvitationKey, string>>;
export const invitationT = (locale: InvitationLocale, key: InvitationKey) => invitationTranslations[locale][key];
