import React from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Users, Briefcase, MessageSquare, Building2, Plus, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi, notificationsApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useBackButton } from '../hooks/useBackButton';
import { useWindowInsets } from '../hooks/useWindowInsets';
import { useStatusBar } from '../hooks/useStatusBar';

export const EmployerMobileLayout: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useBackButton();
  useWindowInsets();
  useStatusBar(false);

  const { data: chatUnread } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: chatApi.getUnreadCount,
    refetchInterval: 12000,
    enabled: !!user,
  });

  const { data: notifUnread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 15000,
    enabled: !!user,
  });

  const unreadMessages = chatUnread?.unread_count || 0;
  const unreadNotifs = notifUnread?.count || 0;

  const NAV_ITEMS = [
    { to: '/employer/dashboard', icon: Home, label: t('nav.home', 'Home') },
    { to: '/employer/candidates', icon: Users, label: t('employer.hireWorkers', 'Hire') },
    { to: '/employer/jobs', icon: Briefcase, label: t('nav.myJobs', 'My Jobs') },
    {
      to: '/employer/messages',
      icon: MessageSquare,
      label: t('nav.messages', 'Messages'),
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    { to: '/employer/profile', icon: Building2, label: t('nav.myProfile', 'Profile') },
  ];

  return (
    <div className="mobile-app-root">
      {/* Content Area with bottom safe padding */}
      <main className="mobile-content-area">
        <Outlet />
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="mobile-nav-safe">
        <div className="flex h-16 items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/employer/dashboard' && location.pathname.startsWith(item.to));
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
    </div>
  );
};

export default EmployerMobileLayout;
