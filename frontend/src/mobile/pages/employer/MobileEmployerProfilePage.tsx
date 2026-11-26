import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, MapPin, Phone, Mail, Globe, ShieldCheck, Shield, 
  Briefcase, Heart, Calendar, LogOut, ChevronRight, Edit3, X, 
  Camera, UploadCloud, AlertCircle, Clock, CheckCircle2, ArrowLeft 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { employerApi, verificationsApi, uploadApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { EmployerProfile, VerificationRecord } from '../../../types';
import MobileLanguageModal from '../../components/MobileLanguageModal';
import { useStatusBar } from '../../hooks/useStatusBar';
import { INDIAN_STATES } from '../../../utils/constants';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const MobileEmployerProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  useStatusBar(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Profile data query
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['employer-profile', user?.id],
    queryFn: employerApi.getMyProfile,
  });

  const employerProfile = profile as EmployerProfile | null | undefined;

  // Verification status query
  const { data: statusSummary } = useQuery({
    queryKey: ['employer-verification-status'],
    queryFn: verificationsApi.getMyStatus,
    enabled: !!user,
  });

  // Verification history query
  const { data: history = [] } = useQuery({
    queryKey: ['employer-verification-history'],
    queryFn: verificationsApi.getMyHistory,
    enabled: !!user,
  });

  const isVerified = statusSummary?.company_status === 'VERIFIED' || employerProfile?.is_verified || false;
  const companyStatus = statusSummary?.company_status || (isVerified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const latestCompanyRecord = history.find((r: VerificationRecord) => r.verification_type === 'PROFILE');

  // Edit form states
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [formError, setFormError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Verification form states
  const [vOrgName, setVOrgName] = useState('');
  const [vOrgType, setVOrgType] = useState('Private Limited');
  const [taxId, setTaxId] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [vNotes, setVNotes] = useState('');
  const [vError, setVError] = useState('');
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  // ── Logo Upload ────────────────────────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be under 5MB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const uploadRes = await uploadApi.uploadImage(file, 'kaamsetu/employers');
      await employerApi.updateProfile({ profile_image_url: uploadRes.url });
      await queryClient.invalidateQueries({ queryKey: ['employer-profile', user?.id] });
      toast.success('Company logo updated successfully!');
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // ── Open Edit Modal ────────────────────────────────────────────────────────
  const handleOpenEdit = () => {
    setFormError('');
    if (employerProfile) {
      setOrgName(employerProfile.organization_name || '');
      setFullName(employerProfile.full_name || '');
      setOrgType(employerProfile.organization_type || '');
      setCity(employerProfile.city || '');
      setState(employerProfile.state || '');
      setWebsite(employerProfile.website || '');
      setBio(employerProfile.bio || '');
    }
    setEditModalOpen(true);
  };

  // ── Save Profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!orgName.trim() && !fullName.trim()) {
      const msg = 'Company or Contact Person name is required';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setIsUpdating(true);
    try {
      await employerApi.updateProfile({
        organization_name: orgName.trim(),
        full_name: fullName.trim() || orgName.trim(),
        organization_type: orgType.trim(),
        city: city.trim(),
        state: state.trim(),
        website: website.trim(),
        bio: bio.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['employer-profile', user?.id] });
      toast.success('Company profile updated successfully!');
      setEditModalOpen(false);
    } catch (err) {
      const msg = extractErrorMessage(err) || 'Failed to update company profile';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Open Verification Modal ───────────────────────────────────────────────
  const handleOpenVerification = () => {
    setVOrgName(employerProfile?.organization_name || '');
    setVOrgType(employerProfile?.organization_type || 'Private Limited');
    setTaxId('');
    setDocFile(null);
    setVNotes('');
    setVError('');
    setVerificationModalOpen(true);
  };

  // ── Submit Company Verification ───────────────────────────────────────────
  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setVError('Please select a business registration or GST certificate document');
      return;
    }
    setIsSubmittingCompany(true);
    setVError('');
    try {
      await verificationsApi.submitCompany(
        docFile,
        vOrgName.trim() || undefined,
        vOrgType.trim() || undefined,
        taxId.trim() || undefined,
        vNotes.trim() || undefined
      );
      await queryClient.invalidateQueries({ queryKey: ['employer-verification-status'] });
      await queryClient.invalidateQueries({ queryKey: ['employer-verification-history'] });
      toast.success('Company verification documents submitted!');
      setVerificationModalOpen(false);
    } catch (err) {
      setVError(extractErrorMessage(err) || 'Failed to submit verification');
    } finally {
      setIsSubmittingCompany(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Hidden File Input for Logo */}
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoSelect}
        accept="image/*"
        className="hidden"
      />

      {/* 1. Header Card with Company Info */}
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

        {/* Company Avatar / Logo with Camera Button */}
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-900 to-[#2E3C8A] text-2xl font-black text-white shadow-md overflow-hidden">
            {employerProfile?.profile_image_url ? (
              <img
                src={employerProfile.profile_image_url}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              (employerProfile?.organization_name?.charAt(0) || user?.email?.charAt(0) || 'E').toUpperCase()
            )}
          </div>

          {/* Camera Upload Button */}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={isUploadingLogo}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-900 text-white shadow-md border-2 border-white active:scale-90 transition-transform disabled:opacity-50"
            aria-label="Change Company Logo"
          >
            {isUploadingLogo ? (
              <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <h1 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-1.5">
          <span>{employerProfile?.organization_name || employerProfile?.full_name || 'Employer Profile'}</span>
          {isVerified && (
            <span title="Verified Company" className="inline-flex items-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            </span>
          )}
        </h1>

        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span>{employerProfile?.city ? `${employerProfile.city}, ${employerProfile.state || 'India'}` : 'India'}</span>
        </p>

        {employerProfile?.organization_type && (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {employerProfile.organization_type}
          </span>
        )}
      </div>

      {/* 2. Trust & Verification Status Banner */}
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Company Verification
            </h3>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            companyStatus === 'VERIFIED'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : companyStatus === 'PENDING'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : companyStatus === 'REJECTED'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {companyStatus}
          </span>
        </div>

        {companyStatus === 'VERIFIED' ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Company documents verified. Your job postings receive prominent trust badges.</span>
          </div>
        ) : companyStatus === 'PENDING' ? (
          <div className="flex items-start gap-2 text-xs text-amber-700 font-medium mt-1">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Registration documents under review by KaamSetu administrators. Usually verified within 24 hours.</span>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-600 mb-2.5">
              {companyStatus === 'REJECTED'
                ? `Verification was rejected: ${latestCompanyRecord?.rejection_reason || 'Please submit valid incorporation or GST documents.'}`
                : 'Upload your GSTIN, Certificate of Incorporation, or MSME registration to earn verified status.'}
            </p>
            <button
              type="button"
              onClick={handleOpenVerification}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <UploadCloud className="h-4 w-4" />
              <span>{companyStatus === 'REJECTED' ? 'Resubmit Business Documents' : 'Verify Company Now'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Menu Items */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={() => navigate('/employer/jobs')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-900">
              <Briefcase className="h-4 w-4" />
            </div>
            <span>Posted Jobs Management</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/employer/saved-workers')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <Heart className="h-4 w-4" />
            </div>
            <span>Saved Workers</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/employer/shifts')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Calendar className="h-4 w-4" />
            </div>
            <span>Shifts & Settlement</span>
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

      {/* ── Edit Employer Profile Full-Screen Mobile Editor (Covers bottom navigation completely) ── */}
      {editModalOpen && (
        <div className="mobile-fullscreen-editor">
          {/* Top Sticky Header */}
          <div className="mobile-header-safe bg-white border-b border-slate-200">
            <div className="flex h-14 items-center justify-between px-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100 flex items-center gap-1 font-semibold text-xs active:scale-95"
                aria-label="Cancel"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Cancel</span>
              </button>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                Edit Company Profile
              </h1>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isUpdating}
                className="text-xs font-extrabold text-indigo-900 px-3 py-1.5 hover:underline disabled:opacity-50 active:scale-95"
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Separately Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
            {formError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 shadow-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
                <span className="font-medium leading-relaxed">{formError}</span>
              </div>
            )}

            <form id="employer-profile-form" onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Company / Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Construction Services"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Contact Person Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Primary contact name"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Industry / Organization Type</label>
                <input
                  type="text"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  placeholder="e.g. Construction, Manufacturing, Logistics"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Company About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell workers about your business, projects, and work opportunities..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none leading-relaxed"
                />
              </div>
            </form>
          </div>

          {/* Permanently Accessible Sticky Action Footer */}
          <div className="mobile-sticky-footer">
            <div className="flex items-center gap-3 max-w-lg mx-auto w-full">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={isUpdating}
                className="mobile-touch-target flex-1 rounded-xl border border-slate-300 py-3 text-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-transform min-h-[48px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="employer-profile-form"
                disabled={isUpdating}
                className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2 min-h-[48px]"
              >
                {isUpdating ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Company...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Company Verification Modal ──────────────────────────────────────── */}
      {verificationModalOpen && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-sheet max-h-[90vh] max-h-[90dvh]">
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-900" />
                <h2 className="text-base font-extrabold text-slate-900">Company Verification</h2>
              </div>
              <button
                type="button"
                onClick={() => setVerificationModalOpen(false)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {vError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{vError}</span>
                </div>
              )}

              <form id="employer-verification-form" onSubmit={handleSubmitCompany} className="space-y-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Organization Name *</label>
                  <input
                    type="text"
                    value={vOrgName}
                    onChange={(e) => setVOrgName(e.target.value)}
                    placeholder="Registered legal company name"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Organization Type</label>
                  <select
                    value={vOrgType}
                    onChange={(e) => setVOrgType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  >
                    <option value="Private Limited">Private Limited</option>
                    <option value="Proprietorship">Proprietorship</option>
                    <option value="Partnership / LLP">Partnership / LLP</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="Contractor / Individual">Contractor / Individual</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">GSTIN / Tax ID / CIN</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Registration Document (GST / CIN / MSME) *</label>
                  <input
                    type="file"
                    ref={docFileInputRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (!ALLOWED_MIME_TYPES.includes(f.type)) {
                          setVError('Please select a PDF, JPEG, PNG, or WebP document');
                          return;
                        }
                        if (f.size > MAX_FILE_SIZE_BYTES) {
                          setVError('File size must be under 5MB');
                          return;
                        }
                        setVError('');
                        setDocFile(f);
                      }
                    }}
                    accept="image/*,application/pdf"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white focus:outline-none min-h-[44px]"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">PDF, JPG, PNG or WebP (max 5MB)</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Notes / Registration Details</label>
                  <input
                    type="text"
                    value={vNotes}
                    onChange={(e) => setVNotes(e.target.value)}
                    placeholder="Additional registration or verification notes..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none min-h-[44px]"
                  />
                </div>
              </form>
            </div>

            {/* Sticky Action Footer */}
            <div className="mobile-sticky-footer">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVerificationModalOpen(false)}
                  disabled={isSubmittingCompany}
                  className="mobile-touch-target flex-1 rounded-xl border border-slate-300 py-3 text-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-transform min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="employer-verification-form"
                  disabled={isSubmittingCompany}
                  className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 min-h-[48px]"
                >
                  {isSubmittingCompany ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading Documents...</span>
                    </>
                  ) : (
                    <span>Submit Company Verification</span>
                  )}
                </button>
              </div>
            </div>
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

export default MobileEmployerProfilePage;