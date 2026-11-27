import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, Navigation, List, Map as MapIcon,
  Zap, X, RefreshCw, AlertCircle, Clock, ChevronLeft, ChevronRight, Briefcase
} from 'lucide-react';
import { jobsApi, categoriesApi, skillsApi, workerApi } from '../../../api/services';
import type { WorkType, JobFilters, Category, Skill } from '../../../types';
import NearbyJobsMap from '../../../components/jobs/NearbyJobsMap';
import MobileJobCard from '../../components/MobileJobCard';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import { INDIAN_STATES } from '../../../utils/constants';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';

const WORK_TYPES: WorkType[] = [
  'FULL_TIME',
  'PART_TIME',
  'DAILY',
  'HOURLY',
  'PROJECT',
  'TEMPORARY',
  'REMOTE',
  'LOCAL',
];

const SORT_OPTIONS = [
  { value: 'newest', key: 'mobile:jobs.sortNewest', fallback: 'Newest First' },
  { value: 'distance_asc', key: 'mobile:jobs.sortDistance', fallback: 'Distance: Closest First' },
  { value: 'oldest', key: 'mobile:jobs.sortOldest', fallback: 'Oldest First' },
  { value: 'salary_desc', key: 'mobile:jobs.sortSalaryDesc', fallback: 'Salary: High to Low' },
  { value: 'salary_asc', key: 'mobile:jobs.sortSalaryAsc', fallback: 'Salary: Low to High' },
];

const RADIUS_VALUES = ['', '5', '10', '25', '50', '100'];

function useDebounce<T>(val: T, delay = 400): T {
  const [debounced, setDebounced] = useState(val);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(val), delay);
    return () => clearTimeout(timer);
  }, [val, delay]);
  return debounced;
}

