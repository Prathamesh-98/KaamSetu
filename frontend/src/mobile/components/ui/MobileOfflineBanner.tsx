import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMobileSyncState } from '../../sync/MobileSyncContext';

export const MobileOfflineBanner: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const { isOnline, isSyncing, triggerSync } = useMobileSyncState();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{t('mobile:sync.offlineBanner', 'You are offline. Reconnecting...')}</span>
      </div>
      <button
        type="button"
        onClick={() => void triggerSync()}
        disabled={isSyncing}
        className="flex-shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white active:scale-95"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default MobileOfflineBanner;
