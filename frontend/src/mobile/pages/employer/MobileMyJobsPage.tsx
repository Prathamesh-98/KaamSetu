import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Users, Plus, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { jobsApi } from '../../../api/services';
import type { JobListItem } from '../../../types';
import { useStatusBar } from '../../hooks/useStatusBar';

export const MobileMyJobsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useStatusBar(false);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');

  const { data: jobs, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => jobsApi.myJobs(),
  });

  const jobList = Array.isArray(jobs) ? jobs : [];
  const filteredJobs = jobList.filter((j: JobListItem) =>
    activeTab === 'ACTIVE' ? j.status === 'ACTIVE' : j.status !== 'ACTIVE'
  );

  return (
    <div className="p-4 space-y-3">
      {/* Header with touch targets and proper truncation */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex-1 min-w-0 truncate text-lg font-extrabold text-slate-900 tracking-tight">
          {t('employer.manageJobs', 'Manage Job Postings')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/employer/post-job')}
          className="flex-shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>{t('employer.postNew', 'New Job')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'ACTIVE'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('employer.activeListings', 'Active Listings')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CLOSED')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'CLOSED'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('employer.closedDrafts', 'Closed / Drafts')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-white p-6 text-center border border-red-100 shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">{t('common.failedLoad', 'Failed to load jobs')}</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">{t('common.checkConnection', 'Please check your connection and try again.')}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('common.retry', 'Retry')}</span>
          </button>
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="space-y-3">
          {filteredJobs.map((job: JobListItem) => (
            <div
              key={job.id}
              onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
              className="mobile-card p-4 active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{job.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {job.city || 'India'} · {job.applications_count || 0} applicants
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  job.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {job.status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                <span className="font-extrabold text-indigo-900">
                  ₹{job.salary_min || 0} - ₹{job.salary_max || 0}
                </span>

                <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                  <Users className="h-4 w-4 text-amber-600" />
                  <span>{t('employer.reviewApplicants', 'Review Applicants')}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">
            {activeTab === 'ACTIVE' ? 'No active job listings' : 'No closed or draft jobs'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {activeTab === 'ACTIVE'
              ? 'Post a job to start receiving applications from verified workers.'
              : 'Jobs that are filled or paused will be archived here.'}
          </p>
          {activeTab === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => navigate('/employer/post-job')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>{t('employer.postNew', 'Post a New Job')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MobileMyJobsPage;
