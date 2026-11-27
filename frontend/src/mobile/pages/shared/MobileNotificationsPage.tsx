import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { notificationsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { Notification } from '../../../types';
import { useBackButton } from '../../hooks/useBackButton';
import { useWindowInsets } from '../../hooks/useWindowInsets';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';
import MobilePageHeader from '../../components/ui/MobilePageHeader';

export const MobileNotificationsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  useBackButton();
  useWindowInsets();

  const pollMs = useAdaptivePollInterval(12000, { enabled: !!user });

  const { data: notifications, isLoading, isError, refetch } = useQuery({
    queryKey: [...MOBILE_QUERY_KEYS.notificationsList, unreadOnly],
    queryFn: () => notificationsApi.list(unreadOnly),
    refetchInterval: pollMs,
    staleTime: 5000,
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
    },
  });

  const getLocalizedText = (n: Notification) => {
    switch (n.type) {
      case 'NEW_MATCHING_JOB':
        return {
          title: t('notifications.NEW_MATCHING_JOB.title', n.title),
          body: t('notifications.NEW_MATCHING_JOB.body', n.body, {
            title: n.body?.split("'")[1] || 'Job',
          }),
        };
      case 'NEW_APPLICATION':
        return {
          title: t('notifications.NEW_APPLICATION.title', n.title),
          body: t('notifications.NEW_APPLICATION.body', n.body),
        };
      case 'APPLICATION_STATUS_UPDATE':
        return {
          title: t('notifications.APPLICATION_STATUS_UPDATE.title', n.title),
          body: t('notifications.APPLICATION_STATUS_UPDATE.body', n.body),
        };
      case 'SHIFT_REQUESTED':
        return {
          title: t('notifications.SHIFT_REQUESTED.title', n.title),
          body: t('notifications.SHIFT_REQUESTED.body', n.body),
        };
      case 'SHIFT_ACCEPTED':
        return {
          title: t('notifications.SHIFT_ACCEPTED.title', n.title),
          body: t('notifications.SHIFT_ACCEPTED.body', n.body),
        };
      case 'SHIFT_DECLINED':
        return {
          title: t('notifications.SHIFT_DECLINED.title', n.title),
          body: t('notifications.SHIFT_DECLINED.body', n.body),
        };
      case 'SHIFT_CANCELLED':
        return {
          title: t('notifications.SHIFT_CANCELLED.title', n.title),
          body: t('notifications.SHIFT_CANCELLED.body', n.body),
        };
      default:
        return { title: n.title, body: n.body };
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }

    const isEmployer = user?.role === 'EMPLOYER';
    const refType = (notif.reference_type || '').toUpperCase();
    const type = (notif.type || '').toUpperCase();

    if (type.includes('PAYMENT') || type.includes('COMPLETED')) {
      navigate(isEmployer ? '/employer/shifts?tab=completed' : '/worker/shifts?tab=completed');
      return;
    }

    if (refType.includes('SHIFT') || type.startsWith('SHIFT_')) {
      navigate(isEmployer ? '/employer/shifts' : '/worker/shifts');
      return;
    }

    if (refType === 'JOB' && notif.reference_id) {
      navigate(isEmployer ? `/employer/jobs/${notif.reference_id}/applicants` : `/worker/jobs/${notif.reference_id}`);
      return;
    }

    if (refType.includes('APPLICATION') || type.includes('APPLICATION')) {
      navigate(isEmployer ? '/employer/jobs' : '/worker/applications');
      return;
    }

    if (refType.includes('MESSAGE') || refType.includes('CHAT') || type.includes('MESSAGE')) {
      navigate(isEmployer ? '/employer/messages' : '/worker/messages');
      return;
    }

    if (refType.includes('VERIFICATION') || type.includes('VERIFICATION')) {
      navigate(isEmployer ? '/employer/verification' : '/worker/verification');
      return;
    }

    navigate(isEmployer ? '/employer/dashboard' : '/worker/dashboard');
  };

  const list = Array.isArray(notifications) ? notifications : [];
  const hasUnread = list.some((n) => !n.is_read);

  return (
    <div className="mobile-app-root">
      <MobilePageHeader
        title={t('nav.notifications', 'Notifications')}
        rightSlot={
          hasUnread ? (
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-bold text-indigo-900 active:scale-95 min-h-[40px]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{t('mobile:notifications.markAllRead', 'Mark all read')}</span>
            </button>
          ) : null
        }
      />

      {/* Filter Pills */}
      <div className="flex items-center gap-2 bg-white px-4 py-2.5 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            !unreadOnly ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('mobile:notifications.all', 'All')}
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            unreadOnly ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('mobile:notifications.unreadOnly', 'Unread Only')}
        </button>
      </div>

      <div className="mobile-subpage-scroll p-4 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-red-100 space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-700">
              {t('common.errorLoading', 'Failed to load notifications')}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('mobile:notifications.retry', 'Retry')}</span>
            </button>
          </div>
        ) : list.length > 0 ? (
          <div className="space-y-2.5">
            {list.map((item) => {
              const { title, body } = getLocalizedText(item);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`mobile-card w-full p-3.5 flex items-start justify-between text-left active:scale-[0.99] ${
                    !item.is_read ? 'bg-indigo-50/50 border-indigo-200' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${
                        !item.is_read ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-xs ${!item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{body}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>
                  {!item.is_read && <span className="h-2.5 w-2.5 rounded-full bg-[#FF9933] flex-shrink-0 ml-2 mt-1" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
            <Bell className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">
              {t('notifications.noNotifications', 'No Notifications')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {t('notifications.noNotificationsDesc', 'Updates on jobs, applications, and shift settlements will appear here.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNotificationsPage;
