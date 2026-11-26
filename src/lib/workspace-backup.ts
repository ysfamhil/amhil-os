export const MAX_BACKUP_BYTES = 3 * 1024 * 1024;

export type WorkspaceCounts = Record<string, number>;

export interface RestorePreview {
  version: number;
  counts: WorkspaceCounts;
  omitted: string[];
  warnings: string[];
  empty: boolean;
}

export interface WorkspaceBackup {
  app: "AMHIL OS";
  schema: "amhil.workspace";
  version: 2;
  exportedAt: string;
  counts: WorkspaceCounts;
  warnings: string[];
  data: Record<string, Record<string, unknown>[]>;
}
