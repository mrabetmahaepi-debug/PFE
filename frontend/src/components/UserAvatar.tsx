import React from 'react';
import { resolveProfilePhotoUrl, getUserInitials } from '../lib/profilePhoto';

export interface UserAvatarUser {
  prenom?: string;
  nom?: string;
  email?: string;
  photoUrl?: string | null;
}

interface UserAvatarProps {
  user?: UserAvatarUser | null;
  className?: string;
  imgClassName?: string;
  title?: string;
}

/** Profile photo or initials fallback. */
const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  className = '',
  imgClassName = '',
  title,
}) => {
  const photo = resolveProfilePhotoUrl(user?.photoUrl);
  const initials = getUserInitials(user);

  if (photo) {
    return (
      <img
        src={photo}
        alt={title || 'Photo de profil'}
        className={imgClassName || className}
        title={title}
      />
    );
  }

  return (
    <span className={className} title={title} aria-hidden={!title}>
      {initials}
    </span>
  );
};

export default UserAvatar;
