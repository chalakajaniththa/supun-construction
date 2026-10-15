import { AppException } from '../errors/app-exception.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** The (not deleted) project, or 404. */
export async function requireProject(db: Db, id: string) {
  const project = await db.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw AppException.notFound('Project not found.');
  return project;
}

/** Field-level 400 (shown next to that field in the form). */
export function fieldError(path: string, message: string): AppException {
  return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
    { path, message, code: 'custom' },
  ]);
}
