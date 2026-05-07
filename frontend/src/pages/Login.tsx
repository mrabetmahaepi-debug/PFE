import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const roleName = typeof user.role === 'object' ? user.role?.nom : user.role;
      const r = (roleName?.toString() || '').trim().toUpperCase();
      
      // Both Admins and SuperAdmins should go to Dashboard in this version
      if (r === 'SUPERADMIN' || r === 'ADMIN') {
        navigate('/dashboard');
      } else if (r === 'CHEF DE PROJET' || r === 'PROJECT MANAGER' || r === 'PM') {
        navigate('/projects');
      } else if (r === 'MEMBRE' || r === 'MEMBER') {
        navigate('/tasks');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate, loading]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const userData = await login({ email, password });
      
      const roleName = typeof userData.role === 'object' ? userData.role?.nom : userData.role;
      const r = (roleName?.toString() || '').trim().toUpperCase();
      
      if (r === 'SUPERADMIN' || r === 'ADMIN') {
        navigate('/dashboard');
      } else if (r === 'CHEF DE PROJET' || r === 'PROJECT MANAGER' || r === 'PM') {
        navigate('/projects');
      } else if (r === 'MEMBRE' || r === 'MEMBER') {
        navigate('/tasks');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error("Login failed:", err.response?.data || err);
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-card"
      >
        <div className="auth-header">
          <div className="auth-logo">PM</div>
          <h1>Welcome Back</h1>
          <p>Login to manage your projects</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loader-small"></span>
            ) : (
              <>
                <LogIn size={20} />
                <span>Login</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
