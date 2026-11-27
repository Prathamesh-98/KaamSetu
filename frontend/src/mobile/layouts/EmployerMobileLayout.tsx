import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Users, Briefcase, MessageSquare, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi, notificationsApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useBackButton } from '../hooks/useBackButton';
import { useWindowInsets } from '../hooks/useWindowInsets';
import { useStatusBar } from '../hooks/useStatusBar';
import { MobileSyncProvider } from '../sync/MobileSyncContext';
import { useAdaptivePollInterval } from '../sync/useMobileSync';
import { MOBILE_QUERY_KEYS } from '../sync/queryKeys';
import MobileOfflineBanner from '../components/ui/MobileOfflineBanner';

const HIDE_NAV_PATTERNS = [
  /^\/employer\/post-job$/,
  /^\/employer\/jobs\/[^/]+\/edit$/,
  /^\/employer\/verification$/,
];

export const EmployerMobileLayout: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const { user } = useAuth();
  const location = useLocation();
  useBackButton();
  useWindowInsets();
  useStatusBar(false);

  const [isOverlayActive, setIsOverlayActive] = useState(false);

  useEffect(() => {
    const checkOverlays = () => {
      const hasEditor = !!document.querySelector('.mobile-fullscreen-editor');
      const hasModal = !!document.querySelector('.mobile-modal-overlay');
      setIsOverlayActive(hasEditor || hasModal);
    };

    checkOverlays();
    const observer = new MutationObserver(checkOverlays);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [location.pathname, location.search]);

  const isHiddenRoute = HIDE_NAV_PATTERNS.some((re) => re.test(location.pathname));
  const shouldHideNav = isOverlayActive || isHiddenRoute;

  const chatPollMs = useAdaptivePollInterval(10000, { enabled: !!user });
  const notifPollMs = useAdaptivePollInterval(12000, { enabled: !!user });

  const { data: chatUnread } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.chatUnreadCount,
    queryFn: chatApi.getUnreadCount,
    refetchInterval: chatPollMs,
    staleTime: 5000,
    enabled: !!user,
  });

  useQuery({
    queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount,
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: notifPollMs,
    staleTime: 5000,
    enabled: !!user,
  });

  const unreadMessages = chatUnread?.unread_count || 0;

  const NAV_ITEMS = [
    { to: '/employer/dashboard', icon: Home, label: t('nav.home', 'Home'), matchPrefix: '/employer/dashboard' },
    { to: '/employer/candidates', icon: Users, label: t('employer.hireWorkers', 'Hire'), matchPrefix: '/employer/candidates' },
    { to: '/employer/jobs', icon: Briefcase, label: t('nav.myJobs', 'My Jobs'), matchPrefix: '/employer/jobs' },
    {
      to: '/employer/messages',
      icon: MessageSquare,
      label: t('nav.messages', 'Messages'),
      matchPrefix: '/employer/messages',
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    { to: '/employer/profile', icon: Building2, label: t('nav.myProfile', 'Profile'), matchPrefix: '/employer/profile' },
  ];

  return (
    <MobileSyncProvider>
      <div className="mobile-app-root">
        <MobileOfflineBanner />

        <main
          className={shouldHideNav ? 'mobile-subpage-scroll' : 'mobile-content-area'}
          id="employer-main-content"
        >
          <Outlet />
        </main>

        {!shouldHideNav && (
          <nav className="mobile-nav-safe" aria-label={t('nav.bottomNav', 'Employer Navigation')}>
            <div className="flex h-16 items-center justify-around px-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  location.pathname === item.to ||
                  (item.matchPrefix !== '/employer/dashboard' && location.pathname.startsWith(item.matchPrefix));
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`mobile-touch-target relative flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
                      isActive ? 'text-indigo-900 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <div className="relative">
                      <item.icon
                        className={`h-5 w-5 transition-transform ${
                          isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
                        }`}
                        style={isActive ? { color: '#1F2A6B' } : undefined}
                      />
                      {item.badge !== undefined && (
                        <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 text-[11px] leading-none tracking-tight truncate max-w-[68px]">
                      {item.label}
                    </span>
                    {isActive && (
                      <span
                        className="absolute bottom-1 h-1 w-6 rounded-full"
                        style={{ backgroundColor: '#FF9933' }}
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </MobileSyncProvider>
  );
};

export default EmployerMobileLayout;
