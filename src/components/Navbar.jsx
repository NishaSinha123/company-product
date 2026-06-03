import React from 'react';
import { useAuth } from '../context/AuthProvider';
import { Beaker, LogOut, ShoppingCart, ShieldAlert, ShoppingBag, FolderHeart } from 'lucide-react';

export default function Navbar({ cartCount = 0, onCartClick = null, activeTab = '', setActiveTab = null }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <header className="glass-panel" style={{
      borderRadius: '0 0 var(--radius-md) var(--radius-md)',
      padding: '16px 24px',
      margin: '0 0 24px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 999
    }}>
      {/* Brand logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="flex-center" style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
          boxShadow: '0 4px 10px 0 var(--color-primary-glow)'
        }}>
          <Beaker size={20} color="#ffffff" />
        </div>
        <div>
          <span style={{ 
            fontFamily: 'var(--font-display)', 
            fontWeight: 700, 
            fontSize: '18px',
            background: 'linear-gradient(to right, #ffffff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            AasaMedChem
          </span>
        </div>
      </div>

      {/* Navigation tabs for panels */}
      {setActiveTab && user.role !== 'seller' && (
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
          <button
            className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
            onClick={() => setActiveTab('products')}
          >
            <ShoppingBag size={14} />
            <span>Products</span>
          </button>
          
          <button
            className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
            onClick={() => setActiveTab('orders')}
          >
            <FolderHeart size={14} />
            <span>{isAdmin ? 'Quotation Orders' : 'My Orders'}</span>
          </button>

          {isAdmin && (
            <button
              className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
              onClick={() => setActiveTab('reports')}
            >
              <ShieldAlert size={14} />
              <span>Stats Reports</span>
            </button>
          )}
        </div>
      )}

      {/* User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right', display: 'none', md: 'block' }} className="user-profile-details">
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</div>
        </div>

        {/* Role Badge */}
        {isAdmin ? (
          <span className="badge badge-indigo" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldAlert size={12} />
            Admin
          </span>
        ) : user.role === 'seller' ? (
          <span className="badge badge-cyan">
            Seller
          </span>
        ) : (
          <span className="badge badge-success">
            User
          </span>
        )}

        {/* Cart Trigger (Sellers Only) */}
        {!isAdmin && onCartClick && (
          <button 
            className="btn btn-secondary" 
            style={{ position: 'relative', padding: '8px 12px' }}
            onClick={onCartClick}
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="flex-center animate-fade-in" style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '18px',
                height: '18px',
                background: 'var(--color-secondary)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '50%',
                boxShadow: '0 0 10px var(--color-secondary)'
              }}>
                {cartCount}
              </span>
            )}
          </button>
        )}

        {/* Logout */}
        <button 
          className="btn btn-danger" 
          style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)' }}
          onClick={logout}
          title="Log Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
