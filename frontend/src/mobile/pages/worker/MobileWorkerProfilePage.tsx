import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, MapPin, Phone, Mail, Award, CheckCircle2, Star, 
  FileText, Bookmark, Calendar, Globe, LogOut, ChevronRight, 
  Edit3, ShieldCheck, DollarSign, Clock, Camera, AlertCircle, X 
} from 'lucide-react';
import { workerApi, verificationsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { WorkerProfile } from '../../../types';
import MobileLanguageModal from '../../components/MobileLanguageModal';

export const MobileWorkerProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Profile data
  const { data: profile } = useQuery({
    queryKey: ['worker-profile', user?.id],
    queryFn: workerApi.getMyProfile,
  });

  const workerProfile = profile as WorkerProfile | null | undefined;

  // Verification status
  const { data: verificationStatus } = useQuery({
    queryKey: ['worker-verification-status'],
    queryFn: verificationsApi.getMyStatus,
    enabled: !!user,
  });

  // Form states for edit profile
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleOpenEdit = () => {
    if (workerProfile) {
      setFullName(workerProfile.full_name || '');
      setCity(workerProfile.city || '');
      setState(workerProfile.state || '');
      setExpectedSalary(workerProfile.expected_salary ? String(workerProfile.expected_salary) : '');
      setBio(workerProfile.bio || '');
      setYearsExperience(workerProfile.years_experience !== null ? String(workerProfile.years_experience) : '');
    }
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await workerApi.updateProfile({
        full_name: fullName.trim(),
        city: city.trim(),
        state: state.trim(),
        expected_salary: expectedSalary ? Number(expectedSalary) : undefined,
        bio: bio.trim(),
        years_experience: yearsExperience ? Number(yearsExperience) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      setEditModalOpen(false);
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!workerProfile) return;
    const nextStatus = workerProfile.availability_status === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      await workerApi.updateProfile({ availability_status: nextStatus as any });
      queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isVerified = verificationStatus?.is_identity_verified || false;

  return (
    <div className="p-4 space-y-4">
      {/* 1. Header Card with Avatar & Verification */}
      <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={handleOpenEdit}
            className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
            aria-label="Edit Profile"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Avatar */}
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-900 to-[#2E3C8A] text-2xl font-black text-white shadow-md">
            {workerProfile?.profile_image_url ? (
              <img
                src={workerProfile.profile_image_url}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              (workerProfile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'W').toUpperCase()
            )}
          </div>
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}
        </div>

        <h1 className="text-lg font-bold text-slate-900">{workerProfile?.full_name || 'Worker Profile'}</h1>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3.5 w-3.5 text-amber-600" />
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
            className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-colors ${
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
            <span className="text-[10px] uppercase font-bold text-slate-400">Daily Wage</span>
            <span className="text-xs font-extrabold text-indigo-900 mt-0.5">
              ₹{workerProfile?.expected_salary ? `${workerProfile.expected_salary}/day` : 'Negotiable'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Skills Section */}
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          {t('worker.skills', 'My Skills & Trades')}
        </h3>
        {workerProfile?.skills && workerProfile.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {workerProfile.skills.map((skill: any, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 border border-indigo-100"
              >
                <span>{typeof skill === 'string' ? skill : skill.skill?.name || skill.name}</span>
                {skill.years_experience && (
                  <span className="text-[10px] text-indigo-600/80 font-normal">({skill.years_experience}y)</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No skills added yet. Tap edit to update your trade skills.</p>
        )}
      </div>

      {/* 3. Navigation Menu Items */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={() => navigate('/worker/applications')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
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

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">Edit Worker Profile</h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Daily Wage (₹)</label>
                  <input
                    type="number"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 800"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years Experience</label>
                  <input
                    type="number"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Short Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell employers about your skills and experience..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 mt-3"
              >
                {isUpdating ? 'Saving...' : 'Save Profile Changes'}
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
