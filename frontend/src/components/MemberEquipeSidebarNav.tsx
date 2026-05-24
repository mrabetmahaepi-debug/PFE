import React, { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users } from 'lucide-react';
import { projectTeamAccessService } from '../services/projectTeamAccess.service';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';

interface MemberEquipeSidebarNavProps {
  collapsed: boolean;
}

/** Équipe link when user has TEAM_MANAGE on at least one project. */
const MemberEquipeSidebarNav: React.FC<MemberEquipeSidebarNavProps> = ({
  collapsed,
}) => {
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const projects = await projectTeamAccessService.getManagedProjects();
      setVisible(projects.length > 0);
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!visible) return null;

  if (collapsed) {
    return (
      <NavLink
        to="/equipe"
        className={({ isActive }) =>
          cn(cu.navItem, 'justify-center px-2', isActive && cu.navItemActive)
        }
        title="Équipe"
      >
        <span className={cu.navIcon}>
          <Users size={16} />
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/equipe"
      className={({ isActive }) =>
        cn(cu.navItem, isActive && cu.navItemActive)
      }
    >
      <span className={cu.navIcon}>
        <Users size={16} />
      </span>
      <span className={cu.navLabel}>Équipe</span>
    </NavLink>
  );
};

export default MemberEquipeSidebarNav;
