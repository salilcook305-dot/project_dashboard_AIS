import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FolderKanban,
  FolderGit2,
  BookOpen,
  Users,
  UserCog,
  Terminal,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  Plus,
} from 'lucide-react';
import { AiSamratLogo } from './AiSamratLogo';
import { AvailabilityBadge } from './AvailabilityBadge';
import { useCurrentUser } from './ProtectedRoute';
import { api } from '../lib/api';
import logoImg from '../assets/ai_samrat_logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useCurrentUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      window.location.href = '/login';
    }
  };

  const isAdminOrManager = user?.is_admin || user?.is_manager || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAdmin = Boolean(user?.is_admin || user?.role === 'ADMIN' || user?.role === 'admin' || user?.is_superuser);

  const handleOpenNewProject = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('open-new-project-modal'));
    } else {
      window.location.href = '/?new=1';
    }
  };

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/diary':
        return {
          title: 'Work Diary Timeline',
          subtitle: 'Daily engineering updates, blocker tracking, and review roster',
          icon: BookOpen,
        };
      case '/team':
        return {
          title: 'Team Directory',
          subtitle: 'Squad allocations, workload statuses, and availability roster',
          icon: Users,
        };
      case '/team-management':
        return {
          title: 'Team Management',
          subtitle: 'Staff administration, credentials, and access permissions',
          icon: UserCog,
        };
      case '/logs':
      case '/system-logs':
        return {
          title: 'System Logs & Audit Trail',
          subtitle: 'Live application logs, security events, and error diagnostics',
          icon: Terminal,
        };
      default:
        return {
          title: 'AI Samrat Project Portfolio',
          subtitle: 'Overview of internal software squads, delivery timelines, and engineering diaries',
          icon: FolderGit2,
        };
    }
  };

  const pageInfo = getPageInfo();
  const PageIcon = pageInfo.icon;

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: FolderKanban },
    { to: '/diary', label: 'Diary', icon: BookOpen },
    { to: '/team', label: 'Team Directory', icon: Users },
    ...(isAdminOrManager ? [{ to: '/team-management', label: 'Team Management', icon: UserCog }] : []),
    ...(isAdmin ? [{ to: '/logs', label: 'System Logs', icon: Terminal }] : []),
  ];

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row select-none md:select-auto">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0B1F5C] text-white shrink-0 border-r border-[#1565C0]/40 h-full overflow-y-auto custom-scrollbar select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <AiSamratLogo showText className="w-9 h-9" />
        </div>

        {/* User mini profile card */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1565C0] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
              {user?.initials || 'US'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate text-white">{user?.name || user?.username}</div>
              <div className="text-[10px] text-sky-200/80 truncate capitalize">
                {user?.role_label || user?.role}
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
            <AvailabilityBadge
              status={user?.status}
              activeCount={user?.active_count}
              leaveUntil={user?.leave_until}
            />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                  ? 'bg-[#1565C0] text-white shadow-sm ring-1 ring-white/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area with Top-Right Controls */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar for Desktop with Title at Left and Logout & Theme at Top Right */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {location.pathname === '/' || location.pathname === '/dashboard' ? (
              <div className="w-8 h-8 rounded-lg bg-white shadow-xs ring-1 ring-slate-200 dark:ring-slate-700 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={logoImg}
                  alt="AI Samrat"
                  className="w-full h-full object-contain rounded-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/static/img/ai_samrat_logo.png';
                  }}
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50">
                <PageIcon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none truncate">
                {pageInfo.title}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate hidden lg:block">
                {pageInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdminOrManager && (
              <button
                type="button"
                onClick={handleOpenNewProject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-royal hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
                title="Create a new project"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            )}

            {/* Dark / Light Mode Icon Button */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-colors shadow-sm"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Log Out Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 transition-colors shadow-sm"
              title="Log out of your account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Header with Top-Right Controls */}
        <div className="md:hidden bg-[#0B1F5C] text-white px-4 py-3 flex items-center justify-between border-b border-[#1565C0]/40 shrink-0 z-20">
          <AiSamratLogo showText className="w-8 h-8" />
          <div className="flex items-center gap-2">
            {isAdminOrManager && (
              <button
                type="button"
                onClick={handleOpenNewProject}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-royal hover:bg-blue-700 shadow-sm cursor-pointer"
                title="Create a new project"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">New Project</span>
              </button>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-200" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-600/30"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0B1F5C] border-b border-[#1565C0]/40 p-4 space-y-2 shrink-0">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${isActive ? 'bg-[#1565C0] text-white' : 'text-slate-300'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
};
