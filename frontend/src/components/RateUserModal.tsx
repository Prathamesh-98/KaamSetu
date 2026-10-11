import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsApi } from '../api/services';
import { Star, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  userName: string;
  onSuccess?: () => void;
}

export const RateUserModal: React.FC<RateUserModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  userName,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState('');

  const submitRating = useMutation({
    mutationFn: () => ratingsApi.create({
      application_id: applicationId,
      rating,
      review_text: reviewText,
      rater_role: user?.role || ''
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['job-applicants'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || t('error_submitting_rating', 'Error submitting rating');
      setError(msg);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-900">
            {t('rate', 'Rate')} {userName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
            </div>
          )}
          <div className="flex justify-center mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-transform hover:scale-110"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  size={40}
                  className={`${
                    (hoverRating || rating) >= star
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200'
                  } transition-colors`}
                />
              </button>
            ))}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('review_optional', 'Review (Optional)')}
            </label>
            <textarea
              className="input w-full min-h-[100px] resize-none"
              placeholder={t('review_placeholder', 'Write your experience...')}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={onClose}
              className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent"
              disabled={submitRating.isPending}
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              onClick={() => submitRating.mutate()}
              disabled={rating === 0 || submitRating.isPending}
              className="btn btn-primary"
            >
              {submitRating.isPending ? t('submitting', 'Submitting...') : t('submit_rating', 'Submit Rating')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
