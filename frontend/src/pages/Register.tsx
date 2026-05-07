import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, UserPlus, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Auth.css';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    company: ''
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register } = useAuth();


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register({
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email,
        password: formData.password,
        poste: formData.company // We use 'poste' to store company name for approval
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de l'inscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="auth-card success-card"
        >
          <div className="auth-header">
            <div className="auth-logo success">✓</div>
            <h1>Inscription réussie !</h1>
            <p>Votre compte a été créé avec succès.</p>
          </div>
          <div className="success-message">
            <p>Pour des raisons de sécurité, votre accès doit être validé par un <strong>Super Administrateur</strong>.</p>
            <p>Vous recevrez un accès complet dès que votre compte sera approuvé.</p>
          </div>
          <div className="auth-footer">
            <Link to="/login" className="primary-btn">Retour à la connexion</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-card"
      >
        <div className="auth-header">
          <div className="auth-logo">GP</div>
          <h1>Créer un compte</h1>
          <p>Rejoignez-nous pour gérer vos projets efficacement</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">

          <div className="form-group">
            <label>Prénom</label>
            <div className="input-wrapper">
              <UserPlus className="input-icon" size={18} />
              <input 
                type="text" 
                name="prenom"
                placeholder="Jean"
                value={formData.prenom}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nom</label>
            <div className="input-wrapper">
              <UserPlus className="input-icon" size={18} />
              <input 
                type="text" 
                name="nom"
                placeholder="Dupont"
                value={formData.nom}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                name="email"
                placeholder="jean.dupont@exemple.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nom de l'entreprise</label>
            <div className="input-wrapper">
              <Building2 className="input-icon" size={18} />
              <input 
                type="text" 
                name="company"
                placeholder="Ex: Ma Société SAS"
                value={formData.company}
                onChange={handleChange}
                required
              />
            </div>
          </div>



          <div className="form-group">
            <label>Mot de passe</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                type="password" 
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loader-small"></span>
            ) : (
              <>
                <UserPlus size={20} />
                <span>S'inscrire</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Déjà un compte ? <Link to="/login">Se connecter</Link></p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
