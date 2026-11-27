import React, { useEffect, useState } from 'react';
import { X, Download, AlertCircle, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { verificationsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';

interface MobileSecureDocumentModalProps {
  recordId: string;
  documentType?: string;
  fileName?: string;
  onClose: () => void;
}

export const MobileSecureDocumentModal: React.FC<MobileSecureDocumentModalProps> = ({
  recordId,
  documentType,
  fileName,
  onClose,
}) => {
  const { t } = useTranslation(['translation', 'mobile']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let activeUrl: string | null = null;
    let mounted = true;

    async function loadDoc() {
      setIsLoading(true);
      setError(null);
      try {
        const { blob, contentType: type } = await verificationsApi.getDocumentBlob(recordId);
        if (!mounted) return;
        const url = URL.createObjectURL(blob);
        activeUrl = url;
        setBlobUrl(url);
        setContentType(type);
      } catch (err) {
        if (!mounted) return;
        setError(extractErrorMessage(err) || t('verification.docLoadError', 'Unable to load private document.'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadDoc();
    return () => {
      mounted = false;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [recordId, t]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || `kaamsetu_doc_${recordId.slice(0, 8)}.${contentType.includes('pdf') ? 'pdf' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isPdf = contentType.toLowerCase().includes('pdf');
  const isImage = contentType.toLowerCase().startsWith('image/');

  return (
    <div className="mobile-fullscreen-editor" role="dialog" aria-modal="true">
      <div className="mobile-header-safe bg-white">
        <div className="flex h-14 items-center justify-between px-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-indigo-900 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 truncate">
                {documentType?.replace(/_/g, ' ') || t('verification.documentEvidence', 'Verification Document')}
              </h2>
              {fileName && <p className="text-[11px] text-slate-500 truncate">{fileName}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {blobUrl && isImage && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="mobile-touch-target p-2 text-slate-600 rounded-full hover:bg-slate-100"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                  className="mobile-touch-target p-2 text-slate-600 rounded-full hover:bg-slate-100"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mobile-touch-target rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('mobile:common.close', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900/95 p-3 flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <span className="text-xs font-medium">{t('verification.decryptingDoc', 'Loading secure document...')}</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white p-6 text-center max-w-sm space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-700">{error}</p>
          </div>
        ) : isImage && blobUrl ? (
          <img
            src={blobUrl}
            alt={documentType || 'Verification'}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease' }}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        ) : isPdf && blobUrl ? (
          <iframe
            src={blobUrl}
            title="Verification PDF"
            className="w-full h-full rounded-xl bg-white"
          />
        ) : (
          <p className="text-xs text-slate-300">{t('verification.previewUnavailable', 'Preview unavailable for this file type.')}</p>
        )}
      </div>

      <div className="mobile-sticky-footer">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
          >
            {t('mobile:common.close', 'Close')}
          </button>
          {blobUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Download className="h-4 w-4" />
              <span>{t('verification.downloadDoc', 'Download Copy')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileSecureDocumentModal;
