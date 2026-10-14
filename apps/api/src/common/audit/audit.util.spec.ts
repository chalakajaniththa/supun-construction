import { describe, expect, it } from 'vitest';
import { actionForMethod, entityFromPath, redact } from './audit.util.js';

describe('audit utils', () => {
  it('redacts secrets recursively', () => {
    expect(
      redact({
        currentPassword: 'a',
        nested: { newPassword: 'b', name: 'n' },
        list: [{ token: 't' }],
      }),
    ).toEqual({
      currentPassword: '[redacted]',
      nested: { newPassword: '[redacted]', name: 'n' },
      list: [{ token: '[redacted]' }],
    });
  });

  it.each([
    ['POST', 'CREATE'],
    ['PATCH', 'UPDATE'],
    ['PUT', 'UPDATE'],
    ['DELETE', 'DELETE'],
    ['GET', undefined],
  ])('%s → %s', (method, action) => {
    expect(actionForMethod(method)).toBe(action);
  });

  it.each([
    ['/settings/company', 'Setting'],
    ['/projects/1/boq', 'Project'],
    ['/companies', 'Company'],
    ['/boq-items/1', 'BoqItem'],
  ])('entityFromPath(%s) = %s', (path, entity) => {
    expect(entityFromPath(path)).toBe(entity);
  });
});
