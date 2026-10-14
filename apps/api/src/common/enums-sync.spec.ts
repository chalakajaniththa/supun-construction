import { ALL_ENUMS } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import * as PrismaEnums from '../generated/prisma/enums.js';

/** packages/shared enums and the Prisma schema enums must stay identical. */
describe('enum sync (shared ↔ prisma)', () => {
  const prismaEnums = PrismaEnums as unknown as Record<string, Record<string, string>>;

  it.each(Object.entries(ALL_ENUMS))('%s matches', (name, values) => {
    expect(prismaEnums[name], `Prisma enum ${name} is missing`).toBeDefined();
    expect(Object.values(prismaEnums[name]!)).toEqual([...values]);
  });

  it('every Prisma enum exists in the shared package', () => {
    expect(Object.keys(prismaEnums).sort()).toEqual(Object.keys(ALL_ENUMS).sort());
  });
});
