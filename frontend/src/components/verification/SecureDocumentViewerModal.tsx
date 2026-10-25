// KaamSetu — Secure Document Viewer Modal
import React, { useEffect, useState } from 'react';
import { X, Download, AlertCircle, FileText, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { verificationsApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';

interface SecureDocumentViewerModalProps {
  recordId: string;
  documentType?: string;
  fileName?: string;
  onClose: () => void;
}

export const SecureDocumentViewerModal: React.FC<SecureDocumentViewerModalProps> = ({
  recordId,
  documentType,
  fileName,
  onClose,
}) => {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadDocument() {
      setIsLoading(true);
      setError(null);
      try {
        const { blob, contentType: type } = await verificationsApi.getDocumentBlob(recordId);
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        activeUrl = url;
        setBlobUrl(url);
        setContentType(type);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = extractErrorMessage(err);
        setError(msg || t('verification.docLoadError', 'Unable to retrieve private document. Access is restricted.'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDocument();

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [recordId, t]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeName = fileName || `verification_document_${recordId.slice(0, 8)}.${contentType.includes('pdf') ? 'pdf' : 'jpg'}`;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isPdf = contentType.toLowerCase().includes('pdf');
  const isImage = contentType.toLowerCase().startsWith('image/');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="secure-doc-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="secure-doc-title" className="text-base font-bold text-[#182849]">
                {documentType?.replace(/_/g, ' ') || t('verification.documentEvidence', 'Verification Evidence')}
              </h3>
              <p className="text-xs text-gray-500 font-medium truncate max-w-md">
                {fileName || `${recordId.slice(0, 13)}... (Confidential Evidence)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blobUrl && (
              <>
                {isImage && (
                  <div className="hidden sm:flex items-center gap-1 mr-2 bg-white px-2 py-1 rounded-xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                      title={t('verification.zoomOut', 'Zoom Out')}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold px-1 text-gray-700">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                      title={t('verification.zoomIn', 'Zoom In')}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors ml-1"
                      title={t('verification.rotate', 'Rotate')}
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="btn btn-outline text-xs px-3 py-1.5 rounded-xl border-gray-300 font-semibold gap-1.5 hover:bg-white"
                  title={t('verification.download', 'Download Evidence')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('verification.download', 'Download')}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Viewer */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-900/5 min-h-[400px]">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-gray-500 py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              <p className="text-sm font-semibold">{t('verification.loadingDocument', 'Decrypting and retrieving document...')}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h4 className="font-bold text-red-900 mb-1">{t('verification.documentUnavailable', 'Document Unavailable')}</h4>
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          {blobUrl && !isLoading && (
            <div className="w-full h-full flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={blobUrl}
                  title="Document Preview"
                  className="w-full h-[65vh] rounded-xl border border-gray-200 bg-white"
                />
              ) : isImage ? (
                <div className="overflow-auto max-h-[65vh] max-w-full flex items-center justify-center p-2">
                  <img
                    src={blobUrl}
                    alt="Document Evidence"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                    }}
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-white rounded-2xl border border-gray-200">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700 mb-4">{t('verification.previewNotAvailable', 'Preview not directly supported for this format.')}</p>
                  <button onClick={handleDownload} className="btn btn-primary rounded-xl text-xs px-4 py-2 font-bold gap-2">
                    <Download className="w-4 h-4" /> {t('verification.downloadToView', 'Download Document')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span className="font-medium">🔒 {t('verification.confidentialNotice', 'Strictly confidential verification evidence.')}</span>
          <button onClick={onClose} className="text-gray-600 hover:text-dark font-bold">
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
