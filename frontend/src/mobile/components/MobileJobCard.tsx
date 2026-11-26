import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Bookmark, Zap } from 'lucide-react';
import type { JobListItem } from '../../types';

interface MobileJobCardProps {
  job: JobListItem;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent, id: string) => void;
  onClick?: () => void;
}

export const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  isSaved = false,
  onToggleSave,
  onClick,
}) => {
  const { t } = useTranslation();

  const formatSalary = () => {
    if (job.salary_min && job.salary_max) {
      return `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`;
    }
    if (job.salary_min) return `₹${job.salary_min.toLocaleString()}`;
    if (job.salary_max) return `₹${job.salary_max.toLocaleString()}`;
    return t('jobs.wageNegotiable', 'Negotiable');
  };

  const employerName = job.employer?.organization_name || job.employer?.full_name || t('common.verifiedEmployer', 'Verified Employer');

  return (
    <div
      onClick={onClick}
      className="mobile-card p-4 active:scale-[0.99] cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-base line-clamp-1">
              {job.title}
            </h3>
            {job.is_urgent && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 border border-red-100">
                <Zap className="h-3 w-3 fill-red-600" />
                {t('jobs.urgent', 'Urgent')}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {employerName}
          </p>
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={(e) => onToggleSave(e, job.id)}
            className="mobile-touch-target -mr-2 -mt-2 p-2 text-slate-400 hover:text-amber-600"
            aria-label={isSaved ? 'Unsave job' : 'Save job'}
          >
            <Bookmark
              className={`h-5 w-5 ${isSaved ? 'fill-amber-600 text-amber-600' : ''}`}
            />
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="text-sm font-bold text-indigo-900">
          {formatSalary()}{' '}
          <span className="text-[11px] font-normal text-slate-500">
            /{job.salary_type ? job.salary_type.toLowerCase() : 'day'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{job.city || t('common.nearby', 'Nearby')}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {job.work_type ? job.work_type.replace('_', ' ') : 'Full Time'}
        </span>

        <span className="text-[11px] text-slate-400">
          {job.applications_count ? `${job.applications_count} ${t('jobs.applicants', 'applicants')}` : ''}
        </span>
      </div>
    </div>
  );
};

export default MobileJobCard;
