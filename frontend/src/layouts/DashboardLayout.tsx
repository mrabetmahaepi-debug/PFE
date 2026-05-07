import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ChatWidget from '../components/ChatWidget';

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isMessagesPage = location.pathname === '/messages';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Sidebar 
        collapsed={collapsed} 
        toggleCollapsed={() => setCollapsed(!collapsed)} 
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
      />
      
      <main className={`transition-all duration-200 ${collapsed ? 'lg:ml-[88px]' : 'lg:ml-[268px]'}`}>
        <Navbar toggleMobile={() => setIsMobileOpen(!isMobileOpen)} />
        <div className="px-4 py-5 md:px-6">
          <Outlet />
        </div>
      </main>

      {!isMessagesPage && <ChatWidget />}
    </div>
  );
};

export default DashboardLayout;
