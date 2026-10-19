import { Fragment } from 'react';

/** `[[ns.key]]` (a screen label), `**bold**`, or `(1)` / `(1, 3)` (numbers of the marks on a screenshot). */
const TOKEN = /\[\[([\w.-]+)\]\]|\*\*(.+?)\*\*|\(([1-9](?:, ?[1-9])*)\)/g;

export type Translate = (key: string) => string;

/** The text with every `[[key]]` replaced by its screen label and the bold marks removed (for search). */
export function plainText(text: string, t: Translate): string {
  return text.replace(TOKEN, (_m, key?: string, bold?: string, nums?: string) =>
    key ? t(key) : (bold ?? `(${nums})`),
  );
}

/** Renders guide text: screen labels as small "button" chips, bold text, and numbered badges. */
export function RichText({ text, t }: { text: string; t: Translate }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, key, bold, nums] = m;
    if (key) {
      parts.push(
        <span
          key={i++}
          className="mx-0.5 inline-block rounded-md border border-primary/25 bg-primary/8 px-1.5 py-px font-semibold whitespace-nowrap text-primary"
        >
          {t(key)}
        </span>,
      );
    } else if (bold) {
      parts.push(
        <strong key={i++} className="font-semibold">
          {bold}
        </strong>,
      );
    } else if (nums) {
      parts.push(
        <Fragment key={i++}>
          {nums.split(',').map((n) => (
            <span
              key={n}
              aria-label={n.trim()}
              className="mx-0.5 inline-flex size-6 items-center justify-center rounded-full bg-rose-600 align-[0.1em] text-[0.8rem] font-bold text-white"
            >
              {n.trim()}
            </span>
          ))}
        </Fragment>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
