// KaamSetu — Admin Verifications Queue Page
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { AdminVerificationManager } from '../../components/verification/AdminVerificationManager';

export default function AdminVerificationsPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark">
              {t('admin.verificationsTitle', 'Trust & Verification Review')}
            </h1>
            <p className="text-gray-500 text-sm">
              {t('admin.verificationsSubtitle', 'Review pending identity cards, skill certificates, and company documents.')}
            </p>
          </div>
        </div>
      </div>

      {/* Verification Queue Component */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <AdminVerificationManager />
      </div>
    </div>
  );
}
