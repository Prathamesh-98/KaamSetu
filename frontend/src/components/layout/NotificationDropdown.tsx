import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { notificationsApi } from '../../api/services';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotificationDropdown({ isTransparent }: { isTransparent: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(false),
    enabled: isOpen,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) {
      markRead.mutate(n.id);
    }
    setIsOpen(false);
    // Navigate based on type
    if (n.type === 'NEW_MATCHING_JOB') navigate('/worker/jobs');
    else if (n.type === 'NEW_APPLICATION' || n.type === 'APPLICATION_STATUS_UPDATE') navigate(n.reference_type === 'JOB_APPLICATION' ? '/worker/applications' : '/employer/applications'); // Naive routing, can be refined based on role
    else if (n.type.startsWith('SHIFT_')) navigate(n.reference_type === 'SHIFT_BOOKING' ? '/worker/shifts' : '/employer/shifts');
  };


  const getNotificationContent = (n: any) => {
    switch(n.type) {
      case 'NEW_MATCHING_JOB':
        return { title: t('notifications.NEW_MATCHING_JOB.title', n.title), body: t('notifications.NEW_MATCHING_JOB.body', n.body, { title: n.body.split("'")[1] || 'A job' }) };
      case 'NEW_APPLICATION':
        return { title: t('notifications.NEW_APPLICATION.title', n.title), body: t('notifications.NEW_APPLICATION.body', n.body) };
      case 'APPLICATION_STATUS_UPDATE':
        return { title: t('notifications.APPLICATION_STATUS_UPDATE.title', n.title), body: t('notifications.APPLICATION_STATUS_UPDATE.body', n.body) };
      case 'SHIFT_REQUESTED':
        return { title: t('notifications.SHIFT_REQUESTED.title', n.title), body: t('notifications.SHIFT_REQUESTED.body', n.body) };
      case 'SHIFT_ACCEPTED':
        return { title: t('notifications.SHIFT_ACCEPTED.title', n.title), body: t('notifications.SHIFT_ACCEPTED.body', n.body) };
      case 'SHIFT_DECLINED':
        return { title: t('notifications.SHIFT_DECLINED.title', n.title), body: t('notifications.SHIFT_DECLINED.body', n.body) };
      case 'SHIFT_CANCELLED':
        return { title: t('notifications.SHIFT_CANCELLED.title', n.title), body: t('notifications.SHIFT_CANCELLED.body', n.body) };
      default:
        return { title: n.title, body: n.body };
    }
  };

  const unreadCount = countData?.count || 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-colors ${
          isTransparent ? 'text-white hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-semibold text-gray-800">{t('notifications.title', 'Notifications')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {t('notifications.markAllRead', 'Mark all read')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">{t('common.loading', 'Loading...')}</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                {t('notifications.empty', 'No notifications yet')}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !n.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-gray-900">{getNotificationContent(n).title}</span>
                      {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0"></span>}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{getNotificationContent(n).body}</p>
                    <span className="text-[10px] text-gray-400 mt-2 block">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
