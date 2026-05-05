import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ChatWidget from '../components/ChatWidget';

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isMessagesPage = location.pathname === '/messages';

  return (
    <div className="layout-container">
      <Sidebar collapsed={collapsed} toggleCollapsed={() => setCollapsed(!collapsed)} />
      
      <main className="main-content">
        <Navbar />
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>

      {!isMessagesPage && <ChatWidget />}
    </div>
  );
};

export default DashboardLayout;
