import { SetMetadata } from '@nestjs/common';
import type { AuditAction as AuditActionValue } from '@sc/shared';

export const AUDIT_ENTITY_KEY = 'auditEntity';
export const SKIP_AUDIT_KEY = 'skipAudit';
export const AUDIT_ACTION_KEY = 'auditAction';

/** Names the audited entity for a controller or handler (default: derived from the URL). */
export const AuditEntity = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);
/** Don't write an audit row for this handler (e.g. login / logout). */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
/** Overrides the action derived from the HTTP method (e.g. POST /auth/change-password → UPDATE). */
export const AuditAction = (action: AuditActionValue) => SetMetadata(AUDIT_ACTION_KEY, action);
