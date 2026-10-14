import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { makePdf, makePng } from './files.js';

describe('seed placeholder files', () => {
  it('makes a PDF with a correct xref table', () => {
    const pdf = makePdf(['Revenue licence', 'Vehicle: NC LK-4521', 'Valid until 14 Oct 2026']);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    // every object offset points at "N 0 obj"
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });

  it('makes a PNG of the requested size', () => {
    const png = makePng(40, 30, [200, 120, 40]);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(40);
    expect(png.readUInt32BE(20)).toBe(30);
    const idatLen = png.readUInt32BE(33);
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect(raw.length).toBe((40 * 3 + 1) * 30);
  });
});
