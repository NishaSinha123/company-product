import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthProvider';
import Navbar from './components/Navbar';
import Login from './components/Login';
import DashboardSeller from './components/DashboardSeller';
import DashboardAdmin from './components/DashboardAdmin';
 
function AppContent() {
  const { user, loading } = useAuth();
  
  // Shared cart states for Seller Console
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('products'); // Global tab state ('products' or 'orders')
 
  // Auto-route tabs based on user login role
  useEffect(() => {
    if (user) {
      if (user.role === 'seller') {
        setActiveTab('orders');
      } else {
        setActiveTab('products');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex-center animate-fade-in" style={{ minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Establishing connection to AasaMedChem Server...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === 'admin';
  const isSeller = user.role === 'seller';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        cartCount={cart.length} 
        onCartClick={() => setCartOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <main style={{ flex: 1 }}>
        {isAdmin ? (
          <DashboardAdmin 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ) : (
          <DashboardSeller 
            cart={cart}
            setCart={setCart}
            cartOpen={cartOpen}
            setCartOpen={setCartOpen}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
