import { ALL_ENUMS } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import si from '../../messages/si.json';

type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const enKeys = flatten(en as Messages);
const siKeys = flatten(si as Messages);

/** Lower-camel-case namespace name for an enum, e.g. ProjectType → projectType. */
const enumNamespace = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

describe('i18n messages', () => {
  it('en.json and si.json have exactly the same keys', () => {
    const missingInSi = Object.keys(enKeys).filter((k) => !(k in siKeys));
    const missingInEn = Object.keys(siKeys).filter((k) => !(k in enKeys));
    expect({ missingInSi, missingInEn }).toEqual({ missingInSi: [], missingInEn: [] });
  });

  it('has no empty translations', () => {
    const empty = [...Object.entries(enKeys), ...Object.entries(siKeys)]
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('uses the same {placeholders} in both languages', () => {
    const vars = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
    const mismatched = Object.keys(enKeys).filter(
      (k) => k in siKeys && vars(enKeys[k]!) !== vars(siKeys[k]!),
    );
    expect(mismatched).toEqual([]);
  });

  it('has a label for every value of every shared enum', () => {
    const missing: string[] = [];
    for (const [name, values] of Object.entries(ALL_ENUMS)) {
      for (const value of values) {
        const key = `enums.${enumNamespace(name)}.${value}`;
        if (!(key in enKeys)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });
});
