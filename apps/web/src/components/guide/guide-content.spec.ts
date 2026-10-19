import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import si from '../../../messages/si.json';
import {
  GUIDE_SECTIONS,
  GUIDE_TOPICS,
  type GuideText,
  guideShots,
  sectionForPath,
} from './guide-content';

type Messages = { [key: string]: string | Messages };

function message(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Every text of every topic, with where it comes from. */
const texts: { where: string; text: GuideText }[] = GUIDE_TOPICS.flatMap((tp) => [
  { where: `${tp.id}.title`, text: tp.title },
  { where: `${tp.id}.summary`, text: tp.summary },
  { where: `${tp.id}.keywords`, text: tp.keywords },
  ...tp.steps.map((s, i) => ({ where: `${tp.id}.step${i + 1}`, text: s.text })),
  ...(tp.tips ?? []).map((x, i) => ({ where: `${tp.id}.tip${i + 1}`, text: x })),
  ...(tp.warnings ?? []).map((x, i) => ({ where: `${tp.id}.warning${i + 1}`, text: x })),
]);

const keysIn = (s: string) => [...s.matchAll(/\[\[([\w.-]+)\]\]/g)].map((m) => m[1]!).sort();
const marksIn = (s: string) =>
  [...s.matchAll(/\(([1-9](?:, ?[1-9])*)\)/g)].map((m) => m[1]!.replace(/ /g, '')).sort();

describe('user guide content', () => {
  it('has unique topic ids in known sections', () => {
    const ids = GUIDE_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sections = new Set(GUIDE_SECTIONS.map((s) => s.id));
    expect(GUIDE_TOPICS.filter((t) => !sections.has(t.section)).map((t) => t.id)).toEqual([]);
  });

  it('has at least one topic in every section, and steps in every topic', () => {
    for (const s of GUIDE_SECTIONS) {
      expect(
        GUIDE_TOPICS.some((t) => t.section === s.id),
        s.id,
      ).toBe(true);
    }
    expect(GUIDE_TOPICS.filter((t) => !t.steps.length).map((t) => t.id)).toEqual([]);
  });

  it('has every text in English and Sinhala', () => {
    const empty = texts.filter(({ text }) => !text.en.trim() || !text.si.trim());
    expect(empty.map((e) => e.where)).toEqual([]);
    const sections = GUIDE_SECTIONS.filter(
      (s) => !s.title.en || !s.title.si || !s.description.en || !s.description.si,
    );
    expect(sections.map((s) => s.id)).toEqual([]);
  });

  it('only names screen labels that exist (without placeholders) in both languages', () => {
    const bad: string[] = [];
    for (const { where, text } of texts) {
      for (const key of keysIn(`${text.en} ${text.si}`)) {
        for (const [lang, messages] of [
          ['en', en],
          ['si', si],
        ] as const) {
          const m = message(messages as Messages, key);
          if (m === undefined || m.includes('{')) bad.push(`${where}: ${lang} ${key}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses the same screen labels and picture marks in both languages', () => {
    const mismatched = texts
      .filter(
        ({ text }) =>
          keysIn(text.en).join() !== keysIn(text.si).join() ||
          marksIn(text.en).join() !== marksIn(text.si).join(),
      )
      .map((e) => e.where);
    expect(mismatched).toEqual([]);
  });

  it('links only to topics that exist', () => {
    const ids = new Set(GUIDE_TOPICS.map((t) => t.id));
    const broken = GUIDE_TOPICS.flatMap((t) =>
      (t.related ?? []).filter((r) => !ids.has(r) || r === t.id).map((r) => `${t.id} → ${r}`),
    );
    expect(broken).toEqual([]);
  });

  it('has every screenshot in both languages', () => {
    const missing = guideShots().flatMap((shot) =>
      (['en', 'si'] as const)
        .map((lang) => `public/guide/${lang}/${shot}.webp`)
        .filter((path) => !existsSync(path)),
    );
    expect(missing).toEqual([]);
  });
});

describe('sectionForPath', () => {
  it('finds the guide section of a page', () => {
    expect(sectionForPath('/daily')).toBe('daily');
    expect(sectionForPath('/daily/expenses')).toBe('daily');
    expect(sectionForPath('/projects/123')).toBe('projects');
    expect(sectionForPath('/payroll')).toBe('workers');
    expect(sectionForPath('/suppliers/abc')).toBe('purchases');
    expect(sectionForPath('/dashboard')).toBe('start');
    expect(sectionForPath('/somewhere-else')).toBeUndefined();
  });
});
