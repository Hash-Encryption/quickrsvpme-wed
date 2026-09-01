export const authErrorTranslations = {
  en: {
    invalidCredentials: 'The email or password is incorrect.',
    sessionExpired: 'Your session expired. Sign in again.',
    unauthorizedAccount: 'This account is not authorized to use QuickRSVP.',
    networkError: 'QuickRSVP could not reach the service. Check your connection and retry.',
    serverError: 'The QuickRSVP service is unavailable. Retry in a moment.',
    accountDataUnavailable: 'Your account data could not be loaded. Retry without signing in again.',
  },
  ar: {
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    sessionExpired: 'انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى.',
    unauthorizedAccount: 'هذا الحساب غير مصرح له باستخدام QuickRSVP.',
    networkError: 'تعذر اتصال QuickRSVP بالخدمة. تحقق من الاتصال ثم أعد المحاولة.',
    serverError: 'خدمة QuickRSVP غير متاحة حالياً. حاول بعد قليل.',
    accountDataUnavailable: 'تعذر تحميل بيانات حسابك. أعد المحاولة من دون تسجيل الدخول مرة أخرى.',
  },
} as const;
