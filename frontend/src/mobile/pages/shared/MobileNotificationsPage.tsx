import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Clock, ArrowLeft, ChevronRight, Briefcase, Calendar } from 'lucide-react';
import { notificationsApi } from '../../../api/services';
import type { Notification } from '../../../types';
import { useBackButton } from '../../hooks/useBackButton';

export const MobileNotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useBackButton();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list(false),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.reference_type === 'JOB' && notif.reference_id) {
      navigate(`/worker/jobs/${notif.reference_id}`);
    } else if (notif.reference_type === 'SHIFT' && notif.reference_id) {
      navigate('/worker/shifts');
    } else if (notif.reference_type === 'APPLICATION') {
      navigate('/worker/applications');
    }
  };

  const list = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="mobile-app-root">
      {/* Header */}
      <div className="mobile-header-safe">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">{t('nav.notifications', 'Notifications')}</h1>
          {list.some((n: Notification) => !n.is_read) ? (
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              className="text-xs font-bold text-indigo-900"
            >
              Mark all read
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      <div className="mobile-content-area p-4 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : list.length > 0 ? (
          <div className="space-y-2.5">
            {list.map((item: Notification) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`mobile-card p-3.5 flex items-start justify-between cursor-pointer active:scale-[0.99] ${
                  !item.is_read ? 'bg-indigo-50/40 border-indigo-200' : ''
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${
                    !item.is_read ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs ${!item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {item.body}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>

                {!item.is_read && (
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF9933] flex-shrink-0 ml-2 mt-1" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
            <Bell className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">{t('notifications.noNotifications', 'No Notifications')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('notifications.noNotificationsDesc', 'Updates on jobs, applications, and shift settlements will appear here.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNotificationsPage;
