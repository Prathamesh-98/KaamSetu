import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { jobsApi } from '../../api/services';
import { CandidateMatchCard } from '../../components/CandidateMatchCard';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function JobCandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['job-candidates', id, page, user?.id],
    queryFn: () => jobsApi.getCandidates(id!, page),
    enabled: !!id,
  });

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/employer/jobs" className="text-gray-500 hover:text-gray-700 flex items-center gap-2 transition-colors">
          <ArrowLeft size={20} />
          <span>{t('back_to_jobs', 'Back to Jobs')}</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#182849' }}>{t('find_matching_candidates', 'Find Matching Candidates')}</h1>
        <p className="text-gray-500 mt-2">
          {t('candidate_recommendations_desc', 'Discover workers ranked by how well they match your job requirements.')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">{t('error_loading', 'Error loading')}</h3>
            <p className="mt-1">{(error as any)?.response?.data?.detail || t('error_loading_candidates', 'Could not load candidates. Please try again.')}</p>
          </div>
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-6">
          {data.items.map((match) => (
            <div key={match.worker.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
               <CandidateMatchCard match={match} jobId={id} />
            </div>
          ))}
          
          {data.pages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('previous', 'Previous')}
              </button>
              <span className="flex items-center px-4 text-sm font-medium text-gray-600">
                {t('page', 'Page')} {page} {t('of', 'of')} {data.pages}
              </span>
              <button 
                disabled={page === data.pages}
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('next', 'Next')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no_candidates_found', 'No Candidates Found')}</h3>
          <p className="text-gray-500">
            {t('no_candidates_desc', 'No active workers matched your criteria, or the pool is empty.')}
          </p>
        </div>
      )}
    </div>
  );
}
