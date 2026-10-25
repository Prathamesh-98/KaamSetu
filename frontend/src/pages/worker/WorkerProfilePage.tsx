// KaamSetu — Worker Profile Page
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, MapPin, Star, Briefcase, CheckCircle, Edit3, Plus,
  Shield, AlertCircle, Save, X, Search, Award
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { workerApi, skillsApi } from '../../api/services'
import type { WorkerProfilePayload, SalaryType, AvailabilityStatus, Skill } from '../../types'
import ImageUploader from '../../components/ImageUploader'
import { INDIAN_STATES } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext';
import { WorkerVerificationCenter } from '../../components/verification/WorkerVerificationCenter';
import { PhoneVerifiedBadge, IdentityVerifiedBadge } from '../../components/verification/TrustBadges';

const AVAILABILITY_CONFIG: Record<AvailabilityStatus, { label: string; color: string }> = {
  AVAILABLE:   { label: 'Available',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  BUSY:        { label: 'Busy',        color: 'text-amber-700 bg-amber-50 border-amber-200' },
  UNAVAILABLE: { label: 'Unavailable', color: 'text-red-700 bg-red-50 border-red-200' },
}

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'HOURLY', label: 'Per Hour' },
  { value: 'DAILY', label: 'Per Day' },
  { value: 'MONTHLY', label: 'Per Month' },
  { value: 'PROJECT', label: 'Per Project' },
  { value: 'FIXED', label: 'Fixed' },
]

const WORK_TYPE_OPTIONS = [
  'FULL_TIME', 'PART_TIME', 'DAILY', 'HOURLY', 'PROJECT', 'TEMPORARY', 'REMOTE', 'LOCAL',
]

