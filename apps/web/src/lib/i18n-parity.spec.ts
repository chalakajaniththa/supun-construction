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

/**
 * The argument names of an ICU message: `{name}`, `{days, plural, =0 {today} other {# days}}` →
 * name, days. Text inside plural / select branches is a sub-message, not an argument.
 */
export function icuArgs(msg: string): string[] {
  const out = new Set<string>();
  let i = 0;
  const message = (end: string | null) => {
    while (i < msg.length) {
      const c = msg[i]!;
      if (c === "'" && msg[i + 1] === "'") {
        i += 2;
      } else if (c === '{') {
        i++;
        argument();
      } else if (end && c === end) {
        return;
      } else i++;
    }
  };
  const argument = () => {
    const m = /^\s*(\w+)\s*(,\s*(\w+)\s*)?/.exec(msg.slice(i))!;
    out.add(m[1]!);
    i += m[0].length;
    if (msg[i] === '}') {
      i++;
      return;
    }
    // ", plural, =0 {…} other {…}" — skip the selectors, read each branch as a sub-message
    if (msg[i] === ',') i++;
    while (i < msg.length && msg[i] !== '}') {
      if (msg[i] === '{') {
        i++;
        message('}');
        i++;
      } else i++;
    }
    i++;
  };
  message(null);
  return [...out].sort();
}

/** Lower-camel-case namespace name for an enum, e.g. ProjectType → projectType. */
const enumNamespace = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

describe('icuArgs', () => {
  it('reads plain and plural / select arguments, not branch text', () => {
    expect(icuArgs('Hello {name}')).toEqual(['name']);
    expect(
      icuArgs('{owner} expires {days, plural, =0 {today} =1 {tomorrow} other {in # days}}'),
    ).toEqual(['days', 'owner']);
    expect(icuArgs('{n, plural, one {# item of {total}} other {# items}}')).toEqual(['n', 'total']);
    expect(icuArgs('No arguments')).toEqual([]);
  });
});

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
    const vars = (s: string) => icuArgs(s).join(',');
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
