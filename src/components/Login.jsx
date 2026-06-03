import React, { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Mail, Beaker, ShieldCheck, User } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setError(err.message || 'Quick login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-center animate-fade-in" style={{ minHeight: '85vh', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '40px', position: 'relative' }}>
        
        {/* Glow Effects */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '-20px',
          width: '80px',
          height: '80px',
          background: 'var(--color-primary)',
          filter: 'blur(50px)',
          opacity: 0.5,
          zIndex: -1
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          background: 'var(--color-secondary)',
          filter: 'blur(50px)',
          opacity: 0.5,
          zIndex: -1
        }} />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="flex-center" style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: 'var(--radius-md)', 
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 20px 0 var(--color-primary-glow)'
          }}>
            <Beaker size={30} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '6px' }}>
            AasaMedChem
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Inventory & Order Management System
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="badge-danger" style={{ 
            display: 'block',
            padding: '12px 16px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '20px',
            fontSize: '13px',
            textTransform: 'none',
            letterSpacing: 'normal',
            lineHeight: '1.4'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                className="glass-input"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <div className="spinner" /> : 'Log In'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '30px 0 20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
          <span style={{ padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Testing Sandbox
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
        </div>

        {/* Quick Fills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 16px' }}
            onClick={() => handleQuickFill('admin')}
            disabled={isSubmitting}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#a5b4fc" />
              <span>Login as Admin</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dr. Sarah (Admin)</span>
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 16px' }}
            onClick={() => handleQuickFill('seller')}
            disabled={isSubmitting}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="#67e8f9" />
              <span>Login as Seller</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>John Doe (Seller)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
