import { saveNow } from '../db/databaseService';

export function installE2EBridge(): void {
  window.__liftlogE2E = {
    flushPersistence: saveNow,
  };
}
