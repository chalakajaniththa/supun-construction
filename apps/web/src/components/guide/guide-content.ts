import {
  Building2,
  CalendarDays,
  ClipboardPen,
  FileText,
  HardHat,
  LifeBuoy,
  ReceiptText,
  Rocket,
  Settings,
  ShoppingCart,
  Tractor,
  type LucideIcon,
} from 'lucide-react';

/**
 * The in-app user guide (/guide), in English and Sinhala.
 *
 * Text can use two small marks:
 *  - `[[daily.markAllPresent]]` shows the label of a button or tab exactly as the screen shows it
 *    (from messages/en.json or si.json), so the guide always matches the screen.
 *  - `**words**` are shown in bold.
 *
 * `shot` is a screenshot in public/guide/<locale>/<shot>.webp, made by
 * e2e/guide-screenshots.spec.ts. A unit test checks that every shot and every [[key]] exists.
 */

export interface GuideText {
  en: string;
  si: string;
}

export type GuideSectionId =
  | 'start'
  | 'daily'
  | 'projects'
  | 'schedule'
  | 'workers'
  | 'machines'
  | 'purchases'
  | 'documents'
  | 'reports'
  | 'settings'
  | 'problems';

export interface GuideSection {
  id: GuideSectionId;
  icon: LucideIcon;
  title: GuideText;
  description: GuideText;
  /** The pages this section is about (the Help button opens the section of the current page). */
  paths: string[];
}

export interface GuideStep {
  text: GuideText;
  shot?: string;
}

