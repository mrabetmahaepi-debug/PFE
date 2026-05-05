import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Bell, 
  User, 
  LogOut, 
  Settings, 
  X, 
  Briefcase, 
  Building2, 
  Clock,
  Check,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { notificationService, type Notification } from '../services/notification.service';
import { superAdminService } from '../services/superadmin.service';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Navbar.css';


const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Refs for click outside
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getMyNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const results = await superAdminService.searchGlobal(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.num_notification === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const navigateToResult = (result: any) => {
    setShowSearchResults(false);
    setSearchQuery('');
    switch (result.type) {
      case 'project': navigate(`/projects/${result.id}`); break;
      case 'enterprise': navigate('/enterprises'); break;
      case 'user': navigate('/team'); break;
      case 'approval': navigate('/approvals'); break;
    }
  };

  /* ─── Approval Logic in Navbar ─── */
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: number, notiId: number } | null>(null);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [selectedEntId, setSelectedEntId] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEnterprises = async () => {
    try {
      const data = await api.get('/entreprises'); // Directly using api or entrepriseService
      setEnterprises(data.data);
    } catch (err) {
      console.error("Failed to fetch enterprises", err);
    }
  };

  const handleApproveFromNoti = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();
    if (!n.metadata) return;
    const { userId } = JSON.parse(n.metadata);
    
    setSelectedUser({ userId, notiId: n.num_notification });
    await fetchEnterprises();
    setShowEnterpriseModal(true);
  };

  const handleRejectFromNoti = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();
    if (!n.metadata) return;
    const { userId } = JSON.parse(n.metadata);
    
    try {
      await superAdminService.rejectUser(userId);
      await markAsRead(n.num_notification);
      setNotifications(prev => prev.filter(item => item.num_notification !== n.num_notification));
    } catch (err) {
      console.error("Failed to reject user from notification", err);
    }
  };

  const approveWithEnterprise = async () => {
    if (!selectedUser || !selectedEntId) return;
    setActionLoading(true);
    try {
      await superAdminService.approveUser(selectedUser.userId, selectedEntId);
      await markAsRead(selectedUser.notiId);
      setNotifications(prev => prev.filter(n => n.num_notification !== selectedUser.notiId));
      setShowEnterpriseModal(false);
      setSelectedUser(null);
      setSelectedEntId(0);
    } catch (err) {
      console.error("Approval failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left" ref={searchRef}>
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Rechercher entreprises, admins, projets..." 
            className="search-input" 
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
          />
          {searchQuery && (
            <X size={14} className="clear-search" onClick={() => { setSearchQuery(''); setSearchResults(null); }} />
          )}
        </div>

        <AnimatePresence>
          {showSearchResults && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="search-results-dropdown premium-card"
            >
              {isSearching ? (
                <div className="search-loading">Recherche en cours...</div>
              ) : (
                <div className="results-scroll">
                  {searchResults && (Object.values(searchResults).flat().length > 0) ? (
                    <>
                      {searchResults.projects?.length > 0 && (
                        <div className="result-group">
                          <label>Projets</label>
                          {searchResults.projects.map((r: any) => (
                            <div key={`p-${r.id}`} className="result-item" onClick={() => navigateToResult(r)}>
                              <Briefcase size={14} />
                              <div className="res-info">
                                <span>{r.title}</span>
                                <small>{r.subtitle}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.enterprises?.length > 0 && (
                        <div className="result-group">
                          <label>Entreprises</label>
                          {searchResults.enterprises.map((r: any) => (
                            <div key={`e-${r.id}`} className="result-item" onClick={() => navigateToResult(r)}>
                              <Building2 size={14} />
                              <div className="res-info">
                                <span>{r.title}</span>
                                <small>{r.subtitle}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.users?.length > 0 && (
                        <div className="result-group">
                          <label>Administrateurs</label>
                          {searchResults.users.map((r: any) => (
                            <div key={`u-${r.id}`} className="result-item" onClick={() => navigateToResult(r)}>
                              <User size={14} />
                              <div className="res-info">
                                <span>{r.title}</span>
                                <small>{r.subtitle}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-results">Aucun résultat trouvé</div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="navbar-actions">

        {/* Notifications */}
        <div className="nav-dropdown-wrapper" ref={notificationsRef}>
          <button 
            className={`action-btn ${unreadCount > 0 ? 'has-badge' : ''}`}
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="notifications-dropdown premium-card"
              >
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button className="mark-all-btn" onClick={markAllAsRead}>Tout marquer comme lu</button>
                  )}
                </div>
                <div className="dropdown-content custom-scroll">
                  {notifications.length === 0 ? (
                    <div className="empty-noti">
                      <Bell size={32} />
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.num_notification} 
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          if (!n.is_read) markAsRead(n.num_notification);
                          setShowNotifications(false);
                        }}
                      >
                        <div className={`noti-icon-box ${n.type || 'info'}`}>
                          {n.type === 'success' ? <Check size={14} /> : <Bell size={14} />}
                        </div>
                        <div className="noti-details">
                          <p className="noti-title">{n.sujet}</p>
                          <p className="noti-message">{n.message}</p>
                          
                          {/* Actions pour SuperAdmin */}
                          {n.metadata && JSON.parse(n.metadata).action === 'approve_user' && (
                            <div className="noti-actions">
                              <button className="noti-btn-reject" onClick={(e) => handleRejectFromNoti(e, n)}>Refuser</button>
                              <button className="noti-btn-approve" onClick={(e) => handleApproveFromNoti(e, n)}>Accepter</button>
                            </div>
                          )}

                          <span className="noti-time">
                            <Clock size={10} /> {new Date(n.date_envoi || '').toLocaleDateString()}
                          </span>
                        </div>
                        {!n.is_read && <div className="unread-dot"></div>}
                      </div>
                    ))
                  )}
                </div>
                <div className="dropdown-footer">
                  <button className="view-all-btn" onClick={() => { navigate('/activities'); setShowNotifications(false); }}>
                    Voir tout l'historique <ChevronDown size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile */}
        <div className="nav-dropdown-wrapper" ref={profileRef}>
          <button 
            className="user-profile-btn"
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
          >
            <div className="user-avatar">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
            <div className="user-info-brief">
              <span className="user-name">{user?.prenom} {user?.nom}</span>
              <span className="user-role">
                {typeof user?.role === 'string' ? user.role : user?.role?.nom}
              </span>
            </div>
            <ChevronDown size={16} className={`chevron-icon ${showProfileMenu ? 'rotated' : ''}`} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="profile-dropdown premium-card"
              >
                <div className="dropdown-item" onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}>
                  <User size={18} /><span>Mon Profil</span>
                </div>
                <div className="dropdown-item" onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}>
                  <Settings size={18} /><span>Paramètres</span>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-item logout" onClick={logout}>
                  <LogOut size={18} /><span>Déconnexion</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Enterprise Selection Modal */}
      <AnimatePresence>
        {showEnterpriseModal && (
          <div className="modal-overlay" onClick={() => setShowEnterpriseModal(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="enterprise-modal-mini premium-card"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Assigner une entreprise</h3>
                <button className="close-btn" onClick={() => setShowEnterpriseModal(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p>Veuillez choisir l'entreprise pour cet administrateur :</p>
                <select 
                  value={selectedEntId} 
                  onChange={(e) => setSelectedEntId(parseInt(e.target.value))}
                  className="ent-select-noti"
                >
                  <option value={0}>Sélectionner une entreprise...</option>
                  {enterprises.map(ent => (
                    <option key={ent.id_entreprise} value={ent.id_entreprise}>{ent.nom}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button className="outline-btn" onClick={() => setShowEnterpriseModal(false)}>Annuler</button>
                <button 
                  className="primary-btn" 
                  disabled={!selectedEntId || actionLoading}
                  onClick={approveWithEnterprise}
                >
                  {actionLoading ? 'Approbation...' : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
