import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  User, 
  LogOut, 
  Settings, 
  X, 
  Briefcase, 
  Building2, 
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { superAdminService } from '../services/superadmin.service';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './Navbar.css';


const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Refs for click outside
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const navigateToResult = (result: any) => {
    setShowSearchResults(false);
    setSearchQuery('');
    switch (result.type) {
      case 'project': navigate(`/projects/${result.id}`); break;
      case 'enterprise': navigate(`/enterprises/${result.id}`); break;
      case 'user': navigate(`/team/${result.id}`); break;
      case 'approval': navigate('/approvals'); break;
    }
  };


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
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <header className="navbar">
      <div className="navbar-left" ref={searchRef}>
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Rechercher entreprises, admins, utilisateurs..." 
            className="search-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                <div className="search-loading">Recherche...</div>
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
                          <label>Utilisateurs</label>
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
        {/* Notifications removed for minimalism */}

        <div className="nav-dropdown-wrapper" ref={profileRef}>
          <div 
            className="profile-mini-v2" 
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <img 
              src={`https://ui-avatars.com/api/?name=${user?.prenom}+${user?.nom}&background=6366f1&color=fff`} 
              alt="user" 
              style={{ width: 40, height: 40, borderRadius: 12 }} 
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="user-info-v2">
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem' }}>{user?.prenom} {user?.nom}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--saas-text-muted)' }}>
                  {typeof user?.role === 'string' ? user.role : user?.role?.nom} platform
                </span>
              </div>
              <ChevronDown size={16} className={`chevron-v2 ${showProfileMenu ? 'rotated' : ''}`} />
            </div>
          </div>

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


    </header>
  );
};

export default Navbar;