export default function WorkerProfilePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formError, setFormError] = useState('')

  const { user } = useAuth()
  
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['worker-profile', user?.id],
    queryFn: workerApi.getMyProfile,
    retry: 1,
  })

  const [form, setForm] = useState<WorkerProfilePayload>({
    full_name: '',
    bio: '',
    city: '',
    state: '',
    years_experience: 0,
    expected_salary: undefined,
    salary_type: 'DAILY',
    availability_status: 'AVAILABLE',
    preferred_work_types: [],
  })

  const startEditing = () => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        bio: profile.bio ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        years_experience: profile.years_experience,
        expected_salary: profile.expected_salary ?? undefined,
        salary_type: profile.salary_type ?? 'DAILY',
        availability_status: profile.availability_status,
        preferred_work_types: profile.preferred_work_types ?? [],
        profile_image_url: profile.profile_image_url ?? undefined,
      })
    }
    setIsEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data: WorkerProfilePayload) =>
      profile ? workerApi.updateProfile(data) : workerApi.createProfile(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] })
      setIsEditing(false)
      setFormError('')
    },
    onError: (err: Error) => setFormError(err.message || t('worker.profileSaveError', 'Failed to save profile.')),
  })

  const toggleWorkType = (wt: string) => {
    setForm((prev) => ({
      ...prev,
      preferred_work_types: prev.preferred_work_types?.includes(wt)
        ? prev.preferred_work_types.filter((t) => t !== wt)
        : [...(prev.preferred_work_types ?? []), wt],
    }))
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="container-page py-8 animate-pulse">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-4">
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-3 pt-3">
              <div className="h-8 bg-gray-200 rounded-xl w-1/3" />
              <div className="h-5 bg-gray-200 rounded-xl w-1/4" />
            </div>
          </div>
          {[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  // ── No Profile Yet ─────────────────────────────────────────────────────────
  if (isError || !profile) {
    return (
      <div className="container-page py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#182849]">{t('nav.profile')}</h1>
          <p className="text-gray-500 mt-2 font-medium">{t('worker.createProfileSubtitle', 'Create your worker profile to start applying for jobs')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center mb-6 max-w-2xl mx-auto">
          <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <User className="w-12 h-12 text-primary-400" />
          </div>
          <h3 className="text-2xl font-bold text-[#182849] mb-3">{t('worker.noProfileYet', 'No profile yet')}</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto font-medium">
            {t('worker.createProfileDesc', 'Create your profile to get discovered by employers and apply to jobs.')}
          </p>
          <button onClick={() => { setIsEditing(true) }} className="btn btn-primary rounded-xl px-8 shadow-sm font-semibold">
            <Plus className="w-5 h-5 mr-2" /> {t('worker.createProfileBtn', 'Create Profile')}
          </button>
        </div>
        {isEditing && ProfileForm()}
      </div>
    )
  }

  // ── Profile Exists ─────────────────────────────────────────────────────────
  const avail = AVAILABILITY_CONFIG[profile.availability_status]

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#182849]">{t('nav.profile')}</h1>
          <p className="text-gray-500 mt-2 font-medium">{t('worker.publicProfileSubtitle', 'Your public worker profile')}</p>
        </div>
        {!isEditing && (
          <button onClick={startEditing} className="btn btn-outline gap-2 bg-white rounded-xl shadow-sm font-semibold border-gray-200">
            <Edit3 className="w-4 h-4" /> {t('worker.editProfile', 'Edit Profile')}
          </button>
        )}
      </div>

      {isEditing ? (
        ProfileForm()
      ) : (
        <div className="space-y-6">
          {/* Header card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
              <div className="w-28 h-28 bg-primary-50 rounded-full flex items-center justify-center text-4xl flex-shrink-0 shadow-sm border-4 border-white">
                {profile.profile_image_url ? (
                  <img src={profile.profile_image_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
                ) : '👷'}
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
                  <h2 className="text-2xl font-bold text-[#182849]">{profile.full_name}</h2>
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <IdentityVerifiedBadge isVerified={profile.is_identity_verified} />
                    <PhoneVerifiedBadge isVerified={profile.is_phone_verified} />
                    <span className={`text-xs font-bold border rounded-xl px-2.5 py-1 shadow-sm ${avail.color}`}>
                      {t(`matching.availability.${avail.label.toLowerCase()}`, { defaultValue: avail.label })}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-gray-500 font-medium mb-4 justify-center md:justify-start">
                  {(profile.city || profile.state) && (
                    <span className="flex items-center gap-1.5 justify-center md:justify-start bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                      <MapPin className="w-4 h-4 text-primary-500" /> {[profile.city, profile.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {profile.average_rating > 0 && (
                    <div className="flex items-center gap-1.5 justify-center md:justify-start bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 text-amber-700">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                      <span className="font-bold">{profile.average_rating.toFixed(1)}</span>
                      <span className="text-xs text-amber-600/70">({profile.total_ratings} {t('worker.ratings', 'ratings')})</span>
                    </div>
                  )}
                </div>

                {profile.bio && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-gray-600 leading-relaxed font-medium">{profile.bio}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#182849] mb-6 flex items-center gap-2 text-lg">
                <Briefcase className="w-5 h-5 text-primary-500" /> {t('worker.workDetails', 'Work & Experience Details')}
              </h3>
              
              <div className="space-y-5">
                <div className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> {t('jobs.yearsExperience')}
                  </span>
                  <span className="text-xl font-bold text-[#182849]">{profile.years_experience} {t('worker.years', 'years')}</span>
                </div>

                {profile.expected_salary && (
                  <div className="flex flex-col p-4 bg-primary-50/50 rounded-xl border border-primary-100">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" /> {t('jobs.expectedSalary')}
                    </span>
                    <span className="text-xl font-bold text-primary-700">
                      ₹{profile.expected_salary.toLocaleString()} <span className="text-sm font-medium text-primary-600/70">/{t(`enums.salaryType.${profile.salary_type}`, { defaultValue: profile.salary_type?.toLowerCase() })}</span>
                    </span>
                  </div>
                )}
                
                {profile.preferred_work_types && profile.preferred_work_types.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-bold text-[#182849] mb-3">{t('worker.preferredWorkTypes', 'Preferred Work Types')}</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.preferred_work_types.map((wt) => (
                        <span key={wt} className="text-xs font-bold bg-white border border-gray-200 shadow-sm rounded-xl px-3 py-1.5 text-[#182849]">
                          {wt.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <WorkerSkillManager profile={profile} t={t} />
          </div>

          {/* Trust and Verification Center */}
          <WorkerVerificationCenter profile={profile} />
        </div>
      )}
    </div>
  )

  // ── Profile Form (inner component sharing outer scope) ────────────────────
  function ProfileForm() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-[#182849] text-xl">{profile ? t('worker.editProfileTitle', 'Edit Profile') : t('worker.createProfileTitle', 'Create Profile')}</h2>
          {isEditing && profile && (
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {formError && (
          <div className="flex items-start gap-2 text-red-700 text-sm bg-red-50 rounded-xl p-4 mb-6 border border-red-100 shadow-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2 flex justify-center mb-4">
            <ImageUploader 
              currentImageUrl={form.profile_image_url} 
              onUploadSuccess={(url) => setForm(p => ({ ...p, profile_image_url: url }))}
              folder="kaamsetu/workers"
              shape="circle"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('worker.formFullName', 'Full Name *')}</label>
            <input
              type="text"
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder={t('worker.formFullNamePlaceholder', 'Your full name')}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('worker.formBio', 'Bio')}</label>
            <textarea
              rows={3}
              className="input w-full resize-none rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.bio ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder={t('worker.formBioPlaceholder', 'Brief description of your experience and expertise...')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('worker.formCity', 'City')}</label>
            <input
              type="text"
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.city ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder={t('worker.formCityPlaceholder', 'e.g. Delhi')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('worker.formState', 'State')}</label>
            <select
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.state ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
            >
              <option value="">{t('worker.formSelectState', 'Select State')}</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('jobs.yearsExperience')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.years_experience ?? 0}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setForm((p) => ({ ...p, years_experience: val === '' ? 0 : parseInt(val, 10) }))
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('jobs.availability')}</label>
            <select
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.availability_status ?? 'AVAILABLE'}
              onChange={(e) => setForm((p) => ({ ...p, availability_status: e.target.value as AvailabilityStatus }))}
            >
              <option value="AVAILABLE">{t('worker.optAvailable', 'Available')}</option>
              <option value="BUSY">{t('worker.optBusy', 'Busy')}</option>
              <option value="UNAVAILABLE">{t('worker.optUnavailable', 'Unavailable')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('jobs.expectedSalary')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.expected_salary ?? ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setForm((p) => ({ ...p, expected_salary: val === '' ? undefined : Number(val) }))
              }}
              placeholder={t('worker.formSalaryPlaceholder', 'e.g. 800')}
            />
            <p className="text-xs text-gray-500 mt-2 font-medium">{t('worker.formSalaryHelp', 'Enter the minimum amount you expect.')}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#182849] mb-2">{t('worker.formSalaryType', 'Salary Type')}</label>
            <select
              className="input w-full rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              value={form.salary_type ?? 'DAILY'}
              onChange={(e) => setForm((p) => ({ ...p, salary_type: e.target.value as SalaryType }))}
            >
              {SALARY_TYPES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-[#182849] mb-3">{t('worker.formPreferredWorkTypes', 'Preferred Work Types')}</label>
            <div className="flex flex-wrap gap-2.5">
              {WORK_TYPE_OPTIONS.map((wt) => {
                const selected = form.preferred_work_types?.includes(wt)
                return (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => toggleWorkType(wt)}
                    className={`text-sm px-4 py-2 rounded-xl border transition-all font-bold shadow-sm ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400 hover:bg-gray-50'
                    }`}
                  >
                    {wt.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !form.full_name.trim()}
            className="btn btn-primary rounded-xl shadow-sm px-8 font-bold"
          >
            {saveMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('worker.saving', 'Saving...')}
              </span>
            ) : (
              <span className="flex items-center gap-2"><Save className="w-5 h-5" /> {t('jobs.saveProfile')}</span>
            )}
          </button>
          {profile && (
            <button onClick={() => setIsEditing(false)} className="btn btn-outline rounded-xl shadow-sm px-6 font-bold">
              {t('worker.cancel', 'Cancel')}
            </button>
          )}
        </div>
      </div>
    )
  }
}

function WorkerSkillManager({ profile, t }: { profile: any, t: any }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const workerSkills = profile?.skills || []

  const { data: results } = useQuery({
    queryKey: ['skills', search],
    queryFn: () => skillsApi.list(search || undefined),
    enabled: showDropdown || search.length > 0,
    staleTime: 60_000,
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addSkillMutation = useMutation({
    mutationFn: (skillId: string) => workerApi.addSkill(skillId, 'INTERMEDIATE', 0),
    onSuccess: (newWorkerSkill) => {
      queryClient.setQueriesData({ queryKey: ['worker-profile'] }, (old: any) => {
        if (!old) return old
        const currentSkills = old.skills || []
        if (currentSkills.some((ws: any) => (ws.skill?.id || ws.skill_id) === (newWorkerSkill.skill?.id || newWorkerSkill.skill_id))) {
          return old
        }
        return {
          ...old,
          skills: [...currentSkills, newWorkerSkill],
        }
      })
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] })
      setSearch('')
      setShowDropdown(false)
      toast.success(t('worker.skillAdded', 'Skill added successfully'))
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('worker.skillAddError', 'Failed to add skill')
      toast.error(msg)
    }
  })

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => workerApi.removeSkill(skillId),
    onSuccess: (_, skillId) => {
      queryClient.setQueriesData({ queryKey: ['worker-profile'] }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          skills: (old.skills || []).filter((ws: any) => (ws.skill?.id || ws.skill_id) !== skillId),
        }
      })
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] })
      toast.success(t('worker.skillRemoved', 'Skill removed'))
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('worker.skillRemoveError', 'Failed to remove skill')
      toast.error(msg)
    }
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <h3 className="font-bold text-[#182849] mb-6 flex items-center gap-2 text-lg">
        <CheckCircle className="w-5 h-5 text-primary-500" /> {t('jobs.skills')}
      </h3>
      
      <div className="mb-6 relative" ref={containerRef}>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input w-full pl-11 pr-10 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
            placeholder={t('worker.searchAddSkills', 'Search and add skills...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (!showDropdown) setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (results && results.length > 0) {
                  const firstAvailable = results.find(
                    (s: Skill) => !workerSkills.some((ws: any) => (ws.skill?.id || ws.skill_id) === s.id)
                  )
                  if (firstAvailable && !addSkillMutation.isPending) {
                    addSkillMutation.mutate(firstAvailable.id)
                  }
                }
              } else if (e.key === 'Escape') {
                setShowDropdown(false)
              }
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              title={t('common.clear', 'Clear')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {showDropdown && results && results.length > 0 && (
          <div
            className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto overflow-x-hidden"
            onMouseDown={(e) => e.preventDefault()}
          >
            {results.map((skill: Skill) => {
              const hasSkill = workerSkills.some((ws: any) => (ws.skill?.id || ws.skill_id) === skill.id)
              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={hasSkill || addSkillMutation.isPending}
                  onClick={() => {
                    if (!hasSkill && !addSkillMutation.isPending) {
                      addSkillMutation.mutate(skill.id)
                    }
                  }}
                  className="w-full text-left px-5 py-3 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors"
                >
                  <span className="font-bold text-[#182849] flex items-center gap-2">
                    {t(`skills.${skill.name}`, { defaultValue: skill.name })}
                    {hasSkill && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        {t('worker.added', 'Added')}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                    {t(`categories.${skill.category}`, { defaultValue: skill.category })}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {workerSkills.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {workerSkills.map((ws: any) => {
            const skillId = ws.skill?.id || ws.skill_id
            const skillName = ws.skill?.name || ws.name || ''
            const isDeleting = removeSkillMutation.isPending && removeSkillMutation.variables === skillId
            return (
              <span
                key={ws.id || skillId}
                className="flex items-center gap-1.5 text-sm font-bold bg-primary-50 text-primary-700 border border-primary-200 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm"
              >
                {t(`skills.${skillName}`, { defaultValue: skillName })}
                <button
                  type="button"
                  onClick={() => removeSkillMutation.mutate(skillId)}
                  disabled={isDeleting}
                  className="p-1 hover:bg-primary-200 rounded-lg transition-colors disabled:opacity-50 text-primary-600 hover:text-primary-800"
                  title={t('common.remove', 'Remove')}
                >
                  {isDeleting ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </span>
            )
          })}
        </div>
      ) : (
        <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <p className="text-sm font-medium text-gray-500">{t('worker.noSkillsAddedYet', 'No skills added yet.')}</p>
        </div>
      )}
    </div>
  )
}
