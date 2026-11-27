import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ratingsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';

interface MobileRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  userName: string;
  onSuccess?: () => void;
}

export const MobileRateModal: React.FC<MobileRateModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  userName,
  onSuccess,
}) => {
  const { t } = useTranslation(['translation', 'mobile']);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: () =>
      ratingsApi.create({
        application_id: applicationId,
        rating,
        review_text: reviewText.trim() || undefined,
        rater_role: user?.role || '',
      }),
    onSuccess: () => {
      toast.success(t('rating_submitted_success', 'Rating submitted!'));
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerApplications });
      void queryClient.invalidateQueries({ queryKey: ['job-applicants'] });
      void queryClient.invalidateQueries({ queryKey: ['work-history'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setError(extractErrorMessage(err) || t('error_submitting_rating', 'Error submitting rating'));
    },
  });

  if (!isOpen) return null;

  return (
    <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
      <div className="mobile-modal-sheet">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-base font-extrabold text-slate-900 truncate pr-2">
            {t('rate', 'Rate')} {userName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label={t('mobile:common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-slate-500">
              {t('mobile:shifts.selectRating', 'Tap a star to rate')}
            </p>
            <div className="flex justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="mobile-touch-target p-1 active:scale-90 transition-transform"
                  aria-label={`${star} stars`}
                >
                  <Star
                    className={`h-9 w-9 ${
                      rating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('review_optional', 'Review (Optional)')}
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={t('review_placeholder', 'Write your experience...')}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="mobile-sticky-footer">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitMutation.isPending}
              className="mobile-touch-target flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
            >
              {t('mobile:common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={rating === 0 || submitMutation.isPending}
              className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-md disabled:opacity-50 min-h-[48px]"
            >
              {submitMutation.isPending
                ? t('mobile:shifts.submittingRating', 'Submitting rating...')
                : t('submit_rating', 'Submit Rating')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileRateModal;
