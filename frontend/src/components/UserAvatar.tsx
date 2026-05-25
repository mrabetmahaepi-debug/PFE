import React, { useEffect, useState } from 'react';
import { resolveUserPhotoUrl, getUserInitials } from '../lib/profilePhoto';
import type { UserPhotoFields } from '../lib/profilePhoto';

export interface UserAvatarUser extends UserPhotoFields {
  prenom?: string;
  nom?: string;
  email?: string;
}

interface UserAvatarProps {
  user?: UserAvatarUser | null;
  className?: string;
  imgClassName?: string;
  title?: string;
}

/** Photo de profil ou initiales en secours. */
const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  className = '',
  imgClassName = '',
  title,
}) => {
  const photo = resolveUserPhotoUrl(user);
  const initials = getUserInitials(user);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photo]);

  if (photo && !imgFailed) {
    return (
      <img
        src={photo}
        alt={title || 'Photo de profil'}
        className={imgClassName || className}
        title={title}
        onError={() => setImgFailed(true)}
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
