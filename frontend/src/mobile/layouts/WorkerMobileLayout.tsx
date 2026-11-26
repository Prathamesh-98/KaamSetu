import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Briefcase, Calendar, MessageSquare, User, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi, notificationsApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useBackButton } from '../hooks/useBackButton';
import { useWindowInsets } from '../hooks/useWindowInsets';
import { useStatusBar } from '../hooks/useStatusBar';

export const WorkerMobileLayout: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useBackButton();
  useWindowInsets();
  useStatusBar(false);

  // Monitor fullscreen modals or editors to hide bottom navigation appropriately
  const [isOverlayActive, setIsOverlayActive] = useState(false);

  useEffect(() => {
    const checkOverlays = () => {
      const hasEditor = !!document.querySelector('.mobile-fullscreen-editor');
      const hasModal = !!document.querySelector('.mobile-modal-overlay');
      setIsOverlayActive(hasEditor || hasModal);
    };

    checkOverlays();
    const observer = new MutationObserver(checkOverlays);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [location.pathname]);

  // Chat unread count
  const { data: chatUnread } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: chatApi.getUnreadCount,
    refetchInterval: 12000,
    enabled: !!user,
  });

  // Notifications unread count
  const { data: notifUnread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 15000,
    enabled: !!user,
  });

  const unreadMessages = chatUnread?.unread_count || 0;
  const unreadNotifs = notifUnread?.count || 0;

  const NAV_ITEMS = [
    { to: '/worker/dashboard', icon: Home, label: t('nav.home', 'Home') },
    { to: '/worker/jobs', icon: Briefcase, label: t('nav.jobs', 'Jobs') },
    { to: '/worker/shifts', icon: Calendar, label: t('worker.shifts', 'Shifts') },
    {
      to: '/worker/messages',
      icon: MessageSquare,
      label: t('nav.messages', 'Messages'),
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    { to: '/worker/profile', icon: User, label: t('nav.myProfile', 'Profile') },
  ];

  return (
    <div className="mobile-app-root">
      {/* Scrollable Content Area with bottom safe padding */}
      <main className="mobile-content-area" id="worker-main-content">
        <Outlet />
      </main>

      {/* Permanently Fixed Bottom Navigation Bar (Hidden during full-screen forms/modals) */}
      {!isOverlayActive && (
        <nav className="mobile-nav-safe" aria-label={t('nav.bottomNav', 'Worker Navigation')}>
          <div className="flex h-16 items-center justify-around px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== '/worker/dashboard' && location.pathname.startsWith(item.to));
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
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-[11px] leading-none tracking-tight">
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
  );
};

export default WorkerMobileLayout;
