// KaamSetu — Post Job / Edit Job Page (Employer)
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, MapPin, DollarSign, Zap, AlertCircle, CheckCircle,
  X, Search, Plus
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { jobsApi, categoriesApi, skillsApi } from '../../api/services'
import type { JobCreatePayload, WorkType, SalaryType, Skill } from '../../types'
import ImageUploader from '../../components/ImageUploader'
import { INDIAN_STATES } from '../../utils/constants'

const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'FULL_TIME',  label: 'Full Time' },
  { value: 'PART_TIME',  label: 'Part Time' },
  { value: 'DAILY',      label: 'Daily Labour' },
  { value: 'HOURLY',     label: 'Hourly' },
  { value: 'PROJECT',    label: 'Project Based' },
  { value: 'TEMPORARY',  label: 'Temporary' },
  { value: 'REMOTE',     label: 'Remote' },
  { value: 'LOCAL',      label: 'Local / On-Site' },
]

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'HOURLY',   label: 'Per Hour' },
  { value: 'DAILY',    label: 'Per Day' },
  { value: 'MONTHLY',  label: 'Per Month' },
  { value: 'PROJECT',  label: 'Per Project' },
  { value: 'FIXED',    label: 'Fixed Amount' },
]

const STEPS = ['Job Details', 'Location & Type', 'Salary & Requirements', 'Review & Publish']

interface SelectedSkill { id: string; name: string }

const DEFAULT_FORM: JobCreatePayload = {
  title: '',
  category_id: '',
  description: '',
  work_type: 'FULL_TIME',
  city: '',
  state: '',
  salary_type: 'DAILY',
  salary_min: undefined,
  salary_max: undefined,
  workers_needed: 1,
  experience_required: 0,
  is_urgent: false,
  start_date: '',
  end_date: '',
  duration_days: undefined,
  additional_requirements: '',
  image_url: undefined,
  required_skill_ids: [],
}

