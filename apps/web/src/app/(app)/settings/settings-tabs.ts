/** Shared by the server page (reads ?tab=) and the client view — so not in a 'use client' file. */
export const SETTINGS_TABS = ['company', 'payroll', 'reminders', 'billing', 'password'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
