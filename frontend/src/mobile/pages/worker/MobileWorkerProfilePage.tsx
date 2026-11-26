import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, MapPin, Phone, Mail, Award, CheckCircle2, Star, 
  FileText, Bookmark, Calendar, Globe, LogOut, ChevronRight, 
  Edit3, ShieldCheck, Shield, Clock, Camera, AlertCircle, X, 
  Plus, Search, RefreshCw, UploadCloud, Check 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { workerApi, verificationsApi, uploadApi, skillsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { 
  WorkerProfile, SalaryType, AvailabilityStatus, Skill, VerificationRecord, WorkerProfilePayload 
} from '../../../types';
import MobileLanguageModal from '../../components/MobileLanguageModal';
import { useStatusBar } from '../../hooks/useStatusBar';
import { INDIAN_STATES } from '../../../utils/constants';

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'HOURLY', label: 'Per Hour' },
  { value: 'DAILY', label: 'Per Day' },
  { value: 'MONTHLY', label: 'Per Month' },
  { value: 'PROJECT', label: 'Per Project' },
  { value: 'FIXED', label: 'Fixed' },
];

const WORK_TYPE_OPTIONS = [
  'FULL_TIME', 'PART_TIME', 'DAILY', 'HOURLY', 'PROJECT', 'TEMPORARY', 'REMOTE', 'LOCAL',
];

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const MobileWorkerProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  useStatusBar(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  // Upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Profile data query
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['worker-profile', user?.id],
    queryFn: workerApi.getMyProfile,
  });

  const workerProfile = profile as WorkerProfile | null | undefined;

  // Verification status query
  const { data: statusSummary } = useQuery({
    queryKey: ['worker-verification-status'],
    queryFn: verificationsApi.getMyStatus,
    enabled: !!user,
  });

  // Verification history query
  const { data: history = [] } = useQuery({
    queryKey: ['worker-verification-history'],
    queryFn: verificationsApi.getMyHistory,
    enabled: !!user,
  });

  const isVerified = statusSummary?.is_identity_verified || (workerProfile as any)?.is_verified || false;
  const identityStatus = statusSummary?.identity_status || (isVerified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const latestIdRecord = history.find((r: VerificationRecord) => r.verification_type === 'IDENTITY');

  // Form states for profile edit
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('DAILY');
  const [yearsExperience, setYearsExperience] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('AVAILABLE');
  const [preferredWorkTypes, setPreferredWorkTypes] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Skill state
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedProficiency, setSelectedProficiency] = useState<'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'>('INTERMEDIATE');
  const [selectedYears, setSelectedYears] = useState('1');

  // Available skills query
  const { data: availableSkills = [] } = useQuery({
    queryKey: ['skills-list', skillSearch],
    queryFn: () => skillsApi.list(skillSearch.trim() || undefined),
    enabled: skillModalOpen,
  });

  // Identity verification form state
  const [idDocType, setIdDocType] = useState('DRIVING_LICENSE');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idNotes, setIdNotes] = useState('');
  const [idError, setIdError] = useState('');
  const [isSubmittingId, setIsSubmittingId] = useState(false);

  // ── Profile Photo Upload ──────────────────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be under 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploadRes = await uploadApi.uploadImage(file, 'kaamsetu/workers');
      await workerApi.updateProfile({ profile_image_url: uploadRes.url });
      await queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] });
      toast.success('Profile photo updated successfully!');
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Open Edit Modal ────────────────────────────────────────────────────────
  const handleOpenEdit = () => {
    if (workerProfile) {
      setFullName(workerProfile.full_name || '');
      setCity(workerProfile.city || '');
      setState(workerProfile.state || '');
      setExpectedSalary(workerProfile.expected_salary ? String(workerProfile.expected_salary) : '');
      setSalaryType((workerProfile.salary_type as SalaryType) || 'DAILY');
      setYearsExperience(workerProfile.years_experience !== null ? String(workerProfile.years_experience) : '');
      setAvailabilityStatus(workerProfile.availability_status || 'AVAILABLE');
      setPreferredWorkTypes(workerProfile.preferred_work_types || []);
      setBio(workerProfile.bio || '');
    }
    setEditModalOpen(true);
  };

  const toggleWorkType = (wt: string) => {
    setPreferredWorkTypes((prev) =>
      prev.includes(wt) ? prev.filter((item) => item !== wt) : [...prev, wt]
    );
  };

  // ── Save Profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    setIsUpdating(true);
    try {
      const payload: Partial<WorkerProfilePayload> = {
        full_name: fullName.trim(),
        city: city.trim(),
        state: state.trim(),
        expected_salary: expectedSalary ? Number(expectedSalary) : undefined,
        salary_type: salaryType,
        years_experience: yearsExperience ? Number(yearsExperience) : 0,
        availability_status: availabilityStatus,
        preferred_work_types: preferredWorkTypes,
        bio: bio.trim(),
      };
      await workerApi.updateProfile(payload);
      await queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] });
      toast.success('Profile updated successfully!');
      setEditModalOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Toggle Availability ────────────────────────────────────────────────────
  const handleToggleAvailability = async () => {
    if (!workerProfile) return;
    const current = workerProfile.availability_status;
    const nextStatus: AvailabilityStatus = current === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      await workerApi.updateProfile({ availability_status: nextStatus });
      await queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] });
      toast.success(`Status changed to ${nextStatus === 'AVAILABLE' ? 'Available' : 'Busy'}`);
    } catch (err) {
      toast.error('Failed to change status');
    }
  };

  // ── Skills Management ─────────────────────────────────────────────────────
  const addSkillMutation = useMutation({
    mutationFn: ({ skillId, proficiency, years }: { skillId: string; proficiency: string; years: number }) =>
      workerApi.addSkill(skillId, proficiency, years),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] });
      toast.success('Skill added successfully!');
      setSkillModalOpen(false);
      setSkillSearch('');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err) || 'Failed to add skill');
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => workerApi.removeSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-profile', user?.id] });
      toast.success('Skill removed');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err) || 'Failed to remove skill');
    },
  });

  // ── Submit Identity Verification ──────────────────────────────────────────
  const handleSubmitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFile) {
      setIdError('Please select a government ID document');
      return;
    }
    setIsSubmittingId(true);
    setIdError('');
    try {
      await verificationsApi.submitIdentity(idFile, idDocType, idNotes.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      await queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
      toast.success('Identity document submitted for review!');
      setVerificationModalOpen(false);
      setIdFile(null);
      setIdNotes('');
    } catch (err) {
      setIdError(extractErrorMessage(err) || 'Failed to submit verification document');
    } finally {
      setIsSubmittingId(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const workerSkills = workerProfile?.skills || [];

  return (
    <div className="p-4 space-y-4">
      {/* Hidden Photo File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/*"
        className="hidden"
      />

      {/* 1. Header Card with Avatar & Verification */}
      <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={handleOpenEdit}
            className="mobile-touch-target rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 active:scale-95 transition-transform"
            aria-label="Edit Profile"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Avatar with Camera Button */}
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-900 to-[#2E3C8A] text-2xl font-black text-white shadow-md overflow-hidden">
            {workerProfile?.profile_image_url ? (
              <img
                src={workerProfile.profile_image_url}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              (workerProfile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'W').toUpperCase()
            )}
          </div>

          {/* Camera Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-900 text-white shadow-md border-2 border-white active:scale-90 transition-transform disabled:opacity-50"
            aria-label="Change Profile Photo"
          >
            {isUploadingPhoto ? (
              <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <h1 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-1.5">
          <span>{workerProfile?.full_name || 'Worker Profile'}</span>
          {isVerified && (
            <span title="Verified Worker" className="inline-flex items-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            </span>
          )}
        </h1>

        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span>{workerProfile?.city ? `${workerProfile.city}, ${workerProfile.state || 'India'}` : 'India'}</span>
        </p>

        {/* Ratings preview */}
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-100">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          <span>{workerProfile?.average_rating ? workerProfile.average_rating.toFixed(1) : '5.0'}</span>
          <span className="text-amber-600/70 font-normal">({workerProfile?.total_ratings || 0} reviews)</span>
        </div>

        {/* Quick status & wage pills */}
        <div className="mt-4 grid grid-cols-2 gap-2 w-full pt-3 border-t border-slate-100">
          {/* Availability Toggle */}
          <button
            type="button"
            onClick={handleToggleAvailability}
            className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-colors active:scale-98 ${
              workerProfile?.availability_status === 'AVAILABLE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
            <span className="text-xs font-extrabold mt-0.5 flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${workerProfile?.availability_status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {workerProfile?.availability_status === 'AVAILABLE' ? 'Available' : 'Busy'}
            </span>
          </button>

          {/* Expected Wage */}
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {workerProfile?.salary_type ? `Wage (${workerProfile.salary_type.toLowerCase()})` : 'Expected Wage'}
            </span>
            <span className="text-xs font-extrabold text-indigo-900 mt-0.5">
              ₹{workerProfile?.expected_salary ? `${workerProfile.expected_salary}` : 'Negotiable'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Trust & Verification Status Banner */}
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Trust & Verification
            </h3>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            identityStatus === 'VERIFIED'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : identityStatus === 'PENDING'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : identityStatus === 'REJECTED'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {identityStatus}
          </span>
        </div>

        {identityStatus === 'VERIFIED' ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Government ID verified. Your profile receives top employer trust.</span>
          </div>
        ) : identityStatus === 'PENDING' ? (
          <div className="flex items-start gap-2 text-xs text-amber-700 font-medium mt-1">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Document under review by KaamSetu administrators. Usually verified within 24 hours.</span>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-600 mb-2.5">
              {identityStatus === 'REJECTED'
                ? `Verification was rejected: ${latestIdRecord?.rejection_reason || 'Please submit a clear government ID.'}`
                : 'Upload your Aadhaar, Voter ID, Driving License or Trade License to get verified and attract more employers.'}
            </p>
            <button
              type="button"
              onClick={() => setVerificationModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <UploadCloud className="h-4 w-4" />
              <span>{identityStatus === 'REJECTED' ? 'Resubmit Government ID' : 'Verify Identity Now'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Skills & Trades Section */}
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('worker.skills', 'My Skills & Trades')}
          </h3>
          <button
            type="button"
            onClick={() => setSkillModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Skill</span>
          </button>
        </div>

        {workerSkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {workerSkills.map((item: any) => {
              const skillId = item.skill?.id || item.skill_id || item.id;
              const skillName = item.skill?.name || item.name || 'Skill';
              const isDeleting = removeSkillMutation.isPending && removeSkillMutation.variables === skillId;
              return (
                <span
                  key={item.id || skillId}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 pl-3 pr-1.5 py-1 text-xs font-semibold text-indigo-900 border border-indigo-100"
                >
                  <span>{skillName}</span>
                  {item.years_experience && (
                    <span className="text-[10px] text-indigo-600 font-normal">({item.years_experience}y)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSkillMutation.mutate(skillId)}
                    disabled={isDeleting}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-md active:scale-90"
                    title="Remove skill"
                  >
                    {isDeleting ? (
                      <span className="h-3 w-3 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No skills added yet. Tap "Add Skill" to highlight your work expertise.</p>
        )}
      </div>

      {/* 4. Preferred Work Types (if present) */}
      {workerProfile?.preferred_work_types && workerProfile.preferred_work_types.length > 0 && (
        <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Preferred Work Types
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {workerProfile.preferred_work_types.map((wt: string) => (
              <span
                key={wt}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700"
              >
                {wt.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. Navigation Menu Items */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={() => navigate('/worker/applications')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <FileText className="h-4 w-4" />
            </div>
            <span>{t('nav.myApplications', 'My Applications')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/worker/saved-jobs')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <Bookmark className="h-4 w-4" />
            </div>
            <span>{t('nav.savedJobs', 'Saved Jobs')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/worker/shifts')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Calendar className="h-4 w-4" />
            </div>
            <span>{t('worker.shifts', 'Shifts & Work History')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setLangModalOpen(true)}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-900">
              <Globe className="h-4 w-4" />
            </div>
            <span>{t('nav.selectLanguage', 'App Language')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 active:bg-red-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <LogOut className="h-4 w-4" />
            </div>
            <span>{t('nav.logout', 'Sign Out')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-red-400" />
        </button>
      </div>

      {/* ── Edit Profile Modal ──────────────────────────────────────────────── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-900">Edit Worker Profile</h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Wage (₹)</label>
                  <input
                    type="number"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 800"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wage Type</label>
                  <select
                    value={salaryType}
                    onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none"
                  >
                    {SALARY_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years Experience</label>
                  <input
                    type="number"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Availability</label>
                  <select
                    value={availabilityStatus}
                    onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BUSY">Busy</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Preferred Work Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {WORK_TYPE_OPTIONS.map((wt) => {
                    const isSelected = preferredWorkTypes.includes(wt);
                    return (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => toggleWorkType(wt)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                          isSelected
                            ? 'bg-indigo-900 text-white border-indigo-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {wt.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bio & Experience Summary</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell employers about your skills, past projects, and specializations..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 mt-3"
              >
                {isUpdating ? 'Saving Profile...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Skill Modal ─────────────────────────────────────────────────── */}
      {skillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <h2 className="text-base font-extrabold text-slate-900">Add Skill or Trade</h2>
              <button
                type="button"
                onClick={() => setSkillModalOpen(false)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Search skills (e.g. Masonry, Plumbing, Carpentry)..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs focus:border-indigo-900 focus:outline-none"
              />
            </div>

            {/* Skills List */}
            <div className="flex-1 overflow-y-auto max-h-60 space-y-1.5 divide-y divide-slate-50">
              {availableSkills.map((sk: Skill) => {
                const hasSkill = workerSkills.some((ws: any) => (ws.skill?.id || ws.skill_id) === sk.id);
                return (
                  <div
                    key={sk.id}
                    className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{sk.name}</h4>
                      <span className="text-[10px] text-slate-400">{sk.category}</span>
                    </div>

                    <button
                      type="button"
                      disabled={hasSkill || addSkillMutation.isPending}
                      onClick={() =>
                        addSkillMutation.mutate({
                          skillId: sk.id,
                          proficiency: selectedProficiency,
                          years: Number(selectedYears) || 1,
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                        hasSkill
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-900 text-white active:scale-95'
                      }`}
                    >
                      {hasSkill ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Identity Verification Modal ─────────────────────────────────────── */}
      {verificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-900" />
                <h2 className="text-base font-extrabold text-slate-900">Government ID Verification</h2>
              </div>
              <button
                type="button"
                onClick={() => setVerificationModalOpen(false)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {idError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{idError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitIdentity} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Type *</label>
                <select
                  value={idDocType}
                  onChange={(e) => setIdDocType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none"
                >
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="VOTER_ID">Voter ID Card (EPIC)</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="TRADE_LICENSE">Trade / Labor License</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Upload Document File *</label>
                <input
                  type="file"
                  ref={idFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (!ALLOWED_MIME_TYPES.includes(f.type)) {
                        setIdError('Please select a PDF, JPEG, PNG, or WebP document');
                        return;
                      }
                      if (f.size > MAX_FILE_SIZE_BYTES) {
                        setIdError('File size must be under 5MB');
                        return;
                      }
                      setIdError('');
                      setIdFile(f);
                    }
                  }}
                  accept="image/*,application/pdf"
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">PDF, JPG, PNG or WebP (max 5MB)</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional Notes (Optional)</label>
                <input
                  type="text"
                  value={idNotes}
                  onChange={(e) => setIdNotes(e.target.value)}
                  placeholder="Document number or extra notes..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingId}
                className="w-full rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 mt-3 flex items-center justify-center gap-2"
              >
                {isSubmittingId ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading Document...</span>
                  </>
                ) : (
                  <span>Submit for Verification</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Language Modal */}
      <MobileLanguageModal
        isOpen={langModalOpen}
        onClose={() => setLangModalOpen(false)}
      />
    </div>
  );
};

export default MobileWorkerProfilePage;