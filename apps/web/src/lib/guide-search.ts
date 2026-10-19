/**
 * Search for the user guide. Works the same for English and Sinhala: every word of the query
 * must appear somewhere in a topic (as a part of a word, so "salar" finds "salaries"); topics
 * score higher when the words are in the title or keywords than in the step text.
 */

export interface SearchField {
  text: string;
  /** How much a match in this field counts (title 8, keywords 5, summary 3, body 1, …). */
  weight: number;
}

export interface SearchDoc {
  id: string;
  fields: SearchField[];
  /** Added to the score of a match (e.g. for the most used topics). */
  boost?: number;
}

/**
 * Lower case, one Unicode form, and no punctuation. Sinhala joiners (ZWJ / ZWNJ) are dropped, so
 * "ශ්\u200dරී" typed with or without the joiner matches. Sinhala vowel signs stay (they are letters).
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * A rough English stem, so "salary" also finds "salaries" and "booking" finds "booked":
 * one common ending is cut off when at least 4 letters stay. Other words are kept as they are.
 */
export function stem(word: string): string {
  const m = /^([a-z]{4,}?)(ies|es|ing|ed|s|y)$/.exec(word);
  return m ? m[1]! : word;
}

export function queryWords(query: string): string[] {
  const words = normalize(query).split(' ').filter(Boolean);
  return [...new Set(words)];
}

export interface SearchHit {
  id: string;
  score: number;
}

/** The matching docs, best first (ties keep the original order). An empty query finds nothing. */
export function searchDocs(docs: SearchDoc[], query: string): SearchHit[] {
  const words = queryWords(query);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const hits: (SearchHit & { order: number })[] = [];
  docs.forEach((doc, order) => {
    const fields = doc.fields.map((f) => ({ text: normalize(f.text), weight: f.weight }));
    let score = 0;
    for (const word of words) {
      const root = stem(word);
      let best = 0;
      for (const f of fields) {
        if (f.weight > best && (f.text.includes(word) || f.text.includes(root))) {
          best = f.weight;
          // a whole word counts a little more than a part of a word
          if (` ${f.text} `.includes(` ${word} `)) best += 0.5;
        }
      }
      if (!best) return; // every word must be found
      score += best;
    }
    if (words.length > 1 && fields.some((f) => f.weight >= 5 && f.text.includes(phrase))) {
      score += 4;
    }
    hits.push({ id: doc.id, score: score + (doc.boost ?? 0), order });
  });
  return hits
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id, score }) => ({ id, score }));
}
