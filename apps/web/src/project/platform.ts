import type { ProjectSnapshot } from './format';

export interface FileIdentity {
  path: string;
  revision: string;
}
export interface OpenedProject {
  snapshot: ProjectSnapshot;
  file?: FileIdentity;
}
export type Outcome<T> =
  | { status: 'success'; value: T }
  | { status: 'cancelled' }
  /** `invalid`: the file was read but is not a usable project, so locating it again cannot help. */
  | { status: 'failure'; message: string; invalid?: boolean };
export type SaveOutcome =
  Outcome<FileIdentity | undefined> | { status: 'conflict' };
export interface RecoveryRecord extends OpenedProject {
  id: string;
  updatedAt: string;
  version?: 1;
  baseline?: string;
  owner?: string;
}
export interface RecentFile {
  path: string;
  name: string;
  folder: string;
}
export type ProjectFileDrop =
  | { type: 'enter' | 'drop'; paths: string[] }
  | { type: 'leave' }
  | { type: 'failure'; message: string };
/** Native and browser I/O lives behind this boundary; session code has no platform imports. */
export interface PlatformAdapter {
  kind: 'web' | 'desktop';
  recoveryWarning?: string;
  open(path?: string): Promise<Outcome<OpenedProject>>;
  openFile?(file: File): Promise<Outcome<OpenedProject>>;
  onFileDrop?(handler: (event: ProjectFileDrop) => void): () => void;
  save(
    snapshot: ProjectSnapshot,
    file?: FileIdentity,
    options?: { saveAs?: boolean; overwrite?: boolean },
  ): Promise<SaveOutcome>;
  listRecovery(): Promise<RecoveryRecord[]>;
  writeRecovery(record: RecoveryRecord): Promise<void>;
  removeRecovery(id: string): Promise<void>;
  claimRecovery?(record: RecoveryRecord): Promise<RecoveryRecord>;
  abandonRecoveryClaim?(
    claimed: RecoveryRecord,
    source: RecoveryRecord,
  ): Promise<void>;
  listRecents?(): Promise<RecentFile[]>;
  /** Called once an opened file has actually replaced the session, not when it was merely picked. */
  rememberRecent?(path: string): Promise<void>;
  removeRecent?(path: string): Promise<void>;
  onCloseRequested?(handler: () => Promise<boolean>): () => void;
}
