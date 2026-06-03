import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthProvider';
import { Search, ShoppingCart, Trash2, CheckCircle2, AlertTriangle, RefreshCw, X, ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import { UNIT_DIMENSIONS, UNIT_LABELS, getConversionFactor, calculateItemTotal, convertQuantity } from '../utils/conversions';
import confetti from 'canvas-confetti';

export default function DashboardSeller({ cart, setCart, cartOpen, setCartOpen, activeTab, setActiveTab }) {
  const { token, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Dynamic Product Loader: Pulls the chemical catalog from the Express API
  // and filters it instantly by SKU, name, description, or category group.
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);

      const response = await fetch(`${API_BASE}/api/products?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        
        // Extract categories
        const cats = [...new Set(data.map(p => p.category))].filter(Boolean);
        setCategories(cats);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // History Loader: Fetches all quotations submitted by the logged-in user.
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, category]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  // Cart operations: Adds new products, updates quantities, and removes items.
  const addToCart = (product) => {
    const exists = cart.find(item => item.product.id === product.id);
    if (exists) {
      setCartOpen(true);
      return; // Already in cart, let user modify quantity in cart drawer
    }

    setCart([...cart, {
      product,
      orderedUnit: product.base_unit,
      orderedQuantity: '1'
    }]);
    setCartOpen(true);
  };

  const updateCartItemQuantity = (index, value) => {
    const updated = [...cart];
    // Keep it as a string to allow editing decimals (e.g. typing "0.5")
    updated[index].orderedQuantity = value;
    setCart(updated);
  };

  const updateCartItemUnit = (index, unit) => {
    const updated = [...cart];
    updated[index].orderedUnit = unit;
    setCart(updated);
  };

  const removeFromCart = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  // Get compatible units based on base unit dimension
  const getCompatibleUnits = (baseUnit) => {
    const dimension = UNIT_DIMENSIONS[baseUnit];
    return Object.keys(UNIT_DIMENSIONS).filter(unit => UNIT_DIMENSIONS[unit] === dimension);
  };

  // Real-time Conversion Engine: Runs dynamically as the user types a quantity
  // or switches metric units (e.g. grams vs kilograms), showing the math breakdown.
  const getCartTotals = () => {
    let total = 0;
    let hasStockErrors = false;

    const itemsBreakdown = cart.map(item => {
      const qty = parseFloat(item.orderedQuantity) || 0;
      const factor = getConversionFactor(item.orderedUnit, item.product.base_unit);
      const baseQty = qty * factor;
      const subtotal = calculateItemTotal(qty, item.orderedUnit, item.product.base_unit, item.product.base_price);
      
      const stockAvailable = parseFloat(item.product.stock_quantity);
      const exceedsStock = baseQty > stockAvailable;
      if (exceedsStock) hasStockErrors = true;

      total += subtotal;

      return {
        ...item,
        baseQty,
        factor,
        subtotal,
        exceedsStock,
        stockAvailable
      };
    });

    return {
      items: itemsBreakdown,
      totalAmount: Math.round(total * 100) / 100,
      hasStockErrors
    };
  };

  const { items: cartItemsWithCalculations, totalAmount, hasStockErrors } = getCartTotals();

  // Checkout Handler: Sends the quotation items to the backend database transaction,
  // clears the shopping cart, and fires a confetti party on successful placement!
  const handlePlaceOrder = async () => {
    if (cart.length === 0 || hasStockErrors || placingOrder) return;
    
    setOrderError('');
    setPlacingOrder(true);

    const orderPayload = {
      items: cart.map(item => ({
        productId: item.product.id,
        orderedUnit: item.orderedUnit,
        orderedQuantity: parseFloat(item.orderedQuantity) || 0
      }))
    };

    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await response.json();

      if (response.ok) {
        // Trigger Success Confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        // Clear Cart
        setCart([]);
        setCartOpen(false);
        
        // Refresh products list to reflect new quantities (if stock were immediately reduced, but here it reduces on approval. We still fetch to check new info)
        fetchProducts();
        
        // Switch to Orders View
        setActiveTab('orders');
        fetchOrders();
      } else {
        setOrderError(data.error || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Order checkout failed:', err);
      setOrderError('Network error. Failed to connect to server.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'approved': return 'badge-indigo';
      case 'completed': return 'badge-success';
      case 'rejected': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0 24px 40px 24px' }}>
      
      {/* Navigation Headers and Switcher */}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {activeTab === 'products' ? 'Chemical & Supplies Catalog' : 'Order Quotations History'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {activeTab === 'products' 
              ? 'Browse, search, and calculate chemical components in multiple metric dimensions.' 
              : 'Track the status, items list, and billing of submitted pricing quotes.'}
          </p>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('products')}
          >
            Browse Catalog
          </button>
          <button 
            className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('orders')}
          >
            My Orders ({orders.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CATALOG VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <div>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="glass-input" 
                style={{ paddingLeft: '38px' }}
                placeholder="Search products by SKU, name, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div style={{ minWidth: '180px' }}>
              <select 
                className="glass-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {(search || category) && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '10px' }}
                onClick={() => { setSearch(''); setCategory(''); }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Catalog grid */}
          {loadingProducts ? (
            <div className="flex-center" style={{ minHeight: '300px' }}>
              <div className="spinner" />
            </div>
          ) : products.length === 0 ? (
            <div className="glass-panel flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
              <AlertTriangle size={36} color="var(--text-muted)" />
              <div style={{ textAlign: 'center' }}>
                <h3>No Products Found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Try adjusting your filters or search query.</p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {products.map(product => {
                const stock = parseFloat(product.stock_quantity);
                const isOutOfStock = stock <= 0;

                return (
                  <div key={product.id} className="glass-panel-interactive" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header: Category & SKU */}
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <span className="badge badge-cyan">{product.category}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{product.sku}</span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', lineHeight: '1.3' }}>
                      {product.name}
                    </h3>

                    {/* Description */}
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', flex: 1 }}>
                      {product.description || 'No description available.'}
                    </p>

                    {/* Footer Info: Stock & Price */}
                    <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="flex-between">
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available Stock:</span>
                        <span style={{ fontWeight: 600, color: isOutOfStock ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {isOutOfStock ? 'Out of Stock' : `${stock.toFixed(4)} ${product.base_unit}`}
                        </span>
                      </div>
                      
                      <div className="flex-between" style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Rate:</span>
                        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-secondary)' }}>
                          ₹{parseFloat(product.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>
                            / {product.base_unit}
                          </span>
                        </span>
                      </div>

                      {/* Add Button */}
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', gap: '8px' }}
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                      >
                        <ShoppingCart size={16} />
                        <span>{isOutOfStock ? 'Unavailable' : 'Configure & Order'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDERS HISTORY VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div>
          {loadingOrders ? (
            <div className="flex-center" style={{ minHeight: '300px' }}>
              <div className="spinner" />
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-panel flex-center" style={{ minHeight: '260px', flexDirection: 'column', gap: '16px' }}>
              <PackageCheck size={36} color="var(--text-muted)" />
              <div style={{ textAlign: 'center' }}>
                <h3>No Orders Placed Yet</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>You haven't submitted any quotations or orders in this account.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map(order => {
                const isExpanded = expandedOrder === order.id;
                const formattedTotal = parseFloat(order.total_amount).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR'
                });

                return (
                  <div key={order.id} className="glass-panel" style={{ overflow: 'hidden' }}>
                    {/* Collapsed Header */}
                    <div 
                      className="flex-between" 
                      style={{ padding: '20px', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                            {order.order_number}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Placed on {new Date(order.created_at).toLocaleString()}
                          </div>
                        </div>
                        
                        <div>
                          <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Amount</span>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>{formattedTotal}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Expanded Details View */}
                    {isExpanded && (
                      <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.15)' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ordered Items & Unit Conversion Breakdown
                        </h4>
                        
                        <div className="custom-table-container">
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Product Details</th>
                                <th>Ordered Quantity</th>
                                <th>Unit Conversion Math</th>
                                <th>Rate (Base)</th>
                                <th style={{ textAlign: 'right' }}>Item Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map(item => {
                                const unitRatio = parseFloat(item.conversion_factor);
                                const isDirectUnit = unitRatio === 1;

                                return (
                                  <tr key={item.id}>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{item.product_name || 'Deleted Product'}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        SKU: {item.product_sku || 'N/A'}
                                      </div>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: 600 }}>
                                        {parseFloat(item.ordered_quantity).toFixed(4)} {item.ordered_unit}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>
                                      {isDirectUnit ? (
                                        <span style={{ color: 'var(--text-muted)' }}>Direct base calculation</span>
                                      ) : (
                                        <div>
                                          <div style={{ fontFamily: 'monospace' }}>
                                            {parseFloat(item.ordered_quantity).toFixed(4)} {item.ordered_unit} × {unitRatio} =
                                          </div>
                                          <div style={{ fontWeight: 600, color: 'var(--color-cyan)' }}>
                                            {parseFloat(item.base_quantity).toFixed(8)} {item.base_unit}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      <span>₹{parseFloat(item.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {item.base_unit}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      ₹{parseFloat(item.item_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CART DRAWER SLIDE OUT */}
      {/* ========================================================================= */}
      {cartOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '500px',
          height: '100vh',
          background: 'rgba(8, 14, 25, 0.95)',
          borderLeft: '1px solid var(--panel-border)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {/* Drawer Header */}
          <div className="flex-between" style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart size={20} color="var(--color-secondary)" />
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Create Quotation Order</h2>
              <span className="badge badge-cyan">{cart.length} items</span>
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px', borderRadius: '50%', background: 'transparent', borderColor: 'transparent' }}
              onClick={() => setCartOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Items Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {orderError && (
              <div className="badge-danger" style={{ 
                display: 'block', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', textTransform: 'none', letterSpacing: 'normal', lineHeight: '1.4'
              }}>
                <strong>Error placing order:</strong> {orderError}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="flex-center" style={{ height: '60%', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
                <ShoppingCart size={48} />
                <p>Your quotation cart is empty.</p>
                <button className="btn btn-primary" onClick={() => setCartOpen(false)}>Add Some Products</button>
              </div>
            ) : (
              cartItemsWithCalculations.map((item, idx) => {
                const compUnits = getCompatibleUnits(item.product.base_unit);
                const showConversionMsg = item.orderedUnit !== item.product.base_unit;

                return (
                  <div key={item.product.id} className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.015)' }}>
                    <div className="flex-between" style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {item.product.sku}
                      </span>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(244,63,94,0.1)', border: 'none' }}
                        onClick={() => removeFromCart(idx)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{item.product.name}</h4>

                    {/* Quantity & Unit Select Input Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Ordered Quantity
                        </label>
                        <input
                          type="text"
                          className="glass-input"
                          style={{ padding: '8px 12px' }}
                          value={item.orderedQuantity}
                          onChange={(e) => updateCartItemQuantity(idx, e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Unit Choice
                        </label>
                        <select
                          className="glass-input"
                          style={{ padding: '8px 12px' }}
                          value={item.orderedUnit}
                          onChange={(e) => updateCartItemUnit(idx, e.target.value)}
                        >
                          {compUnits.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Stock Alert Badge */}
                    {item.exceedsStock && (
                      <div className="badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '4px', textTransform: 'none', letterSpacing: 'normal', fontSize: '11px', marginBottom: '12px' }}>
                        <AlertTriangle size={12} />
                        <span>
                          Exceeds Stock. Available: {item.stockAvailable.toFixed(4)} {item.product.base_unit}.
                          Required: {item.baseQty.toFixed(4)} {item.product.base_unit}.
                        </span>
                      </div>
                    )}

                    {/* Real-time Math Equation Box */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div className="flex-between">
                        <span>Formula Breakdown:</span>
                        <span style={{ color: 'var(--color-primary)' }}>({UNIT_DIMENSIONS[item.product.base_unit]})</span>
                      </div>
                      
                      {showConversionMsg ? (
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '4px', mb: '4px', paddingBottom: '4px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{parseFloat(item.orderedQuantity) || 0} {item.orderedUnit}</span>
                          {' '}× {item.factor} (Factor) ={' '}
                          <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                            {item.baseQty.toFixed(8)} {item.product.base_unit}
                          </span>
                        </div>
                      ) : (
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '4px', mb: '4px', paddingBottom: '4px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-secondary)' }}>Direct {item.product.base_unit} mapping (Ratio 1:1)</span>
                        </div>
                      )}

                      <div className="flex-between">
                        <span>
                          {item.baseQty.toFixed(4)} {item.product.base_unit} × ₹{parseFloat(item.product.base_price).toFixed(2)}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                          ₹{item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer Actions */}
          {cart.length > 0 && (
            <div style={{ padding: '24px', borderTop: '1px solid var(--panel-border)', background: 'rgba(10, 18, 30, 0.98)' }}>
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>Quotation Net Total:</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-success)' }}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                className="btn btn-success"
                style={{ width: '100%', padding: '14px', fontSize: '16px', gap: '8px' }}
                disabled={hasStockErrors || placingOrder}
                onClick={handlePlaceOrder}
              >
                {placingOrder ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Submit Quotation Order</span>
                  </>
                )}
              </button>
              
              {hasStockErrors && (
                <p style={{ color: 'var(--color-danger)', fontSize: '11px', textAlign: 'center', marginTop: '10px' }}>
                  Please resolve the stock errors before submitting.
                </p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
