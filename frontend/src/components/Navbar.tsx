import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  Info,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationService, type Notification } from '../services/notification.service';
import { superAdminService } from '../services/superadmin.service';

interface NavbarProps {
  toggleMobile?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowSearchResults(false);
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const data = await notificationService.getAll();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchResults(true);
      try {
        const results = await superAdminService.searchGlobal(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.num_notification === id ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="text-emerald-600" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-amber-600" />;
      case 'error':
        return <AlertCircle size={14} className="text-rose-600" />;
      default:
        return <Info size={14} className="text-blue-600" />;
    }
  };

  const navigateToResult = (result: any) => {
    setShowSearchResults(false);
    setSearchQuery('');
    if (result.type === 'project') navigate(`/projects/${result.id}`);
    if (result.type === 'enterprise') navigate(`/enterprises/${result.id}`);
    if (result.type === 'user') navigate(`/team/${result.id}`);
    if (result.type === 'approval') navigate('/approvals');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur">
      <div className="relative flex h-16 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex flex-1 items-center gap-3" ref={searchRef}>
          <button className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 lg:hidden" onClick={toggleMobile}>
            <Menu size={18} />
          </button>
          <div className="relative w-full max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects, users, enterprises..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-[#5B5FEF]/50 focus:ring-2 focus:ring-[#5B5FEF]/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={13} />
              </button>
            )}
          </div>
          {showSearchResults && (
            <div className="absolute left-4 right-4 top-16 z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:left-6 md:max-w-xl">
              {isSearching ? (
                <div className="p-3 text-sm text-slate-500">Searching...</div>
              ) : (
                <div className="max-h-72 space-y-3 overflow-y-auto">
                  {searchResults && Object.values(searchResults).flat().length > 0 ? (
                    <>
                      {searchResults.projects?.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</p>
                          {searchResults.projects.map((r: any) => (
                            <button key={`p-${r.id}`} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onClick={() => navigateToResult(r)}>
                              <Briefcase size={14} />
                              <div>
                                <span className="block text-sm text-slate-900">{r.title}</span>
                                <small className="text-xs text-slate-500">{r.subtitle}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.enterprises?.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Companies</p>
                          {searchResults.enterprises.map((r: any) => (
                            <button key={`e-${r.id}`} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onClick={() => navigateToResult(r)}>
                              <Building2 size={14} />
                              <div>
                                <span className="block text-sm text-slate-900">{r.title}</span>
                                <small className="text-xs text-slate-500">{r.subtitle}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.users?.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
                          {searchResults.users.map((r: any) => (
                            <button key={`u-${r.id}`} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onClick={() => navigateToResult(r)}>
                              <User size={14} />
                              <div>
                                <span className="block text-sm text-slate-900">{r.title}</span>
                                <small className="text-xs text-slate-500">{r.subtitle}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 text-sm text-slate-500">No results found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notificationRef}>
            <button className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#5B5FEF] px-1.5 py-0.5 text-[10px] font-semibold text-white">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 z-30 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && <button className="text-xs font-medium text-[#5B5FEF]" onClick={markAllAsRead}>Mark all as read</button>}
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <button key={n.num_notification} className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left ${!n.is_read ? 'bg-slate-50' : 'hover:bg-slate-50'}`} onClick={() => !n.is_read && markAsRead(n.num_notification)}>
                        <span className="mt-0.5 rounded-md bg-slate-100 p-1.5">{getNotificationIcon(n.type)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{n.sujet}</p>
                          <p className="text-xs text-slate-500">{n.message}</p>
                          <span className="text-[11px] text-slate-400">{new Date(n.date_envoi).toLocaleDateString()}</span>
                        </div>
                        {!n.is_read && <span className="mt-2 h-2 w-2 rounded-full bg-[#5B5FEF]"></span>}
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-slate-500">
                      <Bell size={24} />
                      <p className="mt-2 text-sm">No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-2 transition hover:bg-slate-50" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <img src={`https://ui-avatars.com/api/?name=${user?.prenom}+${user?.nom}&background=6366f1&color=fff`} alt="user" className="h-8 w-8 rounded-lg" />
              <div className="hidden sm:block">
                <div className="text-left">
                  <span className="block text-sm font-semibold text-slate-900">{user?.prenom} {user?.nom}</span>
                  <span className="block text-xs text-slate-500">{typeof user?.role === 'string' ? user.role : user?.role?.nom}</span>
                </div>
              </div>
              <ChevronDown size={16} className={`text-slate-500 transition ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}>
                  <User size={16} />
                  <span>My Profile</span>
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}>
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
                <hr className="my-1 border-slate-200" />
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50" onClick={logout}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
