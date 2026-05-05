import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import './BackButton.css';

interface BackButtonProps {
  label?: string;
  fallback?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ label = 'Retour', fallback = '/dashboard' }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Check if there's a history entry to go back to
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <motion.button
      className="back-button"
      onClick={handleClick}
      whileHover={{ x: -3 }}
      whileTap={{ scale: 0.96 }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <ArrowLeft size={18} />
      <span>{label}</span>
    </motion.button>
  );
};

export default BackButton;
