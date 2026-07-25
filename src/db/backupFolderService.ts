import type { BackupMetadata } from '../types/api';
import { idbGet, idbPut } from './indexedDb';

const BACKUP_DIRECTORY_KEY = 'settings:backup-directory-v1';
const BACKUP_IDENTITY_PREFIX = 'settings:folder-backup-identity-v1:';
const PICKER_ID = 'liftlog-backup-folder';

type WritePermission = 'granted' | 'denied' | 'prompt';

interface PermissionCapableHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<WritePermission>;
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<WritePermission>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<FileSystemDirectoryHandle>;
}

export interface ProgramBackupIdentity {
  id: string;
  filename: string;
}

function identityKey(programId: number): string {
  return `${BACKUP_IDENTITY_PREFIX}${programId}`;
}

function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeProgramName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'program';
}

export function isValidBackupId(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isValidBackupFilename(value: string | undefined): value is string {
  return !!value
    && value.length <= 255
    && /^[a-z0-9][a-z0-9._ -]*\.sqlite$/i.test(value);
}

function parseIdentity(value: string | undefined): ProgramBackupIdentity | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ProgramBackupIdentity>;
    if (isValidBackupId(parsed.id) && isValidBackupFilename(parsed.filename)) {
      return { id: parsed.id, filename: parsed.filename };
    }
  } catch {
    // Ignore malformed settings and create a fresh identity when needed.
  }
  return null;
}

export function isFolderBackupSupported(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export async function getBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const value = await idbGet<FileSystemDirectoryHandle>(BACKUP_DIRECTORY_KEY);
  if (!value || value.kind !== 'directory' || typeof value.getFileHandle !== 'function') return null;
  return value;
}

export async function selectBackupDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Folder backups are not supported by this browser.');

  const handle = await picker({ id: PICKER_ID, mode: 'readwrite', startIn: 'documents' });
  await idbPut(BACKUP_DIRECTORY_KEY, handle);
  return handle;
}

export async function getBackupDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean = false,
): Promise<WritePermission> {
  const permissionHandle = handle as PermissionCapableHandle;
  if (!permissionHandle.queryPermission) return 'granted';

  const current = await permissionHandle.queryPermission({ mode: 'readwrite' });
  if (current !== 'prompt' || !request || !permissionHandle.requestPermission) return current;
  return permissionHandle.requestPermission({ mode: 'readwrite' });
}

export async function getOrCreateProgramBackupIdentity(
  programId: number,
  programName: string,
): Promise<ProgramBackupIdentity> {
  const existing = parseIdentity(await idbGet<string>(identityKey(programId)));
  if (existing) return existing;

  const id = createUuid();
  const identity = {
    id,
    filename: `liftlog-${safeProgramName(programName)}-${id}.sqlite`,
  };
  await idbPut(identityKey(programId), JSON.stringify(identity));
  return identity;
}

export async function adoptProgramBackupIdentity(
  programId: number,
  metadata: BackupMetadata,
): Promise<boolean> {
  if (!isValidBackupId(metadata.folder_backup_id)
    || !isValidBackupFilename(metadata.folder_backup_filename)) {
    return false;
  }

  const identity = {
    id: metadata.folder_backup_id,
    filename: metadata.folder_backup_filename,
  };
  await idbPut(identityKey(programId), JSON.stringify(identity));
  return true;
}

export async function writeProgramBackupFile(
  handle: FileSystemDirectoryHandle,
  filename: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!isValidBackupFilename(filename)) throw new Error('Invalid backup filename.');
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' }));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
}