export const MobileFindJobsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const paramQ = searchParams.get('q') || '';
  const paramCat = searchParams.get('category') || '';

  const [keyword, setKeyword] = useState(paramQ);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [workType, setWorkType] = useState<WorkType | ''>('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [experienceMax, setExperienceMax] = useState('');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [sameDay, setSameDay] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  // Geolocation & Map
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [workerLocation, setWorkerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle');
  const [geoMsg, setGeoMsg] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const debouncedKeyword = useDebounce(keyword, 350);
  const debouncedCity = useDebounce(city, 350);

  // Fetch authoritative categories & skills from backend
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: MOBILE_QUERY_KEYS.categories,
    queryFn: categoriesApi.list,
    staleTime: 300_000,
  });

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: MOBILE_QUERY_KEYS.skills(),
    queryFn: () => skillsApi.list(),
    staleTime: 300_000,
  });

  // Resolve ?category= whether UUID or category name
  useEffect(() => {
    if (!paramCat || categories.length === 0) return;
    const match = categories.find(
      (c) => c.id === paramCat || c.name.toLowerCase() === paramCat.toLowerCase()
    );
    if (match) setCategoryId(match.id);
  }, [paramCat, categories]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [
    debouncedKeyword,
    debouncedCity,
    state,
    categoryId,
    skillId,
    workType,
    salaryMin,
    salaryMax,
    experienceMax,
    onlyUrgent,
    sameDay,
    workerLocation,
    radiusKm,
    sortBy,
  ]);

  const filters: JobFilters = useMemo(() => {
    const f: JobFilters = {
      keyword: debouncedKeyword || undefined,
      city: debouncedCity || undefined,
      state: state || undefined,
      category_id: categoryId || undefined,
      skill_id: skillId || undefined,
      work_type: workType || undefined,
      salary_min: salaryMin ? Number(salaryMin) : undefined,
      salary_max: salaryMax ? Number(salaryMax) : undefined,
      experience_max: experienceMax ? Number(experienceMax) : undefined,
      is_urgent: onlyUrgent ? true : undefined,
      same_day: sameDay ? true : undefined,
      sort_by: sortBy === 'distance_asc' && !workerLocation ? 'newest' : sortBy,
      page,
      per_page: 20,
    };
    if (workerLocation) {
      f.worker_lat = workerLocation.lat;
      f.worker_lng = workerLocation.lng;
      if (radiusKm) f.radius_km = Number(radiusKm);
    }
    return f;
  }, [
    debouncedKeyword,
    debouncedCity,
    state,
    categoryId,
    skillId,
    workType,
    salaryMin,
    salaryMax,
    experienceMax,
    onlyUrgent,
    sameDay,
    sortBy,
    workerLocation,
    radiusKm,
    page,
  ]);

  const { data: jobsData, isLoading, isError, refetch } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobsList(filters as Record<string, unknown>),
    queryFn: () => jobsApi.list(filters),
    staleTime: 15000,
    refetchOnMount: 'always',
  });

  const { data: savedJobs } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedJobs,
    queryFn: workerApi.getSavedJobs,
  });

  const savedJobIds = useMemo(() => {
    if (!Array.isArray(savedJobs)) return new Set<string>();
    return new Set(savedJobs.map((sj) => sj.job.id));
  }, [savedJobs]);

  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs }),
  });

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedJobIds.has(id)) unsaveMutation.mutate(id);
    else saveMutation.mutate(id);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoMsg(t('mobile:jobs.locationError', 'Location not supported on this device.'));
      return;
    }
    setGeoStatus('locating');
    setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoStatus('idle');
        setGeoMsg('');
      },
      (err) => {
        if (err.code === 1) {
          setGeoStatus('denied');
          setGeoMsg(t('mobile:jobs.locationDenied', 'Location permission denied. Search by city or state instead.'));
        } else {
          setGeoStatus('error');
          setGeoMsg(t('mobile:jobs.locationError', 'Unable to get location. Please try city/state filters.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleClearLocation = () => {
    setWorkerLocation(null);
    setRadiusKm('');
    setGeoStatus('idle');
    setGeoMsg('');
    if (sortBy === 'distance_asc') setSortBy('newest');
  };

  const resetAllFilters = () => {
    setKeyword('');
    setCity('');
    setState('');
    setCategoryId('');
    setSkillId('');
    setWorkType('');
    setSalaryMin('');
    setSalaryMax('');
    setExperienceMax('');
    setOnlyUrgent(false);
    setSameDay(false);
    setSortBy('newest');
    handleClearLocation();
  };

  const activeFiltersCount = [
    city,
    state,
    categoryId,
    skillId,
    workType,
    salaryMin,
    salaryMax,
    experienceMax,
    onlyUrgent,
    sameDay,
    workerLocation,
  ].filter(Boolean).length;

  const jobs = jobsData?.items || [];
  const totalPages = jobsData?.pages ?? jobsData?.total_pages ?? 1;
  const unmappedCount = jobs.filter((j) => j.latitude == null || j.longitude == null).length;

  return (
    <div className="flex flex-col">
      <MobilePageHeader
        title={t('nav.findJobs', 'Find Jobs')}
        showBack={false}
        rightSlot={
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'list' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>{t('mobile:jobs.listView', 'List')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'map' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>{t('mobile:jobs.mapView', 'Map')}</span>
            </button>
          </div>
        }
      />

      <div className="p-4 space-y-3">
        {/* Search & Filter Drawer Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('landing.searchPlaceholder', 'Search jobs, skills, locations...')}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-8 text-xs font-medium shadow-xs focus:border-indigo-900 focus:outline-none min-h-[44px]"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-3 text-slate-400 p-1"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className={`mobile-touch-target relative rounded-2xl border px-3.5 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-xs ${
              activeFiltersCount > 0
                ? 'bg-indigo-900 text-white border-indigo-900'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{t('mobile:jobs.filters', 'Filters')}</span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-[#FF9933] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* GPS Location + Radius Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {!workerLocation ? (
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoStatus === 'locating'}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-900 active:scale-95"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>
                {geoStatus === 'locating'
                  ? t('mobile:jobs.locating', 'Locating...')
                  : t('mobile:jobs.useMyLocation', 'Use My Location')}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                <Navigation className="h-3 w-3" />
                <span>{t('mobile:jobs.locationActive', 'GPS Active')}</span>
                <button type="button" onClick={handleClearLocation} className="ml-1 text-emerald-800">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {RADIUS_VALUES.map((rv) => (
                  <option key={rv} value={rv}>
                    {rv ? t('mobile:jobs.kmValue', { km: rv, defaultValue: `${rv} km` }) : t('mobile:jobs.anyDistance', 'Any Distance')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Urgent & Same-Day Chips */}
          <button
            type="button"
            onClick={() => setOnlyUrgent(!onlyUrgent)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold border ${
              onlyUrgent ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <Zap className="h-3 w-3" />
            <span>{t('jobs.urgent', 'Urgent')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSameDay(!sameDay)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold border ${
              sameDay ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>{t('mobile:jobs.sameDayOnly', 'Same-Day')}</span>
          </button>
        </div>

        {geoMsg && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{geoMsg}</span>
          </div>
        )}

        {/* Horizontal Category Chips (Using real backend UUIDs!) */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${
              categoryId === '' ? 'bg-indigo-900 text-white border-indigo-900' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {t('mobile:jobs.allCategories', 'All Categories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                categoryId === cat.id
                  ? 'bg-indigo-900 text-white border-indigo-900'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {t(`categories.${cat.name}`, { defaultValue: cat.name })}
            </button>
          ))}
        </div>

        {/* Result Count & Sort Strip */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500">
            {jobsData ? `${jobsData.total} ${t('nav.jobs', 'Jobs')}` : ''}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            {SORT_OPTIONS.map((opt) => {
              if (opt.value === 'distance_asc' && !workerLocation) return null;
              return (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key, opt.fallback)}
                </option>
              );
            })}
          </select>
        </div>

        {/* Main Content: List or Map */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-red-100 space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-700">{t('jobs.errorTitle', 'Could not load jobs')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('mobile:sync.retry', 'Retry')}</span>
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div className="space-y-2.5">
            {unmappedCount > 0 && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800">
                {t('mobile:jobs.unmappedNotice', {
                  count: unmappedCount,
                  defaultValue: `${unmappedCount} jobs without exact coordinates are hidden on map.`,
                })}
              </div>
            )}
            <div className="h-[440px] rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-white">
              <NearbyJobsMap
                jobs={jobs}
                workerLocation={workerLocation}
                radiusKm={radiusKm ? Number(radiusKm) : null}
                onSelectJob={(jobId) => navigate(`/worker/jobs/${jobId}`)}
              />
            </div>
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <MobileJobCard
                key={job.id}
                job={job}
                isSaved={savedJobIds.has(job.id)}
                onToggleSave={handleToggleSave}
                hasWorkerLocation={!!workerLocation}
                onClick={() => navigate(`/worker/jobs/${job.id}`)}
              />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-100 mt-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{t('mobile:common.prev', 'Prev')}</span>
                </button>
                <span className="text-xs font-semibold text-slate-600">
                  {t('mobile:common.pageOf', { page, total: totalPages, defaultValue: `Page ${page} of ${totalPages}` })}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  <span>{t('mobile:common.next', 'Next')}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-xs mt-4 space-y-2">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">{t('jobs.noJobsFound', 'No matching jobs found')}</h3>
            <p className="text-xs text-slate-500">{t('jobs.tryDifferentFilters', 'Try clearing filters or broadening your location.')}</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 inline-flex rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
              >
                {t('mobile:jobs.resetFilters', 'Reset Filters')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comprehensive Filter Bottom Sheet */}
      {filterSheetOpen && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-base font-extrabold text-slate-900">{t('mobile:jobs.filters', 'Filters')}</h2>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="mobile-touch-target rounded-full p-1.5 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* City & State */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('jobs.city', 'City')}</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('mobile:jobs.cityPlaceholder', 'City...')}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('common.state', 'State')}</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white min-h-[42px]"
                  >
                    <option value="">{t('common.all', 'All')}</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Skill & Work Type */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('jobs.requiredSkills', 'Skill')}</label>
                  <select
                    value={skillId}
                    onChange={(e) => setSkillId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white min-h-[42px]"
                  >
                    <option value="">{t('mobile:jobs.allSkills', 'All Skills')}</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(`skills.${s.name}`, { defaultValue: s.name })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('employer.employmentType', 'Work Type')}</label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value as WorkType | '')}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white min-h-[42px]"
                  >
                    <option value="">{t('mobile:jobs.allWorkTypes', 'All Work Types')}</option>
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {t(`enums.workType.${wt}`, { defaultValue: wt.replace('_', ' ') })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Min/Max & Experience Max */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('mobile:jobs.salaryMin', 'Min ₹')}</label>
                  <input
                    type="number"
                    min="0"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('mobile:jobs.salaryMax', 'Max ₹')}</label>
                  <input
                    type="number"
                    min="0"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="50000"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('mobile:jobs.maxExperience', 'Max Exp')}</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={experienceMax}
                    onChange={(e) => setExperienceMax(e.target.value)}
                    placeholder="5"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs min-h-[42px]"
                  />
                </div>
              </div>
            </div>

            <div className="mobile-sticky-footer">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetAllFilters();
                    setFilterSheetOpen(false);
                  }}
                  className="mobile-touch-target flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
                >
                  {t('mobile:jobs.resetFilters', 'Reset')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-md min-h-[48px]"
                >
                  {t('mobile:jobs.applyFilters', 'Apply Filters')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFindJobsPage;
