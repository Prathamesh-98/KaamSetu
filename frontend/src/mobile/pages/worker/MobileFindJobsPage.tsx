import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, Filter, MapPin, Briefcase, Zap, X, Bookmark, 
  Send, AlertCircle, CheckCircle, Clock 
} from 'lucide-react';
import { jobsApi, workerApi, applicationsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import type { JobListItem, Job } from '../../../types';
import MobileJobCard from '../../components/MobileJobCard';

export const MobileFindJobsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState('');

  // Fetch Jobs
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['jobs', { q: query, category: selectedCategory, urgent: onlyUrgent }],
    queryFn: () => jobsApi.list({
      keyword: query || undefined,
      category_id: selectedCategory || undefined,
      is_urgent: onlyUrgent ? true : undefined,
      sort_by: 'newest',
    }),
  });

  // Saved Jobs
  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  });

  const savedJobIds = useMemo(() => {
    if (!savedJobs || !Array.isArray(savedJobs)) return new Set<string>();
    return new Set(savedJobs.map((sj) => sj.job.id));
  }, [savedJobs]);

  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedJobIds.has(id)) unsaveMutation.mutate(id);
    else saveMutation.mutate(id);
  };

  const handleOpenDetails = async (jobId: string) => {
    try {
      const fullJob = await jobsApi.get(jobId);
      setSelectedJob(fullJob);
      setApplySuccess(false);
      setApplyError('');
    } catch {
      // fallback
    }
  };

  const handleApply = async () => {
    if (!selectedJob || isApplying) return;
    setIsApplying(true);
    setApplyError('');
    try {
      await applicationsApi.apply(selectedJob.id, coverNote);
      setApplySuccess(true);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    } catch (err) {
      setApplyError(extractErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const jobs = jobsData?.items || [];

  const CATEGORY_CHIPS = [
    { id: '', label: t('common.all', 'All') },
    { id: 'Construction', label: t('categories.Construction', 'Construction') },
    { id: 'Electrical', label: t('categories.Electrical', 'Electrical') },
    { id: 'Plumbing', label: t('categories.Plumbing', 'Plumbing') },
    { id: 'Driving', label: t('categories.Driving', 'Driving') },
    { id: 'Domestic Help', label: t('categories.Domestic Help', 'Domestic') },
    { id: 'Painting', label: t('categories.Painting', 'Painting') },
  ];

  return (
    <div className="p-4 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('landing.searchPlaceholder', 'Search jobs, skills, locations...')}
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium shadow-sm focus:border-indigo-900 focus:outline-none"
        />
      </div>

      {/* Filter Horizontal Scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setOnlyUrgent(!onlyUrgent)}
          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            onlyUrgent
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          <Zap className="h-3 w-3" />
          <span>{t('jobs.urgent', 'Urgent')}</span>
        </button>

        {CATEGORY_CHIPS.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? '' : cat.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>{jobs.length} {t('jobs.availableJobs', 'jobs found')}</span>
      </div>

      {/* Job List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <MobileJobCard
              key={job.id}
              job={job}
              isSaved={savedJobIds.has(job.id)}
              onToggleSave={handleToggleSave}
              onClick={() => handleOpenDetails(job.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">{t('jobs.noJobsFound', 'No jobs found')}</h3>
          <p className="text-xs text-slate-500 mt-1">{t('jobs.tryResetting', 'Try resetting filters or searching for different keywords')}</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setSelectedCategory(''); setOnlyUrgent(false); }}
            className="mt-3 inline-flex items-center rounded-xl bg-indigo-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {t('common.clearFilters', 'Clear Filters')}
          </button>
        </div>
      )}

      {/* Job Details Bottom Sheet / Modal */}
      {selectedJob && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-sheet max-h-[88vh] max-h-[88dvh]">
            {/* Header */}
            <div className="flex items-start justify-between border-b p-4">
              <div className="min-w-0 flex-1 mr-2">
                <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-900">
                  {selectedJob.category?.name || 'General'}
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-1 truncate">{selectedJob.title}</h2>
                <p className="text-xs text-slate-500 truncate">{selectedJob.employer?.organization_name || 'Verified Employer'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100 flex-shrink-0"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Details Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('jobs.compensation', 'Compensation')}</span>
                  <span className="font-extrabold text-sm text-indigo-900">
                    ₹{selectedJob.salary_min || 0} - ₹{selectedJob.salary_max || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 block">/{selectedJob.salary_type ? selectedJob.salary_type.toLowerCase() : 'day'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('jobs.location', 'Location')}</span>
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    <span className="truncate">{selectedJob.city || 'India'}</span>
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-1">{t('jobs.description', 'Job Description')}</h4>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
              </div>

              {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1.5">{t('jobs.requiredSkills', 'Required Skills')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.required_skills.map((jobSkill: any, idx: number) => (
                      <span key={idx} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        {jobSkill.skill?.name || 'Skill'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Application Form Note */}
              {applySuccess ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-center border border-emerald-200">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-1.5" />
                  <h4 className="font-bold text-emerald-900 text-sm">{t('jobs.appSubmitted', 'Application Submitted!')}</h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">{t('jobs.appSubmittedDesc', 'The employer will review your profile and contact you.')}</p>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t">
                  {applyError && (
                    <div className="rounded-xl bg-red-50 p-2.5 text-[11px] text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{applyError}</span>
                    </div>
                  )}

                  <label className="block font-bold text-slate-700">Cover Note (Optional)</label>
                  <textarea
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Add a brief note to employer (e.g. your availability, years of experience)..."
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="mobile-sticky-footer">
              {applySuccess ? (
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="w-full rounded-xl bg-emerald-700 py-3 text-center text-xs font-bold text-white shadow min-h-[48px]"
                >
                  Close
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="mobile-touch-target flex-1 rounded-xl border border-slate-300 py-3 text-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-transform min-h-[48px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={isApplying}
                    className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px]"
                  >
                    {isApplying ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t('common.submitting', 'Submitting...')}</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>{t('jobs.applyNow', 'Apply For This Job')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFindJobsPage;