export default function PostJobPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const isEdit = !!editId
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<JobCreatePayload>(DEFAULT_FORM)
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)
  const [formError, setFormError] = useState('')
  const skillRef = useRef<HTMLDivElement>(null)

  // Load existing job in edit mode
  const { data: existingJob, isLoading: loadingJob } = useQuery({
    queryKey: ['job', editId],
    queryFn: () => jobsApi.get(editId!),
    enabled: isEdit,
  })

  // Populate form when existing job loads
  useEffect(() => {
    if (existingJob) {
      setForm({
        title: existingJob.title,
        category_id: existingJob.category.id,
        description: existingJob.description,
        work_type: existingJob.work_type,
        city: existingJob.city,
        state: existingJob.state,
        salary_type: existingJob.salary_type,
        salary_min: existingJob.salary_min ?? undefined,
        salary_max: existingJob.salary_max ?? undefined,
        workers_needed: existingJob.workers_needed,
        experience_required: existingJob.experience_required,
        is_urgent: existingJob.is_urgent,
        start_date: existingJob.start_date ?? '',
        end_date: existingJob.end_date ?? '',
        duration_days: existingJob.duration_days ?? undefined,
        additional_requirements: existingJob.additional_requirements ?? '',
        image_url: existingJob.image_url ?? undefined,
        required_skill_ids: existingJob.required_skills.map(js => js.skill.id),
      })
      setSelectedSkills(existingJob.required_skills.map(js => ({
        id: js.skill.id,
        name: js.skill.name,
      })))
    }
  }, [existingJob])

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    staleTime: 300_000,
  })

  const { data: skillResults } = useQuery({
    queryKey: ['skills', skillSearch],
    queryFn: () => skillsApi.list(skillSearch || undefined),
    enabled: skillSearch.length > 0 || showSkillDropdown,
    staleTime: 60_000,
  })

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) {
        setShowSkillDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const set = <K extends keyof JobCreatePayload>(key: K, value: JobCreatePayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const addSkill = (skill: Skill) => {
    if (selectedSkills.some(s => s.id === skill.id)) return
    const updated = [...selectedSkills, { id: skill.id, name: skill.name }]
    setSelectedSkills(updated)
    setForm(prev => ({ ...prev, required_skill_ids: updated.map(s => s.id) }))
    setSkillSearch('')
    setShowSkillDropdown(false)
  }

  const removeSkill = (skillId: string) => {
    const updated = selectedSkills.filter(s => s.id !== skillId)
    setSelectedSkills(updated)
    setForm(prev => ({ ...prev, required_skill_ids: updated.map(s => s.id) }))
  }

  const saveMutation = useMutation({
    mutationFn: (data: JobCreatePayload) =>
      isEdit
        ? jobsApi.update(editId!, data)
        : jobsApi.create(data),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ['employer-jobs'] })
      void queryClient.invalidateQueries({ queryKey: ['job', editId] })
      navigate(isEdit ? `/employer/jobs` : `/employer/jobs/${job.id}/applicants`)
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setFormError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setFormError(detail || err.message || 'Failed to save job. Please try again.')
      }
    },
  })

  const canAdvanceStep0 = form.title.trim() && form.category_id && form.description.trim()
  const canAdvanceStep1 = form.city.trim() && form.state.trim() && form.work_type
  const canAdvanceStep2 = form.salary_type && (form.experience_required ?? 0) >= 0
  const canSubmit = canAdvanceStep0 && canAdvanceStep1 && canAdvanceStep2

  const handleSubmit = () => {
    setFormError('')
    if (form.salary_min && form.salary_max && form.salary_min > form.salary_max) {
      setFormError('Minimum salary cannot exceed maximum salary.')
      setStep(2)
      return
    }
    if (form.end_date && form.start_date && new Date(form.end_date) < new Date(form.start_date)) {
      setFormError('End date cannot be before start date.')
      setStep(1)
      return
    }
    if (!canSubmit) {
      setFormError('Please fill all required fields before submitting.')
      return
    }
    saveMutation.mutate(form)
  }

  if (isEdit && loadingJob) {
    return (
      <div className="container-page py-8 max-w-2xl animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-8" />
        <div className="card p-6 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/2" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-8 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#182849' }}>
          {isEdit ? 'Edit Job Posting' : t('employer.postNew')}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEdit ? 'Update your job details below' : 'Reach thousands of skilled workers near you'}
        </p>
      </div>

      {/* ── Step Indicator ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < step
                ? 'bg-primary-600 text-white'
                : i === step
                ? 'bg-primary-100 text-primary-700 border-2 border-primary-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-primary-700' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {formError && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-4 mb-6">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* ── Step 0: Job Details ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="font-bold text-dark">Job Details</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="label">Job Title *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Experienced Electrician Needed"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="label">Category *</label>
              <select
                className="input w-full"
                value={form.category_id}
                onChange={(e) => set('category_id', e.target.value)}
              >
                <option value="">Select a category...</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{t(`categories.${cat.name}`, { defaultValue: cat.name })}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-2 block">Job Image</label>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <ImageUploader
                currentImageUrl={form.image_url}
                onUploadSuccess={(url) => set('image_url', url)}
                folder="kaamsetu/jobs"
                shape="rectangle"
              />
              <p className="text-xs text-gray-500 mt-2">Add an image to make your job posting stand out (optional).</p>
            </div>
          </div>

          <div>
            <label className="label">Job Description *</label>
            <textarea
              rows={5}
              className="input w-full resize-none"
              placeholder="Describe the job responsibilities, requirements, and any other important details..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Required Skills */}
          <div>
            <label className="label">Required Skills</label>
            {/* Selected skills */}
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedSkills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1.5 text-sm bg-primary-50 text-primary-700 border border-primary-200 rounded-full px-3 py-1"
                  >
                    {t(`skills.${skill.name}`, { defaultValue: skill.name })}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill.id)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Skill search */}
            <div ref={skillRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-10 w-full"
                  placeholder="Search and add skills..."
                  value={skillSearch}
                  onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true) }}
                  onFocus={() => setShowSkillDropdown(true)}
                />
              </div>
              {showSkillDropdown && skillResults && skillResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                  {skillResults
                    .filter(s => !selectedSkills.some(sel => sel.id === s.id))
                    .slice(0, 20)
                    .map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => addSkill(skill)}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary-50 flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-3 h-3 text-primary-500 flex-shrink-0" />
                        <span>{t(`skills.${skill.name}`, { defaultValue: skill.name })}</span>
                        {skill.category && <span className="text-xs text-gray-400 ml-auto">{t(`categories.${skill.category}`, { defaultValue: skill.category })}</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100 cursor-pointer"
            onClick={() => set('is_urgent', !form.is_urgent)}
          >
            <input
              type="checkbox"
              checked={form.is_urgent ?? false}
              onChange={(e) => set('is_urgent', e.target.checked)}
              className="w-4 h-4 accent-red-600"
              onClick={(e) => e.stopPropagation()}
            />
            <Zap className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-dark">Mark as Urgent</p>
              <p className="text-xs text-gray-500">Urgent jobs appear at the top of search results</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => { setFormError(''); setStep(1) }}
              disabled={!canAdvanceStep0}
              className="btn btn-primary"
            >
              Next: Location & Type →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Location & Type ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="font-bold text-dark">Location & Work Type</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">City *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Delhi"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </div>
            <div>
              <label className="label">State *</label>
              <select
                className="input w-full"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Work Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WORK_TYPES.map((wt) => (
                <button
                  key={wt.value}
                  type="button"
                  onClick={() => set('work_type', wt.value)}
                  className={`text-sm py-2 px-3 rounded-xl border transition-colors ${
                    form.work_type === wt.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {t(`enums.workType.${wt.value}`, { defaultValue: wt.label })}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.start_date ?? ''}
                onChange={(e) => set('start_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.end_date ?? ''}
                onChange={(e) => set('end_date', e.target.value)}
                min={form.start_date || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Number of Workers Needed *</label>
              <input
                type="number"
                min={1}
                max={500}
                className="input w-full"
                value={form.workers_needed ?? 1}
                onChange={(e) => set('workers_needed', e.target.value === '' ? 1 : parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className="label">Duration (days)</label>
              <input
                type="number"
                min={1}
                className="input w-full"
                placeholder="e.g. 30"
                value={form.duration_days ?? ''}
                onChange={(e) => set('duration_days', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-between pt-2">
            <button onClick={() => setStep(0)} className="btn btn-outline">← Back</button>
            <button
              onClick={() => { setFormError(''); setStep(2) }}
              disabled={!canAdvanceStep1}
              className="btn btn-primary"
            >
              Next: Salary →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Salary & Requirements ─────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="font-bold text-dark">Salary & Requirements</h2>
          </div>

          <div>
            <label className="label">Salary Type *</label>
            <div className="flex flex-wrap gap-2">
              {SALARY_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => set('salary_type', st.value)}
                  className={`text-sm py-2 px-4 rounded-xl border transition-colors ${
                    form.salary_type === st.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {t(`enums.salaryType.${st.value}`, { defaultValue: st.label })}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Min Salary (₹)</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                placeholder="e.g. 500"
                value={form.salary_min ?? ''}
                onChange={(e) => set('salary_min', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Max Salary (₹)</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                placeholder="e.g. 1000"
                value={form.salary_max ?? ''}
                onChange={(e) => set('salary_max', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">Experience Required (years)</label>
            <input
              type="number"
              min={0}
              max={30}
              className="input w-full"
              value={form.experience_required ?? 0}
              onChange={(e) => set('experience_required', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            />
          </div>

          <div>
            <label className="label">Additional Requirements</label>
            <textarea
              rows={3}
              className="input w-full resize-none"
              placeholder="Any specific tools, certifications, or conditions..."
              value={form.additional_requirements ?? ''}
              onChange={(e) => set('additional_requirements', e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn btn-outline">← Back</button>
            <button
              onClick={() => { setFormError(''); setStep(3) }}
              disabled={!canAdvanceStep2}
              className="btn btn-primary"
            >
              Next: Review & Publish →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Publish ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="font-bold text-dark">Review Job Details</h2>
          </div>

          <div className="bg-surface rounded-xl p-5 border border-gray-100 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Job Title</p>
                <p className="font-medium text-dark">{form.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Category</p>
                <p className="font-medium text-dark">
                  {(() => {
                    const catName = categories?.find(c => c.id === form.category_id)?.name;
                    return catName ? t(`categories.${catName}`, { defaultValue: catName }) : '';
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Location</p>
                <p className="font-medium text-dark">{form.city}, {form.state}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Work Type</p>
                <p className="font-medium text-dark">{t(`enums.workType.${form.work_type}`, { defaultValue: WORK_TYPES.find(w => w.value === form.work_type)?.label })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Salary</p>
                <p className="font-medium text-dark">
                  {form.salary_min || form.salary_max ? (
                    <>₹{form.salary_min || 0}{form.salary_max ? ` - ₹${form.salary_max}` : ''} / {t(`enums.salaryType.${form.salary_type}`, { defaultValue: SALARY_TYPES.find(s => s.value === form.salary_type)?.label })}</>
                  ) : 'Negotiable'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Experience Needed</p>
                <p className="font-medium text-dark">{form.experience_required} years</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Workers Needed</p>
                <p className="font-medium text-dark">{form.workers_needed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Schedule</p>
                <p className="font-medium text-dark">
                  {form.start_date ? new Date(form.start_date).toLocaleDateString() : 'Immediate'} 
                  {form.duration_days ? ` (${form.duration_days} days)` : ''}
                </p>
              </div>
            </div>

            {selectedSkills.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Required Skills</p>
                <div className="flex flex-wrap gap-1">
                  {selectedSkills.map(s => (
                    <span key={s.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md border">{t(`skills.${s.name}`, { defaultValue: s.name })}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-between pt-4">
            <button onClick={() => setStep(2)} className="btn btn-outline" disabled={saveMutation.isPending}>← Back</button>
            <button
              onClick={handleSubmit}
              disabled={saveMutation.isPending || !canSubmit}
              className="btn btn-primary"
            >
              {saveMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEdit ? 'Saving...' : 'Publishing...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  {isEdit ? 'Save Changes' : 'Publish Job'}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
