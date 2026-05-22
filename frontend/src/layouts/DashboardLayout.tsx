import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ChatWidget from '../components/ChatWidget';
import { cn } from '../lib/cn';

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isMessagesPage = location.pathname === '/messages';
  const isDashboardHome =
    location.pathname === '/' || location.pathname === '/dashboard';
  const isTeamPage =
    location.pathname === '/team' || location.pathname.startsWith('/team/');

  return (
    <div
      className={cn(
        'layout-container coach-layout min-h-screen bg-cu-app font-sans',
        collapsed && 'sidebar-collapsed',
        isDashboardHome && 'coach-layout--dashboard',
        isTeamPage && 'coach-layout--team'
      )}
    >
      <div className="coach-app-shell min-h-screen bg-cu-app transition-[margin-left] duration-300">
        <Sidebar collapsed={collapsed} toggleCollapsed={() => setCollapsed(!collapsed)} />

        <main className="main-content flex min-h-screen min-w-0 flex-1 flex-col bg-white">
          <Navbar />
          <div
            className={cn(
              'page-wrapper min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
              isDashboardHome ? 'bg-cu-app px-7 pb-8 pt-6' : 'bg-white px-0 pb-8 pt-0'
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {!isMessagesPage && <ChatWidget />}
    </div>
  );
};

export default DashboardLayout;
