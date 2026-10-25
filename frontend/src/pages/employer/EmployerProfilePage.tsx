import React, { useState, useEffect } from 'react'
import { Save, User, Building, MapPin, Briefcase, Globe, AlertCircle, CheckCircle, Star, BadgeCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { employerApi } from '../../api/services'
import type { EmployerProfile } from '../../types'
import ImageUploader from '../../components/ImageUploader'
import { INDIAN_STATES } from '../../utils/constants';
import { EmployerVerificationCenter } from '../../components/verification/EmployerVerificationCenter';
import { CompanyVerifiedBadge } from '../../components/verification/TrustBadges';

export default function EmployerProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Partial<EmployerProfile>>({
    full_name: '',
    organization_name: '',
    organization_type: '',
    bio: '',
    city: '',
    state: '',
    website: '',
  })

  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['employer-profile', user?.id],
    queryFn: employerApi.getMyProfile,
    retry: 1,
  })

  // Populate form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        organization_name: profile.organization_name ?? '',
        organization_type: profile.organization_type ?? '',
        bio: profile.bio ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        website: profile.website ?? '',
        profile_image_url: profile.profile_image_url ?? undefined,
      })
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<EmployerProfile>) =>
      profile ? employerApi.updateProfile(data) : employerApi.createProfile(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-profile', user?.id] })
      setSuccessMessage(t('employer.profileSavedSuccess', 'Profile saved successfully!'))
      setFormError('')
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || err.message || t('employer.profileSaveError', 'Failed to save profile.'))
      setSuccessMessage('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name) {
      setFormError(t('employer.fullNameRequired', 'Full Name is required'))
      return
    }
    saveMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded-xl w-1/3 mb-2" />
        <div className="h-5 bg-gray-200 rounded-xl w-1/4 mb-8" />
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
          <div className="h-28 w-28 bg-gray-200 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="h-14 bg-gray-200 rounded-xl" />
            <div className="h-14 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            {t('nav.profile', 'Profile')}
            {profile && <CompanyVerifiedBadge isVerified={profile.is_verified} />}
          </h1>
          <p className="text-gray-500 text-base mt-2">{t('employer.manageCompanyInfo', 'Manage your company information and settings')}</p>
        </div>
        {profile && profile.average_rating > 0 && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              <span className="font-bold text-xl">{profile.average_rating.toFixed(1)}</span>
            </div>
            <span className="text-sm font-medium text-gray-500 mt-2">{profile.total_ratings} {t('ratings', 'ratings')}</span>
          </div>
        )}
      </div>

      {(!profile && !isLoading) && (
        <div className="mb-8 p-5 bg-blue-50 text-blue-800 rounded-xl flex items-start gap-4 border border-blue-200 shadow-sm">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-[#2455E8]" />
          <p className="text-base font-medium">{t('employer.setupProfileWarning', 'You haven\'t set up your profile yet. Please complete it to start posting jobs.')}</p>
        </div>
      )}

      {formError && (
        <div className="mb-8 p-5 bg-red-50 text-red-800 rounded-xl flex items-start gap-4 border border-red-200 shadow-sm">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-base font-medium">{formError}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-8 p-5 bg-emerald-50 text-emerald-800 rounded-xl flex items-start gap-4 border border-emerald-200 shadow-sm">
          <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-600" />
          <p className="text-base font-medium">{successMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-8 pb-8 border-b border-gray-100">
             <div className="relative">
               <ImageUploader 
                 currentImageUrl={formData.profile_image_url} 
                 onUploadSuccess={(url) => setFormData(p => ({ ...p, profile_image_url: url }))}
                 folder="kaamsetu/employers"
                 shape="circle"
               />
             </div>
             <div>
                <h3 className="text-xl font-bold text-gray-900">{t('employer.companyLogo', 'Company Logo')}</h3>
                <p className="text-base text-gray-500 mt-2 max-w-md">{t('employer.logoHint', 'Upload a clear, square logo. Max 5MB. JPEG or PNG format for best results.')}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.fullName', 'Full Name')} <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium" 
                  placeholder={t('employer.fullNamePlaceholder', 'Your full name')}
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.orgName', 'Organization Name')}</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium" 
                  placeholder={t('employer.orgNamePlaceholder', 'Company or Business Name')}
                  value={formData.organization_name ?? ''}
                  onChange={e => setFormData({...formData, organization_name: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.orgType', 'Organization Type')}</label>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium" 
                  placeholder={t('employer.orgTypePlaceholder', 'e.g. Construction Company, Individual')}
                  value={formData.organization_type ?? ''}
                  onChange={e => setFormData({...formData, organization_type: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.website', 'Website')}</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="url" 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium" 
                  placeholder="https://example.com"
                  value={formData.website ?? ''}
                  onChange={e => setFormData({...formData, website: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.city', 'City')}</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium" 
                  placeholder={t('employer.cityPlaceholder', 'City')}
                  value={formData.city ?? ''}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.state', 'State')}</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <select 
                  className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium appearance-none" 
                  value={formData.state ?? ''}
                  onChange={e => setFormData({...formData, state: e.target.value})}
                >
                  <option value="">{t('employer.selectState', 'Select State')}</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-gray-700">{t('employer.bio', 'Bio / Description')}</label>
              <textarea 
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2455E8] focus:border-transparent transition-all outline-none text-gray-900 font-medium min-h-[120px] resize-y" 
                placeholder={t('employer.bioPlaceholder', 'Tell workers about your business...')}
                value={formData.bio ?? ''}
                onChange={e => setFormData({...formData, bio: e.target.value})}
              />
            </div>
          </div>
          
          <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
             <button 
                type="submit" 
                className="inline-flex items-center justify-center px-8 py-3 bg-[#2455E8] hover:bg-[#1e46c7] text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? t('employer.saving', 'Saving...') : (
                  <><Save className="w-5 h-5 mr-2" /> {t('jobs.saveProfile', 'Save Profile')}</>
                )}
              </button>
          </div>
        </form>
      </div>

      {profile && (
        <div className="mt-8">
          <EmployerVerificationCenter profile={profile} />
        </div>
      )}
    </div>
  )
}
