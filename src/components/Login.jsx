import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Mail, Beaker, ShieldCheck, User, Eye, EyeOff, Sparkles, UserPlus, LogIn } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  
  // Tab control: 'login' or 'signup'
  const [activeMode, setActiveMode] = useState('login');

  // Input fields for login and signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('seller'); // Default new accounts to 'seller' representation

  // UI state management
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [greeting, setGreeting] = useState('Welcome back');

  // Friendly greeting calculations
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting('Good morning, researcher');
    } else if (hours < 17) {
      setGreeting('Good afternoon, scientist');
    } else {
      setGreeting('Good evening, chemist');
    }
  }, []);

  // Animate card shake on form validation/authentication failures
  const triggerError = (msg) => {
    setError(msg);
    setShouldShake(true);
    setTimeout(() => {
      setShouldShake(false);
    }, 500);
  };

  // Form submission handler (Handles both Login and Registration workflows)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (activeMode === 'login') {
      // -------------------------------------------------------------
      // LOG IN WORKFLOW
      // -------------------------------------------------------------
      if (!email || !password) {
        triggerError('Please enter your email and password.');
        return;
      }

      setIsSubmitting(true);
      try {
        await login(email, password);
      } catch (err) {
        let friendlyError = err.message;
        if (err.message.includes('Invalid') || err.message.includes('password')) {
          friendlyError = "Hmm... those credentials don't match. Check spelling or caps lock and try again!";
        } else if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          friendlyError = "Connection timed out. Please verify that your backend Express server is running on port 5000!";
        }
        triggerError(friendlyError);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // -------------------------------------------------------------
      // SIGN UP / REGISTER WORKFLOW
      // -------------------------------------------------------------
      if (!email || !password || !name || !role) {
        triggerError('All fields (Name, Email, Password, and Role) are required.');
        return;
      }

      if (password.length < 6) {
        triggerError('Security check: password must be at least 6 characters long.');
        return;
      }

      setIsSubmitting(true);
      try {
        await register(email, password, name, role);
      } catch (err) {
        let friendlyError = err.message;
        if (err.message.includes('exists') || err.message.includes('duplicate')) {
          friendlyError = "A user account with this email address already exists! Try switching back to Log In.";
        }
        triggerError(friendlyError);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Evaluation Shortcut: quick clicks to log in sandbox profiles instantly
  const handleQuickFill = async (profileRole) => {
    setError('');
    setIsSubmitting(true);
    setActiveMode('login'); // Force mode back to login since sandbox accounts are already registered
    
    const testEmail = profileRole === 'admin' ? 'admin@aasamedchem.com' : 'seller@aasamedchem.com';
    const testPass = profileRole === 'admin' ? 'admin123' : 'seller123';
    
    setEmail(testEmail);
    setPassword(testPass);

    try {
      await login(testEmail, testPass);
    } catch (err) {
      triggerError(err.message || 'Quick login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-center animate-fade-in" style={{ minHeight: '85vh', padding: '20px' }}>
      
      {/* Dynamic CSS styles for animations and tab transitions */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .shake-card {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .mode-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .mode-tab-btn-active {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          box-shadow: var(--shadow-sm);
        }
        .quick-fill-btn {
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: 10px 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          transition: all 0.2s ease;
        }
        .quick-fill-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }
      `}</style>

      {/* Main Glassmorphism Card */}
      <div 
        className={`glass-panel ${shouldShake ? 'shake-card' : ''}`} 
        style={{ 
          width: '100%', 
          maxWidth: '460px', 
          padding: '40px', 
          position: 'relative',
          transition: 'all 0.3s ease'
        }}
      >
        
        {/* Glow ambient panels */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          left: '-30px',
          width: '120px',
          height: '120px',
          background: 'var(--color-primary)',
          filter: 'blur(70px)',
          opacity: 0.45,
          zIndex: -1
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          background: 'var(--color-secondary)',
          filter: 'blur(70px)',
          opacity: 0.45,
          zIndex: -1
        }} />

        {/* Portal Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="flex-center" style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 24px 0 var(--color-primary-glow)'
          }}>
            <Beaker size={32} color="#ffffff" />
          </div>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              AasaMedChem Portal
            </span>
            <Sparkles size={11} color="var(--color-secondary)" />
          </div>
          
          <h2 style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: '2px', marginBottom: '2px' }}>
            {activeMode === 'login' ? 'Portal Connection' : 'Register Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {activeMode === 'login' ? greeting : 'Create new authentication credentials for stock management'}
          </p>
        </div>

        {/* Tab switcher: Log In vs Register */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(0,0,0,0.3)', 
          padding: '4px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          border: '1px solid var(--panel-border)'
        }}>
          <button 
            type="button"
            className={`mode-tab-btn ${activeMode === 'login' ? 'mode-tab-btn-active' : ''}`}
            onClick={() => { setActiveMode('login'); setError(''); }}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
          
          <button 
            type="button"
            className={`mode-tab-btn ${activeMode === 'signup' ? 'mode-tab-btn-active' : ''}`}
            onClick={() => { setActiveMode('signup'); setError(''); }}
          >
            <UserPlus size={14} />
            <span>Sign Up</span>
          </button>
        </div>

        {/* Error notification display */}
        {error && (
          <div className="badge-danger animate-fade-in" style={{ 
            display: 'block',
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '13px',
            textTransform: 'none',
            letterSpacing: 'normal',
            lineHeight: '1.45',
            border: '1px solid rgba(244, 63, 94, 0.4)'
          }}>
            <strong>Notice:</strong> {error}
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Register Mode extra input: Name */}
          {activeMode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="glass-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="e.g. Dr. Gautham Sinha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          )}

          {/* Email Box */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                className="glass-input"
                style={{ paddingLeft: '40px' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Password Box */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              
              <input
                type={showPassword ? 'text' : 'password'}
                className="glass-input"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                placeholder={activeMode === 'login' ? '••••••••' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />

              <button
                type="button"
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', padding: 0
                }}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Reveal password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Register Mode extra input: Role Selection Dropdown */}
          {activeMode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Account Operations Role
              </label>
              <select
                className="glass-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
                style={{ cursor: 'pointer' }}
              >
                <option value="seller">Seller / Sales Representative</option>
                <option value="admin">Admin / Warehouse Inspector</option>
              </select>
            </div>
          )}

          {/* Submit Trigger Button */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '12px', borderRadius: '8px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex-center" style={{ gap: '8px' }}>
                <div className="spinner" />
                <span>Processing...</span>
              </div>
            ) : activeMode === 'login' ? (
              'Establish Connection'
            ) : (
              'Create Account & Enter'
            )}
          </button>
        </form>

        {/* Sandbox Dev-Bypass divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '28px 0 16px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
          <span style={{ padding: '0 12px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Evaluation Sandbox
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
        </div>

        {/* Sandbox instant logging portals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <button
            type="button"
            className="btn quick-fill-btn"
            style={{ borderRadius: '8px' }}
            onClick={() => handleQuickFill('admin')}
            disabled={isSubmitting}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={16} color="#818cf8" />
              <span style={{ fontSize: '13px', fontWeight: 550 }}>Enter as Administrator</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Sarah (Admin)</span>
          </button>
          
          <button
            type="button"
            className="btn quick-fill-btn"
            style={{ borderRadius: '8px' }}
            onClick={() => handleQuickFill('seller')}
            disabled={isSubmitting}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={16} color="#22d3ee" />
              <span style={{ fontSize: '13px', fontWeight: 550 }}>Enter as Seller / Rep</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>John (Seller)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
