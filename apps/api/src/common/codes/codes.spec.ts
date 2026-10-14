import { describe, expect, it, vi } from 'vitest';
import { formatCode, nextCode, withCodeRetry } from './codes.js';

describe('codes', () => {
  it.each([
    ['W-', 1, 4, 'W-0001'],
    ['AST-', 12, 3, 'AST-012'],
    ['PRJ-2026-', 7, 3, 'PRJ-2026-007'],
    ['SUP-', 1000, 3, 'SUP-1000'],
  ])('formatCode(%s, %i, %i) = %s', (p, n, w, out) => expect(formatCode(p, n, w)).toBe(out));

  it('nextCode adds one to the highest number for the prefix', async () => {
    const prisma = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ max: 41 }]) };
    await expect(nextCode(prisma as never, 'Worker', 'W-', 4)).resolves.toBe('W-0042');
    expect(prisma.$queryRawUnsafe.mock.calls[0]![1]).toBe('^W-([0-9]+)$');
  });

  it('nextCode starts at 1', async () => {
    const prisma = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ max: null }]) };
    await expect(nextCode(prisma as never, 'Asset', 'AST-', 3)).resolves.toBe('AST-001');
  });

  it('withCodeRetry retries on a duplicate code only', async () => {
    const codes = ['A1', 'A2'];
    const create = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['code'] } })
      .mockResolvedValueOnce('ok');
    await expect(withCodeRetry(async () => codes.shift()!, create)).resolves.toBe('ok');
    expect(create).toHaveBeenLastCalledWith('A2');

    const other = vi.fn().mockRejectedValue({ code: 'P2002', meta: { target: ['nic'] } });
    await expect(withCodeRetry(async () => 'X', other)).rejects.toMatchObject({ code: 'P2002' });
    expect(other).toHaveBeenCalledTimes(1);
  });
});
