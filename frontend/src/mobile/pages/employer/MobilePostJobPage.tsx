import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, AlertCircle, CheckCircle2, Camera, MapPin, Search, X,
  Zap, Check, Crosshair, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, categoriesApi, skillsApi, uploadApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { INDIAN_STATES } from '../../../utils/constants';
import type { SalaryType, WorkType, Skill, Job } from '../../../types';
import { useBackButton } from '../../hooks/useBackButton';
import { useStatusBar } from '../../hooks/useStatusBar';
import { invalidateJobSync } from '../../sync/queryKeys';

const WORK_TYPES: WorkType[] = [
  'FULL_TIME', 'PART_TIME', 'DAILY', 'HOURLY', 'PROJECT', 'TEMPORARY', 'REMOTE', 'LOCAL',
];

const SALARY_TYPES: SalaryType[] = ['HOURLY', 'DAILY', 'MONTHLY', 'PROJECT', 'FIXED'];

export const MobilePostJobPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: editJobId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editJobId);

  useBackButton();
  useStatusBar(false);

  const [step, setStep] = useState(1);

  // Step 1: Job Details
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Step 2: Location & Type
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [workType, setWorkType] = useState<WorkType>('FULL_TIME');
  const [workersNeeded, setWorkersNeeded] = useState('1');
  const [durationDays, setDurationDays] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [experienceRequired, setExperienceRequired] = useState('0');

  // Step 3: Salary & Skills
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('DAILY');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [skillQuery, setSkillQuery] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const { data: allSkills = [] } = useQuery({
    queryKey: ['skills-list-all'],
    queryFn: () => skillsApi.list(),
  });

  const { data: existingJob, isLoading: isEditLoading } = useQuery<Job>({
    queryKey: ['job-edit', editJobId],
    queryFn: () => jobsApi.get(editJobId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingJob) {
      setTitle(existingJob.title || '');
      setCategoryId(existingJob.category?.id || '');
      setDescription(existingJob.description || '');
      setImageUrl(existingJob.image_url || '');
      setAdditionalRequirements(existingJob.additional_requirements || '');
      setCity(existingJob.city || '');
      setState(existingJob.state || '');
      setLatitude(existingJob.latitude ?? undefined);
      setLongitude(existingJob.longitude ?? undefined);
      setWorkType((existingJob.work_type as WorkType) || 'FULL_TIME');
      setWorkersNeeded(String(existingJob.workers_needed ?? 1));
      setDurationDays(existingJob.duration_days ? String(existingJob.duration_days) : '');
      setStartDate(existingJob.start_date ? existingJob.start_date.slice(0, 10) : '');
      setEndDate(existingJob.end_date ? existingJob.end_date.slice(0, 10) : '');
      setExperienceRequired(String(existingJob.experience_required ?? 0));
      setSalaryMin(existingJob.salary_min != null ? String(existingJob.salary_min) : '');
      setSalaryMax(existingJob.salary_max != null ? String(existingJob.salary_max) : '');
      setSalaryType((existingJob.salary_type as SalaryType) || 'DAILY');
      setIsUrgent(Boolean(existingJob.is_urgent));
      const reqSkills = existingJob.required_skills || [];
      setSelectedSkillIds(reqSkills.map((rs: any) => rs.skill_id || rs.skill?.id || rs.id).filter(Boolean));
    }
  }, [existingJob]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return allSkills.slice(0, 25);
    return allSkills.filter(
      (s: Skill) =>
        s.name.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
    );
  }, [allSkills, skillQuery]);

  const selectedSkillObjects = useMemo(
    () => allSkills.filter((s: Skill) => selectedSkillIds.includes(s.id)),
    [allSkills, selectedSkillIds]
  );

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file (JPEG, PNG, WebP)');
      return;
    }
    setIsUploadingImg(true);
    try {
      const res = await uploadApi.uploadImage(file, 'kaamsetu/jobs');
      setImageUrl(res.url);
      toast.success('Worksite image uploaded!');
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to upload image');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error(t('mobile:jobs.locationError', 'GPS not supported on this device.'));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setIsLocating(false);
        toast.success(t('mobile:jobs.locationActive', 'GPS Active'));
      },
      () => {
        setIsLocating(false);
        toast.error(t('mobile:jobs.locationDenied', 'Location permission denied.'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const validateStep = (targetStep: number): boolean => {
    setError('');
    if (targetStep === 1) {
      if (!title.trim() || !description.trim() || !categoryId) {
        setError(t('mobile:employerFlow.requiredMissing', 'Please fill all required fields in this step.'));
        return false;
      }
    }
    if (targetStep === 2) {
      if (!city.trim() || !state.trim()) {
        setError(t('mobile:employerFlow.requiredMissing', 'Please fill city and state in this step.'));
        return false;
      }
      if (startDate && endDate && endDate < startDate) {
        setError(t('mobile:employerFlow.dateInvalid', 'End date cannot be earlier than start date.'));
        return false;
      }
    }
    if (targetStep === 3) {
      const min = salaryMin ? Number(salaryMin) : undefined;
      const max = salaryMax ? Number(salaryMax) : undefined;
      if (min != null && max != null && min > max) {
        setError(t('mobile:employerFlow.salaryInvalid', 'Minimum salary cannot exceed maximum salary.'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
    }
  };

  const handlePublish = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        category_id: categoryId,
        description: description.trim(),
        work_type: workType,
        workers_needed: Math.max(1, Number(workersNeeded) || 1),
        duration_days: durationDays ? Number(durationDays) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        experience_required: Number(experienceRequired) || 0,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_type: salaryType,
        city: city.trim(),
        state: state.trim(),
        latitude,
        longitude,
        image_url: imageUrl || undefined,
        additional_requirements: additionalRequirements.trim() || undefined,
        required_skill_ids: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
        is_urgent: isUrgent,
      };

      if (isEditMode && editJobId) {
        await jobsApi.update(editJobId, payload);
        toast.success(t('jobs.updatedSuccess', 'Job updated successfully!'));
      } else {
        await jobsApi.create(payload);
        toast.success(t('jobs.createdSuccess', 'Job published successfully!'));
      }

      await invalidateJobSync(queryClient, editJobId);
      navigate('/employer/jobs', { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err) || 'Failed to save job';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = [
    t('mobile:employerFlow.stepDetails', 'Job Details'),
    t('mobile:employerFlow.stepLocation', 'Location & Type'),
    t('mobile:employerFlow.stepSalary', 'Salary & Skills'),
    t('mobile:employerFlow.stepReview', 'Review & Publish'),
  ];

  if (isEditMode && isEditLoading) {
    return (
      <div className="mobile-fullscreen-editor p-6 space-y-4">
        <div className="h-12 rounded-2xl mobile-skeleton" />
        <div className="h-48 rounded-2xl mobile-skeleton" />
        <div className="h-48 rounded-2xl mobile-skeleton" />
      </div>
    );
  }

  return (
    <div className="mobile-fullscreen-editor">
      {/* Header */}
      <div className="mobile-header-safe bg-white border-b border-slate-200">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
            aria-label={t('mobile:common.back', 'Back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-extrabold text-slate-900">
              {isEditMode
                ? t('mobile:employerFlow.editJob', 'Edit Job Posting')
                : t('mobile:employerFlow.createJob', 'Post a New Job')}
            </h1>
            <p className="text-[11px] font-semibold text-indigo-700">
              {t('mobile:employerFlow.stepCount', {
                current: step,
                total: 4,
                defaultValue: `Step ${step} of 4`,
              })}{' '}
              · {stepLabels[step - 1]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mobile-touch-target rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('mobile:common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 4-step Progress Bar */}
        <div className="grid grid-cols-4 gap-1 px-4 pb-2.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-colors ${
                n <= step ? 'bg-indigo-900' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full pb-28">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t('jobs.title', 'Job Title')} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Experienced House Mason"
                className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t('jobs.category', 'Job Category')} *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
              >
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t('jobs.description', 'Job Description & Work Details')} *
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe tasks, site timings, tools required..."
                className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t('mobile:employerFlow.additionalReqs', 'Additional Requirements (Optional)')}
              </label>
              <textarea
                rows={2}
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                placeholder={t('mobile:employerFlow.additionalReqsPlaceholder', 'Tools needed, shift timings, accommodation details...')}
                className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t('mobile:employerFlow.jobPhoto', 'Worksite / Job Photo (Optional)')}
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-3 px-4 font-bold text-indigo-900 cursor-pointer">
                  {isUploadingImg ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span>{imageUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                </label>
                {imageUrl && (
                  <div className="relative h-14 w-14 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                    <img src={imageUrl} alt="Job" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-0.5 right-0.5 rounded-full bg-slate-900/70 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t('common.city', 'City')} *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t('common.state', 'State')} *</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                >
                  <option value="">{t('common.selectState', 'Select State')}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCaptureGps}
              disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 px-3 font-bold text-indigo-900"
            >
              {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              <span>
                {latitude != null
                  ? `${t('mobile:jobs.locationActive', 'GPS Active')} (${latitude.toFixed(3)}, ${longitude?.toFixed(3)})`
                  : t('mobile:jobs.useMyLocation', 'Use My Location')}
              </span>
            </button>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">{t('jobs.workType', 'Work Type')}</label>
              <div className="grid grid-cols-2 gap-2">
                {WORK_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => setWorkType(wt)}
                    className={`rounded-xl py-2.5 px-3 font-bold border text-left transition-colors ${
                      workType === wt
                        ? 'bg-indigo-900 text-white border-indigo-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {wt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('mobile:employerFlow.workersNeeded', 'Workers')}</label>
                <input
                  type="number"
                  min={1}
                  value={workersNeeded}
                  onChange={(e) => setWorkersNeeded(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white min-h-[42px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('mobile:employerFlow.expRequired', 'Min Exp')}</label>
                <input
                  type="number"
                  min={0}
                  value={experienceRequired}
                  onChange={(e) => setExperienceRequired(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white min-h-[42px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('mobile:employerFlow.durationDays', 'Days')}</label>
                <input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white min-h-[42px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('mobile:employerFlow.startDate', 'Start Date')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white min-h-[42px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('mobile:employerFlow.endDate', 'End Date')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white min-h-[42px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t('jobs.minWage', 'Min Wage (₹)')}</label>
                <input
                  type="number"
                  min={0}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="600"
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white min-h-[44px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t('jobs.maxWage', 'Max Wage (₹)')}</label>
                <input
                  type="number"
                  min={0}
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="950"
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">{t('jobs.wageType', 'Pay Period')}</label>
              <div className="flex flex-wrap gap-2">
                {SALARY_TYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSalaryType(st)}
                    className={`rounded-xl px-3 py-2 font-bold border ${
                      salaryType === st
                        ? 'bg-indigo-900 text-white border-indigo-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Required Skills Search & Selection */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">
                {t('mobile:employerFlow.selectedSkills', 'Required Skills')} ({selectedSkillIds.length})
              </label>

              {selectedSkillObjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkillObjects.map((sk: Skill) => (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => toggleSkill(sk.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-900 px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      <span>{sk.name}</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder={t('mobile:employerFlow.searchSkills', 'Search and add required skills...')}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 bg-white min-h-[44px]"
                />
              </div>

              <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                {filteredSkills.map((sk: Skill) => {
                  const active = selectedSkillIds.includes(sk.id);
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => toggleSkill(sk.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {sk.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-amber-50/70 p-3.5 border border-amber-200">
              <div className="flex items-center gap-2.5">
                <Zap className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {t('mobile:employerFlow.markUrgent', 'Mark as Urgent Hiring')}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t('mobile:employerFlow.markUrgentDesc', 'Highlights listing to nearby workers immediately')}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-amber-600"
              />
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div className="space-y-3 text-xs">
            <div className="mobile-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
                  <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    {city}, {state} · {workType.replace('_', ' ')}
                  </p>
                </div>
                {isUrgent && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                    URGENT
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Pay</span>
                  <span className="font-extrabold text-indigo-900">
                    ₹{salaryMin || 0}–{salaryMax || 0} / {salaryType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Openings</span>
                  <span className="font-bold text-slate-800">{workersNeeded}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Min Exp</span>
                  <span className="font-bold text-slate-800">{experienceRequired} yrs</span>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{description}</p>

              {selectedSkillObjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedSkillObjects.map((sk: Skill) => (
                    <span
                      key={sk.id}
                      className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-800"
                    >
                      {sk.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="mobile-sticky-footer">
        <div className="flex gap-2.5 max-w-lg mx-auto w-full">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
            >
              {t('mobile:employerFlow.back', 'Back')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
            >
              {t('mobile:common.cancel', 'Cancel')}
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-[2] rounded-xl bg-indigo-900 py-3 text-xs font-extrabold text-white shadow-md min-h-[48px]"
            >
              {t('mobile:employerFlow.next', 'Next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-md flex items-center justify-center gap-1.5 min-h-[48px] disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>{t('mobile:employerFlow.publishing', 'Publishing...')}</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {isEditMode
                      ? t('mobile:employerFlow.saveUpdate', 'Save Changes')
                      : t('mobile:employerFlow.publish', 'Publish Job')}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePostJobPage;
