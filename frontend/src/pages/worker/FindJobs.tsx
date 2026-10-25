import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, MapPin, Briefcase, Clock, Zap, X, ChevronLeft, ChevronRight,
  Bookmark, Navigation, List, Map as MapIcon, AlertCircle, Compass
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { jobsApi, categoriesApi, skillsApi, workerApi } from '../../api/services'
import type { JobListItem, WorkType, JobFilters, Category, Skill } from '../../types'
import NearbyJobsMap from '../../components/jobs/NearbyJobsMap'

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
  { value: 'distance_asc', label: 'Distance: Closest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'salary_desc', label: 'Salary: High to Low' },
  { value: 'salary_asc', label: 'Salary: Low to High' },
]

const RADIUS_OPTIONS = [
  { value: '', label: 'Any Distance' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function JobCard({
  job,
  isSaved,
  onToggleSave,
  hasWorkerLocation = false,
  isSelected = false,
}: {
  job: JobListItem
  isSaved: boolean
  onToggleSave: (e: React.MouseEvent, id: string) => void
  hasWorkerLocation?: boolean
  isSelected?: boolean
}) {
  const { t } = useTranslation()
  const salaryText = job.salary_min && job.salary_max
    ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
    : job.salary_min
    ? `From ₹${job.salary_min.toLocaleString()}`
    : t('jobs.salaryNegotiable', 'Salary Negotiable')

  return (
    <Link
      to={`/worker/jobs/${job.id}`}
      className={`card p-5 hover:shadow-md transition-all block group bg-white rounded-xl border ${
        isSelected ? 'border-primary-500 ring-2 ring-primary-100 shadow-sm' : 'border-gray-100'
      }`}
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
                {job.distance_km != null ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
                    title={t('jobs.approxStraightLine', 'straight-line approx.')}
                  >
                    <Navigation className="w-3 h-3 text-emerald-600" />
                    <span>~{job.distance_km} km</span>
                    {job.estimated_travel_time && (
                      <span className="text-emerald-800 font-medium">• {job.estimated_travel_time}</span>
                    )}
                  </span>
                ) : hasWorkerLocation ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {t('jobs.distanceUnavailable', 'Distance unavailable')}
                  </span>
                ) : null}
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
          <MapPin className="w-3 h-3" />
          {job.address_detail ? `${job.address_detail}, ` : ''}{job.city}, {job.state}
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
  const [sameDay, setSameDay] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  // Geolocation & Map States
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [workerLocation, setWorkerLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState<string>('')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle')
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const debouncedKeyword = useDebounce(keyword, 400)
  const debouncedCity = useDebounce(city, 400)
  const debouncedState = useDebounce(state, 400)

  // Reset page when any filter or location parameter changes
  useEffect(() => {
    setPage(1)
  }, [
    debouncedKeyword, debouncedCity, debouncedState, categoryId, skillId,
    workType, salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent,
    sameDay, workerLocation, radiusKm, sortBy
  ])

  // Geolocation Handler
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      setGeoErrorMsg(t('jobs.geoError', 'Geolocation is not supported by your browser.'))
      return
    }

    setGeoStatus('locating')
    setGeoErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        })
        setGeoStatus('idle')
        setGeoErrorMsg(null)
      },
      (err) => {
        if (err.code === 1) {
          setGeoStatus('denied')
          setGeoErrorMsg(t('jobs.geoDeniedDesc', 'Please enable location in your browser settings or search by city/state below.'))
        } else {
          setGeoStatus('error')
          setGeoErrorMsg(t('jobs.geoError', 'Could not determine your location. Please try again or search manually.'))
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const handleClearLocation = () => {
    setWorkerLocation(null)
    setRadiusKm('')
    setGeoStatus('idle')
    setGeoErrorMsg(null)
    if (sortBy === 'distance_asc') {
      setSortBy('newest')
    }
  }

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

  // Construct filters payload according to strict backend contracts
  const filters: JobFilters = useMemo(() => {
    const payload: JobFilters = {
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
      same_day: sameDay || undefined,
      page,
      per_page: 20,
    }

    if (workerLocation) {
      payload.worker_lat = workerLocation.lat
      payload.worker_lng = workerLocation.lng
      if (radiusKm) {
        payload.radius_km = Number(radiusKm)
      }
      payload.sort_by = sortBy
    } else {
      // Safe fallback: don't send distance_asc without coordinates to prevent 422
      payload.sort_by = sortBy === 'distance_asc' ? 'newest' : sortBy
    }

    return payload
  }, [
    debouncedKeyword, debouncedCity, debouncedState, categoryId, skillId,
    workType, salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent,
    sameDay, workerLocation, radiusKm, sortBy, page
  ])

  const { data: jobsResponse, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => jobsApi.list(filters),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })

  const activeFilterCount = [
    keyword, city, state, categoryId, skillId, workType,
    salaryMin, salaryMax, experienceMax, startDateFrom, isUrgent,
    sameDay, workerLocation, radiusKm
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
    setSameDay(false)
    handleClearLocation()
  }

  // Count jobs with coordinates vs unmapped
  const mappedJobsCount = useMemo(() => {
    if (!jobsResponse?.items) return 0
    return jobsResponse.items.filter(j => j.latitude && j.longitude).length
  }, [jobsResponse?.items])

  const unmappedJobsCount = useMemo(() => {
    if (!jobsResponse?.items) return 0
    return jobsResponse.items.length - mappedJobsCount
  }, [jobsResponse?.items, mappedJobsCount])

  return (
    <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">{t('nav.findJobs', 'Find Jobs')}</h1>
        <p className="text-gray-500 mt-1">{t('jobs.discoverOpportunities', 'Discover opportunities matched to your skills and location')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar Filters */}
        <div className="w-full md:w-1/4 flex-shrink-0">
          <div className="card p-5 bg-white border border-gray-100 rounded-xl shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
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

            {/* Location & Radius Section */}
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-primary-600" />
                  {t('jobs.locationActive', 'Near your location')}
                </span>
                {workerLocation && (
                  <button
                    onClick={handleClearLocation}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    {t('jobs.clearLocation', 'Clear')}
                  </button>
                )}
              </div>

              {!workerLocation ? (
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={geoStatus === 'locating'}
                  className="btn btn-outline w-full py-2 px-3 text-xs flex items-center justify-center gap-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700 font-medium"
                >
                  {geoStatus === 'locating' ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      {t('jobs.locating', 'Locating...')}
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5 text-primary-600" />
                      {t('jobs.useMyLocation', 'Use My Location')}
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs bg-white p-2 rounded-lg border border-blue-200 text-blue-900 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="truncate">
                      {workerLocation.lat.toFixed(4)}, {workerLocation.lng.toFixed(4)}
                    </span>
                  </div>

                  <div>
                    <label className="label text-xs text-gray-700">{t('jobs.radius', 'Search Radius')}</label>
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      className="input w-full py-1.5 text-xs bg-white"
                    >
                      {RADIUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value ? t('jobs.km', { count: opt.value, defaultValue: opt.label }) : t('jobs.allDistances', opt.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {geoErrorMsg && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{geoErrorMsg}</span>
                </div>
              )}
            </div>

            {/* Keyword Search */}
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

            {/* City & State (Retained as Fallback) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('jobs.city', 'City')}</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('jobs.cityPlaceholder', 'e.g. Delhi')}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input pl-8 w-full text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('jobs.state', 'State')}</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('jobs.statePlaceholder', 'e.g. Maharashtra')}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="input pl-8 w-full text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
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

            {/* Skills */}
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

            {/* Work Type */}
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

            {/* Experience */}
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

            {/* Salary Range */}
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

            {/* Toggles: Urgent & Same-Day */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={sameDay}
                  onChange={(e) => setSameDay(e.target.checked)}
                  className="w-4 h-4 accent-primary-600 rounded"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-dark flex items-center gap-1.5">
                    ⚡ {t('jobs.sameDay', 'Same-Day Jobs')}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {t('jobs.sameDayDesc', 'Starting today or urgent daily work')}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 accent-primary-600 rounded"
                />
                <span className="text-sm font-medium text-dark flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-red-500" /> {t('jobs.urgentJobsOnly', 'Urgent Only')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Main Column */}
        <div className="w-full md:w-3/4 flex-1">
          {/* Controls Bar: Count, Sort, and View Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-600 flex items-center gap-2">
              {isFetching && <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />}
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

            <div className="flex items-center gap-3 flex-wrap">
              {/* Map / List View Toggle */}
              <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-dark shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                  {t('jobs.listView', 'List')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'map'
                      ? 'bg-white text-dark shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  aria-pressed={viewMode === 'map'}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  {t('jobs.mapView', 'Map')}
                </button>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">{t('jobs.sortBy', 'Sort by:')}</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input py-1.5 text-xs"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(`sortOptions.${opt.value}`, opt.label)}
                    </option>
                  ))}
                </select>
              </div>
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
              {/* Map View Mode */}
              {viewMode === 'map' && (
                <div className="space-y-4 mb-6">
                  <NearbyJobsMap
                    jobs={jobsResponse.items}
                    workerLocation={workerLocation}
                    radiusKm={radiusKm ? Number(radiusKm) : null}
                    selectedJobId={selectedJobId}
                    onSelectJob={(id) => setSelectedJobId(id)}
                  />

                  {unmappedJobsCount > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        {t('jobs.unmappedNotice', { count: unmappedJobsCount, defaultValue: `${unmappedJobsCount} jobs without map coordinates are listed below` })}
                      </span>
                      <button
                        onClick={() => setViewMode('list')}
                        className="text-xs font-semibold text-primary-600 hover:underline flex-shrink-0"
                      >
                        {t('jobs.listView', 'List View')} &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Job Cards */}
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
                          hasWorkerLocation={Boolean(workerLocation)}
                          isSelected={selectedJobId === job.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagination */}
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
