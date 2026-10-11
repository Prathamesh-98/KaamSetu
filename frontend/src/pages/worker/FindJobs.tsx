import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, MapPin, Briefcase, Clock, Zap, SlidersHorizontal, X, ChevronLeft, ChevronRight, IndianRupee, Bookmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { jobsApi, categoriesApi, skillsApi, workerApi } from '../../api/services'
import type { JobListItem, WorkType, JobFilters, Category, Skill } from '../../types'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  DAILY: 'Daily Labour',
  HOURLY: 'Hourly',
  PROJECT: 'Project Based',
  TEMPORARY: 'Temporary',
  REMOTE: 'Remote',
  LOCAL: 'Local / On-Site',
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'salary_desc', label: 'Salary: High to Low' },
  { value: 'salary_asc', label: 'Salary: Low to High' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function JobCard({ job, isSaved, onToggleSave }: { job: JobListItem, isSaved: boolean, onToggleSave: (e: React.MouseEvent, id: string) => void }) {
  const { t } = useTranslation()
  const salaryText = job.salary_min && job.salary_max
    ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
    : job.salary_min
    ? `From ₹${job.salary_min.toLocaleString()}`
    : t('jobs.salaryNegotiable', 'Salary Negotiable')

  return (
    <Link
      to={`/worker/jobs/${job.id}`}
      className="card p-5 hover:shadow-md transition-all block group bg-white rounded-xl border border-gray-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4">
            {job.image_url && (
              <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0 border border-gray-200 overflow-hidden hidden sm:block">
                <img src={job.image_url} alt={job.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {job.is_urgent && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                    <Zap className="w-3 h-3" /> {t('jobs.urgent', 'Urgent')}
                  </span>
                )}
                <span className="badge badge-outline text-xs">
                  {t(`enums.workType.${job.work_type}`, { defaultValue: WORK_TYPE_LABELS[job.work_type] || job.work_type })}
                </span>
              </div>
              <h3 className="font-bold text-dark text-base truncate group-hover:text-primary-600 transition-colors">{job.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {job.employer.organization_name || job.employer.full_name}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end">
          <div className="font-semibold text-primary-600 text-sm">{salaryText}</div>
          <div className="text-xs text-gray-400 mt-0.5">/ {t(`enums.salaryType.${job.salary_type}`, { defaultValue: job.salary_type.toLowerCase() })}</div>
          <button 
            onClick={(e) => onToggleSave(e, job.id)}
            className={`mt-2 p-1.5 rounded-full transition-colors ${isSaved ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            title={isSaved ? t('jobs.removeFromSaved', "Remove from saved") : t('jobs.saveJob', "Save job")}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary-600' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {job.city}, {job.state}
        </span>
        <span className="flex items-center gap-1">
          <Briefcase className="w-3 h-3" /> {job.category?.name ? t(`categories.${job.category.name}`, { defaultValue: job.category.name }) : t('jobs.category', 'Category')}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
        {job.applications_count > 0 && (
          <span className="text-gray-400">{job.applications_count} {t('jobs.applied', 'applied')}</span>
        )}
      </div>

      {job.required_skills && job.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.required_skills.slice(0, 4).map((js) => (
            <span key={js.skill.id} className="text-xs bg-surface text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
              {t(`skills.${js.skill.name}`, { defaultValue: js.skill.name })}{js.is_mandatory ? ' *' : ''}
            </span>
          ))}
          {job.required_skills.length > 4 && (
            <span className="text-xs text-gray-400">+{job.required_skills.length - 4} {t('jobs.more', 'more')}</span>
          )}
        </div>
      )}
    </Link>
  )
}

export default function FindJobs() {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [skillId, setSkillId] = useState('')
  const [workType, setWorkType] = useState<WorkType | ''>('')
  const [salaryMin, setSalaryMin] = useState<number | ''>('')
  const [salaryMax, setSalaryMax] = useState<number | ''>('')
  const [experienceMax, setExperienceMax] = useState<number | ''>('')
  const [startDateFrom, setStartDateFrom] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  const debouncedKeyword = useDebounce(keyword, 400)
  const debouncedCity = useDebounce(city, 400)
  const debouncedState = useDebounce(state, 400)

  useEffect(() => {
    setPage(1)
  }, [
    debouncedKeyword, debouncedCity, debouncedState, categoryId, skillId,
    workType, salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent, sortBy
  ])

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    staleTime: 300_000,
  })

  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => skillsApi.list(),
    staleTime: 300_000,
  })

  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  })
  const savedJobIds = useMemo(() => {
    if (!savedJobs) return new Set<string>()
    return new Set(savedJobs.map(sj => sj.job.id))
  }, [savedJobs])

  const queryClient = useQueryClient()
  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })
  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (savedJobIds.has(id)) {
      unsaveMutation.mutate(id)
    } else {
      saveMutation.mutate(id)
    }
  }

  const filters: JobFilters = useMemo(() => ({
    keyword: debouncedKeyword || undefined,
    city: debouncedCity || undefined,
    state: debouncedState || undefined,
    category_id: categoryId || undefined,
    skill_id: skillId || undefined,
    work_type: workType || undefined,
    salary_min: salaryMin !== '' ? salaryMin : undefined,
    salary_max: salaryMax !== '' ? salaryMax : undefined,
    experience_max: experienceMax !== '' ? experienceMax : undefined,
    start_date_from: startDateFrom || undefined,
    is_urgent: isUrgent || undefined,
    sort_by: sortBy,
    page,
    per_page: 20,
  }), [
    debouncedKeyword, debouncedCity, debouncedState, categoryId, skillId,
    workType, salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent, sortBy, page
  ])

  const { data: jobsResponse, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => jobsApi.list(filters),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })

  const activeFilterCount = [
    keyword, city, state, categoryId, skillId, workType,
    salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent
  ].filter(Boolean).length

  const handleClearFilters = () => {
    setKeyword('')
    setCity('')
    setState('')
    setCategoryId('')
    setSkillId('')
    setWorkType('')
    setSalaryMin('')
    setSalaryMax('')
    setExperienceMax('')
    setStartDateFrom('')
    setIsUrgent(false)
  }

  return (
    <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">{t('nav.findJobs', 'Find Jobs')}</h1>
        <p className="text-gray-500 mt-1">{t('jobs.discoverOpportunities', 'Discover opportunities matched to your skills and location')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar Filters */}
        <div className="w-full md:w-1/4 flex-shrink-0">
          <div className="card p-5 bg-white border border-gray-100 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-dark">{t('jobs.filters', 'Filters')}</h2>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {t('jobs.clearAll', 'Clear All')}
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="label">{t('jobs.searchKeyword', 'Keyword')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('jobs.searchPlaceholder', 'Job title...')}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="input pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('jobs.city', 'City')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('jobs.cityPlaceholder', 'e.g. Delhi')}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('jobs.state', 'State')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('jobs.statePlaceholder', 'e.g. Maharashtra')}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="input pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('jobs.category', 'Category')}</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input pl-10 w-full appearance-none"
                  >
                    <option value="">{t('jobs.allCategories', 'All Categories')}</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{t(`categories.${cat.name}`, { defaultValue: cat.name })}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">{t('jobs.skillRequired', 'Skill Required')}</label>
                <select
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">{t('jobs.allSkills', 'All Skills')}</option>
                  {skills?.map((skill) => (
                    <option key={skill.id} value={skill.id}>{t(`skills.${skill.name}`, { defaultValue: skill.name })}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('jobs.workType', 'Work Type')}</label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as WorkType | '')}
                  className="input w-full"
                >
                  <option value="">{t('jobs.allTypes', 'All Types')}</option>
                  {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{t(`enums.workType.${value}`, { defaultValue: label })}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('jobs.experienceLabel', 'Experience (Years)')}</label>
                <input
                  type="number"
                  min={0}
                  placeholder={t('jobs.experiencePlaceholder', 'Max years')}
                  value={experienceMax}
                  onChange={(e) => setExperienceMax(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('jobs.minSalary', 'Min Sal')}</label>
                  <input
                    type="number"
                    min={0}
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="label">{t('jobs.maxSalary', 'Max Sal')}</label>
                  <input
                    type="number"
                    min={0}
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm font-medium text-dark flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-red-500" /> {t('jobs.urgentJobsOnly', 'Urgent Only')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Column */}
        <div className="w-full md:w-3/4 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-600 flex items-center gap-2">
              {isFetching && <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></span>}
              {jobsResponse ? (
                <span>
                  {jobsResponse.total === 0
                    ? t('jobs.noJobsFound', 'No jobs found')
                    : t('jobs.showingResults', 'Showing {{count}} of {{total}} jobs', { count: jobsResponse.items.length, total: jobsResponse.total })}
                </span>
              ) : (
                <span>{t('jobs.loadingJobs', 'Loading jobs...')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">{t('jobs.sortBy', 'Sort by:')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input py-1.5 text-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(`sortOptions.${opt.value}`, opt.label)}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="card p-5 animate-pulse bg-white rounded-xl border border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-5 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="card p-8 text-center border-red-200 bg-red-50 rounded-xl">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="font-bold text-red-700 mb-2">{t('jobs.failedToLoad', 'Failed to load jobs')}</h3>
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : t('jobs.somethingWentWrong', 'Something went wrong.')}
              </p>
            </div>
          )}

          {!isLoading && !isError && jobsResponse && (
            <>
              {jobsResponse.items.length === 0 ? (
                <div className="card p-10 text-center flex flex-col items-center justify-center min-h-[300px] bg-white rounded-xl border border-gray-100">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="font-bold text-dark text-lg mb-2">{t('jobs.noMatch', 'No jobs match')}</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {t('jobs.tryAdjusting', 'Try adjusting your filters.')}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="btn btn-outline mt-6"
                    >
                      {t('jobs.clearFiltersBtn', 'Clear Filters')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 relative">
                  <div className={isFetching ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
                    {jobsResponse.items.map((job) => (
                      <div className="mb-4" key={job.id}>
                        <JobCard 
                          job={job}
                          isSaved={savedJobIds.has(job.id)}
                          onToggleSave={handleToggleSave}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {jobsResponse.total_pages > 1 && (
                <div className="mt-8 flex items-center justify-between card p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-500 hidden sm:block">
                    {t('pagination.page', 'Page')} <span className="font-semibold text-dark">{jobsResponse.page}</span> {t('pagination.of', 'of')} <span className="font-semibold text-dark">{jobsResponse.total_pages}</span>
                  </p>
                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={jobsResponse.page <= 1}
                      className="btn btn-outline py-2 px-3 flex items-center gap-1 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" /> {t('pagination.prev', 'Previous')}
                    </button>
                    <span className="text-sm font-medium text-dark sm:hidden px-2">
                      {jobsResponse.page} / {jobsResponse.total_pages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(jobsResponse.total_pages, p + 1))}
                      disabled={jobsResponse.page >= jobsResponse.total_pages}
                      className="btn btn-outline py-2 px-3 flex items-center gap-1 disabled:opacity-50"
                    >
                      {t('pagination.next', 'Next')} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
