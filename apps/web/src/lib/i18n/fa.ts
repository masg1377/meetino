/**
 * Centralized Persian strings for user-facing UI.
 *
 * Keep:
 *   - keys in English (so the rest of the code stays grep-friendly),
 *   - values in Persian.
 *
 * Use the `t(key)` helper from './index' to access these; that's where a
 * future multilingual layer would slot in. For now we only ship Persian.
 *
 * NEW STRINGS: add them here rather than inline so we can swap languages
 * later without scattered string surgery.
 */
export const fa = {
  common: {
    loading: 'در حال بارگذاری',
    back: 'بازگشت',
    close: 'بستن',
    cancel: 'انصراف',
    confirm: 'تأیید',
    save: 'ذخیره',
    delete: 'حذف',
    copy: 'کپی',
    copied: 'کپی شد',
    dismiss: 'بستن',
    retry: 'تلاش دوباره',
    leave: 'خروج',
    enter: 'ورود',
    yes: 'بله',
    no: 'خیر',
  },

  theme: {
    toggleLabel: 'تغییر پوسته',
    light: 'روشن',
    dark: 'تیره',
    system: 'سیستم',
    label: {
      light: 'تم: روشن',
      dark: 'تم: تیره',
      system: 'تم: سیستم',
    },
  },

  auth: {
    login: {
      title: 'ورود به میتینو',
      subtitle: 'برای ساخت و مدیریت جلسه‌ها وارد حساب کاربری خود شوید.',
      submit: 'ورود',
      submitting: 'در حال ورود…',
      noAccount: 'حساب کاربری ندارید؟',
      registerCta: 'ثبت‌نام کنید',
      genericError: 'ورود ناموفق بود. لطفاً دوباره تلاش کنید.',
    },
    register: {
      title: 'ساخت حساب کاربری',
      subtitle: 'با ساخت حساب می‌توانید جلسه ایجاد کنید و میزبان آن باشید.',
      submit: 'ثبت‌نام',
      submitting: 'در حال ساخت حساب…',
      hasAccount: 'قبلاً ثبت‌نام کرده‌اید؟',
      loginCta: 'ورود به حساب',
      genericError: 'ثبت‌نام با مشکل مواجه شد. لطفاً دوباره تلاش کنید.',
      passwordHint: 'حداقل ۸ کاراکتر، شامل یک حرف و یک رقم',
    },
    fields: {
      email: 'ایمیل',
      password: 'رمز عبور',
      displayName: 'نام نمایشی',
      invalidEmail: 'ایمیل معتبر نیست',
      passwordRequired: 'رمز عبور الزامی است',
      passwordMin: 'رمز عبور باید حداقل ۸ کاراکتر باشد',
      passwordMax: 'رمز عبور نمی‌تواند بیشتر از ۷۲ کاراکتر باشد',
      passwordNeedsLetter: 'رمز عبور باید حداقل یک حرف داشته باشد',
      passwordNeedsDigit: 'رمز عبور باید حداقل یک رقم داشته باشد',
      displayNameMin: 'نام نمایشی باید حداقل ۲ کاراکتر باشد',
      displayNameMax: 'نام نمایشی نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد',
    },
  },

  dashboard: {
    hero: {
      pill: 'داشبورد میتینو',
      greeting: (name: string) => `سلام، ${name} 👋`,
      subtitle:
        'جلسه‌ای بسازید، لینک را برای شرکت‌کنندگان بفرستید و میزبان جلسه باشید.',
      createCta: 'ایجاد جلسه جدید',
    },
    meetings: {
      sectionTitle: 'جلسات من',
      empty: {
        title: 'هنوز جلسه‌ای ندارید',
        description:
          'اولین جلسه خود را بسازید و لینک آن را با شرکت‌کنندگان به اشتراک بگذارید.',
        action: 'ساخت اولین جلسه',
      },
      loadError: 'بارگذاری جلسات با خطا مواجه شد.',
      joinCta: 'ورود به جلسه',
      copyLink: 'کپی لینک',
    },
    account: {
      title: 'اطلاعات حساب',
      displayName: 'نام نمایشی',
      email: 'ایمیل',
      role: 'نقش',
      memberSince: 'عضو از',
    },
    userMenu: {
      logout: 'خروج از حساب',
    },
  },

  meetingStatus: {
    SCHEDULED: 'برنامه‌ریزی‌شده',
    LIVE: 'در حال برگزاری',
    ENDED: 'پایان‌یافته',
    CANCELLED: 'لغو شده',
  },

  prejoin: {
    statusBadgePrefix: 'وضعیت',
    hostLabel: 'میزبان',
    locked: 'قفل',
    needsPassword: 'نیاز به رمز',
    permissionPrompt:
      'اولین بار که میکروفون یا دوربین را روشن می‌کنید، مرورگر اجازه دسترسی می‌خواهد.',
    cameraStatus: {
      requesting: 'در حال درخواست اجازه از مرورگر…',
      denied: 'دسترسی به دوربین رد شد. می‌توانید بدون دوربین وارد جلسه شوید.',
      notFound: 'دوربینی پیدا نشد. می‌توانید بدون دوربین وارد شوید.',
      off: 'دوربین خاموش است',
      idle: 'در حال آماده‌سازی پیش‌نمایش…',
    },
    closed: '🎬 این جلسه پایان یافته است و دیگر قابل پیوستن نیست.',
    notFound: 'این جلسه پیدا نشد یا لینک شما معتبر نیست.',
    loadError: 'خطا در بارگذاری اطلاعات جلسه.',
    guestLocked:
      '🔒 این جلسه قفل است. برای ورود باید با حساب کاربری وارد شوید یا منتظر بمانید تا میزبان قفل را باز کند.',
    hostLockedNotice:
      '🔒 این جلسه قفل است. اگر میزبان یا مدیر هستید، می‌توانید وارد شوید؛ در غیر این صورت ورود رد می‌شود.',
    join: {
      joining: 'در حال پیوستن…',
      registeredCta: 'پیوستن به جلسه',
      guestCta: 'پیوستن به‌عنوان مهمان',
      withAccountPrefix: 'با حساب کاربری',
      withAccountSuffix: 'وارد جلسه می‌شوید.',
      haveAccount: 'حساب دارید؟',
      loginCta: 'ورود به حساب کاربری',
      nameField: 'نام شما',
      namePlaceholder: 'مثلاً سارا',
      passwordField: 'رمز عبور جلسه',
      passwordPlaceholder: 'رمز عبور',
      backHome: 'بازگشت به صفحه اصلی',
      genericError: 'پیوستن به جلسه با خطا مواجه شد.',
    },
  },

  room: {
    hostLabel: 'میزبان',
    locked: '🔒 این جلسه قفل است؛ شرکت‌کنندگان جدید نمی‌توانند وارد شوند.',
    leave: 'خروج از جلسه',
    loadError: 'بارگذاری اتاق با خطا مواجه شد.',
    backToPrejoin: 'بازگشت به صفحه پیش‌ورود',
    kickedOther: (name: string) => `${name} از جلسه حذف شد.`,
    elapsedAria: (label: string) => `زمان جلسه ${label}`,
    connectionLabels: {
      realtime: 'چت/حضور',
      media: 'تصویر/صدا',
    },
    mediaStatus: {
      connecting: 'تصویر/صدا: در حال اتصال…',
      connected: 'تصویر/صدا: متصل',
      reconnecting: 'تصویر/صدا: اتصال مجدد…',
      disconnected: 'تصویر/صدا: قطع',
      error: 'تصویر/صدا: خطا',
      idle: 'تصویر/صدا: بی‌اتصال',
    },
    kickedScreen: {
      title: 'شما از جلسه حذف شدید',
      body:
        'میزبان جلسه دسترسی شما را قطع کرد. با نشست فعلی نمی‌توانید دوباره وارد همین جلسه شوید.',
    },
    endedScreen: {
      title: 'جلسه پایان یافت',
      body:
        'این جلسه توسط میزبان پایان داده شده است. می‌توانید بعداً یک جلسهٔ جدید شروع کنید.',
    },
    livekit: {
      connectError: 'اتصال به سرور ویدیو با خطا مواجه شد.',
    },
    chat: {
      title: 'چت جلسه',
      messagesCount: (n: number) => `${n} پیام`,
      empty: 'هنوز پیامی فرستاده نشده.',
      emptyHint: 'اولین پیام را شما بنویسید.',
      sendAria: 'ارسال پیام',
      enterHint: 'Enter برای ارسال — Shift+Enter برای خط جدید',
      placeholder: 'پیام خود را بنویسید…',
      bodyRequired: 'پیام نمی‌تواند خالی باشد.',
      bodyTooLong: (n: number) => `پیام نباید بیشتر از ${n} کاراکتر باشد.`,
      socketDown: 'اتصال برقرار نیست.',
      historyError: 'بارگذاری تاریخچهٔ چت با خطا مواجه شد.',
    },
    participants: {
      title: 'شرکت‌کنندگان',
      onlineSuffix: (n: number) => `${n} نفر آنلاین`,
      empty: 'هیچ‌کس آنلاین نیست.',
      youSuffix: '(شما)',
      kickConfirm: {
        title: 'حذف شرکت‌کننده',
        body: (name: string) =>
          `آیا «${name}» را از جلسه حذف می‌کنید؟ این فرد دیگر نمی‌تواند با همین لینک یا نشست مهمان وارد شود.`,
        confirm: 'بله، حذف کن',
      },
      kickError: 'حذف شرکت‌کننده با خطا مواجه شد.',
      kickTitle: 'حذف از جلسه',
    },
    media: {
      micOnAria: 'بستن میکروفون',
      micOffAria: 'باز کردن میکروفون',
      cameraOnAria: 'بستن دوربین',
      cameraOffAria: 'باز کردن دوربین',
      screenOnAria: 'پایان اشتراک صفحه',
      screenOffAria: 'اشتراک‌گذاری صفحه',
      leaveAria: 'خروج از جلسه',
      permissionDenied: {
        camera: 'دسترسی به دوربین رد شد. می‌توانید بدون دوربین در جلسه بمانید.',
        microphone:
          'دسترسی به میکروفون رد شد. می‌توانید بدون میکروفون در جلسه بمانید.',
        screen: 'دسترسی به اشتراک‌گذاری صفحه رد شد.',
      },
      notFound: {
        camera: 'دوربینی یافت نشد.',
        microphone: 'میکروفونی یافت نشد.',
        screen: 'منبع اشتراک‌گذاری پیدا نشد.',
      },
      busy: 'دستگاه توسط برنامهٔ دیگری استفاده می‌شود.',
      generic: 'خطا در تنظیم دستگاه',
    },
  },

  hostControls: {
    sectionTitle: 'کنترل میزبان',
    onlyHost: 'فقط برای میزبان',
    genericError: 'خطایی رخ داد.',
    lock: {
      heading: 'قفل جلسه',
      bodyLocked:
        'این جلسه قفل است. هیچ شرکت‌کنندهٔ جدیدی نمی‌تواند وارد شود.',
      bodyOpen: 'هرکسی با لینک جلسه می‌تواند وارد شود.',
      lockBtn: 'قفل کردن',
      unlockBtn: 'باز کردن',
    },
    password: {
      heading: 'رمز عبور جلسه',
      active: 'فعال',
      inactive: 'غیرفعال',
      placeholderChange: 'تغییر رمز عبور…',
      placeholderSet: 'تنظیم رمز عبور…',
      saveBtn: 'ذخیره',
      clearBtn: 'حذف رمز',
      tooShort: 'رمز عبور باید حداقل ۴ کاراکتر باشد.',
    },
    end: {
      heading: 'پایان دادن جلسه برای همه',
      body: 'این کار قابل بازگشت نیست. همه از جلسه خارج می‌شوند.',
      btn: 'پایان جلسه',
      confirm: {
        title: 'پایان دادن جلسه؟',
        body:
          'با تأیید این عمل، جلسه برای همهٔ شرکت‌کنندگان بسته می‌شود و تماس‌های تصویری قطع خواهند شد. این کار قابل بازگشت نیست.',
        ok: 'بله، پایان بده',
      },
    },
  },

  meetingCard: {
    createdAt: 'ساخته‌شده در',
    statusLocked: 'قفل',
    statusPasswordProtected: 'رمزدار',
  },

  meetingCreated: {
    title: 'جلسه ساخته شد',
    okPrimary: 'جلسهٔ شما آماده است.',
    okSecondary:
      'لینک زیر را برای شرکت‌کنندگان ارسال کنید — هر کسی با لینک می‌تواند به‌عنوان مهمان وارد جلسه شود.',
    linkLabel: 'لینک جلسه',
    titleField: 'عنوان',
    codeField: 'کد جلسه',
    enterCta: 'ورود به جلسه',
  },

  // ── Phase 7.6 — analytics, history, attendance, rejoin ───────────
  dashboardStats: {
    title: 'آمار جلسه‌های شما',
    subtitle: 'مرور کلی فعالیت شما در میتینو.',
    cards: {
      totalMeetings: 'تعداد کل جلسات',
      endedMeetings: 'جلسات برگزارشده',
      activeMeetings: 'جلسات فعال',
      totalDuration: 'مجموع زمان جلسات',
      averageDuration: 'میانگین زمان جلسه',
      totalParticipants: 'مجموع شرکت‌کنندگان',
      totalGuests: 'تعداد مهمان‌ها',
    },
    empty: 'هنوز جلسه‌ای ایجاد نکرده‌اید.',
    loading: 'در حال بارگذاری آمار…',
  },

  history: {
    title: 'آخرین جلسه‌ها',
    cta: 'مشاهدهٔ جزئیات',
    duration: 'مدت',
    participants: 'شرکت‌کننده',
    guests: 'مهمان',
    empty: 'هنوز جلسه‌ای ندارید.',
    statuses: {
      SCHEDULED: 'برنامه‌ریزی‌شده',
      LIVE: 'در حال برگزاری',
      ENDED: 'پایان‌یافته',
      CANCELLED: 'لغو‌شده',
    },
  },

  details: {
    title: 'جزئیات جلسه',
    sectionMeta: 'اطلاعات جلسه',
    sectionAttendance: 'فهرست حضور',
    fields: {
      slug: 'کد جلسه',
      status: 'وضعیت',
      createdAt: 'تاریخ ایجاد',
      startedAt: 'شروع',
      endedAt: 'پایان',
      duration: 'مدت زمان',
      host: 'میزبان',
      chatCount: 'تعداد پیام‌های چت',
    },
    attendance: {
      colName: 'نام شرکت‌کننده',
      colKind: 'نوع کاربر',
      colRole: 'نقش',
      colJoinedAt: 'زمان ورود',
      colLeftAt: 'زمان خروج',
      colDuration: 'مدت حضور',
      colStatus: 'وضعیت',
      kindRegistered: 'کاربر ثبت‌نام‌شده',
      kindGuest: 'مهمان',
      roleHost: 'میزبان',
      roleStudent: 'دانشجو',
      roleGuest: 'مهمان',
      statusActive: 'فعال',
      statusLeft: 'خارج‌شده',
      statusKicked: 'اخراج‌شده',
      empty: 'هنوز شرکت‌کننده‌ای وارد جلسه نشده است.',
    },
    redacted:
      'فقط میزبان یا مدیر می‌تواند فهرست کامل حضور را ببیند. شما فقط رکورد خودتان را می‌بینید.',
    loading: 'در حال بارگذاری اطلاعات جلسه…',
  },

  rejoin: {
    kickedScreen: {
      title: 'شما از جلسه خارج شده‌اید.',
      desc: 'برای ورود مجدد باید از میزبان اجازه بگیرید.',
      messagePlaceholder: 'دلیل یا پیامی برای میزبان (اختیاری)',
      submit: 'درخواست ورود مجدد',
      submitting: 'در حال ارسال…',
      pending: 'درخواست شما ارسال شد. لطفاً منتظر تأیید میزبان بمانید.',
      rejected: 'میزبان درخواست ورود مجدد شما را رد کرد.',
      back: 'بازگشت به پیشخوان',
    },
    host: {
      toast: 'یک کاربر درخواست ورود مجدد دارد',
      approve: 'تأیید ورود',
      reject: 'رد درخواست',
      modalTitle: 'درخواست ورود مجدد',
    },
    notify: {
      approved: 'درخواست شما تأیید شد. لطفاً دوباره به جلسه وارد شوید.',
      rejected: 'میزبان درخواست ورود مجدد را رد کرد.',
    },
  },

  autoEnd: {
    banner:
      'این جلسه به دلیل خالی بودن پس از یک ساعت به صورت خودکار پایان یافت.',
  },

  // ── Phase 7.6 — local recording ───────────────────────────────────
  recording: {
    btn: {
      start: 'ضبط',
      stop: 'پایان ضبط',
      preparing: 'در حال آماده‌سازی…',
    },
    state: {
      idle: 'آماده ضبط',
      recording: 'در حال ضبط',
      stopped: 'ضبط متوقف شد',
      error: 'خطا در شروع ضبط',
      denied: 'دسترسی ضبط داده نشد',
    },
    notice:
      'ضبط به صورت محلی انجام می‌شود و فقط روی دستگاه شما ذخیره می‌شود. فایل ضبط‌شده روی سرور ذخیره نمی‌شود.',
    unsupported:
      'مرورگر شما از ضبط محلی پشتیبانی نمی‌کند. لطفاً از یک نسخهٔ به‌روز کروم، اج یا فایرفاکس استفاده کنید.',
    saveAria: 'دانلود فایل ضبط',
    emptyError: 'هیچ ویدیویی ضبط نشد.',
  },

  // ── Phase 7.7 — whiteboard ────────────────────────────────────────
  whiteboard: {
    title: 'تخته سفید',
    toolbarLabel: 'تخته سفید',
    loading: 'در حال آماده‌سازی تخته…',
    colorLabel: 'رنگ',
    sizeLabel: 'اندازه قلم',
    tools: {
      pen: 'قلم',
      eraser: 'پاک‌کن',
      text: 'متن',
      line: 'خط',
      rect: 'مستطیل',
      circle: 'دایره',
    },
    actions: {
      undo: 'بازگشت',
      redo: 'انجام مجدد',
      clear: 'پاک کردن تخته',
    },
  },

  // ── Phase 7.7 — file sharing ──────────────────────────────────────
  files: {
    title: 'اشتراک فایل',
    listTitle: 'فایل‌های جلسه',
    empty: 'هنوز فایلی به اشتراک گذاشته نشده است.',
    preview: 'پیش‌نمایش',
    download: 'دانلود',
    delete: 'حذف',
    deleteConfirmTitle: 'حذف فایل',
    deleteConfirmMessage: (name: string) =>
      `آیا فایل «${name}» حذف شود؟ این عمل قابل بازگشت نیست.`,
    pdfFallback: 'مرورگر شما از نمایش PDF داخل صفحه پشتیبانی نمی‌کند.',
    openInNewTab: 'باز کردن در تب جدید',
    unsupportedPreview: 'پیش‌نمایش برای این نوع فایل پشتیبانی نمی‌شود.',
    upload: {
      cta: 'آپلود فایل',
      hint: 'فایل را اینجا رها کنید یا کلیک کنید (jpg, png, webp, pdf — حداکثر ۲۵ مگابایت).',
    },
    errors: {
      unsupported: 'فرمت فایل پشتیبانی نمی‌شود.',
      tooLarge: 'حجم فایل بیش از حد مجاز است.',
      unauthorizedDelete: 'فقط آپلودکننده یا میزبان می‌تواند این فایل را حذف کند.',
    },
  },

  // ── Phase 7.7 — camera background effects ─────────────────────────
  cameraEffects: {
    title: 'افکت دوربین',
    chooseImage: 'انتخاب تصویر پس‌زمینه',
    removeImage: 'حذف تصویر پس‌زمینه',
    imageTooLarge: 'حجم تصویر بیش از ۵ مگابایت است.',
    unsupported: 'افکت دوربین روی این دستگاه پشتیبانی نمی‌شود.',
    options: {
      none: 'بدون افکت',
      blur: 'محو کردن پس‌زمینه',
      virtual: 'پس‌زمینه مجازی',
    },
  },

  // ── Phase 7.7 — meeting toolbar additions ─────────────────────────
  toolbar: {
    whiteboard: 'تخته سفید',
    files: 'فایل‌ها',
    effects: 'افکت دوربین',
    more: 'بیشتر',
  },
} as const;

export type FaDict = typeof fa;
