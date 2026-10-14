import { z } from 'zod';
import { percentSchema, positiveRateSchema } from '../money';

const optionalText = (max: number) => z.string().trim().max(max).default('');

export const companySettingsSchema = z.object({
  name: z.string().trim().min(1, 'REQUIRED').max(200),
  address: optionalText(500),
  phone: optionalText(50),
  email: z.union([z.literal(''), z.email('INVALID_EMAIL').max(200)]).default(''),
  cidaGrade: optionalText(50),
  logoDocId: z.uuid().nullable().default(null),
});
export type CompanySettings = z.infer<typeof companySettingsSchema>;

export const payrollSettingsSchema = z.object({
  epfEmployeePct: percentSchema,
  epfEmployerPct: percentSchema,
  etfEmployerPct: percentSchema,
  workingDaysPerMonth: z.coerce.number().int().min(1).max(31),
  otMultiplier: positiveRateSchema,
  permanentOtDivisor: z.coerce.number().int().min(1).max(1000),
  dailyStandardHours: z.coerce.number().int().min(1).max(24),
});
export type PayrollSettings = z.infer<typeof payrollSettingsSchema>;

export const reminderSettingsSchema = z.object({
  daysBefore: z
    .array(z.coerce.number().int().min(1).max(365))
    .min(1, 'REQUIRED')
    .max(10)
    .transform((days) => [...new Set(days)].sort((a, b) => b - a)),
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

export const billingSettingsSchema = z.object({
  defaultRetentionPct: percentSchema,
  defaultRetentionCapPct: percentSchema,
});
export type BillingSettings = z.infer<typeof billingSettingsSchema>;

export const SETTING_KEYS = ['company', 'payroll', 'reminders', 'billing'] as const;
export const SettingKey = z.enum(SETTING_KEYS);
export type SettingKey = (typeof SETTING_KEYS)[number];

export const settingSchemas = {
  company: companySettingsSchema,
  payroll: payrollSettingsSchema,
  reminders: reminderSettingsSchema,
  billing: billingSettingsSchema,
} as const;

export interface SettingsMap {
  company: CompanySettings;
  payroll: PayrollSettings;
  reminders: ReminderSettings;
  billing: BillingSettings;
}

/** Defaults from overview §6. Rates are decimal strings (never floats). */
export const DEFAULT_SETTINGS: SettingsMap = {
  company: {
    name: 'Supun Construction',
    address: '',
    phone: '',
    email: '',
    cidaGrade: '',
    logoDocId: null,
  },
  payroll: {
    epfEmployeePct: '8',
    epfEmployerPct: '12',
    etfEmployerPct: '3',
    workingDaysPerMonth: 26,
    otMultiplier: '1.5',
    permanentOtDivisor: 240,
    dailyStandardHours: 8,
  },
  reminders: { daysBefore: [30, 14, 7] },
  billing: { defaultRetentionPct: '10', defaultRetentionCapPct: '5' },
};
