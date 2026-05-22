import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, UserPlus, AlertCircle, Building2, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PhoneCountryInput, {
  createDefaultPhoneValue,
  type PhoneCountryValue,
} from '../components/PhoneCountryInput';
import { validatePhoneForCountry } from '../lib/phoneCountries';
import './Auth.css';

import { getPasswordChecks, isPasswordStrong } from '../lib/passwordRules';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    entrepriseNom: '',
    companyAddress: '',
    email: '',
    password: '',
  });
  const [phone, setPhone] = useState<PhoneCountryValue>(createDefaultPhoneValue);
  const [fieldErrors, setFieldErrors] = useState<{
    companyAddress?: string;
    phone?: string;
  }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.password),
    [formData.password]
  );
  const passwordIsStrong = isPasswordStrong(formData.password);

  const addressValid = formData.companyAddress.trim().length >= 3;
  const phoneValidation = useMemo(
    () => validatePhoneForCountry(phone.phoneCountryCode, phone.phoneNumber),
    [phone.phoneCountryCode, phone.phoneNumber]
  );

  const canSubmit =
    passwordIsStrong &&
    formData.entrepriseNom.trim().length >= 2 &&
    addressValid &&
    phoneValidation.valid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'companyAddress' && fieldErrors.companyAddress) {
      setFieldErrors((prev) => ({ ...prev, companyAddress: undefined }));
    }
  };

  const handlePhoneChange = (value: PhoneCountryValue) => {
    setPhone(value);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: typeof fieldErrors = {};
    if (!addressValid) {
      nextErrors.companyAddress =
        "L'adresse de l'entreprise est requise (au moins 3 caractères).";
    }
    if (!phoneValidation.valid) {
      nextErrors.phone = phoneValidation.message;
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordIsStrong) {
      setError('Veuillez respecter les exigences du mot de passe.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        prenom: formData.prenom,
        nom: formData.nom,
        entrepriseNom: formData.entrepriseNom.trim(),
        companyAddress: formData.companyAddress.trim(),
        phoneCountryCode: phone.phoneCountryCode,
        phoneNumber: phone.phoneNumber,
        email: formData.email,
        password: formData.password,
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; errors?: Array<{ path?: string[]; message?: string }> } };
      };
      const backendErrors = axiosErr.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const mapped: typeof fieldErrors = {};
        for (const item of backendErrors) {
          const path = item.path?.[0];
          if (path === 'companyAddress') mapped.companyAddress = item.message;
          if (path === 'phoneNumber' || path === 'phoneCountryCode') mapped.phone = item.message;
        }
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
        }
      }
      setError(
        axiosErr.response?.data?.message || "Erreur lors de l'inscription"
      );
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
            <p>
              Pour des raisons de sécurité, votre accès doit être validé par un{' '}
              <strong>Super Administrateur</strong>.
            </p>
            <p>Vous recevrez un accès complet dès que votre compte sera approuvé.</p>
          </div>
          <div className="auth-footer">
            <Link to="/login" className="primary-btn">
              Retour à la connexion
            </Link>
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
        className="auth-card auth-card--register"
      >
        <div className="auth-header">
          <div className="auth-logo">GP</div>
          <h1 className="auth-title-gradient">Créer un compte</h1>
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
                autoComplete="given-name"
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
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nom de l&apos;entreprise</label>
            <div className="input-wrapper">
              <Building2 className="input-icon" size={18} />
              <input
                type="text"
                name="entrepriseNom"
                placeholder="Ex. TechNova SAS"
                value={formData.entrepriseNom}
                onChange={handleChange}
                required
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Adresse de l&apos;entreprise</label>
            <div
              className={`input-wrapper${fieldErrors.companyAddress ? ' input-wrapper--error' : ''}`}
            >
              <MapPin className="input-icon" size={18} />
              <input
                type="text"
                name="companyAddress"
                placeholder="Ex. Tunis, Tunisie"
                value={formData.companyAddress}
                onChange={handleChange}
                required
                autoComplete="street-address"
                aria-invalid={fieldErrors.companyAddress ? true : undefined}
              />
            </div>
            {fieldErrors.companyAddress ? (
              <p className="field-error" role="alert">
                {fieldErrors.companyAddress}
              </p>
            ) : null}
          </div>

          <div className="form-group">
            <label>Numéro de téléphone</label>
            <PhoneCountryInput
              value={phone}
              onChange={handlePhoneChange}
              error={fieldErrors.phone}
              disabled={isSubmitting}
            />
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
                autoComplete="email"
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
                autoComplete="new-password"
              />
            </div>
            <ul className="password-rules">
              {passwordChecks.map((c) => (
                <li
                  key={c.label}
                  className={c.valid ? 'password-rule--valid' : 'password-rule--pending'}
                >
                  {c.valid ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <span className="loader-small" />
            ) : (
              <>
                <UserPlus size={20} />
                <span>S&apos;inscrire</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
