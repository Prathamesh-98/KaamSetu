import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ArrowLeft, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { jobsApi, categoriesApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useBackButton } from '../../hooks/useBackButton';

export const MobilePostJobPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useBackButton();

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [jobType, setJobType] = useState('FULL_TIME');
  const [openings, setOpenings] = useState('1');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState('DAY');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const catList = categories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const resolvedCategoryId = categoryId || (catList.length > 0 ? catList[0].id : 'cat-default');

    setError('');
    setIsSubmitting(true);

    try {
      await jobsApi.create({
        title: title.trim(),
        category_id: resolvedCategoryId,
        description: description.trim(),
        work_type: jobType as any,
        workers_needed: Number(openings) || 1,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_type: (salaryPeriod === 'DAY' ? 'DAILY' : salaryPeriod === 'MONTH' ? 'MONTHLY' : 'HOURLY') as any,
        city: city.trim(),
        state: state.trim(),
        is_urgent: isUrgent,
      });

      navigate('/employer/jobs', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-app-root">
      {/* Header */}
      <div className="mobile-header-safe">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Post a Job</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mobile-content-area px-4 py-4 max-w-md mx-auto w-full">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Job Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Job Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mason for Commercial Project"
              required
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trade Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none bg-white"
            >
              <option value="">Select Category</option>
              {catList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Type & Vacancies */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employment Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none bg-white"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="DAILY">Daily Wage</option>
                <option value="PROJECT">Project / Contract</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vacancies</label>
              <input
                type="number"
                value={openings}
                onChange={(e) => setOpenings(e.target.value)}
                min="1"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Wage / Salary */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Compensation Range (₹)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="Min ₹"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
              />
              <input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="Max ₹"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
              />
              <select
                value={salaryPeriod}
                onChange={(e) => setSalaryPeriod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none bg-white"
              >
                <option value="DAY">per day</option>
                <option value="MONTH">per month</option>
                <option value="HOUR">per hour</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune"
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Job Details & Requirements *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe work duties, site location, required experience..."
              rows={4}
              required
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
            />
          </div>

          {/* Urgent Hiring Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 border border-amber-200">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <div>
                <div className="font-bold text-slate-900">Urgent Requirement</div>
                <div className="text-[10px] text-slate-500">Highlight to workers for rapid response</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="h-4 w-4 accent-amber-600 rounded"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-900 py-3.5 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 mt-4 min-h-[48px] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Publishing Job Listing...</span>
              </>
            ) : (
              <span>Publish Job Listing</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MobilePostJobPage;