export interface GuideTopic {
  id: string;
  section: GuideSectionId;
  title: GuideText;
  /** One or two sentences: what this is for. */
  summary: GuideText;
  /** Other words people may search with (comma separated). */
  keywords: GuideText;
  /** The page where this is done ("Open this page" button). */
  page?: string;
  steps: GuideStep[];
  tips?: GuideText[];
  warnings?: GuideText[];
  related?: string[];
  /** Shown under "Most used" on the guide's first page. */
  popular?: boolean;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'start',
    icon: Rocket,
    title: { en: 'Getting started', si: 'ආරම්භ කිරීම' },
    description: {
      en: 'Log in, find your way around the screen and change the language.',
      si: 'ඇතුළු වීම, තිරය හඳුනා ගැනීම සහ භාෂාව මාරු කිරීම.',
    },
    paths: ['/dashboard', '/login'],
  },
  {
    id: 'daily',
    icon: ClipboardPen,
    title: { en: 'Every day', si: 'දිනපතා වැඩ' },
    description: {
      en: 'Attendance, machine hours, fuel, expenses and reminders.',
      si: 'පැමිණීම, යන්ත්‍ර පැය, ඉන්ධන, වියදම් සහ මතක් කිරීම්.',
    },
    paths: ['/daily', '/notifications'],
  },
  {
    id: 'projects',
    icon: Building2,
    title: { en: 'Projects and bills', si: 'ව්‍යාපෘති සහ බිල්පත්' },
    description: {
      en: 'New projects, budget, BOQ and progress, bills (IPC), payments, variations and bonds.',
      si: 'නව ව්‍යාපෘති, අයවැය, BOQ සහ ප්‍රගතිය, බිල්පත් (IPC), ගෙවීම්, වෙනස්කම් සහ ඇපකර.',
    },
    paths: ['/projects'],
  },
  {
    id: 'schedule',
    icon: CalendarDays,
    title: { en: 'Schedule', si: 'වැඩ සැලැස්ම' },
    description: {
      en: 'Plan which worker and which machine goes to which site.',
      si: 'කුමන සේවකයා සහ කුමන යන්ත්‍රය කුමන වැඩබිමට යනවාද යන්න සැලසුම් කිරීම.',
    },
    paths: ['/schedule'],
  },
  {
    id: 'workers',
    icon: HardHat,
    title: { en: 'Workers and salaries', si: 'සේවකයින් සහ වැටුප්' },
    description: {
      en: 'Add workers, change pay, give advances and pay the monthly salaries.',
      si: 'සේවකයින් එකතු කිරීම, වැටුප වෙනස් කිරීම, අත්තිකාරම් දීම සහ මාසික වැටුප් ගෙවීම.',
    },
    paths: ['/workers', '/payroll'],
  },
  {
    id: 'machines',
    icon: Tractor,
    title: { en: 'Machines and vehicles', si: 'යන්ත්‍ර සහ වාහන' },
    description: {
      en: 'Add machines, record services and repairs, and keep vehicle papers.',
      si: 'යන්ත්‍ර එකතු කිරීම, සර්විස් සහ අලුත්වැඩියා සටහන් කිරීම, වාහන ලියකියවිලි තබා ගැනීම.',
    },
    paths: ['/assets'],
  },
  {
    id: 'purchases',
    icon: ShoppingCart,
    title: { en: 'Purchases, store and suppliers', si: 'මිලදී ගැනීම්, ගබඩාව සහ සැපයුම්කරුවන්' },
    description: {
      en: 'Record what you buy, send materials to sites and pay suppliers.',
      si: 'මිලදී ගන්නා දේ සටහන් කිරීම, ද්‍රව්‍ය වැඩබිම්වලට යැවීම සහ සැපයුම්කරුවන්ට ගෙවීම.',
    },
    paths: ['/purchases', '/suppliers'],
  },
  {
    id: 'documents',
    icon: FileText,
    title: { en: 'Documents', si: 'ලේඛන' },
    description: {
      en: 'Keep insurance, licences, contracts and other papers, and renew them.',
      si: 'රක්ෂණ, බලපත්‍ර, ගිවිසුම් සහ වෙනත් ලියකියවිලි තබා ගැනීම සහ අලුත් කිරීම.',
    },
    paths: ['/documents'],
  },
  {
    id: 'reports',
    icon: ReceiptText,
    title: { en: 'Reports', si: 'වාර්තා' },
    description: {
      en: 'Download reports as PDF (to print) or Excel.',
      si: 'වාර්තා PDF (මුද්‍රණයට) හෝ Excel ලෙස බාගැනීම.',
    },
    paths: ['/reports'],
  },
  {
    id: 'settings',
    icon: Settings,
    title: { en: 'Settings and backups', si: 'සැකසුම් සහ බැකප්' },
    description: {
      en: 'Company details, salary rates, backups, Google Drive and the sample data.',
      si: 'සමාගම් විස්තර, වැටුප් අනුපාත, බැකප්, Google Drive සහ නියැදි දත්ත.',
    },
    paths: ['/settings'],
  },
  {
    id: 'problems',
    icon: LifeBuoy,
    title: { en: 'Problems and questions', si: 'ගැටලු සහ ප්‍රශ්න' },
    description: {
      en: 'What to do when something does not work as expected.',
      si: 'යමක් බලාපොරොත්තු වූ ලෙස වැඩ නොකරන විට කළ යුතු දේ.',
    },
    paths: [],
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  // ── Getting started ───────────────────────────────────────────────────────────────────
  {
    id: 'login',
    section: 'start',
    title: { en: 'Log in and log out', si: 'ඇතුළු වීම සහ පිටවීම' },
    summary: {
      en: 'Open the system in your web browser and log in with your username and password.',
      si: 'වෙබ් බ්‍රව්සරයෙන් පද්ධතිය විවෘත කර ඔබගේ පරිශීලක නාමය සහ මුරපදය යොදා ඇතුළු වන්න.',
    },
    keywords: {
      en: 'login, sign in, open, start, username, password, logout, sign out, exit',
      si: 'ඇතුළු වීම, ලොග් වීම, විවෘත කිරීම, පරිශීලක නාමය, මුරපදය, පිටවීම, ලොග් අවුට්',
    },
    page: '/login',
    steps: [
      {
        text: {
          en: 'Open your web browser (Safari or Chrome) and go to **http://localhost:3000**. Tip: add it to your bookmarks.',
          si: 'වෙබ් බ්‍රව්සරය (Safari හෝ Chrome) විවෘත කර **http://localhost:3000** වෙත යන්න. ඉඟිය: එය bookmark එකක් ලෙස සුරකින්න.',
        },
      },
      {
        text: {
          en: 'Type your username (1) and your password (2), then press [[auth.login]] (3).',
          si: 'ඔබගේ පරිශීලක නාමය (1) සහ මුරපදය (2) ටයිප් කර [[auth.login]] (3) ඔබන්න.',
        },
        shot: 'login',
      },
      {
        text: {
          en: 'To log out, click your name at the top right, then [[common.logout]] (2).',
          si: 'පිටවීමට, ඉහළ දකුණු කෙළවරේ ඇති ඔබගේ නම ක්ලික් කර, [[common.logout]] (2) ඔබන්න.',
        },
        shot: 'user-menu',
      },
    ],
    tips: [
      {
        en: 'You stay logged in for 7 days on this computer, so usually you do not need to log in every day.',
        si: 'මෙම පරිගණකයේ දින 7ක් ඔබ ඇතුළු වී සිටින නිසා, සාමාන්‍යයෙන් දිනපතා ඇතුළු වීමට අවශ්‍ය නැත.',
      },
    ],
    related: ['password', 'faq-site-not-reached', 'faq-forgot-password'],
  },
  {
    id: 'screen-tour',
    section: 'start',
    title: { en: 'Find your way around the screen', si: 'තිරයේ කොටස් හඳුනා ගන්න' },
    summary: {
      en: 'Every page has the same menu on the left and the same buttons at the top.',
      si: 'සෑම පිටුවකම වම් පැත්තේ එකම මෙනුව සහ ඉහළින් එකම බොත්තම් ඇත.',
    },
    keywords: {
      en: 'menu, sidebar, top bar, buttons, help, where, navigation, bell, backup dot',
      si: 'මෙනුව, පැති තීරුව, ඉහළ තීරුව, බොත්තම්, උදව්, සීනුව, බැකප් තිත',
    },
    page: '/dashboard',
    steps: [
      {
        text: {
          en: '**The menu (1)** on the left opens each part of the system: [[nav.dashboard]], [[nav.daily]], [[nav.projects]], [[nav.workers]] and so on. The part you are in is coloured.',
          si: 'වම් පැත්තේ **මෙනුව (1)** මඟින් පද්ධතියේ සෑම කොටසක්ම විවෘත වේ: [[nav.dashboard]], [[nav.daily]], [[nav.projects]], [[nav.workers]] ආදිය. ඔබ සිටින කොටස වර්ණයෙන් පෙන්වයි.',
        },
        shot: 'screen-tour',
      },
      {
        text: {
          en: '**EN | සිං (2)** changes the language. **The backup dot (3)** shows if your data is safely backed up (green is good). **The bell (4)** shows reminders. **Your name (5)** has the password and log-out buttons.',
          si: '**EN | සිං (2)** මඟින් භාෂාව මාරු වේ. **බැකප් තිත (3)** ඔබගේ දත්ත ආරක්ෂිතව බැකප් වී ඇත්දැයි පෙන්වයි (කොළ පැහැය නම් හොඳයි). **සීනුව (4)** මතක් කිරීම් පෙන්වයි. **ඔබගේ නමෙහි (5)** මුරපදය සහ පිටවීමේ බොත්තම් ඇත.',
        },
      },
      {
        text: {
          en: 'The **question mark** button at the top opens this guide at the help for the page you are on.',
          si: 'ඉහළ ඇති **ප්‍රශ්නාර්ථ ලකුණ** බොත්තම, ඔබ සිටින පිටුවට අදාළ උදව් සමඟ මෙම මාර්ගෝපදේශය විවෘත කරයි.',
        },
        shot: 'help-button',
      },
    ],
    tips: [
      {
        en: 'On a small screen the menu is hidden. Press the button with three lines at the top left to open it.',
        si: 'කුඩා තිරයක මෙනුව සැඟවී ඇත. එය විවෘත කිරීමට ඉහළ වම් පැත්තේ ඉරි තුනක් ඇති බොත්තම ඔබන්න.',
      },
    ],
    related: ['language', 'dashboard', 'reminders', 'backup'],
    popular: true,
  },
  {
    id: 'language',
    section: 'start',
    title: {
      en: 'Change the language (English / Sinhala)',
      si: 'භාෂාව මාරු කරන්න (ඉංග්‍රීසි / සිංහල)',
    },
    summary: {
      en: 'Use the system in English or in Sinhala. You can switch at any time.',
      si: 'පද්ධතිය ඉංග්‍රීසියෙන් හෝ සිංහලෙන් භාවිත කරන්න. ඕනෑම වේලාවක මාරු කළ හැක.',
    },
    keywords: {
      en: 'language, sinhala, english, translate, sinhalese',
      si: 'භාෂාව, සිංහල, ඉංග්‍රීසි, පරිවර්තනය',
    },
    steps: [
      {
        text: {
          en: 'At the top right, click **සිං** for Sinhala or **EN** for English. The whole screen changes at once.',
          si: 'ඉහළ දකුණු පැත්තේ, සිංහල සඳහා **සිං** හෝ ඉංග්‍රීසි සඳහා **EN** ක්ලික් කරන්න. මුළු තිරයම එවලේම වෙනස් වේ.',
        },
        shot: 'language',
      },
    ],
    tips: [
      {
        en: 'The system remembers your choice. Reports (PDF and Excel) and this guide also come out in the language you choose.',
        si: 'පද්ධතිය ඔබගේ තේරීම මතක තබා ගනී. වාර්තා (PDF සහ Excel) සහ මෙම මාර්ගෝපදේශයද ඔබ තෝරන භාෂාවෙන් ලැබේ.',
      },
    ],
    related: ['screen-tour', 'reports'],
  },
  {
    id: 'dashboard',
    section: 'start',
    title: { en: 'Understand the dashboard', si: 'මුල් පිටුව තේරුම් ගන්න' },
    summary: {
      en: 'The first page shows how the business is doing today and what needs your attention.',
      si: 'පළමු පිටුවෙන් අද ව්‍යාපාරය කෙසේ සිදු වේද සහ ඔබගේ අවධානය අවශ්‍ය දේ පෙන්වයි.',
    },
    keywords: {
      en: 'dashboard, home, summary, overview, today, kpi, money to receive, spent',
      si: 'මුල් පිටුව, සාරාංශය, අද, ලැබිය යුතු මුදල්, වියදම',
    },
    page: '/dashboard',
    steps: [
      {
        text: {
          en: 'The four boxes at the top show: (1) projects that are running, (2) workers at the sites today, (3) money spent this month, (4) money the clients still have to pay you. Click a box to see the details.',
          si: 'ඉහළ ඇති කොටු හතරෙන් පෙන්වන්නේ: (1) ක්‍රියාත්මක ව්‍යාපෘති, (2) අද වැඩබිම්වල සිටින සේවකයින්, (3) මේ මාසයේ වියදම් කළ මුදල, (4) සේවාදායකයින් තවමත් ඔබට ගෙවිය යුතු මුදල. විස්තර බැලීමට කොටුවක් ක්ලික් කරන්න.',
        },
        shot: 'dashboard-kpis',
      },
      {
        text: {
          en: '[[dashboard.needsAttention]] lists papers that expire, machines due for a service, projects over budget and backup problems. Click a line to go straight to it.',
          si: '[[dashboard.needsAttention]] යටතේ කල් ඉකුත් වන ලියකියවිලි, සර්විස් කළ යුතු යන්ත්‍ර, අයවැය ඉක්මවූ ව්‍යාපෘති සහ බැකප් ගැටලු පෙන්වයි. එහි යාමට පේළියක් ක්ලික් කරන්න.',
        },
        shot: 'dashboard-attention',
      },
      {
        text: {
          en: 'Lower down, each running project has three thin bars: **time used**, **budget used** and **work done**. If budget or time is far ahead of the work done, look at that project.',
          si: 'පහළින්, සෑම ක්‍රියාත්මක ව්‍යාපෘතියකටම තුනී තීරු තුනක් ඇත: **ගත වූ කාලය**, **වියදම් කළ අයවැය** සහ **කළ වැඩ**. අයවැය හෝ කාලය කළ වැඩට වඩා බොහෝ ඉදිරියෙන් නම්, එම ව්‍යාපෘතිය පරීක්ෂා කරන්න.',
        },
        shot: 'dashboard-projects',
      },
    ],
    tips: [
      {
        en: 'The [[dashboard.quickActions]] buttons open the things you do most: [[nav.daily]], [[dashboard.addExpense]] and [[dashboard.uploadDocument]].',
        si: '[[dashboard.quickActions]] බොත්තම් මඟින් ඔබ බොහෝ විට කරන දේ විවෘත වේ: [[nav.daily]], [[dashboard.addExpense]] සහ [[dashboard.uploadDocument]].',
      },
    ],
    related: ['reminders', 'project-health', 'daily-attendance'],
  },
  {
    id: 'password',
    section: 'start',
    title: { en: 'Change your password', si: 'ඔබගේ මුරපදය වෙනස් කරන්න' },
    summary: {
      en: 'Choose your own password so nobody else can open your records.',
      si: 'වෙනත් කිසිවෙකුට ඔබගේ වාර්තා විවෘත කළ නොහැකි වන පරිදි ඔබේම මුරපදයක් තෝරන්න.',
    },
    keywords: {
      en: 'password, change password, security, safe, yellow banner',
      si: 'මුරපදය, මුරපදය වෙනස් කිරීම, ආරක්ෂාව, කහ පැහැති දැන්වීම',
    },
    page: '/settings?tab=password',
    steps: [
      {
        text: {
          en: 'Click your name at the top right, then [[common.changePassword]] (1).',
          si: 'ඉහළ දකුණේ ඔබගේ නම ක්ලික් කර, [[common.changePassword]] (1) ඔබන්න.',
        },
        shot: 'user-menu',
      },
      {
        text: {
          en: 'Type the password you use now (1). Then type the new password two times (2, 3) — at least 8 characters. Press [[settings.password.submit]] (4).',
          si: 'දැන් භාවිත කරන මුරපදය (1) ටයිප් කරන්න. ඉන්පසු නව මුරපදය දෙවරක් (2, 3) ටයිප් කරන්න — අවම වශයෙන් අකුරු 8ක්. [[settings.password.submit]] (4) ඔබන්න.',
        },
        shot: 'password',
      },
    ],
    warnings: [
      {
        en: 'Write the new password on paper and keep it in a safe place.',
        si: 'නව මුරපදය කඩදාසියක ලියා ආරක්ෂිත ස්ථානයක තබන්න.',
      },
    ],
    tips: [
      {
        en: 'While the first password (admin123) is still used, a yellow banner at the top reminds you to change it.',
        si: 'පළමු මුරපදය (admin123) තවමත් භාවිත වන තාක්, ඉහළින් ඇති කහ පැහැති දැන්වීමක් එය වෙනස් කිරීමට මතක් කරයි.',
      },
    ],
    related: ['login', 'faq-forgot-password'],
  },
  {
    id: 'start-stop',
    section: 'start',
    title: {
      en: 'Start, stop and update the system',
      si: 'පද්ධතිය ආරම්භ කිරීම, නැවැත්වීම සහ යාවත්කාලීන කිරීම',
    },
    summary: {
      en: 'The system runs on this computer inside Docker Desktop. It starts by itself when Docker starts.',
      si: 'පද්ධතිය මෙම පරිගණකයේ Docker Desktop තුළ ක්‍රියා කරයි. Docker ආරම්භ වන විට එය ඉබේම ආරම්භ වේ.',
    },
    keywords: {
      en: 'start, stop, docker, mac, windows, linux, turn on, turn off, start.command, stop.command, update, install',
      si: 'ආරම්භ කිරීම, නැවැත්වීම, docker, mac, පණගැන්වීම, අක්‍රිය කිරීම, යාවත්කාලීන කිරීම',
    },
    steps: [
      {
        text: {
          en: 'The system runs inside **Docker Desktop**. Keep Docker Desktop open (on a Mac: the whale icon in the top menu bar; on Windows: the whale icon near the clock). When Docker starts, the system starts by itself.',
          si: 'පද්ධතිය **Docker Desktop** තුළ ක්‍රියා කරයි. Docker Desktop විවෘතව තබා ගන්න (Mac හි: ඉහළ මෙනු තීරුවේ තල්මසා අයිකනය; Windows හි: ඔරලෝසුව අසල ඇති තල්මසා අයිකනය). Docker ආරම්භ වූ විට, පද්ධතිය ඉබේම ආරම්භ වේ.',
        },
      },
      {
        text: {
          en: 'Tip: in Docker Desktop → **Settings → General**, tick **Start Docker Desktop when you sign in**. Then the system is ready every morning without doing anything.',
          si: 'ඉඟිය: Docker Desktop → **Settings → General** හි **Start Docker Desktop when you sign in** සලකුණු කරන්න. එවිට කිසිවක් නොකර සෑම උදෑසනකම පද්ධතිය සූදානම්ව පවතී.',
        },
      },
      {
        text: {
          en: 'To stop or start it by hand, open the **supun-construction** folder in a terminal and type **docker compose stop** or **docker compose up -d**. (On a Mac set up from the source folder you can also double-click **stop.command** / **start.command** in the **scripts** folder.) Your data is always kept.',
          si: 'අතින් නැවැත්වීමට හෝ ආරම්භ කිරීමට, **supun-construction** ෆෝල්ඩරය terminal එකක විවෘත කර **docker compose stop** හෝ **docker compose up -d** ටයිප් කරන්න. (මූලාශ්‍ර ෆෝල්ඩරයෙන් සකසා ඇති Mac එකක **scripts** ෆෝල්ඩරයේ ඇති **stop.command** / **start.command** දෙවරක් ක්ලික් කිරීමටද හැක.) ඔබගේ දත්ත සැමවිටම ආරක්ෂිතව පවතී.',
        },
      },
      {
        text: {
          en: 'When your helper says there is a new version, run the install command again (it is in the file docs/INSTALL.md). It takes a few minutes; your data is kept.',
          si: 'නව සංස්කරණයක් ඇති බව ඔබගේ උදව්කරු පැවසූ විට, ස්ථාපන විධානය නැවත ධාවනය කරන්න (එය docs/INSTALL.md ගොනුවේ ඇත). මිනිත්තු කිහිපයක් ගත වේ; ඔබගේ දත්ත ආරක්ෂිතව පවතී.',
        },
      },
    ],
    tips: [
      {
        en: 'You can leave the system running all the time. The nightly backup at 23:00 only runs while it is running.',
        si: 'ඔබට පද්ධතිය සෑම විටම ක්‍රියාත්මකව තැබිය හැක. රාත්‍රී 23:00 බැකප් එක සිදු වන්නේ එය ක්‍රියාත්මකව ඇති විට පමණි.',
      },
    ],
    related: ['faq-site-not-reached', 'backup'],
  },

  // ── Every day ─────────────────────────────────────────────────────────────────────────
  {
    id: 'daily-attendance',
    section: 'daily',
    title: { en: 'Record who came to work today', si: 'අද වැඩට පැමිණි අය සටහන් කරන්න' },
    summary: {
      en: 'Daily Entry is the most important page. Pick the day and the site, and mark each worker.',
      si: 'දෛනික සටහන් වඩාත්ම වැදගත් පිටුවයි. දිනය සහ වැඩබිම තෝරා, සෑම සේවකයෙකුම සලකුණු කරන්න.',
    },
    keywords: {
      en: 'attendance, present, absent, half day, leave, overtime, ot, daily entry, workers came, roll call',
      si: 'පැමිණීම, පැමිණියා, නොපැමිණියා, භාග දිනය, නිවාඩු, අතිකාල, OT, දෛනික සටහන්, හාජරය',
    },
    page: '/daily',
    steps: [
      {
        text: {
          en: 'Click [[nav.daily]] in the menu. Today is already chosen as the date (1). Choose the site in [[daily.project]] (2).',
          si: 'මෙනුවේ [[nav.daily]] ක්ලික් කරන්න. දිනය (1) ලෙස අද දිනය දැනටමත් තෝරා ඇත. [[daily.project]] (2) හි වැඩබිම තෝරන්න.',
        },
        shot: 'daily-pick',
      },
      {
        text: {
          en: 'Workers planned for this site on the [[nav.schedule]] are listed already. Press [[daily.markAllPresent]] (1) if everyone came, or pick [[daily.status.PRESENT]], [[daily.status.HALF_DAY]], [[daily.status.ABSENT]] or [[daily.status.LEAVE]] for each person (3). Type overtime hours in [[daily.otHours]] if any.',
          si: '[[nav.schedule]] හි මෙම වැඩබිමට සැලසුම් කළ සේවකයින් දැනටමත් ලැයිස්තුගත කර ඇත. සියලු දෙනා පැමිණියා නම් [[daily.markAllPresent]] (1) ඔබන්න, නැතහොත් එක් එක් අයට [[daily.status.PRESENT]], [[daily.status.HALF_DAY]], [[daily.status.ABSENT]] හෝ [[daily.status.LEAVE]] තෝරන්න (3). අතිකාල පැය ඇත්නම් [[daily.otHours]] හි ටයිප් කරන්න.',
        },
        shot: 'daily-attendance',
      },
      {
        text: {
          en: 'Someone came who was not planned? Use [[daily.addWorker]] (4) to add them. [[daily.copyFromYesterday]] (2) fills in the same as the last working day.',
          si: 'සැලසුම් නොකළ කෙනෙක් පැමිණියාද? ඔවුන් එකතු කිරීමට [[daily.addWorker]] (4) භාවිත කරන්න. [[daily.copyFromYesterday]] (2) මඟින් අවසන් වැඩ දිනයේ තිබූ ලෙසම පුරවයි.',
        },
      },
      {
        text: {
          en: 'At the bottom, check the totals (1) and press [[common.save]] (2). Machines and expenses on the same page are saved together.',
          si: 'පහළින්, එකතුව (1) පරීක්ෂා කර [[common.save]] (2) ඔබන්න. එම පිටුවේම ඇති යන්ත්‍ර සහ වියදම්ද එකවර සුරැකේ.',
        },
        shot: 'daily-save',
      },
    ],
    tips: [
      {
        en: 'Rows where you did not choose anything are not saved. Salaries are calculated from this attendance, so record it every day.',
        si: 'ඔබ කිසිවක් නොතෝරූ පේළි සුරැකෙන්නේ නැත. වැටුප් ගණනය කරන්නේ මෙම පැමිණීමෙන් නිසා, එය සෑම දිනකම සටහන් කරන්න.',
      },
      {
        en: 'To fill in a past day, change the date at the top. [[daily.today]] brings you back to today.',
        si: 'පසුගිය දිනයක් පිරවීමට, ඉහළ ඇති දිනය වෙනස් කරන්න. [[daily.today]] මඟින් නැවත අද දිනයට පැමිණේ.',
      },
    ],
    warnings: [
      {
        en: 'A worker can be marked at only one site per day. If they are already marked at another site, you will see a message.',
        si: 'සේවකයෙකු දිනකට එක් වැඩබිමක පමණක් සලකුණු කළ හැක. ඔවුන් දැනටමත් වෙනත් වැඩබිමක සලකුණු කර ඇත්නම්, පණිවිඩයක් පෙනේ.',
      },
    ],
    related: ['daily-machines', 'daily-expenses', 'schedule-book', 'faq-locked-day'],
    popular: true,
  },
  {
    id: 'daily-machines',
    section: 'daily',
    title: { en: 'Record machine hours and fuel', si: 'යන්ත්‍ර පැය සහ ඉන්ධන සටහන් කරන්න' },
    summary: {
      en: 'For each machine that worked at the site, write the meter reading and the fuel used.',
      si: 'වැඩබිමේ වැඩ කළ සෑම යන්ත්‍රයක් සඳහාම මීටර කියවීම සහ භාවිත කළ ඉන්ධන ලියන්න.',
    },
    keywords: {
      en: 'machine, hours, hour meter, fuel, diesel, litres, jcb, excavator, tipper, km, usage, operator',
      si: 'යන්ත්‍ර, පැය, පැය මීටරය, ඉන්ධන, ඩීසල්, ලීටර්, JCB, බැකෝ, ටිපර්, කිලෝමීටර්, ක්‍රියාකරු',
    },
    page: '/daily',
    steps: [
      {
        text: {
          en: 'Open [[nav.daily]] and choose the date and the site, as for attendance.',
          si: 'පැමිණීම සඳහා මෙන්ම, [[nav.daily]] විවෘත කර දිනය සහ වැඩබිම තෝරන්න.',
        },
      },
      {
        text: {
          en: 'Go down to [[daily.sections.usage]]. Machines planned for this site are listed. To add another one, use [[daily.addMachine]] (1).',
          si: '[[daily.sections.usage]] කොටසට පහළට යන්න. මෙම වැඩබිමට සැලසුම් කළ යන්ත්‍ර ලැයිස්තුගත කර ඇත. තවත් එකක් එකතු කිරීමට [[daily.addMachine]] (1) භාවිත කරන්න.',
        },
        shot: 'daily-machines',
      },
      {
        text: {
          en: 'Type the meter reading at the end of the day (2). The hours worked are counted for you. Then type the fuel in litres (3) and its cost, and choose the operator.',
          si: 'දවස අවසානයේ මීටර කියවීම (2) ටයිප් කරන්න. වැඩ කළ පැය ඔබ වෙනුවෙන් ගණනය වේ. ඉන්පසු ඉන්ධන ලීටර් ගණන (3) සහ එහි මිල ටයිප් කර, ක්‍රියාකරු තෝරන්න.',
        },
      },
      {
        text: {
          en: 'Press [[common.save]] at the bottom of the page.',
          si: 'පිටුවේ පහළින් ඇති [[common.save]] ඔබන්න.',
        },
        shot: 'daily-save',
      },
    ],
    tips: [
      {
        en: 'The meter reading also tells the system when a machine needs its next service. You get a reminder before it is due.',
        si: 'මීටර කියවීමෙන් යන්ත්‍රයට ඊළඟ සර්විස් එක අවශ්‍ය වන්නේ කවදාදැයි පද්ධතියට දැනගත හැක. එයට පෙර ඔබට මතක් කිරීමක් ලැබේ.',
      },
    ],
    related: ['daily-attendance', 'machine-service', 'machine-usage'],
  },
  {
    id: 'daily-expenses',
    section: 'daily',
    title: { en: 'Add expenses for a site', si: 'වැඩබිමක වියදම් එකතු කරන්න' },
    summary: {
      en: 'Write down small costs of the day — meals, transport, small tools — with a photo of the receipt if you have one.',
      si: 'දවසේ කුඩා වියදම් — කෑම, ප්‍රවාහනය, කුඩා උපකරණ — ලියා තබන්න; රිසිට්පතක් ඇත්නම් එහි ඡායාරූපයක්ද එක් කරන්න.',
    },
    keywords: {
      en: 'expense, cost, spend, spent, money, meals, transport, receipt, bill, petty cash',
      si: 'වියදම, වියදම් කිරීම, මුදල්, කෑම, ප්‍රවාහනය, රිසිට්පත, බිල, සුළු මුදල්',
    },
    page: '/daily',
    steps: [
      {
        text: {
          en: 'Open [[nav.daily]], choose the date and the site, and go down to [[daily.sections.expenses]] (1).',
          si: '[[nav.daily]] විවෘත කර, දිනය සහ වැඩබිම තෝරා, [[daily.sections.expenses]] (1) කොටසට පහළට යන්න.',
        },
        shot: 'daily-expenses',
      },
      {
        text: {
          en: 'Press [[daily.addExpense]] (2) for each expense. Choose the [[daily.category]], write [[daily.description]], the [[daily.amount]] and [[daily.paidBy]]. You can attach a photo of the receipt.',
          si: 'සෑම වියදමක් සඳහාම [[daily.addExpense]] (2) ඔබන්න. [[daily.category]] තෝරා, [[daily.description]], [[daily.amount]] සහ [[daily.paidBy]] ලියන්න. රිසිට්පතේ ඡායාරූපයක් එක් කළ හැක.',
        },
      },
      {
        text: {
          en: 'Press [[common.save]] at the bottom of the page.',
          si: 'පිටුවේ පහළින් ඇති [[common.save]] ඔබන්න.',
        },
        shot: 'daily-save',
      },
    ],
    tips: [
      {
        en: 'If you choose a supplier and "credit", the amount is added to what you owe that supplier.',
        si: 'ඔබ සැපයුම්කරුවෙකු සහ "ණයට" තේරුවහොත්, එම මුදල එම සැපයුම්කරුට ඔබ ගෙවිය යුතු මුදලට එකතු වේ.',
      },
    ],
    related: ['expenses', 'daily-attendance', 'supplier-pay'],
  },
  {
    id: 'expenses',
    section: 'daily',
    title: {
      en: 'Find, change or add expenses (also office costs)',
      si: 'වියදම් සොයන්න, වෙනස් කරන්න හෝ එකතු කරන්න (කාර්යාල වියදම්ද)',
    },
    summary: {
      en: 'The Expenses page lists every expense. Add office costs here, or fix a mistake.',
      si: 'වියදම් පිටුවේ සියලු වියදම් ලැයිස්තුගත කර ඇත. කාර්යාල වියදම් මෙහි එකතු කරන්න, නැතහොත් වැරැද්දක් නිවැරදි කරන්න.',
    },
    keywords: {
      en: 'expenses, office cost, general cost, edit expense, delete expense, receipt, find expense',
      si: 'වියදම්, කාර්යාල වියදම, සාමාන්‍ය වියදම, වියදම වෙනස් කිරීම, වියදම මකා දැමීම, රිසිට්පත',
    },
    page: '/daily/expenses',
    steps: [
      {
        text: {
          en: 'Click [[nav.expenses]] in the menu (under [[nav.daily]]). Use the search box (2) and the filters to find an expense.',
          si: 'මෙනුවේ [[nav.expenses]] ක්ලික් කරන්න ([[nav.daily]] යටතේ). වියදමක් සොයා ගැනීමට සෙවුම් කොටුව (2) සහ පෙරහන් භාවිත කරන්න.',
        },
        shot: 'expenses-list',
      },
      {
        text: {
          en: 'Press [[expenses.add]] (1) to add one. Leave [[expenses.fields.project]] empty for office or general costs. Press [[common.save]].',
          si: 'අලුතින් එකතු කිරීමට [[expenses.add]] (1) ඔබන්න. කාර්යාල හෝ සාමාන්‍ය වියදම් සඳහා [[expenses.fields.project]] හිස්ව තබන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'expense-dialog',
      },
      {
        text: {
          en: 'To change or delete an expense, use the buttons at the end of its row.',
          si: 'වියදමක් වෙනස් කිරීමට හෝ මකා දැමීමට, එහි පේළියේ අගින් ඇති බොත්තම් භාවිත කරන්න.',
        },
      },
    ],
    related: ['daily-expenses', 'reports'],
  },
  {
    id: 'reminders',
    section: 'daily',
    title: {
      en: 'See reminders (expiring papers, services, deadlines)',
      si: 'මතක් කිරීම් බලන්න (කල් ඉකුත් වන ලියකියවිලි, සර්විස්, නියමිත දින)',
    },
    summary: {
      en: 'The system reminds you before insurance, licences or bonds expire, when a machine needs a service, and before a project deadline.',
      si: 'රක්ෂණ, බලපත්‍ර හෝ ඇපකර කල් ඉකුත් වීමට පෙර, යන්ත්‍රයකට සර්විස් අවශ්‍ය වූ විට සහ ව්‍යාපෘති නියමිත දිනයට පෙර පද්ධතිය ඔබට මතක් කරයි.',
    },
    keywords: {
      en: 'reminder, notification, bell, alert, expiry, expire, insurance, licence, deadline, service due',
      si: 'මතක් කිරීම, දැනුම්දීම, සීනුව, කල් ඉකුත්වීම, රක්ෂණය, බලපත්‍රය, නියමිත දිනය, සර්විස්',
    },
    page: '/notifications',
    steps: [
      {
        text: {
          en: 'The bell at the top (1) shows how many new reminders there are. Click it to see them. Click [[notifications.seeAll]] (2) for the full list.',
          si: 'ඉහළ ඇති සීනුව (1) අලුත් මතක් කිරීම් කීයක් තිබේදැයි පෙන්වයි. ඒවා බැලීමට එය ක්ලික් කරන්න. සම්පූර්ණ ලැයිස්තුව සඳහා [[notifications.seeAll]] (2) ක්ලික් කරන්න.',
        },
        shot: 'bell',
      },
      {
        text: {
          en: 'Click a reminder to open the thing it is about (for example the machine or the document).',
          si: 'මතක් කිරීමක් ක්ලික් කළ විට එය අදාළ දෙය විවෘත වේ (උදාහරණයක් ලෙස යන්ත්‍රය හෝ ලේඛනය).',
        },
        shot: 'notifications',
      },
      {
        text: {
          en: 'Sort it out — for example upload the renewed insurance as a new version. The reminder then disappears by itself.',
          si: 'ගැටලුව විසඳන්න — උදාහරණයක් ලෙස අලුත් කළ රක්ෂණය නව අනුවාදයක් ලෙස උඩුගත කරන්න. එවිට මතක් කිරීම ඉබේම ඉවත් වේ.',
        },
      },
    ],
    tips: [
      {
        en: 'How many days before an expiry you are reminded is set in [[nav.settings]] → [[settings.tabs.reminders]].',
        si: 'කල් ඉකුත් වීමට දින කීයකට පෙර මතක් කළ යුතුද යන්න [[nav.settings]] → [[settings.tabs.reminders]] හි සකසා ඇත.',
      },
    ],
    related: ['document-renew', 'machine-service', 'dashboard', 'settings-company'],
    popular: true,
  },

  // ── Projects and bills ────────────────────────────────────────────────────────────────
  {
    id: 'project-new',
    section: 'projects',
    title: { en: 'Add a new project', si: 'නව ව්‍යාපෘතියක් එකතු කරන්න' },
    summary: {
      en: 'Each contract or site is a project. Add it when you win a tender or agree a private job.',
      si: 'සෑම ගිවිසුමක්ම හෝ වැඩබිමක්ම ව්‍යාපෘතියකි. ටෙන්ඩරයක් දිනූ විට හෝ පෞද්ගලික වැඩක් එකඟ වූ විට එය එකතු කරන්න.',
    },
    keywords: {
      en: 'new project, add project, site, contract, tender, job, create project',
      si: 'නව ව්‍යාපෘතිය, ව්‍යාපෘතියක් එකතු කිරීම, වැඩබිම, ගිවිසුම, ටෙන්ඩරය',
    },
    page: '/projects/new',
    steps: [
      {
        text: {
          en: 'Click [[nav.projects]] in the menu, then [[projects.add]] (1). The search box (2) finds a project; click a row (3) to open it.',
          si: 'මෙනුවේ [[nav.projects]] ක්ලික් කර, [[projects.add]] (1) ඔබන්න. සෙවුම් කොටුවෙන් (2) ව්‍යාපෘතියක් සොයාගත හැක; එය විවෘත කිරීමට පේළියක් (3) ක්ලික් කරන්න.',
        },
        shot: 'projects-list',
      },
      {
        text: {
          en: 'Fill in what you know now: the name, the type of work, government or private, and the client. You can change everything later.',
          si: 'දැන් දන්නා දේ පුරවන්න: නම, වැඩ වර්ගය, රජයේද පෞද්ගලිකද, සහ සේවාදායකයා. පසුව සියල්ල වෙනස් කළ හැක.',
        },
        shot: 'project-form',
      },
      {
        text: {
          en: 'Add the contract value, retention, the advance and the dates if you have them. Press [[common.save]] at the bottom.',
          si: 'ඔබ සතුව ඇත්නම් ගිවිසුම් වටිනාකම, රඳවා ගැනීම (retention), අත්තිකාරම සහ දින එකතු කරන්න. පහළින් ඇති [[common.save]] ඔබන්න.',
        },
        shot: 'project-form-save',
      },
    ],
    tips: [
      {
        en: 'The client is not in the list? Use [[projects.newClient]] in the form, or see "Manage clients".',
        si: 'සේවාදායකයා ලැයිස්තුවේ නැද්ද? පෝරමයේ [[projects.newClient]] භාවිත කරන්න, නැතහොත් "සේවාදායකයින් කළමනාකරණය" බලන්න.',
      },
    ],
    related: ['project-budget', 'clients', 'boq'],
    popular: true,
  },
  {
    id: 'project-health',
    section: 'projects',
    title: { en: 'See how a project is going', si: 'ව්‍යාපෘතියක් කෙසේ සිදු වේදැයි බලන්න' },
    summary: {
      en: 'The project page shows time used, budget used and work done, and warns you when something is wrong.',
      si: 'ව්‍යාපෘති පිටුවේ ගත වූ කාලය, වියදම් කළ අයවැය සහ කළ වැඩ පෙන්වන අතර, යමක් වැරදි වූ විට අනතුරු අඟවයි.',
    },
    keywords: {
      en: 'progress, health, over budget, behind schedule, status, work done, percentage',
      si: 'ප්‍රගතිය, තත්ත්වය, අයවැය ඉක්මවීම, කාලසටහනට පසුපසින්, කළ වැඩ, ප්‍රතිශතය',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open [[nav.projects]] and click the project. The tabs (1) open each part of the project. [[projects.tabs.overview]] shows the three bars (2): [[health.time]], [[health.budget]] and [[health.physical]].',
          si: '[[nav.projects]] විවෘත කර ව්‍යාපෘතිය ක්ලික් කරන්න. ටැබ් (1) මඟින් ව්‍යාපෘතියේ එක් එක් කොටස විවෘත වේ. [[projects.tabs.overview]] හි තීරු තුන (2) පෙන්වයි: [[health.time]], [[health.budget]] සහ [[health.physical]].',
        },
        shot: 'project-overview',
      },
      {
        text: {
          en: 'Red or orange labels such as [[health.flags.OVER_BUDGET]] or [[health.flags.BEHIND_SCHEDULE]] mean you should look closer.',
          si: '[[health.flags.OVER_BUDGET]] හෝ [[health.flags.BEHIND_SCHEDULE]] වැනි රතු හෝ තැඹිලි ලේබල් පෙනේ නම්, වඩා හොඳින් පරීක්ෂා කළ යුතුය.',
        },
      },
      {
        text: {
          en: 'A project without a BOQ (for example a private house): move the [[health.manualProgress]] slider to show how much is finished and press [[health.saveProgress]].',
          si: 'BOQ නොමැති ව්‍යාපෘතියක් (උදාහරණයක් ලෙස පෞද්ගලික නිවසක්): කොපමණ වැඩ අවසන්දැයි පෙන්වීමට [[health.manualProgress]] ස්ලයිඩරය චලනය කර [[health.saveProgress]] ඔබන්න.',
        },
        shot: 'project-manual-progress',
      },
    ],
    related: ['project-budget', 'boq-progress', 'dashboard'],
  },
  {
    id: 'project-budget',
    section: 'projects',
    title: { en: 'Set the budget and see the costs', si: 'අයවැය සකසා වියදම් බලන්න' },
    summary: {
      en: 'Write how much you expect to spend on each part of the work, then compare it with what was really spent.',
      si: 'වැඩේ එක් එක් කොටසට වියදම් කිරීමට බලාපොරොත්තු වන මුදල ලියා, සත්‍ය වශයෙන් වියදම් වූ මුදල සමඟ සසඳන්න.',
    },
    keywords: {
      en: 'budget, cost, actual cost, labour, materials, equipment, profit, spent, variance',
      si: 'අයවැය, වියදම, සත්‍ය වියදම, ශ්‍රමය, ද්‍රව්‍ය, උපකරණ, ලාභය, ඉතිරිය',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project. On [[projects.tabs.overview]], go down to [[projects.budget.title]]. Type an amount for each category (1) and press [[projects.budget.save]] (2).',
          si: 'ව්‍යාපෘතිය විවෘත කරන්න. [[projects.tabs.overview]] හි [[projects.budget.title]] වෙත පහළට යන්න. එක් එක් කාණ්ඩයට මුදලක් (1) ටයිප් කර [[projects.budget.save]] (2) ඔබන්න.',
        },
        shot: 'project-budget',
      },
      {
        text: {
          en: 'Higher up on the same page, [[costs.budgetVsActual]] shows the budget next to what was spent. [[costs.variance]] is what remains; a red amount means that part is over budget.',
          si: 'එම පිටුවේම ඉහළින්, [[costs.budgetVsActual]] මඟින් අයවැය සහ වියදම් කළ මුදල එකට පෙන්වයි. [[costs.variance]] යනු ඉතිරි මුදලයි; රතු පැහැති මුදලක් නම් එම කොටස අයවැය ඉක්මවා ඇත.',
        },
      },
      {
        text: {
          en: 'The [[projects.tabs.costs]] tab shows everything spent (1). Click a category (2) to see every entry in it: worker days, purchases, machine hours and expenses.',
          si: '[[projects.tabs.costs]] ටැබයෙන් වියදම් කළ සියල්ල (1) පෙන්වයි. එහි සෑම සටහනක්ම බැලීමට කාණ්ඩයක් (2) ක්ලික් කරන්න: සේවක දින, මිලදී ගැනීම්, යන්ත්‍ර පැය සහ වියදම්.',
        },
        shot: 'project-costs',
      },
    ],
    tips: [
      {
        en: 'Costs come in by themselves from attendance, machine use, purchases, store issues and expenses. You do not type them twice.',
        si: 'වියදම් පැමිණීම, යන්ත්‍ර භාවිතය, මිලදී ගැනීම්, ගබඩා නිකුත් කිරීම් සහ වියදම් වලින් ඉබේම එකතු වේ. ඒවා දෙවරක් ටයිප් කිරීමට අවශ්‍ය නැත.',
      },
      {
        en: "An [[health.estimated]] label means part of the labour cost is estimated, because that month's salaries are not finalized yet.",
        si: '[[health.estimated]] ලේබලයක් යනු එම මාසයේ වැටුප් තවම අවසන් කර නොමැති නිසා ශ්‍රම වියදමෙන් කොටසක් ඇස්තමේන්තු කර ඇති බවයි.',
      },
    ],
    related: ['project-health', 'reports'],
  },
  {
    id: 'boq',
    section: 'projects',
    title: { en: 'Add the BOQ (bill of quantities)', si: 'BOQ (ප්‍රමාණ පත්‍රය) එකතු කරන්න' },
    summary: {
      en: 'Import the BOQ from an Excel or CSV file, or type the items one by one.',
      si: 'BOQ එක Excel හෝ CSV ගොනුවකින් ආයාත කරන්න, නැතහොත් අයිතම එකින් එක ටයිප් කරන්න.',
    },
    keywords: {
      en: 'boq, bill of quantities, import, excel, csv, items, rates, quantities',
      si: 'BOQ, ප්‍රමාණ පත්‍රය, ආයාත කිරීම, Excel, CSV, අයිතම, අනුපාත, ප්‍රමාණ',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project and the [[projects.tabs.boq]] tab.',
          si: 'ව්‍යාපෘතිය සහ [[projects.tabs.boq]] ටැබය විවෘත කරන්න.',
        },
        shot: 'project-boq',
      },
      {
        text: {
          en: '[[boq.importBtn]] (1): choose the Excel (.xlsx) or CSV file. The columns must be: Item No, Description, Unit, Quantity, Rate. You see the items before anything is saved; then press the button to add them.',
          si: '[[boq.importBtn]] (1): Excel (.xlsx) හෝ CSV ගොනුව තෝරන්න. තීරු මෙසේ විය යුතුය: Item No, Description, Unit, Quantity, Rate. කිසිවක් සුරැකීමට පෙර ඔබට අයිතම පෙනේ; ඉන්පසු ඒවා එකතු කිරීමට බොත්තම ඔබන්න.',
        },
      },
      {
        text: {
          en: 'Or press [[boq.addItem]] (2) to type one item.',
          si: 'නැතහොත් එක් අයිතමයක් ටයිප් කිරීමට [[boq.addItem]] (2) ඔබන්න.',
        },
      },
    ],
    related: ['boq-progress', 'bill-new', 'variations'],
  },
  {
    id: 'boq-progress',
    section: 'projects',
    title: { en: 'Record work done (progress)', si: 'කළ වැඩ (ප්‍රගතිය) සටහන් කරන්න' },
    summary: {
      en: 'Write how much of each BOQ item is finished. This is used for the work-done bar and for bills.',
      si: 'එක් එක් BOQ අයිතමයෙන් කොපමණ ප්‍රමාණයක් අවසන්දැයි ලියන්න. මෙය කළ වැඩ තීරුවට සහ බිල්පත් සඳහා භාවිත වේ.',
    },
    keywords: {
      en: 'progress, measurement, work done, quantity done, boq progress, measure',
      si: 'ප්‍රගතිය, මිනුම්, කළ වැඩ, කළ ප්‍රමාණය, BOQ ප්‍රගතිය, මැනීම',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project, the [[projects.tabs.boq]] tab, and press [[boq.recordProgress]] (3).',
          si: 'ව්‍යාපෘතිය, [[projects.tabs.boq]] ටැබය විවෘත කර [[boq.recordProgress]] (3) ඔබන්න.',
        },
        shot: 'project-boq',
      },
      {
        text: {
          en: 'Choose the date of the measurement. For the items that moved, type the **total done so far** (not only this week). Leave the others empty. Press the save button.',
          si: 'මිනුම් කළ දිනය තෝරන්න. ප්‍රගතියක් ඇති අයිතම සඳහා, **මේ දක්වා කළ මුළු ප්‍රමාණය** ටයිප් කරන්න (මේ සතියේ පමණක් නොවේ). අනෙක් ඒවා හිස්ව තබන්න. සුරැකීමේ බොත්තම ඔබන්න.',
        },
        shot: 'boq-record',
      },
    ],
    warnings: [
      {
        en: 'Progress cannot go backwards. If a number is lower than before, the system asks you to check it.',
        si: 'ප්‍රගතිය පසුපසට යා නොහැක. අංකයක් පෙරට වඩා අඩු නම්, එය පරීක්ෂා කරන ලෙස පද්ධතිය ඔබෙන් ඉල්ලයි.',
      },
    ],
    related: ['boq', 'bill-new', 'project-health'],
  },
  {
    id: 'bill-new',
    section: 'projects',
    title: { en: 'Make a bill (IPC) for the client', si: 'සේවාදායකයාට බිල්පතක් (IPC) සාදන්න' },
    summary: {
      en: 'The system calculates the bill from the progress, and takes off retention and the advance by itself.',
      si: 'පද්ධතිය ප්‍රගතියෙන් බිල්පත ගණනය කර, රඳවා ගැනීම සහ අත්තිකාරම ඉබේම අඩු කරයි.',
    },
    keywords: {
      en: 'bill, ipc, invoice, payment certificate, progress bill, retention, advance recovery, claim',
      si: 'බිල්පත, IPC, ඉන්වොයිසිය, ගෙවීම් සහතිකය, ප්‍රගති බිල්පත, රඳවා ගැනීම, අත්තිකාරම් අය කිරීම',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'First record the progress up to the bill date. Then open the project and the [[projects.tabs.bills]] tab. Press [[bills.new]] (1).',
          si: 'පළමුව බිල්පත් දිනය දක්වා ප්‍රගතිය සටහන් කරන්න. ඉන්පසු ව්‍යාපෘතිය සහ [[projects.tabs.bills]] ටැබය විවෘත කරන්න. [[bills.new]] (1) ඔබන්න.',
        },
        shot: 'project-bills',
      },
      {
        text: {
          en: 'Choose the date the bill covers up to, and press [[bills.calculate]]. Check every line of the calculation. Add other deductions if there are any. Press [[bills.saveDraft]].',
          si: 'බිල්පත ආවරණය කරන අවසන් දිනය තෝරා [[bills.calculate]] ඔබන්න. ගණනයේ සෑම පේළියක්ම පරීක්ෂා කරන්න. වෙනත් අඩු කිරීම් ඇත්නම් එකතු කරන්න. [[bills.saveDraft]] ඔබන්න.',
        },
        shot: 'bill-dialog',
      },
      {
        text: {
          en: 'In the list (2), use [[bills.actions.submit]] when you send it to the client, and [[bills.actions.certify]] when the engineer certifies it. [[bills.actions.markPaid]] becomes possible when the payments cover it.',
          si: 'ලැයිස්තුවේ (2), සේවාදායකයාට යවන විට [[bills.actions.submit]] ද, ඉංජිනේරුවරයා සහතික කළ විට [[bills.actions.certify]] ද භාවිත කරන්න. ගෙවීම් මඟින් එය ආවරණය වූ විට [[bills.actions.markPaid]] කළ හැක.',
        },
      },
      {
        text: {
          en: 'Print it: [[nav.reports]] → [[reports.list.ipc.name]].',
          si: 'මුද්‍රණය කිරීමට: [[nav.reports]] → [[reports.list.ipc.name]].',
        },
      },
    ],
    warnings: [
      {
        en: 'After [[bills.actions.submit]], the amounts can no longer be changed. Only one draft bill can exist at a time.',
        si: '[[bills.actions.submit]] කළ පසු, මුදල් තවදුරටත් වෙනස් කළ නොහැක. එක් වරකට තිබිය හැක්කේ එක් කෙටුම්පත් බිල්පතක් පමණි.',
      },
    ],
    related: ['boq-progress', 'client-payment', 'reports'],
    popular: true,
  },
  {
    id: 'client-payment',
    section: 'projects',
    title: {
      en: 'Record a payment from the client',
      si: 'සේවාදායකයාගෙන් ලැබුණු ගෙවීමක් සටහන් කරන්න',
    },
    summary: {
      en: 'When the client pays a bill, the advance or retention, write it here so "money to receive" stays correct.',
      si: 'සේවාදායකයා බිල්පතක්, අත්තිකාරම හෝ රඳවා ගත් මුදල ගෙවූ විට, "ලැබිය යුතු මුදල්" නිවැරදිව තබා ගැනීමට එය මෙහි ලියන්න.',
    },
    keywords: {
      en: 'payment received, client paid, cheque, receive money, retention release, advance received',
      si: 'ලැබුණු ගෙවීම, සේවාදායකයා ගෙවූ, චෙක්පත, මුදල් ලැබීම, රඳවා ගැනීම නිදහස් කිරීම',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project and the [[projects.tabs.bills]] tab. Go down to [[payments.title]] and press [[payments.add]].',
          si: 'ව්‍යාපෘතිය සහ [[projects.tabs.bills]] ටැබය විවෘත කරන්න. [[payments.title]] වෙත පහළට ගොස් [[payments.add]] ඔබන්න.',
        },
        shot: 'project-payments',
      },
      {
        text: {
          en: 'Choose what the payment is for and which bill, then the date, the amount and how it was paid (cash, cheque, bank). Add the cheque number. Press [[common.save]].',
          si: 'ගෙවීම කුමක් සඳහාද සහ කුමන බිල්පතටද යන්න තෝරා, ඉන්පසු දිනය, මුදල සහ ගෙවූ ආකාරය (මුදල්, චෙක්පත, බැංකුව) තෝරන්න. චෙක්පත් අංකය එකතු කරන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'payment-dialog',
      },
    ],
    related: ['bill-new', 'dashboard'],
  },
  {
    id: 'variations',
    section: 'projects',
    title: { en: 'Variations and extensions of time', si: 'වෙනස්කම් සහ කාලය දීර්ඝ කිරීම්' },
    summary: {
      en: 'Record approved changes to the work (they change the contract value) and approved new finish dates.',
      si: 'වැඩයේ අනුමත වෙනස්කම් (ඒවා ගිවිසුම් වටිනාකම වෙනස් කරයි) සහ අනුමත නව අවසන් දින සටහන් කරන්න.',
    },
    keywords: {
      en: 'variation, vo, change order, extension of time, eot, new end date, deadline extended',
      si: 'වෙනස්කම්, VO, කාලය දීර්ඝ කිරීම, EOT, නව අවසන් දිනය, නියමිත දිනය දීර්ඝ කිරීම',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project and the [[projects.tabs.variations]] tab.',
          si: 'ව්‍යාපෘතිය සහ [[projects.tabs.variations]] ටැබය විවෘත කරන්න.',
        },
        shot: 'project-variations',
      },
      {
        text: {
          en: '[[variations.add]] (1): write what changed and the change in value (use a minus sign for work taken out). Only **approved** variations change the contract value.',
          si: '[[variations.add]] (1): වෙනස් වූ දේ සහ වටිනාකමේ වෙනස ලියන්න (ඉවත් කළ වැඩ සඳහා ඍණ ලකුණ භාවිත කරන්න). **අනුමත** වෙනස්කම් පමණක් ගිවිසුම් වටිනාකම වෙනස් කරයි.',
        },
      },
      {
        text: {
          en: "[[eot.add]] (2): enter the new end date and the letter reference. The latest one becomes the project's end date.",
          si: '[[eot.add]] (2): නව අවසන් දිනය සහ ලිපියේ යොමු අංකය ඇතුළත් කරන්න. නවතම එක ව්‍යාපෘතියේ අවසන් දිනය බවට පත් වේ.',
        },
      },
    ],
    related: ['boq', 'project-health'],
  },
  {
    id: 'bonds',
    section: 'projects',
    title: { en: 'Keep bonds and bank guarantees', si: 'ඇපකර සහ බැංකු ඇපකර තබා ගන්න' },
    summary: {
      en: 'Add each bank guarantee with its expiry date. You are reminded before it expires.',
      si: 'සෑම බැංකු ඇපකරයක්ම එහි කල් ඉකුත් වන දිනය සමඟ එකතු කරන්න. එය කල් ඉකුත් වීමට පෙර ඔබට මතක් කරනු ලැබේ.',
    },
    keywords: {
      en: 'bond, guarantee, bank guarantee, performance bond, bid bond, advance guarantee, expiry',
      si: 'ඇපකරය, බැංකු ඇපකරය, කාර්ය සාධන ඇපකරය, ලංසු ඇපකරය, කල් ඉකුත්වීම',
    },
    page: '/projects',
    steps: [
      {
        text: {
          en: 'Open the project and the [[projects.tabs.bonds]] tab. Press [[bonds.add]].',
          si: 'ව්‍යාපෘතිය සහ [[projects.tabs.bonds]] ටැබය විවෘත කරන්න. [[bonds.add]] ඔබන්න.',
        },
        shot: 'project-bonds',
      },
      {
        text: {
          en: 'Choose the type, write the bank, reference number, amount and the dates. Press [[common.save]]. Upload a scan of the bond under [[bonds.copies]].',
          si: 'වර්ගය තෝරා, බැංකුව, යොමු අංකය, මුදල සහ දින ලියන්න. [[common.save]] ඔබන්න. ඇපකරයේ ස්කෑන් පිටපතක් [[bonds.copies]] යටතේ උඩුගත කරන්න.',
        },
      },
    ],
    tips: [
      {
        en: 'When the bank extends a bond, edit it and change the expiry date. When it is returned, change its status.',
        si: 'බැංකුව ඇපකරයක් දීර්ඝ කළ විට, එය සංස්කරණය කර කල් ඉකුත් වන දිනය වෙනස් කරන්න. එය ආපසු දුන් විට, එහි තත්ත්වය වෙනස් කරන්න.',
      },
    ],
    related: ['reminders', 'document-upload'],
  },
  {
    id: 'clients',
    section: 'projects',
    title: { en: 'Manage clients', si: 'සේවාදායකයින් කළමනාකරණය කරන්න' },
    summary: {
      en: 'Clients are the offices, societies, companies or people you work for.',
      si: 'සේවාදායකයින් යනු ඔබ වැඩ කරන කාර්යාල, සමිති, සමාගම් හෝ පුද්ගලයින්ය.',
    },
    keywords: {
      en: 'client, customer, pradeshiya sabha, provincial council, owner, add client',
      si: 'සේවාදායකයා, ගනුදෙනුකරු, ප්‍රාදේශීය සභාව, පළාත් සභාව, අයිතිකරු',
    },
    page: '/projects/clients',
    steps: [
      {
        text: {
          en: 'Open [[nav.projects]] and press [[projects.manageClients]]. Press [[clients.add]], fill in the name, type and phone, and press [[common.save]].',
          si: '[[nav.projects]] විවෘත කර [[projects.manageClients]] ඔබන්න. [[clients.add]] ඔබා, නම, වර්ගය සහ දුරකථන අංකය පුරවා [[common.save]] ඔබන්න.',
        },
        shot: 'clients',
      },
    ],
    related: ['project-new'],
  },

  // ── Schedule ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schedule-book',
    section: 'schedule',
    title: {
      en: 'Plan workers and machines for a site',
      si: 'වැඩබිමකට සේවකයින් සහ යන්ත්‍ර සැලසුම් කරන්න',
    },
    summary: {
      en: 'Book who and which machine works where. The same person or machine can never be booked twice at the same time.',
      si: 'කවුද සහ කුමන යන්ත්‍රයද කොහේ වැඩ කරන්නේදැයි වෙන් කරන්න. එකම පුද්ගලයා හෝ යන්ත්‍රය එකම වේලාවට දෙවරක් වෙන් කළ නොහැක.',
    },
    keywords: {
      en: 'schedule, plan, booking, assign, allocate, week, roster, team, send workers',
      si: 'වැඩ සැලැස්ම, සැලසුම, වෙන් කිරීම, පැවරීම, සතිය, කණ්ඩායම, සේවකයින් යැවීම',
    },
    page: '/schedule',
    steps: [
      {
        text: {
          en: 'Click [[nav.schedule]]. You see one week. Use (1) and (2) to go to the previous or next week. Coloured blocks (4) are bookings; each project has its own colour.',
          si: '[[nav.schedule]] ක්ලික් කරන්න. ඔබට සතියක් පෙනේ. පෙර හෝ ඊළඟ සතියට යාමට (1) සහ (2) භාවිත කරන්න. වර්ණ කොටු (4) වෙන් කිරීම් වේ; සෑම ව්‍යාපෘතියකටම වෙනම වර්ණයක් ඇත.',
        },
        shot: 'schedule',
      },
      {
        text: {
          en: 'To book many people at once, press [[schedule.assignTeam]] (3). Choose the project, the first and last day, the time, and tick the workers. Press [[schedule.assign]].',
          si: 'එකවර බොහෝ දෙනෙකු වෙන් කිරීමට, [[schedule.assignTeam]] (3) ඔබන්න. ව්‍යාපෘතිය, පළමු සහ අවසන් දිනය, වේලාව තෝරා සේවකයින් සලකුණු කරන්න. [[schedule.assign]] ඔබන්න.',
        },
        shot: 'schedule-assign',
      },
      {
        text: {
          en: 'To book one person for one day, click an empty day in their row.',
          si: 'එක් අයෙකු එක් දිනකට වෙන් කිරීමට, ඔවුන්ගේ පේළියේ හිස් දිනයක් ක්ලික් කරන්න.',
        },
      },
      {
        text: {
          en: 'Use [[schedule.show]] at the top to switch between [[schedule.workers]] and [[schedule.machines]].',
          si: '[[schedule.workers]] සහ [[schedule.machines]] අතර මාරු වීමට ඉහළ ඇති [[schedule.show]] භාවිත කරන්න.',
        },
      },
    ],
    tips: [
      {
        en: 'People booked here are listed by themselves on [[nav.daily]] for that site, so attendance is quick.',
        si: 'මෙහි වෙන් කළ අය එම වැඩබිම සඳහා [[nav.daily]] හි ඉබේම ලැයිස්තුගත වන නිසා, පැමිණීම සටහන් කිරීම ඉක්මන් වේ.',
      },
    ],
    related: ['schedule-change', 'daily-attendance', 'faq-already-booked'],
  },
  {
    id: 'schedule-change',
    section: 'schedule',
    title: { en: 'Change or cancel a booking', si: 'වෙන් කිරීමක් වෙනස් කරන්න හෝ අවලංගු කරන්න' },
    summary: {
      en: 'Move a booking to another time or site, or cancel it so the time is free again.',
      si: 'වෙන් කිරීමක් වෙනත් වේලාවකට හෝ වැඩබිමකට ගෙන යන්න, නැතහොත් එම කාලය නැවත නිදහස් වන පරිදි එය අවලංගු කරන්න.',
    },
    keywords: {
      en: 'change booking, cancel booking, move, edit schedule, remove booking',
      si: 'වෙන් කිරීම වෙනස් කිරීම, වෙන් කිරීම අවලංගු කිරීම, ගෙන යාම, සැලැස්ම සංස්කරණය',
    },
    page: '/schedule',
    steps: [
      {
        text: {
          en: 'On [[nav.schedule]], click the coloured block. Change the project, day or time and press [[common.save]] (1) — or press [[schedule.cancelBooking]] (2).',
          si: '[[nav.schedule]] හි, වර්ණ කොටුව ක්ලික් කරන්න. ව්‍යාපෘතිය, දිනය හෝ වේලාව වෙනස් කර [[common.save]] (1) ඔබන්න — නැතහොත් [[schedule.cancelBooking]] (2) ඔබන්න.',
        },
        shot: 'schedule-change',
      },
      {
        text: {
          en: "A project's [[projects.tabs.team]] tab shows who and which machines are booked for the next two weeks.",
          si: 'ව්‍යාපෘතියක [[projects.tabs.team]] ටැබයෙන් ඉදිරි සති දෙක සඳහා වෙන් කර ඇති අය සහ යන්ත්‍ර පෙන්වයි.',
        },
        shot: 'project-team',
      },
    ],
    related: ['schedule-book', 'faq-already-booked'],
  },

  // ── Workers and salaries ──────────────────────────────────────────────────────────────
  {
    id: 'worker-new',
    section: 'workers',
    title: { en: 'Add a worker', si: 'සේවකයෙකු එකතු කරන්න' },
    summary: {
      en: 'Add each person who works for you, with their skill and pay.',
      si: 'ඔබ වෙනුවෙන් වැඩ කරන සෑම පුද්ගලයෙකුම ඔවුන්ගේ කුසලතාව සහ වැටුප සමඟ එකතු කරන්න.',
    },
    keywords: {
      en: 'new worker, add worker, employee, staff, labourer, mason, nic, daily paid, permanent',
      si: 'නව සේවකයා, සේවකයෙකු එකතු කිරීම, කාර්ය මණ්ඩලය, කම්කරු, මේසන්, හැඳුනුම්පත, දෛනික, ස්ථිර',
    },
    page: '/workers/new',
    steps: [
      {
        text: {
          en: 'Click [[nav.workers]], then [[workers.add]] (1). To open a worker, click their row (2).',
          si: '[[nav.workers]] ක්ලික් කර, [[workers.add]] (1) ඔබන්න. සේවකයෙකු විවෘත කිරීමට, ඔවුන්ගේ පේළිය (2) ක්ලික් කරන්න.',
        },
        shot: 'workers-list',
      },
      {
        text: {
          en: 'Fill in the name, NIC, phone and skill. Choose the [[workers.fields.type]]: daily paid (paid for each day worked) or permanent (monthly salary with EPF / ETF). Type the starting pay. Press [[common.save]].',
          si: 'නම, ජාතික හැඳුනුම්පත් අංකය, දුරකථන අංකය සහ කුසලතාව පුරවන්න. [[workers.fields.type]] තෝරන්න: දෛනික (වැඩ කළ සෑම දිනකටම ගෙවයි) හෝ ස්ථිර (EPF / ETF සහිත මාසික වැටුප). ආරම්භක වැටුප ටයිප් කරන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'worker-form',
      },
      {
        text: {
          en: 'Later, open the worker from the list. The tabs (1) show their pay rates, attendance, advances, payslips and documents. [[common.edit]] (2) changes their details.',
          si: 'පසුව, ලැයිස්තුවෙන් සේවකයා විවෘත කරන්න. ටැබ් (1) මඟින් ඔවුන්ගේ වැටුප් අනුපාත, පැමිණීම, අත්තිකාරම්, වැටුප් පත්‍රිකා සහ ලේඛන පෙන්වයි. [[common.edit]] (2) මඟින් ඔවුන්ගේ විස්තර වෙනස් කළ හැක.',
        },
        shot: 'worker-detail',
      },
    ],
    tips: [
      {
        en: 'When a worker leaves, edit them and turn off [[workers.fields.active]]. Their history is kept.',
        si: 'සේවකයෙකු ඉවත් වූ විට, ඔවුන්ව සංස්කරණය කර [[workers.fields.active]] අක්‍රිය කරන්න. ඔවුන්ගේ ඉතිහාසය ආරක්ෂිතව පවතී.',
      },
    ],
    related: ['worker-rate', 'worker-attendance', 'document-upload'],
  },
  {
    id: 'worker-rate',
    section: 'workers',
    title: {
      en: 'Give a pay rise (change the pay rate)',
      si: 'වැටුප් වැඩිවීමක් දෙන්න (වැටුප් අනුපාතය වෙනස් කරන්න)',
    },
    summary: {
      en: 'Add a new pay rate from a date. Old salaries keep the old rate.',
      si: 'දිනයක සිට නව වැටුප් අනුපාතයක් එකතු කරන්න. පැරණි වැටුප් පැරණි අනුපාතයම තබා ගනී.',
    },
    keywords: {
      en: 'pay rise, increment, salary change, daily rate, monthly salary, overtime rate, wage',
      si: 'වැටුප් වැඩිවීම, වැටුප් වෙනස, දෛනික අනුපාතය, මාසික වැටුප, අතිකාල අනුපාතය, කුලිය',
    },
    page: '/workers',
    steps: [
      {
        text: {
          en: 'Open the worker and the [[workers.tabs.rates]] tab. Press [[workers.rates.add]].',
          si: 'සේවකයා සහ [[workers.tabs.rates]] ටැබය විවෘත කරන්න. [[workers.rates.add]] ඔබන්න.',
        },
        shot: 'worker-rates',
      },
      {
        text: {
          en: 'Choose [[workers.rates.effectiveFrom]] and type the new daily rate or monthly salary. Leave the overtime rate empty to calculate it from the normal pay. Press the save button.',
          si: '[[workers.rates.effectiveFrom]] තෝරා නව දෛනික අනුපාතය හෝ මාසික වැටුප ටයිප් කරන්න. සාමාන්‍ය වැටුපෙන් ගණනය කිරීමට අතිකාල අනුපාතය හිස්ව තබන්න. සුරැකීමේ බොත්තම ඔබන්න.',
        },
        shot: 'worker-rate-dialog',
      },
    ],
    related: ['worker-new', 'payroll'],
  },
  {
    id: 'worker-attendance',
    section: 'workers',
    title: { en: "See a worker's attendance", si: 'සේවකයෙකුගේ පැමිණීම බලන්න' },
    summary: {
      en: 'A month calendar shows every day the worker came, with totals.',
      si: 'මාසික දින දර්ශනයක සේවකයා පැමිණි සෑම දිනයක්ම එකතුව සමඟ පෙන්වයි.',
    },
    keywords: {
      en: 'attendance calendar, days worked, absent days, month, worker history',
      si: 'පැමිණීමේ දින දර්ශනය, වැඩ කළ දින, නොපැමිණි දින, මාසය, සේවක ඉතිහාසය',
    },
    page: '/workers',
    steps: [
      {
        text: {
          en: 'Open the worker and the [[workers.tabs.attendance]] tab. The calendar (1) shows each day; the totals (2) show days worked, absent days and OT hours. Use the arrows to change the month.',
          si: 'සේවකයා සහ [[workers.tabs.attendance]] ටැබය විවෘත කරන්න. දින දර්ශනය (1) සෑම දිනයක්ම පෙන්වයි; එකතුව (2) වැඩ කළ දින, නොපැමිණි දින සහ OT පැය පෙන්වයි. මාසය වෙනස් කිරීමට ඊතල භාවිත කරන්න.',
        },
        shot: 'worker-attendance',
      },
    ],
    tips: [
      {
        en: 'Attendance is recorded on [[nav.daily]], not here. To print a month grid for everyone, use [[nav.reports]] → [[reports.list.attendance.name]].',
        si: 'පැමිණීම සටහන් කරන්නේ [[nav.daily]] හි මිස මෙහි නොවේ. සියලු දෙනාගේ මාසික සටහන මුද්‍රණය කිරීමට [[nav.reports]] → [[reports.list.attendance.name]] භාවිත කරන්න.',
      },
    ],
    related: ['daily-attendance', 'reports'],
  },
  {
    id: 'advance',
    section: 'workers',
    title: { en: 'Give a salary advance', si: 'වැටුප් අත්තිකාරමක් දෙන්න' },
    summary: {
      en: 'Record money given to a worker before payday. It is taken back from the salary by itself.',
      si: 'වැටුප් දිනයට පෙර සේවකයෙකුට දුන් මුදල් සටහන් කරන්න. එය වැටුපෙන් ඉබේම අය කර ගනී.',
    },
    keywords: {
      en: 'advance, loan, salary advance, borrow, deduction, take back, recover',
      si: 'අත්තිකාරම, ණය, වැටුප් අත්තිකාරම, අඩු කිරීම, අය කර ගැනීම',
    },
    page: '/workers',
    steps: [
      {
        text: {
          en: 'Open the worker and the [[workers.tabs.advances]] tab. Press [[advances.add]].',
          si: 'සේවකයා සහ [[workers.tabs.advances]] ටැබය විවෘත කරන්න. [[advances.add]] ඔබන්න.',
        },
        shot: 'worker-advances',
      },
      {
        text: {
          en: "Type the date, the amount and the reason. In [[advances.fields.recoveryPerMonth]], type how much to take back from each month's salary — or leave it empty to take it all at once. Press [[common.save]].",
          si: 'දිනය, මුදල සහ හේතුව ටයිප් කරන්න. [[advances.fields.recoveryPerMonth]] හි, එක් එක් මාසයේ වැටුපෙන් කොපමණ අය කර ගත යුතුදැයි ටයිප් කරන්න — නැතහොත් සියල්ල එකවර අය කර ගැනීමට හිස්ව තබන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'advance-dialog',
      },
    ],
    tips: [
      {
        en: '[[nav.payroll]] shows all open advances, and how much is taken back this month.',
        si: '[[nav.payroll]] හි සියලු විවෘත අත්තිකාරම් සහ මේ මාසයේ අය කර ගන්නා මුදල පෙන්වයි.',
      },
    ],
    related: ['payroll'],
  },
  {
    id: 'payroll',
    section: 'workers',
    title: { en: 'Pay the monthly salaries', si: 'මාසික වැටුප් ගෙවන්න' },
    summary: {
      en: 'At the end of the month the system calculates every salary from the attendance. You check it and finalize the month.',
      si: 'මාසය අවසානයේ පද්ධතිය පැමිණීමෙන් සෑම වැටුපක්ම ගණනය කරයි. ඔබ එය පරීක්ෂා කර මාසය අවසන් කරන්න.',
    },
    keywords: {
      en: 'salary, salaries, payroll, wages, pay, epf, etf, month end, calculate salary, finalize',
      si: 'වැටුප, වැටුප්, පඩි, කුලිය, EPF, ETF, මාසය අවසානය, වැටුප් ගණනය කිරීම, අවසන් කිරීම',
    },
    page: '/payroll',
    steps: [
      {
        text: {
          en: 'Make sure attendance for the whole month is recorded on [[nav.daily]]. Then click [[nav.payroll]]. Use the arrows (1, 3) to choose the month (2).',
          si: 'මුළු මාසයේම පැමිණීම [[nav.daily]] හි සටහන් කර ඇති බව තහවුරු කරගන්න. ඉන්පසු [[nav.payroll]] ක්ලික් කරන්න. මාසය (2) තෝරා ගැනීමට ඊතල (1, 3) භාවිත කරන්න.',
        },
        shot: 'payroll-month',
      },
      {
        text: {
          en: "Press [[payroll.generate]] (or [[payroll.regenerate]] (1) after changes). Each worker's days, overtime, EPF, advance and net pay appear.",
          si: '[[payroll.generate]] ඔබන්න (වෙනස්කම් කළ පසු [[payroll.regenerate]] (1)). සෑම සේවකයෙකුගේම දින, අතිකාල, EPF, අත්තිකාරම සහ ශුද්ධ වැටුප පෙනේ.',
        },
        shot: 'payroll-draft',
      },
      {
        text: {
          en: "Check the numbers. To change the advance taken back or add another deduction, press the pencil button on that worker's row.",
          si: 'අංක පරීක්ෂා කරන්න. අය කර ගන්නා අත්තිකාරම වෙනස් කිරීමට හෝ වෙනත් අඩු කිරීමක් එකතු කිරීමට, එම සේවකයාගේ පේළියේ ඇති පැන්සල් බොත්තම ඔබන්න.',
        },
        shot: 'payroll-table',
      },
      {
        text: {
          en: 'Change the amounts and press the save button.',
          si: 'මුදල් වෙනස් කර සුරැකීමේ බොත්තම ඔබන්න.',
        },
        shot: 'payroll-line',
      },
      {
        text: {
          en: "When everything is right, press [[payroll.finalize]] (2). The month's attendance is then locked and the advance deductions are recorded.",
          si: 'සියල්ල නිවැරදි වූ විට, [[payroll.finalize]] (2) ඔබන්න. එවිට මාසයේ පැමිණීම අගුළු දමා අත්තිකාරම් අඩු කිරීම් සටහන් වේ.',
        },
      },
    ],
    warnings: [
      {
        en: 'If you see [[payroll.staleTitle]], attendance, pay or advances changed after the calculation. Press [[payroll.regenerate]] before you finalize.',
        si: '[[payroll.staleTitle]] පෙනේ නම්, ගණනය කිරීමෙන් පසු පැමිණීම, වැටුප හෝ අත්තිකාරම් වෙනස් වී ඇත. අවසන් කිරීමට පෙර [[payroll.regenerate]] ඔබන්න.',
      },
    ],
    related: ['payslips', 'payroll-reopen', 'advance', 'daily-attendance'],
    popular: true,
  },
  {
    id: 'payslips',
    section: 'workers',
    title: {
      en: 'Print payslips and the salary sheet',
      si: 'වැටුප් පත්‍රිකා සහ වැටුප් ලේඛනය මුද්‍රණය කරන්න',
    },
    summary: {
      en: 'Download the payslips (one per page), the salary sheet to sign, and the EPF / ETF summary.',
      si: 'වැටුප් පත්‍රිකා (පිටුවකට එකක්), අත්සන් කිරීමට වැටුප් ලේඛනය සහ EPF / ETF සාරාංශය බාගන්න.',
    },
    keywords: {
      en: 'payslip, pay slip, salary sheet, print salary, epf form, etf, pdf, excel',
      si: 'වැටුප් පත්‍රිකාව, වැටුප් ලේඛනය, වැටුප් මුද්‍රණය, EPF, ETF, PDF, Excel',
    },
    page: '/payroll',
    steps: [
      {
        text: {
          en: 'Open [[nav.payroll]] and choose the month. Press [[payroll.payslipsPdf]], [[payroll.sheetPdf]], [[payroll.sheetExcel]] or [[payroll.epfPdf]] (2). The file is saved in your Downloads folder.',
          si: '[[nav.payroll]] විවෘත කර මාසය තෝරන්න. [[payroll.payslipsPdf]], [[payroll.sheetPdf]], [[payroll.sheetExcel]] හෝ [[payroll.epfPdf]] (2) ඔබන්න. ගොනුව ඔබගේ Downloads ෆෝල්ඩරයේ සුරැකේ.',
        },
        shot: 'payroll-finalized',
      },
      {
        text: {
          en: "One worker's payslips: open the worker → [[workers.tabs.payslips]] and press the printer button on the month.",
          si: 'එක් සේවකයෙකුගේ වැටුප් පත්‍රිකා: සේවකයා විවෘත කර → [[workers.tabs.payslips]] → මාසයේ ඇති මුද්‍රණ යන්ත්‍ර බොත්තම ඔබන්න.',
        },
        shot: 'worker-payslips',
      },
    ],
    tips: [
      {
        en: 'Print salaries after you finalize the month. Before that, the papers say "Draft".',
        si: 'මාසය අවසන් කළ පසු වැටුප් මුද්‍රණය කරන්න. ඊට පෙර, ලේඛනවල "කෙටුම්පත" ලෙස සඳහන් වේ.',
      },
    ],
    related: ['payroll', 'reports'],
  },
  {
    id: 'payroll-reopen',
    section: 'workers',
    title: {
      en: 'Fix a mistake in a finalized month',
      si: 'අවසන් කළ මාසයක වැරැද්දක් නිවැරදි කරන්න',
    },
    summary: {
      en: 'Open the last finalized month again, fix the attendance or deductions, and finalize again.',
      si: 'අවසන් කළ අවසාන මාසය නැවත විවෘත කර, පැමිණීම හෝ අඩු කිරීම් නිවැරදි කර, නැවත අවසන් කරන්න.',
    },
    keywords: {
      en: 'reopen, open again, mistake, wrong salary, unlock, correct attendance, locked',
      si: 'නැවත විවෘත කිරීම, වැරැද්ද, වැරදි වැටුප, අගුළු හැරීම, පැමිණීම නිවැරදි කිරීම, අගුළු දමා ඇත',
    },
    page: '/payroll',
    steps: [
      {
        text: {
          en: 'Open [[nav.payroll]] and go to the finalized month. Press [[payroll.reopen]] (1) and confirm.',
          si: '[[nav.payroll]] විවෘත කර අවසන් කළ මාසයට යන්න. [[payroll.reopen]] (1) ඔබා තහවුරු කරන්න.',
        },
        shot: 'payroll-finalized',
      },
      {
        text: {
          en: 'Fix the attendance on [[nav.daily]] (or the deductions). Come back, press [[payroll.regenerate]], check, and press [[payroll.finalize]] again.',
          si: '[[nav.daily]] හි පැමිණීම (හෝ අඩු කිරීම්) නිවැරදි කරන්න. ආපසු පැමිණ, [[payroll.regenerate]] ඔබා, පරීක්ෂා කර, නැවත [[payroll.finalize]] ඔබන්න.',
        },
      },
    ],
    warnings: [
      {
        en: 'Only the latest finalized month can be opened again.',
        si: 'නැවත විවෘත කළ හැක්කේ අවසන් කළ නවතම මාසය පමණි.',
      },
    ],
    related: ['payroll', 'faq-locked-day'],
  },

  // ── Machines and vehicles ─────────────────────────────────────────────────────────────
  {
    id: 'machine-new',
    section: 'machines',
    title: { en: 'Add a machine or vehicle', si: 'යන්ත්‍රයක් හෝ වාහනයක් එකතු කරන්න' },
    summary: {
      en: 'Add each machine, vehicle or tool, with its meter and service interval.',
      si: 'සෑම යන්ත්‍රයක්ම, වාහනයක්ම හෝ උපකරණයක්ම එහි මීටරය සහ සර්විස් පරතරය සමඟ එකතු කරන්න.',
    },
    keywords: {
      en: 'new machine, add vehicle, jcb, tipper, lorry, cab, roller, mixer, asset, equipment',
      si: 'නව යන්ත්‍රය, වාහනය එකතු කිරීම, JCB, ටිපර්, ලොරිය, කැබ්, රෝලරය, මික්සරය, උපකරණ',
    },
    page: '/assets/new',
    steps: [
      {
        text: {
          en: 'Click [[nav.assets]], then [[assets.add]].',
          si: '[[nav.assets]] ක්ලික් කර, [[assets.add]] ඔබන්න.',
        },
        shot: 'assets-list',
      },
      {
        text: {
          en: 'Fill in the name and kind. Turn on [[assets.fields.isVehicle]] for vehicles on the road. Write the meter reading now and how often it needs a service. Press [[common.save]].',
          si: 'නම සහ වර්ගය පුරවන්න. මාර්ගයේ ධාවනය වන වාහන සඳහා [[assets.fields.isVehicle]] සක්‍රිය කරන්න. දැන් ඇති මීටර කියවීම සහ සර්විස් කළ යුතු වාර ගණන ලියන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'asset-form',
      },
    ],
    tips: [
      {
        en: '[[assets.fields.internalRatePerHour]] is used to add machine costs to projects.',
        si: 'ව්‍යාපෘතිවලට යන්ත්‍ර වියදම් එකතු කිරීමට [[assets.fields.internalRatePerHour]] භාවිත වේ.',
      },
    ],
    related: ['machine-service', 'vehicle-papers'],
  },
  {
    id: 'machine-service',
    section: 'machines',
    title: { en: 'Record a service or repair', si: 'සර්විස් එකක් හෝ අලුත්වැඩියාවක් සටහන් කරන්න' },
    summary: {
      en: 'Write down every service and repair. A service resets the service counter.',
      si: 'සෑම සර්විස් එකක්ම සහ අලුත්වැඩියාවක්ම ලියා තබන්න. සර්විස් එකකින් සර්විස් ගණකය නැවත ආරම්භ වේ.',
    },
    keywords: {
      en: 'service, repair, maintenance, garage, oil change, tyre, breakdown, service due',
      si: 'සර්විස්, අලුත්වැඩියාව, නඩත්තුව, ගරාජය, ඔයිල් මාරු කිරීම, ටයර්, කැඩීම',
    },
    page: '/assets',
    steps: [
      {
        text: {
          en: 'Open the machine. The tabs (1) open its parts; the service state (2) shows if a service is due.',
          si: 'යන්ත්‍රය විවෘත කරන්න. ටැබ් (1) මඟින් එහි කොටස් විවෘත වේ; සර්විස් තත්ත්වය (2) සර්විස් එකක් අවශ්‍යදැයි පෙන්වයි.',
        },
        shot: 'asset-detail',
      },
      {
        text: {
          en: 'Open [[assets.tabs.maintenance]] and press [[assets.maintenance.add]].',
          si: '[[assets.tabs.maintenance]] විවෘත කර [[assets.maintenance.add]] ඔබන්න.',
        },
        shot: 'asset-maintenance',
      },
      {
        text: {
          en: 'Choose the type (service, repair, tyres), write what was done, the meter reading and the cost, and the garage. Press [[common.save]].',
          si: 'වර්ගය (සර්විස්, අලුත්වැඩියාව, ටයර්) තෝරා, කළ දේ, මීටර කියවීම, වියදම සහ ගරාජය ලියන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'maintenance-dialog',
      },
    ],
    related: ['machine-usage', 'reminders'],
  },
  {
    id: 'machine-usage',
    section: 'machines',
    title: { en: "See a machine's hours and fuel", si: 'යන්ත්‍රයක පැය සහ ඉන්ධන බලන්න' },
    summary: {
      en: 'The usage log shows every day the machine worked, with hours and fuel.',
      si: 'භාවිත සටහනේ යන්ත්‍රය වැඩ කළ සෑම දිනයක්ම පැය සහ ඉන්ධන සමඟ පෙන්වයි.',
    },
    keywords: {
      en: 'usage, hours, fuel used, machine log, utilisation',
      si: 'භාවිතය, පැය, භාවිත කළ ඉන්ධන, යන්ත්‍ර සටහන',
    },
    page: '/assets',
    steps: [
      {
        text: {
          en: 'Open the machine and the [[assets.tabs.usage]] tab. Totals are at the top.',
          si: 'යන්ත්‍රය සහ [[assets.tabs.usage]] ටැබය විවෘත කරන්න. එකතුව ඉහළින් ඇත.',
        },
        shot: 'asset-usage',
      },
    ],
    tips: [
      {
        en: 'Usage is recorded on [[nav.daily]]. For a printed summary use [[nav.reports]] → [[reports.list.asset-utilisation.name]].',
        si: 'භාවිතය සටහන් කරන්නේ [[nav.daily]] හි ය. මුද්‍රිත සාරාංශයක් සඳහා [[nav.reports]] → [[reports.list.asset-utilisation.name]] භාවිත කරන්න.',
      },
    ],
    related: ['daily-machines', 'reports'],
  },
  {
    id: 'vehicle-papers',
    section: 'machines',
    title: {
      en: 'Keep vehicle papers (licence, insurance)',
      si: 'වාහන ලියකියවිලි තබා ගන්න (බලපත්‍රය, රක්ෂණය)',
    },
    summary: {
      en: 'Upload the revenue licence, insurance, emission test and other papers with their expiry dates.',
      si: 'ආදායම් බලපත්‍රය, රක්ෂණය, දුම් පරීක්ෂණය සහ වෙනත් ලියකියවිලි ඒවායේ කල් ඉකුත් වන දින සමඟ උඩුගත කරන්න.',
    },
    keywords: {
      en: 'revenue licence, insurance, emission test, fitness certificate, registration book, vehicle papers',
      si: 'ආදායම් බලපත්‍රය, රක්ෂණය, දුම් පරීක්ෂණය, යෝග්‍යතා සහතිකය, ලියාපදිංචි පොත, වාහන ලියකියවිලි',
    },
    page: '/assets',
    steps: [
      {
        text: {
          en: 'Open the vehicle and the [[assets.tabs.documents]] tab. Press [[documents.actions.upload]] (1). Choose the file, the kind (for example insurance) and the expiry date.',
          si: 'වාහනය සහ [[assets.tabs.documents]] ටැබය විවෘත කරන්න. [[documents.actions.upload]] (1) ඔබන්න. ගොනුව, වර්ගය (උදාහරණයක් ලෙස රක්ෂණය) සහ කල් ඉකුත් වන දිනය තෝරන්න.',
        },
        shot: 'asset-documents',
      },
    ],
    tips: [
      {
        en: 'When you renew a paper, use [[documents.actions.newVersion]] on the old one — do not upload it as a new document.',
        si: 'ලියවිල්ලක් අලුත් කළ විට, පැරණි එකෙහි [[documents.actions.newVersion]] භාවිත කරන්න — එය නව ලේඛනයක් ලෙස උඩුගත නොකරන්න.',
      },
    ],
    related: ['document-upload', 'document-renew', 'reminders'],
  },

  // ── Purchases, store and suppliers ────────────────────────────────────────────────────
  {
    id: 'purchase-new',
    section: 'purchases',
    title: { en: 'Record a purchase', si: 'මිලදී ගැනීමක් සටහන් කරන්න' },
    summary: {
      en: 'Enter one bill from a supplier. Each item goes to the main store or straight to a site.',
      si: 'සැපයුම්කරුවෙකුගේ එක් බිලක් ඇතුළත් කරන්න. සෑම අයිතමයක්ම ප්‍රධාන ගබඩාවට හෝ කෙලින්ම වැඩබිමකට යයි.',
    },
    keywords: {
      en: 'purchase, buy, bought, cement, sand, steel, materials, invoice, supplier bill, credit, cash',
      si: 'මිලදී ගැනීම, ගැනීම, සිමෙන්ති, වැලි, යකඩ, ද්‍රව්‍ය, ඉන්වොයිසිය, සැපයුම්කරුගේ බිල, ණය, මුදල්',
    },
    page: '/purchases',
    steps: [
      {
        text: {
          en: 'Click [[nav.purchases]]. The tabs (1) show purchases, the store, issues and materials. Press [[purchases.add]] (2).',
          si: '[[nav.purchases]] ක්ලික් කරන්න. ටැබ් (1) මිලදී ගැනීම්, ගබඩාව, නිකුත් කිරීම් සහ ද්‍රව්‍ය පෙන්වයි. [[purchases.add]] (2) ඔබන්න.',
        },
        shot: 'purchases-list',
      },
      {
        text: {
          en: 'Choose the supplier, the date, cash or credit, and the bill number. For each item press [[purchases.addLine]] (1): material, quantity, unit price, and where it was delivered ([[purchases.mainStore]] or a project). Press [[common.save]] (2).',
          si: 'සැපයුම්කරු, දිනය, මුදල් හෝ ණය, සහ බිල් අංකය තෝරන්න. සෑම අයිතමයක් සඳහාම [[purchases.addLine]] (1) ඔබන්න: ද්‍රව්‍යය, ප්‍රමාණය, ඒකක මිල, සහ එය භාර දුන් ස්ථානය ([[purchases.mainStore]] හෝ ව්‍යාපෘතියක්). [[common.save]] (2) ඔබන්න.',
        },
        shot: 'purchase-dialog',
      },
    ],
    tips: [
      {
        en: 'Credit purchases are added to what you owe the supplier. Cash purchases are already paid.',
        si: 'ණයට ගත් මිලදී ගැනීම් සැපයුම්කරුට ඔබ ගෙවිය යුතු මුදලට එකතු වේ. මුදලින් ගත් ඒවා දැනටමත් ගෙවා ඇත.',
      },
    ],
    related: ['store-issue', 'materials', 'supplier-pay'],
    popular: true,
  },
  {
    id: 'store-issue',
    section: 'purchases',
    title: {
      en: 'Send materials from the store to a site',
      si: 'ගබඩාවේ සිට වැඩබිමකට ද්‍රව්‍ය යවන්න',
    },
    summary: {
      en: 'When materials leave the main store for a site, issue them. Their cost moves to that project.',
      si: 'ප්‍රධාන ගබඩාවෙන් ද්‍රව්‍ය වැඩබිමකට යන විට, ඒවා නිකුත් කරන්න. ඒවායේ වියදම එම ව්‍යාපෘතියට යයි.',
    },
    keywords: {
      en: 'store, stock, issue, send to site, inventory, warehouse, material transfer',
      si: 'ගබඩාව, තොගය, නිකුත් කිරීම, වැඩබිමට යැවීම, ද්‍රව්‍ය මාරු කිරීම',
    },
    page: '/purchases?tab=store',
    steps: [
      {
        text: {
          en: 'Open [[nav.purchases]] → [[purchases.tabs.store]]. The table (1) shows what is in the store. Press [[store.issue]] (2) on the material.',
          si: '[[nav.purchases]] → [[purchases.tabs.store]] විවෘත කරන්න. වගුව (1) ගබඩාවේ ඇති දේ පෙන්වයි. ද්‍රව්‍යයේ ඇති [[store.issue]] (2) ඔබන්න.',
        },
        shot: 'store',
      },
      {
        text: {
          en: 'Choose the project, the date and the quantity. Press the save button.',
          si: 'ව්‍යාපෘතිය, දිනය සහ ප්‍රමාණය තෝරන්න. සුරැකීමේ බොත්තම ඔබන්න.',
        },
        shot: 'issue-dialog',
      },
    ],
    tips: [
      {
        en: 'Made a mistake? On [[purchases.tabs.issues]], use [[store.undo]] — the quantity goes back to the store.',
        si: 'වැරැද්දක් වුණාද? [[purchases.tabs.issues]] හි [[store.undo]] භාවිත කරන්න — ප්‍රමාණය නැවත ගබඩාවට යයි.',
      },
    ],
    related: ['purchase-new', 'faq-not-enough-stock'],
  },
  {
    id: 'materials',
    section: 'purchases',
    title: { en: 'Add a material to the list', si: 'ලැයිස්තුවට ද්‍රව්‍යයක් එකතු කරන්න' },
    summary: {
      en: 'Materials you buy, like cement, sand or steel, are kept in a list with their unit.',
      si: 'සිමෙන්ති, වැලි හෝ යකඩ වැනි ඔබ මිලදී ගන්නා ද්‍රව්‍ය ඒවායේ ඒකකය සමඟ ලැයිස්තුවක තබා ඇත.',
    },
    keywords: {
      en: 'material, new material, unit, cement, catalog, item',
      si: 'ද්‍රව්‍යය, නව ද්‍රව්‍යය, ඒකකය, සිමෙන්ති, ලැයිස්තුව',
    },
    page: '/purchases?tab=materials',
    steps: [
      {
        text: {
          en: 'Open [[nav.purchases]] → [[purchases.tabs.materials]]. Press [[materials.add]], type the name (also in Sinhala if you like), the category and the unit. Press [[common.save]].',
          si: '[[nav.purchases]] → [[purchases.tabs.materials]] විවෘත කරන්න. [[materials.add]] ඔබා, නම (කැමති නම් සිංහලෙන්ද), කාණ්ඩය සහ ඒකකය ටයිප් කරන්න. [[common.save]] ඔබන්න.',
        },
        shot: 'materials',
      },
    ],
    related: ['purchase-new'],
  },
  {
    id: 'supplier-new',
    section: 'purchases',
    title: { en: 'Add a supplier', si: 'සැපයුම්කරුවෙකු එකතු කරන්න' },
    summary: {
      en: 'Shops, dealers, fuel stations and subcontractors you buy from.',
      si: 'ඔබ මිලදී ගන්නා සාප්පු, අලෙවි නියෝජිතයින්, ඉන්ධන පිරවුම්හල් සහ උප කොන්ත්‍රාත්කරුවන්.',
    },
    keywords: {
      en: 'supplier, shop, dealer, vendor, subcontractor, hardware, fuel station',
      si: 'සැපයුම්කරු, සාප්පුව, අලෙවි නියෝජිතයා, උප කොන්ත්‍රාත්කරු, හාඩ්වෙයාර්, ඉන්ධන පිරවුම්හල',
    },
    page: '/suppliers',
    steps: [
      {
        text: {
          en: 'Click [[nav.suppliers]], then [[suppliers.add]]. Fill in the name, type and phone, and press [[common.save]]. The list shows how much you owe each supplier.',
          si: '[[nav.suppliers]] ක්ලික් කර, [[suppliers.add]] ඔබන්න. නම, වර්ගය සහ දුරකථන අංකය පුරවා [[common.save]] ඔබන්න. ලැයිස්තුවේ එක් එක් සැපයුම්කරුට ඔබ ගෙවිය යුතු මුදල පෙන්වයි.',
        },
        shot: 'suppliers-list',
      },
    ],
    related: ['supplier-pay', 'purchase-new'],
  },
  {
    id: 'supplier-pay',
    section: 'purchases',
    title: {
      en: 'Pay a supplier and see what you owe',
      si: 'සැපයුම්කරුවෙකුට ගෙවා ගෙවිය යුතු මුදල බලන්න',
    },
    summary: {
      en: 'The statement shows credit purchases, payments and the balance. Record every payment you make.',
      si: 'ගිණුම් ප්‍රකාශයේ ණයට ගත් දේ, ගෙවීම් සහ ශේෂය පෙන්වයි. ඔබ කරන සෑම ගෙවීමක්ම සටහන් කරන්න.',
    },
    keywords: {
      en: 'pay supplier, supplier payment, owe, balance, statement, credit, cheque',
      si: 'සැපයුම්කරුට ගෙවීම, ගෙවිය යුතු, ශේෂය, ගිණුම් ප්‍රකාශය, ණය, චෙක්පත',
    },
    page: '/suppliers',
    steps: [
      {
        text: {
          en: 'Open [[nav.suppliers]] and click the supplier, then [[suppliers.tabs.statement]]. (1) is what you owe now. Press [[suppliers.statement.addPayment]] (2).',
          si: '[[nav.suppliers]] විවෘත කර සැපයුම්කරු ක්ලික් කර, ඉන්පසු [[suppliers.tabs.statement]] ඔබන්න. (1) යනු දැන් ඔබ ගෙවිය යුතු මුදලයි. [[suppliers.statement.addPayment]] (2) ඔබන්න.',
        },
        shot: 'supplier-statement',
      },
      {
        text: {
          en: 'Type the date, the amount, how you paid and the cheque number. Press the save button.',
          si: 'දිනය, මුදල, ගෙවූ ආකාරය සහ චෙක්පත් අංකය ටයිප් කරන්න. සුරැකීමේ බොත්තම ඔබන්න.',
        },
        shot: 'supplier-payment',
      },
    ],
    related: ['supplier-new', 'purchase-new', 'reports'],
  },

  // ── Documents ─────────────────────────────────────────────────────────────────────────
  {
    id: 'document-upload',
    section: 'documents',
    title: { en: 'Upload a document', si: 'ලේඛනයක් උඩුගත කරන්න' },
    summary: {
      en: 'Keep contracts, drawings, insurance, licences and photos safely in the system, with expiry dates.',
      si: 'ගිවිසුම්, සැලසුම්, රක්ෂණ, බලපත්‍ර සහ ඡායාරූප කල් ඉකුත් වන දින සමඟ පද්ධතිය තුළ ආරක්ෂිතව තබා ගන්න.',
    },
    keywords: {
      en: 'upload, document, file, pdf, photo, scan, contract, drawing, cida, certificate, insurance, attach',
      si: 'උඩුගත කිරීම, ලේඛනය, ගොනුව, PDF, ඡායාරූපය, ස්කෑන්, ගිවිසුම, සැලසුම, CIDA, සහතිකය, රක්ෂණය',
    },
    page: '/documents',
    steps: [
      {
        text: {
          en: 'Company papers (CIDA registration, certificates): click [[nav.documents]]. For a project, worker, machine or supplier: open it and its [[documents.title]] tab.',
          si: 'සමාගම් ලියකියවිලි (CIDA ලියාපදිංචිය, සහතික): [[nav.documents]] ක්ලික් කරන්න. ව්‍යාපෘතියක්, සේවකයෙකු, යන්ත්‍රයක් හෝ සැපයුම්කරුවෙකු සඳහා: එය සහ එහි [[documents.title]] ටැබය විවෘත කරන්න.',
        },
        shot: 'documents',
      },
      {
        text: {
          en: 'Press [[documents.actions.upload]]. Drop the file in the box or click it to choose one (1). Choose the kind, write a title and, if it has one, the expiry date. Press [[documents.upload.submit]] (2).',
          si: '[[documents.actions.upload]] ඔබන්න. ගොනුව කොටුවට දමන්න හෝ එකක් තෝරා ගැනීමට එය ක්ලික් කරන්න (1). වර්ගය තෝරා, මාතෘකාවක් සහ, ඇත්නම්, කල් ඉකුත් වන දිනය ලියන්න. [[documents.upload.submit]] (2) ඔබන්න.',
        },
        shot: 'upload-dialog',
      },
    ],
    tips: [
      {
        en: 'PDF files, photos, Word and Excel files, drawings and ZIP files can be uploaded. If you enter an expiry date, you get a reminder before it.',
        si: 'PDF ගොනු, ඡායාරූප, Word සහ Excel ගොනු, සැලසුම් සහ ZIP ගොනු උඩුගත කළ හැක. ඔබ කල් ඉකුත් වන දිනයක් ඇතුළත් කළහොත්, ඊට පෙර ඔබට මතක් කිරීමක් ලැබේ.',
      },
    ],
    related: ['document-renew', 'document-find', 'vehicle-papers'],
    popular: true,
  },
  {
    id: 'document-renew',
    section: 'documents',
    title: {
      en: 'Renew insurance or a licence (new version)',
      si: 'රක්ෂණය හෝ බලපත්‍රය අලුත් කරන්න (නව අනුවාදය)',
    },
    summary: {
      en: 'Upload the renewed paper as a new version of the old one. The reminder then disappears by itself.',
      si: 'අලුත් කළ ලියවිල්ල පැරණි එකෙහි නව අනුවාදයක් ලෙස උඩුගත කරන්න. එවිට මතක් කිරීම ඉබේම ඉවත් වේ.',
    },
    keywords: {
      en: 'renew, renewal, new version, insurance renewed, licence renewed, replace file, update document',
      si: 'අලුත් කිරීම, නව අනුවාදය, රක්ෂණය අලුත් කිරීම, බලපත්‍රය අලුත් කිරීම, ගොනුව ප්‍රතිස්ථාපනය',
    },
    page: '/documents',
    steps: [
      {
        text: {
          en: "Open the place where the old document is kept: [[nav.documents]] → [[documents.tabs.company]] for company papers, or the machine, worker or project → its [[documents.title]] tab. Press [[documents.actions.newVersion]] (1) on the document's row.",
          si: 'පැරණි ලේඛනය ඇති තැන විවෘත කරන්න: සමාගම් ලියකියවිලි සඳහා [[nav.documents]] → [[documents.tabs.company]], නැතහොත් යන්ත්‍රය, සේවකයා හෝ ව්‍යාපෘතිය → එහි [[documents.title]] ටැබය. ලේඛනයේ පේළියේ ඇති [[documents.actions.newVersion]] (1) ඔබන්න.',
        },
        shot: 'document-actions',
      },
      {
        text: {
          en: 'Choose the new file and enter the **new expiry date**. Press [[documents.version.submit]].',
          si: 'නව ගොනුව තෝරා **නව කල් ඉකුත් වන දිනය** ඇතුළත් කරන්න. [[documents.version.submit]] ඔබන්න.',
        },
        shot: 'version-dialog',
      },
    ],
    tips: [
      {
        en: 'The old file is not deleted. [[documents.actions.history]] (2) shows every version.',
        si: 'පැරණි ගොනුව මකා දමන්නේ නැත. [[documents.actions.history]] (2) මඟින් සෑම අනුවාදයක්ම පෙන්වයි.',
      },
    ],
    related: ['document-find', 'reminders'],
    popular: true,
  },
  {
    id: 'document-find',
    section: 'documents',
    title: { en: 'Find, view or download a document', si: 'ලේඛනයක් සොයන්න, බලන්න හෝ බාගන්න' },
    summary: {
      en: 'Search all documents in one place, see which ones expire soon, and open older versions.',
      si: 'සියලු ලේඛන එක තැනකින් සොයන්න, ඉක්මනින් කල් ඉකුත් වන ඒවා බලන්න, සහ පැරණි අනුවාද විවෘත කරන්න.',
    },
    keywords: {
      en: 'find document, search file, download, view, open, old version, history, expiring',
      si: 'ලේඛනය සෙවීම, ගොනුව සෙවීම, බාගැනීම, බැලීම, විවෘත කිරීම, පැරණි අනුවාදය, ඉතිහාසය',
    },
    page: '/documents?tab=all',
    steps: [
      {
        text: {
          en: 'Open [[nav.documents]] → [[documents.tabs.all]]. Type in the search box (1). Use [[documents.expiringFilter]] (2) to see papers that expire soon.',
          si: '[[nav.documents]] → [[documents.tabs.all]] විවෘත කරන්න. සෙවුම් කොටුවේ (1) ටයිප් කරන්න. ඉක්මනින් කල් ඉකුත් වන ලියකියවිලි බැලීමට [[documents.expiringFilter]] (2) භාවිත කරන්න.',
        },
        shot: 'documents-all',
      },
      {
        text: {
          en: "On a row, the eye button ([[documents.actions.preview]]) opens the file. [[documents.actions.history]] lists every version; [[documents.actions.restore]] brings an old one back. To download, open the document where it is kept (for example on the machine's [[documents.title]] tab) and press [[documents.actions.download]].",
          si: 'පේළියක, ඇස් බොත්තම ([[documents.actions.preview]]) ගොනුව විවෘත කරයි. [[documents.actions.history]] මඟින් සෑම අනුවාදයක්ම ලැයිස්තුගත කරයි; [[documents.actions.restore]] මඟින් පැරණි එකක් නැවත ගෙන එයි. බාගැනීමට, ලේඛනය ඇති තැන විවෘත කර (උදාහරණයක් ලෙස යන්ත්‍රයේ [[documents.title]] ටැබය) [[documents.actions.download]] ඔබන්න.',
        },
        shot: 'history-sheet',
      },
    ],
    related: ['document-upload', 'document-renew'],
  },

  // ── Reports ───────────────────────────────────────────────────────────────────────────
  {
    id: 'reports',
    section: 'reports',
    title: { en: 'Download a report (PDF or Excel)', si: 'වාර්තාවක් බාගන්න (PDF හෝ Excel)' },
    summary: {
      en: 'Project costs, salaries, attendance, machines, expenses, suppliers, bills, expiring papers and a monthly summary.',
      si: 'ව්‍යාපෘති වියදම්, වැටුප්, පැමිණීම, යන්ත්‍ර, වියදම්, සැපයුම්කරුවන්, බිල්පත්, කල් ඉකුත් වන ලියකියවිලි සහ මාසික සාරාංශයක්.',
    },
    keywords: {
      en: 'report, print, pdf, excel, download, summary, monthly report, statement, export',
      si: 'වාර්තාව, මුද්‍රණය, PDF, Excel, බාගැනීම, සාරාංශය, මාසික වාර්තාව, ගිණුම් ප්‍රකාශය',
    },
    page: '/reports',
    steps: [
      {
        text: {
          en: 'Click [[nav.reports]]. Each card is one report. Click the report you want.',
          si: '[[nav.reports]] ක්ලික් කරන්න. සෑම කාඩ්පතක්ම එක් වාර්තාවකි. ඔබට අවශ්‍ය වාර්තාව ක්ලික් කරන්න.',
        },
        shot: 'reports',
      },
      {
        text: {
          en: 'Choose the filters (project, month or dates). Press [[reports.downloadPdf]] to print, or [[reports.downloadExcel]] to work with the numbers. The file goes to your Downloads folder.',
          si: 'පෙරහන් (ව්‍යාපෘතිය, මාසය හෝ දින) තෝරන්න. මුද්‍රණය කිරීමට [[reports.downloadPdf]] හෝ අංක සමඟ වැඩ කිරීමට [[reports.downloadExcel]] ඔබන්න. ගොනුව ඔබගේ Downloads ෆෝල්ඩරයට යයි.',
        },
        shot: 'report-panel',
      },
    ],
    tips: [
      {
        en: 'Reports come out in the language you are using now (English or Sinhala).',
        si: 'වාර්තා ලැබෙන්නේ ඔබ දැන් භාවිත කරන භාෂාවෙන් (ඉංග්‍රීසි හෝ සිංහල).',
      },
      {
        en: 'Good monthly habit: [[reports.list.business-summary.name]] shows money in, money out and money to receive.',
        si: 'හොඳ මාසික පුරුද්දක්: [[reports.list.business-summary.name]] මඟින් ලැබුණු මුදල්, වියදම් සහ ලැබිය යුතු මුදල් පෙන්වයි.',
      },
    ],
    related: ['payslips', 'bill-new', 'language'],
    popular: true,
  },

  // ── Settings and backups ──────────────────────────────────────────────────────────────
  {
    id: 'settings-company',
    section: 'settings',
    title: {
      en: 'Company details, salary rates and reminder days',
      si: 'සමාගම් විස්තර, වැටුප් අනුපාත සහ මතක් කිරීමේ දින',
    },
    summary: {
      en: 'Settings that are used everywhere: the company name on reports, EPF / ETF rates and when reminders come.',
      si: 'සෑම තැනකම භාවිත වන සැකසුම්: වාර්තාවල සමාගමේ නම, EPF / ETF අනුපාත සහ මතක් කිරීම් පැමිණෙන කාලය.',
    },
    keywords: {
      en: 'settings, company name, address, cida grade, epf rate, etf rate, working days, overtime rate, reminder days, retention default',
      si: 'සැකසුම්, සමාගමේ නම, ලිපිනය, CIDA ශ්‍රේණිය, EPF අනුපාතය, ETF අනුපාතය, වැඩ දින, අතිකාල අනුපාතය, මතක් කිරීමේ දින',
    },
    page: '/settings',
    steps: [
      {
        text: {
          en: 'Click [[nav.settings]]. The tabs at the top open each group of settings. On [[settings.tabs.company]], change the name, address and CIDA grade, and press [[common.save]].',
          si: '[[nav.settings]] ක්ලික් කරන්න. ඉහළ ඇති ටැබ් මඟින් එක් එක් සැකසුම් කාණ්ඩය විවෘත වේ. [[settings.tabs.company]] හි නම, ලිපිනය සහ CIDA ශ්‍රේණිය වෙනස් කර [[common.save]] ඔබන්න.',
        },
        shot: 'settings-company',
      },
      {
        text: {
          en: '[[settings.tabs.payroll]]: EPF, ETF, working days and overtime. Change them only if the law or your rules change.',
          si: '[[settings.tabs.payroll]]: EPF, ETF, වැඩ දින සහ අතිකාල. නීතිය හෝ ඔබගේ නීති වෙනස් වුවහොත් පමණක් ඒවා වෙනස් කරන්න.',
        },
        shot: 'settings-payroll',
      },
      {
        text: {
          en: '[[settings.tabs.reminders]]: how many days before an expiry you want a reminder, for example 30, 14, 7.',
          si: '[[settings.tabs.reminders]]: කල් ඉකුත් වීමට දින කීයකට පෙර මතක් කිරීමක් අවශ්‍යද, උදාහරණයක් ලෙස 30, 14, 7.',
        },
        shot: 'settings-reminders',
      },
    ],
    related: ['password', 'backup', 'reminders'],
  },
  {
    id: 'backup',
    section: 'settings',
    title: {
      en: 'Backups: check them and back up now',
      si: 'බැකප්: ඒවා පරීක්ෂා කර දැන් බැකප් කරන්න',
    },
    summary: {
      en: 'Every night at 23:00 all records and documents are copied and locked. You can also back up at any time.',
      si: 'සෑම රාත්‍රියකම 23:00 ට සියලු වාර්තා සහ ලේඛන පිටපත් කර අගුළු දමයි. ඔබට ඕනෑම වේලාවක බැකප් කළ හැක.',
    },
    keywords: {
      en: 'backup, back up, save copy, data safe, restore, red dot, orange dot, green dot',
      si: 'බැකප්, පිටපත, දත්ත ආරක්ෂාව, ප්‍රතිසාධනය, රතු තිත, තැඹිලි තිත, කොළ තිත',
    },
    page: '/settings?tab=backup',
    steps: [
      {
        text: {
          en: 'Look at the backup dot at the top of every page: **green** = fine, **orange** = the last backup is old or only on this computer, **red** = a backup failed. Click it to open the backup page.',
          si: 'සෑම පිටුවකම ඉහළ ඇති බැකප් තිත බලන්න: **කොළ** = හොඳයි, **තැඹිලි** = අවසන් බැකප් එක පැරණියි හෝ මෙම පරිගණකයේ පමණයි, **රතු** = බැකප් එකක් අසාර්ථකයි. බැකප් පිටුව විවෘත කිරීමට එය ක්ලික් කරන්න.',
        },
        shot: 'screen-tour',
      },
      {
        text: {
          en: '[[nav.settings]] → [[settings.tabs.backup]] shows the state and what to do (1). Press [[backup.backupNow]] (2). It takes about a minute; you can keep working.',
          si: '[[nav.settings]] → [[settings.tabs.backup]] මඟින් තත්ත්වය සහ කළ යුතු දේ (1) පෙන්වයි. [[backup.backupNow]] (2) ඔබන්න. මිනිත්තුවක් පමණ ගත වේ; ඔබට දිගටම වැඩ කළ හැක.',
        },
        shot: 'backup',
      },
    ],
    warnings: [
      {
        en: 'Keep your **backup password** (shown the first time the system started) written on paper. Without it, no backup can be restored.',
        si: 'ඔබගේ **බැකප් මුරපදය** (පද්ධතිය පළමු වරට ආරම්භ වූ විට පෙන්වූ) කඩදාසියක ලියා තබා ගන්න. එය නොමැතිව කිසිදු බැකප් එකක් ප්‍රතිසාධනය කළ නොහැක.',
      },
    ],
    tips: [
      {
        en: 'To bring back an old backup, ask your helper. It replaces all current data.',
        si: 'පැරණි බැකප් එකක් නැවත ගෙන ඒමට, ඔබගේ උදව්කරුගෙන් විමසන්න. එය වත්මන් සියලු දත්ත ප්‍රතිස්ථාපනය කරයි.',
      },
    ],
    related: ['google-drive', 'faq-backup-red', 'start-stop'],
    popular: true,
  },
  {
    id: 'google-drive',
    section: 'settings',
    title: { en: 'Connect Google Drive for backups', si: 'බැකප් සඳහා Google Drive සම්බන්ධ කරන්න' },
    summary: {
      en: 'With Google Drive, every backup is also kept outside the computer — safe even if the Mac is lost or broken.',
      si: 'Google Drive සමඟ, සෑම බැකප් එකක්ම පරිගණකයෙන් පිටතද තබා ගනී — Mac එක නැති වුවද කැඩුණද ආරක්ෂිතයි.',
    },
    keywords: {
      en: 'google drive, cloud, online backup, gdrive, connect drive, setup-gdrive',
      si: 'Google Drive, ක්ලවුඩ්, අන්තර්ජාල බැකප්, Drive සම්බන්ධ කිරීම',
    },
    page: '/settings?tab=backup',
    steps: [
      {
        text: {
          en: 'On the computer where the system is installed, open [[nav.settings]] → [[settings.tabs.backup]]. In the [[backup.drive.title]] box press [[backup.drive.connect]].',
          si: 'පද්ධතිය ස්ථාපනය කර ඇති පරිගණකයේ, [[nav.settings]] → [[settings.tabs.backup]] විවෘත කරන්න. [[backup.drive.title]] කොටුවේ [[backup.drive.connect]] ඔබන්න.',
        },
        shot: 'backup-drive',
      },
      {
        text: {
          en: 'After a few seconds, press [[backup.drive.openSignIn]]. A Google page opens in a new tab: choose the Google account for the backups.',
          si: 'තත්පර කිහිපයකින්, [[backup.drive.openSignIn]] ඔබන්න. නව ටැබයක Google පිටුවක් විවෘත වේ: බැකප් සඳහා Google ගිණුම තෝරන්න.',
        },
        shot: 'gdrive-signin',
      },
      {
        text: {
          en: 'If Google says the app is not verified, click **Advanced**, then **Go to rclone (unsafe)**, then **Continue** / **Allow**. When the page says **Success**, close it.',
          si: 'යෙදුම තහවුරු කර නැති බව Google පැවසුවහොත්, **Advanced**, ඉන්පසු **Go to rclone (unsafe)**, ඉන්පසු **Continue** / **Allow** ක්ලික් කරන්න. පිටුවේ **Success** පෙනුණු විට, එය වසන්න.',
        },
      },
      {
        text: {
          en: 'Back in the system, the box now says it is connected (the page updates by itself). Press [[backup.backupNow]] to test it.',
          si: 'ආපසු පද්ධතියට පැමිණි විට, කොටුවේ එය සම්බන්ධ වී ඇති බව පෙන්වයි (පිටුව ඉබේම යාවත්කාලීන වේ). එය පරීක්ෂා කිරීමට [[backup.backupNow]] ඔබන්න.',
        },
      },
    ],
    tips: [
      {
        en: 'The backup tool can only see the files it creates in your Drive. The backups are locked, so nobody can open them without your backup password.',
        si: 'බැකප් මෙවලමට ඔබගේ Drive හි එය සාදන ගොනු පමණක් දැකිය හැක. බැකප් අගුළු දමා ඇති නිසා, ඔබගේ බැකප් මුරපදය නොමැතිව කිසිවෙකුට ඒවා විවෘත කළ නොහැක.',
      },
    ],
    related: ['backup'],
  },
  {
    id: 'sample-data',
    section: 'settings',
    title: {
      en: 'Remove the sample data and start for real',
      si: 'නියැදි දත්ත ඉවත් කර සැබෑ ලෙස ආරම්භ කරන්න',
    },
    summary: {
      en: 'The system came with made-up sample data for practice. Reset it when you want to start again.',
      si: 'පුහුණුව සඳහා පද්ධතිය සමඟ ව්‍යාජ නියැදි දත්ත පැමිණියේය. නැවත ආරම්භ කිරීමට අවශ්‍ය විට එය යළි සකසන්න.',
    },
    keywords: {
      en: 'sample data, demo data, reset, start fresh, start empty, real use, delete all, practice data, clear database',
      si: 'නියැදි දත්ත, ආදර්ශ දත්ත, යළි සැකසීම, අලුතින් ආරම්භ කිරීම, සියල්ල මකා දැමීම',
    },
    page: '/settings?tab=sampleData',
    steps: [
      {
        text: {
          en: 'If you might want the old records back one day, first press [[backup.backupNow]].',
          si: 'කවදා හෝ පැරණි වාර්තා නැවත අවශ්‍ය විය හැකි නම්, පළමුව [[backup.backupNow]] ඔබන්න.',
        },
      },
      {
        text: {
          en: 'Open [[nav.settings]] → [[settings.tabs.sampleData]]. To start real use press [[sampleData.emptyButton]] (1). To practise again with the made-up company press [[sampleData.button]] (2).',
          si: '[[nav.settings]] → [[settings.tabs.sampleData]] විවෘත කරන්න. සැබෑ භාවිතය ආරම්භ කිරීමට [[sampleData.emptyButton]] (1) ඔබන්න. ව්‍යාජ සමාගම සමඟ නැවත පුහුණු වීමට [[sampleData.button]] (2) ඔබන්න.',
        },
        shot: 'sample-data',
      },
      {
        text: {
          en: 'Type **RESET** (1), then the password you use to log in (2), and press the red button (3). It takes up to a minute.',
          si: '**RESET** (1) ටයිප් කර, ඉන්පසු ඔබ පිවිසීමට භාවිත කරන මුරපදය (2) ටයිප් කර, රතු බොත්තම (3) ඔබන්න. එයට මිනිත්තුවක් පමණ ගත විය හැක.',
        },
        shot: 'reset-dialog',
      },
    ],
    warnings: [
      {
        en: 'Both buttons delete ALL projects, workers, machines, daily records, salaries, bills and documents. It cannot be undone, except by restoring a backup. Your login, the settings and all backups (also Google Drive) are kept.',
        si: 'බොත්තම් දෙකම සියලු ව්‍යාපෘති, සේවකයින්, යන්ත්‍ර, දෛනික සටහන්, වැටුප්, බිල්පත් සහ ලේඛන මකා දමයි. බැකප් එකක් ප්‍රතිසාධනය කිරීමෙන් හැර එය අහෝසි කළ නොහැක. ඔබගේ පිවිසුම, සැකසුම් සහ සියලු බැකප් (Google Drive ද) ආරක්ෂිතව පවතී.',
      },
    ],
    related: ['backup'],
  },

  // ── Problems and questions ────────────────────────────────────────────────────────────
  {
    id: 'faq-locked-day',
    section: 'problems',
    title: { en: '"This day can no longer be changed"', si: '"මෙම දිනය තවදුරටත් වෙනස් කළ නොහැක"' },
    summary: {
      en: 'The salaries of that month are finalized, so its attendance is locked.',
      si: 'එම මාසයේ වැටුප් අවසන් කර ඇති නිසා, එහි පැමිණීම අගුළු දමා ඇත.',
    },
    keywords: {
      en: 'locked, cannot change attendance, payroll locked, finalized, error',
      si: 'අගුළු දමා ඇත, පැමිණීම වෙනස් කළ නොහැක, වැටුප් අගුළු, අවසන් කළ, දෝෂය',
    },
    steps: [
      {
        text: {
          en: 'Open [[nav.payroll]], go to that month and press [[payroll.reopen]]. Fix the day on [[nav.daily]], then calculate and finalize the month again.',
          si: '[[nav.payroll]] විවෘත කර, එම මාසයට ගොස් [[payroll.reopen]] ඔබන්න. [[nav.daily]] හි දිනය නිවැරදි කර, ඉන්පසු මාසය නැවත ගණනය කර අවසන් කරන්න.',
        },
      },
    ],
    related: ['payroll-reopen'],
  },
  {
    id: 'faq-already-booked',
    section: 'problems',
    title: { en: '"Already booked" on the schedule', si: 'වැඩ සැලැස්මේ "දැනටමත් වෙන් කර ඇත"' },
    summary: {
      en: 'The person or machine is already booked somewhere else at that time, so nothing was saved.',
      si: 'එම පුද්ගලයා හෝ යන්ත්‍රය එම වේලාවේ දැනටමත් වෙනත් තැනක වෙන් කර ඇති නිසා, කිසිවක් සුරැකුණේ නැත.',
    },
    keywords: {
      en: 'already booked, double booking, conflict, overlap, busy',
      si: 'දැනටමත් වෙන් කර ඇත, දෙවරක් වෙන් කිරීම, ගැටුම, කාර්යබහුල',
    },
    steps: [
      {
        text: {
          en: 'The message shows where they are already booked. Choose another time or another person — or first change or cancel the other booking.',
          si: 'ඔවුන් දැනටමත් වෙන් කර ඇති තැන පණිවිඩයේ පෙන්වයි. වෙනත් වේලාවක් හෝ වෙනත් පුද්ගලයෙකු තෝරන්න — නැතහොත් පළමුව අනෙක් වෙන් කිරීම වෙනස් කරන්න හෝ අවලංගු කරන්න.',
        },
      },
    ],
    related: ['schedule-change', 'schedule-book'],
  },
  {
    id: 'faq-not-enough-stock',
    section: 'problems',
    title: { en: '"Not enough in the store"', si: '"ගබඩාවේ ප්‍රමාණවත් නැත"' },
    summary: {
      en: 'You tried to issue more than the store has.',
      si: 'ඔබ ගබඩාවේ ඇති ප්‍රමාණයට වඩා නිකුත් කිරීමට උත්සාහ කළා.',
    },
    keywords: {
      en: 'not enough stock, insufficient stock, store empty, issue error',
      si: 'තොගය ප්‍රමාණවත් නැත, ගබඩාව හිස්, නිකුත් කිරීමේ දෝෂය',
    },
    steps: [
      {
        text: {
          en: 'Check that the purchase was recorded with [[purchases.fields.deliverTo]] = [[purchases.mainStore]]. If the material went straight to a site, it never entered the store and does not need to be issued.',
          si: 'මිලදී ගැනීම [[purchases.fields.deliverTo]] = [[purchases.mainStore]] ලෙස සටහන් කර ඇත්දැයි පරීක්ෂා කරන්න. ද්‍රව්‍ය කෙලින්ම වැඩබිමකට ගියේ නම්, එය කිසි විටෙකත් ගබඩාවට ඇතුළු නොවූ නිසා නිකුත් කිරීමට අවශ්‍ය නැත.',
        },
      },
    ],
    related: ['store-issue', 'purchase-new'],
  },
  {
    id: 'faq-backup-red',
    section: 'problems',
    title: { en: 'The backup dot is red or orange', si: 'බැකප් තිත රතු හෝ තැඹිලි පැහැයි' },
    summary: {
      en: 'The last backup is old, failed, or was not saved to Google Drive.',
      si: 'අවසන් බැකප් එක පැරණියි, අසාර්ථකයි, නැතහොත් Google Drive වෙත සුරැකුණේ නැත.',
    },
    keywords: {
      en: 'backup failed, red dot, orange dot, backup old, backup service not running',
      si: 'බැකප් අසාර්ථකයි, රතු තිත, තැඹිලි තිත, බැකප් පැරණියි, බැකප් සේවාව ක්‍රියාත්මක නැත',
    },
    steps: [
      {
        text: {
          en: 'Click the dot. The backup page says what is wrong and what to do. Usually [[backup.backupNow]] fixes it.',
          si: 'තිත ක්ලික් කරන්න. වැරැද්ද සහ කළ යුතු දේ බැකප් පිටුවේ පවසයි. සාමාන්‍යයෙන් [[backup.backupNow]] මඟින් එය නිවැරදි වේ.',
        },
        shot: 'backup',
      },
      {
        text: {
          en: 'If it says the backup service is not running, start the system again (Docker Desktop open, then **docker compose up -d** in the supun-construction folder, or **start.command** on a Mac). If it stays red, ask your helper.',
          si: 'බැකප් සේවාව ක්‍රියාත්මක නොවන බව පවසයි නම්, පද්ධතිය නැවත ආරම්භ කරන්න (Docker Desktop විවෘත කර, supun-construction ෆෝල්ඩරයේ **docker compose up -d**, නැතහොත් Mac හි **start.command**). එය දිගටම රතු නම්, ඔබගේ උදව්කරුගෙන් විමසන්න.',
        },
      },
    ],
    related: ['backup', 'google-drive'],
  },
  {
    id: 'faq-site-not-reached',
    section: 'problems',
    title: {
      en: 'The browser says "This site can\'t be reached"',
      si: 'බ්‍රව්සරය "This site can\'t be reached" යැයි පවසයි',
    },
    summary: {
      en: 'The system is still starting, or it is stopped.',
      si: 'පද්ධතිය තවමත් ආරම්භ වෙමින් පවතී, නැතහොත් නවතා ඇත.',
    },
    keywords: {
      en: 'cannot open, not working, site cannot be reached, blank page, not loading, docker',
      si: 'විවෘත කළ නොහැක, වැඩ කරන්නේ නැත, පිටුව පූරණය නොවේ, හිස් පිටුව, docker',
    },
    steps: [
      {
        text: {
          en: 'Wait one minute and reload the page. If it still does not open, check that Docker Desktop is open, then start the system (**docker compose up -d** in the supun-construction folder, or **start.command** on a Mac).',
          si: 'මිනිත්තුවක් රැඳී පිටුව නැවත පූරණය කරන්න. තවමත් විවෘත නොවේ නම්, Docker Desktop විවෘතව ඇත්දැයි පරීක්ෂා කර, පද්ධතිය ආරම්භ කරන්න (supun-construction ෆෝල්ඩරයේ **docker compose up -d**, නැතහොත් Mac හි **start.command**).',
        },
      },
    ],
    related: ['start-stop'],
  },
  {
    id: 'faq-forgot-password',
    section: 'problems',
    title: { en: 'I forgot my password', si: 'මට මගේ මුරපදය අමතක විය' },
    summary: {
      en: 'Your helper can reset the login so you can log in with the first password again.',
      si: 'ඔබට නැවත පළමු මුරපදයෙන් ඇතුළු විය හැකි වන පරිදි ඔබගේ උදව්කරුට පිවිසුම යළි සැකසිය හැක.',
    },
    keywords: {
      en: 'forgot password, lost password, cannot log in, reset password, wrong password',
      si: 'මුරපදය අමතක විය, මුරපදය නැති විය, ඇතුළු විය නොහැක, මුරපදය යළි සැකසීම, වැරදි මුරපදය',
    },
    steps: [
      {
        text: {
          en: 'Ask your helper to reset the login (the steps are in the README file, "Troubleshooting"). Your records are not touched. Then log in and choose a new password at once.',
          si: 'පිවිසුම යළි සකසන ලෙස ඔබගේ උදව්කරුගෙන් ඉල්ලන්න (පියවර README ගොනුවේ "Troubleshooting" හි ඇත). ඔබගේ වාර්තාවලට කිසිදු බලපෑමක් නැත. ඉන්පසු ඇතුළු වී වහාම නව මුරපදයක් තෝරන්න.',
        },
      },
    ],
    related: ['password', 'login'],
  },
  {
    id: 'faq-deleted',
    section: 'problems',
    title: { en: 'I deleted something by mistake', si: 'මම වැරදීමකින් යමක් මකා දැමුවා' },
    summary: {
      en: 'Projects, workers, machines, suppliers and documents are only hidden when deleted — they are kept in the history.',
      si: 'ව්‍යාපෘති, සේවකයින්, යන්ත්‍ර, සැපයුම්කරුවන් සහ ලේඛන මකා දැමූ විට සඟවනු ලබයි පමණි — ඒවා ඉතිහාසයේ ආරක්ෂිතව පවතී.',
    },
    keywords: {
      en: 'deleted by mistake, undo delete, recover, bring back, lost record',
      si: 'වැරදීමකින් මකා දැමීම, මකා දැමීම අහෝසි කිරීම, නැවත ලබා ගැනීම, නැති වූ වාර්තාව',
    },
    steps: [
      {
        text: {
          en: 'Ask your helper — they can bring it back. As a last way, a backup from before the mistake can be restored.',
          si: 'ඔබගේ උදව්කරුගෙන් විමසන්න — ඔවුන්ට එය නැවත ගෙන ආ හැක. අවසාන ක්‍රමයක් ලෙස, වැරැද්දට පෙර බැකප් එකක් ප්‍රතිසාධනය කළ හැක.',
        },
      },
    ],
    related: ['backup'],
  },
];

export function topicById(id: string | null | undefined): GuideTopic | undefined {
  return id ? GUIDE_TOPICS.find((t) => t.id === id) : undefined;
}

/** The guide section for a page of the app (used by the Help button). */
export function sectionForPath(pathname: string): GuideSectionId | undefined {
  const match = GUIDE_SECTIONS.flatMap((s) => s.paths.map((p) => ({ p, id: s.id })))
    .filter(({ p }) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.p.length - a.p.length)[0];
  return match?.id;
}

/** Every shot name the guide uses. */
export function guideShots(): string[] {
  return [
    ...new Set(GUIDE_TOPICS.flatMap((t) => t.steps.flatMap((s) => (s.shot ? [s.shot] : [])))),
  ];
}
