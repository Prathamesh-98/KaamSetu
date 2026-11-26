import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, MapPin, Phone, Mail, Globe, ShieldCheck, 
  Briefcase, Heart, Calendar, LogOut, ChevronRight, Edit3, X 
} from 'lucide-react';
import { employerApi, verificationsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { EmployerProfile } from '../../../types';
import MobileLanguageModal from '../../components/MobileLanguageModal';

export const MobileEmployerProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Profile data
  const { data: profile } = useQuery({
    queryKey: ['employer-profile', user?.id],
    queryFn: employerApi.getMyProfile,
  });

  const employerProfile = profile as EmployerProfile | null | undefined;

  const { data: verificationStatus } = useQuery({
    queryKey: ['employer-verification-status'],
    queryFn: verificationsApi.getMyStatus,
    enabled: !!user,
  });

  // Edit form states
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleOpenEdit = () => {
    if (employerProfile) {
      setOrgName(employerProfile.organization_name || employerProfile.full_name || '');
      setOrgType(employerProfile.organization_type || '');
      setCity(employerProfile.city || '');
      setState(employerProfile.state || '');
      setWebsite(employerProfile.website || '');
      setBio(employerProfile.bio || '');
    }
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await employerApi.updateProfile({
        organization_name: orgName.trim(),
        organization_type: orgType.trim(),
        city: city.trim(),
        state: state.trim(),
        website: website.trim(),
        bio: bio.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
      setEditModalOpen(false);
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isVerified = verificationStatus?.company_status === 'VERIFIED' || verificationStatus?.is_verified || false;

  return (
    <div className="p-4 space-y-4">
      {/* 1. Header Card with Company Info */}
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

        {/* Company Avatar / Logo */}
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-900 to-[#2E3C8A] text-2xl font-black text-white shadow-md">
            {employerProfile?.profile_image_url ? (
              <img
                src={employerProfile.profile_image_url}
                alt="Logo"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              (employerProfile?.organization_name?.charAt(0) || user?.email?.charAt(0) || 'E').toUpperCase()
            )}
          </div>
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
              <ShieldCheck className="h-4 w-4" />
            </div>
          )}
        </div>

        <h1 className="text-lg font-bold text-slate-900">
          {employerProfile?.organization_name || employerProfile?.full_name || 'Employer Profile'}
        </h1>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3.5 w-3.5 text-amber-600" />
          <span>{employerProfile?.city ? `${employerProfile.city}, ${employerProfile.state || 'India'}` : 'India'}</span>
        </p>

        {employerProfile?.organization_type && (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {employerProfile.organization_type}
          </span>
        )}
      </div>

      {/* 2. Menu Items */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={() => navigate('/employer/jobs')}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
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

      {/* Edit Employer Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">Edit Company Profile</h2>
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
                <label className="block font-semibold text-slate-700 mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Industry / Organization Type</label>
                <input
                  type="text"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  placeholder="e.g. Construction, Manufacturing, Contracting"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="About the business..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 mt-3"
              >
                {isUpdating ? 'Saving...' : 'Save Company Details'}
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

export default MobileEmployerProfilePage;
