import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core/query-builders/update';

import type * as schema from '../../drizzle/schema';
import { auditLogs } from '../../drizzle/schema';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

export type AuditableTable = AnyPgTable<{
  columns: {
    id: AnyPgColumn<{ data: string }>;
    history: AnyPgColumn<{ data: unknown }>;
  };
}> & {
  id: AnyPgColumn<{ data: string }>;
  history: AnyPgColumn<{ data: unknown }>;
  $inferInsert: { history?: unknown };
};

export interface WithAuditParams<T extends AuditableTable> {
  table: T;
  tableName: string;
  recordId: string;
  action: AuditAction;
  actorId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  currentHistory: unknown[];
}

export interface HistoryEntry {
  action: AuditAction;
  actorId: string | null;
  at: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

/**
 * Computes one append-only history entry from a row's old and new state.
 * CREATE treats every field in `newData` as changed from null; DELETE treats
 * every field in `oldData` as changed to null; UPDATE compares key by key
 * and includes only fields whose value actually differs.
 */
export function buildHistoryEntry(
  action: AuditAction,
  actorId: string | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): HistoryEntry {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (action === 'CREATE' && newData) {
    for (const key of Object.keys(newData)) {
      changes[key] = { old: null, new: newData[key] };
    }
  } else if (action === 'DELETE' && oldData) {
    for (const key of Object.keys(oldData)) {
      changes[key] = { old: oldData[key], new: null };
    }
  } else if (action === 'UPDATE' && oldData && newData) {
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    for (const key of keys) {
      const oldValue = oldData[key];
      const newValue = newData[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }
  }

  return { action, actorId, at: new Date().toISOString(), changes };
}

/**
 * Appends one entry to the row's own `history` column and inserts a matching
 * row into `audit_logs`, both through the caller's open transaction.
 */
export async function withAudit<T extends AuditableTable>(
  tx: Transaction,
  params: WithAuditParams<T>,
): Promise<void> {
  const entry = buildHistoryEntry(params.action, params.actorId, params.oldData, params.newData);
  const nextHistory = [...params.currentHistory, entry];

  const updatedRows = await tx
    .update(params.table)
    // Drizzle cannot retain `history` through a generic table's mapped insert
    // type, although AuditableTable guarantees that column. Keep the assertion
    // limited to the exact update payload rather than widening the table/tx.
    .set({ history: nextHistory } as PgUpdateSetSource<T>)
    .where(eq(params.table.id, params.recordId))
    .returning({ id: params.table.id });

  if (updatedRows.length === 0) {
    throw new Error(`Audit target not found: ${params.tableName}/${params.recordId}`);
  }

  await tx.insert(auditLogs).values({
    tableName: params.tableName,
    recordId: params.recordId,
    action: params.action,
    oldData: params.oldData,
    newData: params.newData,
    actorId: params.actorId,
  });
}
