/** Case-insensitive "contains" filters over several text columns (OR), or {} without a search. */
export function searchWhere<F extends string>(
  search: string | undefined,
  fields: readonly F[],
): { OR?: Record<F, { contains: string; mode: 'insensitive' }>[] } {
  if (!search) return {};
  return {
    OR: fields.map(
      (f) =>
        ({ [f]: { contains: search, mode: 'insensitive' } }) as Record<
          F,
          { contains: string; mode: 'insensitive' }
        >,
    ),
  };
}

/** Removes keys whose value is undefined (so Prisma `data` only touches given fields). */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
