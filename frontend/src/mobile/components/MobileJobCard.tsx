import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Briefcase, Bookmark, Zap, Navigation, Clock } from 'lucide-react';
import type { JobListItem } from '../../types';
import MobileStatusBadge from './ui/MobileStatusBadge';

interface MobileJobCardProps {
  job: JobListItem;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent, id: string) => void;
  onClick?: () => void;
  hasWorkerLocation?: boolean;
}

export const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  isSaved = false,
  onToggleSave,
  onClick,
  hasWorkerLocation = false,
}) => {
  const { t } = useTranslation(['translation', 'mobile']);

  const salaryText =
    job.salary_min && job.salary_max
      ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
      : job.salary_min
      ? `₹${job.salary_min.toLocaleString()}+`
      : t('jobs.salaryNegotiable', 'Salary Negotiable');

  const salaryPeriod = job.salary_type
    ? t(`enums.salaryType.${job.salary_type}`, {
        defaultValue: `/${job.salary_type.toLowerCase()}`,
      })
    : '';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      className="mobile-card p-3.5 flex flex-col gap-2.5 cursor-pointer"
    >
      {/* Top Row: Badges & Bookmark */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {job.is_urgent && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <Zap className="h-3 w-3 text-red-600" />
                {t('jobs.urgent', 'Urgent')}
              </span>
            )}
            <MobileStatusBadge status={job.work_type} variant="workType" className="text-[10px]" />
            {job.distance_km != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <Navigation className="h-2.5 w-2.5" />
                <span>~{job.distance_km} km</span>
              </span>
            ) : hasWorkerLocation ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                {t('jobs.distanceUnavailable', 'Distance unavailable')}
              </span>
            ) : null}
          </div>

          <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{job.title}</h3>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {job.employer?.organization_name || job.employer?.full_name || t('roles.EMPLOYER', 'Employer')}
          </p>
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(e, job.id);
            }}
            className="mobile-touch-target -mr-2 -mt-2 rounded-full p-2 text-slate-400 hover:bg-slate-50 active:scale-90"
            aria-label={isSaved ? t('jobs.removeFromSaved', 'Remove saved') : t('jobs.saveJob', 'Save job')}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-indigo-900 text-indigo-900' : ''}`} />
          </button>
        )}
      </div>

      {/* Meta Row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1 max-w-[180px] truncate">
          <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span className="truncate">
            {job.city}
            {job.state ? `, ${job.state}` : ''}
          </span>
        </span>
        {job.category?.name && (
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span>{t(`categories.${job.category.name}`, { defaultValue: job.category.name })}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
          <span>{new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </span>
      </div>

      {/* Skill tags */}
      {job.required_skills && job.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.required_skills.slice(0, 3).map((js) => (
            <span
              key={js.skill.id}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
            >
              {t(`skills.${js.skill.name}`, { defaultValue: js.skill.name })}
              {js.is_mandatory ? ' *' : ''}
            </span>
          ))}
          {job.required_skills.length > 3 && (
            <span className="text-[10px] text-slate-400 self-center">
              +{job.required_skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom Salary & Travel Time */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div>
          <span className="font-extrabold text-indigo-900 text-sm">{salaryText}</span>
          {job.salary_min && <span className="text-[11px] text-slate-500 ml-1">{salaryPeriod}</span>}
        </div>
        {job.estimated_travel_time && (
          <span className="text-[10px] font-semibold text-emerald-700">{job.estimated_travel_time}</span>
        )}
      </div>
    </div>
  );
};

export default MobileJobCard;
