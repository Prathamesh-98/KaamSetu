import React, { createContext, useContext } from 'react';
import { useMobileSync, type MobileSyncState } from './useMobileSync';

const MobileSyncContext = createContext<MobileSyncState>({
  isOnline: true,
  isForeground: true,
  isSyncing: false,
  wsConnected: false,
  lastSyncedAt: null,
  triggerSync: async () => {},
});

export const MobileSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncState = useMobileSync();
  return <MobileSyncContext.Provider value={syncState}>{children}</MobileSyncContext.Provider>;
};

export function useMobileSyncState(): MobileSyncState {
  return useContext(MobileSyncContext);
}
