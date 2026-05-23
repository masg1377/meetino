/**
 * Client-side translator for English error messages coming from the API.
 * We don't want to touch the backend's HTTP exception strings (they're useful
 * in logs / for non-fa locales later), so we map them to Persian here.
 *
 * The matcher is intentionally LOOSE — substring matches are fine because
 * the messages are short, stable, and unique enough. If a pattern isn't
 * matched we fall back to the original (better English than a wrong guess).
 */

interface Pattern {
  match: RegExp;
  fa: string;
}

const PATTERNS: Pattern[] = [
  // Phase 3 / 7 meeting access
  { match: /Meeting not found/i, fa: 'این جلسه پیدا نشد یا لینک شما معتبر نیست.' },
  { match: /You must join this meeting first/i, fa: 'برای انجام این عمل ابتدا باید وارد جلسه شوید.' },
  { match: /You were removed from this meeting/i, fa: 'شما از این جلسه حذف شده‌اید.' },
  { match: /This meeting is locked/i, fa: 'این جلسه قفل است.' },
  { match: /This meeting has ended/i, fa: 'این جلسه پایان یافته است.' },
  { match: /Meeting has already ended/i, fa: 'این جلسه پایان یافته است.' },
  { match: /This meeting was cancelled/i, fa: 'این جلسه لغو شده است.' },
  { match: /A valid password is required/i, fa: 'رمز عبور صحیح برای ورود به جلسه لازم است.' },
  { match: /Cannot kick another host/i, fa: 'نمی‌توان میزبان دیگر را حذف کرد.' },
  { match: /You cannot kick yourself/i, fa: 'نمی‌توانید خودتان را حذف کنید.' },
  { match: /Only the host( or an admin)? may perform/i, fa: 'فقط میزبان یا مدیر می‌تواند این عمل را انجام دهد.' },
  { match: /Your account is not active/i, fa: 'حساب کاربری شما فعال نیست.' },
  { match: /Participant not found in this meeting/i, fa: 'این شرکت‌کننده در جلسه پیدا نشد.' },
  { match: /Password must be at least/i, fa: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' },
  { match: /Password must be at most/i, fa: 'رمز عبور باید حداکثر ۶۴ کاراکتر باشد.' },

  // Phase 2 auth — matches the actual NestJS exception strings.
  { match: /Invalid email or password/i, fa: 'ایمیل یا رمز عبور نادرست است.' },
  { match: /Invalid credentials/i, fa: 'ایمیل یا رمز عبور نادرست است.' },
  { match: /Account is disabled/i, fa: 'حساب کاربری شما غیرفعال است.' },
  { match: /Email already (in use|registered|exists)/i, fa: 'این ایمیل قبلاً ثبت شده است.' },
  { match: /already (in use|registered|exists)/i, fa: 'این ایمیل قبلاً ثبت شده است.' },
  { match: /Missing refresh token/i, fa: 'نشست یافت نشد. لطفاً دوباره وارد شوید.' },
  { match: /Refresh token (invalid|expired|missing)/i, fa: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' },
  { match: /User no longer exists/i, fa: 'حساب کاربری شما پیدا نشد.' },
  { match: /User vanished/i, fa: 'حساب کاربری شما پیدا نشد.' },
  { match: /Unauthorized/i, fa: 'دسترسی غیرمجاز. لطفاً دوباره وارد شوید.' },

  // Phase 5 chat
  { match: /Message body must be a string/i, fa: 'متن پیام نامعتبر است.' },
  { match: /Message body (is required|cannot be empty)/i, fa: 'پیام نمی‌تواند خالی باشد.' },
  { match: /Message body cannot exceed (\d+) characters/i, fa: 'پیام بیش از حد مجاز طولانی است.' },

  // Phase 4 realtime
  { match: /Not authenticated/i, fa: 'احراز هویت انجام نشده است.' },
  { match: /You are not allowed to join this meeting/i, fa: 'اجازهٔ ورود به این جلسه را ندارید.' },

  // Phase 6 LiveKit
  { match: /LiveKit is not configured/i, fa: 'سرور تصویر/صدا تنظیم نشده است.' },

  // Phase 7.7 — file sharing
  { match: /This file type is not supported/i, fa: 'فرمت فایل پشتیبانی نمی‌شود. فقط jpg, png, webp و pdf مجاز است.' },
  { match: /File exceeds the allowed size/i, fa: 'حجم فایل بیش از حد مجاز است.' },
  { match: /No file was uploaded/i, fa: 'فایلی برای آپلود انتخاب نشده است.' },
  { match: /File is empty or missing/i, fa: 'فایل خالی است یا یافت نشد.' },
  { match: /Could not store the uploaded file/i, fa: 'ذخیرهٔ فایل با خطا مواجه شد.' },
  { match: /File not found/i, fa: 'فایل پیدا نشد.' },
  { match: /You cannot delete this file/i, fa: 'فقط آپلودکننده یا میزبان می‌تواند این فایل را حذف کند.' },

  // Phase 7.6 — rejoin workflow
  { match: /You are not blocked from this meeting/i, fa: 'شما از این جلسه اخراج نشده‌اید و نیازی به اجازه ندارید.' },
  { match: /Rejoin request not found/i, fa: 'درخواست ورود مجدد پیدا نشد.' },
  { match: /Message cannot exceed \d+ characters/i, fa: 'پیام شما طولانی‌تر از حد مجاز است.' },
  { match: /Message must be a string/i, fa: 'متن پیام نامعتبر است.' },

  // Generic 5xx / 4xx fallbacks
  { match: /Internal server error/i, fa: 'خطایی در سرور رخ داد. کمی بعد دوباره تلاش کنید.' },
  { match: /Bad request/i, fa: 'درخواست نامعتبر است.' },
  { match: /Validation failed/i, fa: 'مقادیر واردشده معتبر نیستند.' },
];

/**
 * Best-effort translation of a server error message into Persian.
 * Returns the original string if nothing matched (better than guessing).
 */
export function translateServerError(message: string | undefined | null): string {
  if (!message) return 'خطایی رخ داد.';
  const trimmed = message.trim();
  for (const { match, fa } of PATTERNS) {
    if (match.test(trimmed)) return fa;
  }
  return trimmed;
}
