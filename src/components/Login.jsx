import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Mail, Beaker, ShieldCheck, User, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  
  // Standard form states. I'm keeping email and password separated for simple HMR updates
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UX Features: password visibility toggle & shaking card effect on validation failure
  const [showPassword, setShowPassword] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [greeting, setGreeting] = useState('Welcome back');

  // Human touch: Calculate a friendly greeting based on local time
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

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if the user left anything empty
    if (!email || !password) {
      triggerError('Please fill in both email and password fields.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Call authentication context provider
      await login(email, password);
    } catch (err) {
      // Humanized error messages to avoid raw server codes
      let friendlyError = err.message;
      if (err.message.includes('Invalid') || err.message.includes('password')) {
        friendlyError = "Oops! Those credentials don't match our database records. Double check for caps lock and try again!";
      } else if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        friendlyError = "Connection issues! We can't reach the AasaMedChem server. Is the server running on port 5000?";
      }
      triggerError(friendlyError);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to animate errors
  const triggerError = (msg) => {
    setError(msg);
    setShouldShake(true);
    
    // Reset the shake animation class after 500ms so it can be re-triggered
    setTimeout(() => {
      setShouldShake(false);
    }, 5000);
  };

  // Sandbox testing helper: quickly logs in test profiles without typing
  const handleQuickFill = async (role) => {
    setError('');
    setIsSubmitting(true);
    
    const testEmail = role === 'admin' ? 'admin@aasamedchem.com' : 'seller@aasamedchem.com';
    const testPass = role === 'admin' ? 'admin123' : 'seller123';
    
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
      
      {/* Self-contained CSS for shake animation and password toggles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .shake-card {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
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

      {/* Main Login Card - shakes if there's an error */}
      <div 
        className={`glass-panel ${shouldShake ? 'shake-card' : ''}`} 
        style={{ 
          width: '100%', 
          maxWidth: '450px', 
          padding: '40px', 
          position: 'relative',
          transition: 'all 0.3s ease'
        }}
      >
        
        {/* Glowing glassmorphism ambient backdrops */}
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Secure Gateway
            </span>
            <Sparkles size={12} color="var(--color-secondary)" />
          </div>
          
          <h2 style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: '4px', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            AasaMedChem
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {greeting}
          </p>
        </div>

        {/* Error notification display */}
        {error && (
          <div className="badge-danger animate-fade-in" style={{ 
            display: 'block',
            padding: '12px 16px', 
            borderRadius: '10px', 
            marginBottom: '24px',
            fontSize: '13px',
            textTransform: 'none',
            letterSpacing: 'normal',
            lineHeight: '1.45',
            border: '1px solid rgba(244, 63, 94, 0.4)'
          }}>
            <strong>Hold on:</strong> {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Email Box */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                className="glass-input"
                style={{ paddingLeft: '40px' }}
                placeholder="researcher@company.com"
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
              Access Code / Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              
              <input
                type={showPassword ? 'text' : 'password'}
                className="glass-input"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />

              {/* Password visibility toggle - very human-friendly addition */}
              <button
                type="button"
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide access code' : 'Reveal access code'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In Trigger Button */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '10px', borderRadius: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex-center" style={{ gap: '8px' }}>
                <div className="spinner" />
                <span>Verifying...</span>
              </div>
            ) : 'Establish Connection'}
          </button>
        </form>

        {/* Sandbox Dev-Bypass divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0 20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
          <span style={{ padding: '0 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Evaluation Bypass
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
        </div>

        {/* Sandbox Instant Profiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <button
            type="button"
            className="btn quick-fill-btn"
            style={{ borderRadius: '10px' }}
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
            style={{ borderRadius: '10px' }}
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
