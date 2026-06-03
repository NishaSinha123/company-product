import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthProvider';
import { Plus, Edit2, Trash2, Check, X, Beaker, AlertTriangle, AlertCircle, ShoppingBag, FolderSearch, RefreshCw, Layers } from 'lucide-react';
import { UNIT_DIMENSIONS, UNIT_LABELS } from '../utils/conversions';

export default function DashboardAdmin({ activeTab: activeSubTab, setActiveTab: setActiveSubTab, isSeller = false }) {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  
  // Statistics States
  const [stats, setStats] = useState({ buyerStats: [], sellerStats: [] });
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Products Loading & Error states
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productError, setProductError] = useState('');
  
  // Product Form Fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [basePrice, setBasePrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');

  // Orders Loading & Status states
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderActionError, setOrderActionError] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState(null);

  // Inventory Lister: Pulls all registered chemicals and stock levels
  // from our PostgreSQL catalog to display them in the management table.
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch(`${API_BASE}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Requests Feed: Pulls all submitted quotations from sellers and general users
  // to list them in the admin reviews dashboard.
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

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    if (!isSeller) {
      fetchStats();
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'reports' && !isSeller) {
      fetchStats();
    }
  }, [activeSubTab]);

  // Open Form to Create Product
  const openCreateForm = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setDescription('');
    setCategory('');
    setBaseUnit('kg');
    setBasePrice('');
    setStockQuantity('');
    setProductError('');
    setProductFormOpen(true);
  };

  // Open Form to Edit Product
  const openEditForm = (product) => {
    setEditingProduct(product);
    setSku(product.sku);
    setName(product.name);
    setDescription(product.description || '');
    setCategory(product.category || '');
    setBaseUnit(product.base_unit);
    setBasePrice(product.base_price.toString());
    setStockQuantity(product.stock_quantity.toString());
    setProductError('');
    setProductFormOpen(true);
  };

  // Product Save Controller: Sends new or edited chemical profile details (SKU, name,
  // description, base price, and current stock) to the backend database.
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!sku || !name || !baseUnit || basePrice === '' || stockQuantity === '') {
      setProductError('SKU, Name, Unit, Price, and Stock are required.');
      return;
    }

    const priceNum = parseFloat(basePrice);
    const stockNum = parseFloat(stockQuantity);

    if (isNaN(priceNum) || priceNum < 0) {
      setProductError('Base price must be a non-negative number.');
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      setProductError('Stock quantity must be a non-negative number.');
      return;
    }

    setProductError('');
    const payload = {
      sku,
      name,
      description,
      category: category || 'General',
      base_unit: baseUnit,
      base_price: priceNum,
      stock_quantity: stockNum
    };

    try {
      let response;
      if (editingProduct) {
        response = await fetch(`${API_BASE}/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE}/api/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (response.ok) {
        setProductFormOpen(false);
        fetchProducts(); // Refresh list
      } else {
        setProductError(data.error || 'Failed to save product details.');
      }
    } catch (err) {
      console.error('Failed to submit product:', err);
      setProductError('Network error. Failed to contact server.');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product? All stock values will be removed.')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchProducts();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete product.');
      }
    } catch (err) {
      console.error('Delete product error:', err);
    }
  };

  // Order Status Auditor: Coordinates status transitions (e.g. approving a quote,
  // which executes a backend stock check and decrements warehouse inventory).
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setOrderActionError('');
    setProcessingOrderId(orderId);

    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh orders & products to update status and inventory numbers
        fetchOrders();
        fetchProducts();
        if (!isSeller) {
          fetchStats();
        }
      } else {
        setOrderActionError(data.error || `Failed to update status to ${newStatus}.`);
      }
    } catch (err) {
      console.error('Status update failed:', err);
      setOrderActionError('Network error. Failed to update order status.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Verification Auditor: Compares the converted order items against the active
  // warehouse stock levels to check if we have enough stock before approving.
  const checkItemStockSufficiency = (item) => {
    const matchedProduct = products.find(p => p.id === item.product_id);
    if (!matchedProduct) return { exists: false, sufficient: false, stock: 0 };
    
    const currentStock = parseFloat(matchedProduct.stock_quantity);
    const requiredStock = parseFloat(item.base_quantity);
    return {
      exists: true,
      sufficient: currentStock >= requiredStock,
      stock: currentStock
    };
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
      
      {/* Subtab Navigation */}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {isSeller 
              ? 'Quotation Requests Queue' 
              : activeSubTab === 'reports'
              ? 'Sales & Usage Analytics'
              : activeSubTab === 'orders' 
              ? 'Incoming Order Proposals' 
              : 'Warehouse Inventory Stock'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSeller
              ? 'As a sales representative, review user order proposals, inspect conversions, and confirm or reject them.'
              : activeSubTab === 'reports'
              ? 'Observe details on how much medicine general users took and how much sales reps confirmed.'
              : activeSubTab === 'orders' 
              ? 'Review quotation items, inspect unit mathematical conversions, and approve/reject orders.' 
              : 'Add new items, adjust stock levels, configure pricing, and manage chemical catalogs.'}
          </p>
        </div>

        {!isSeller && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`btn ${activeSubTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('products')}
            >
              Manage Inventory Catalog
            </button>
            <button 
              className={`btn ${activeSubTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('orders')}
            >
              Quotation Requests Feed ({orders.length})
            </button>
            <button 
              className={`btn ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('reports')}
            >
              Sales & Usage Reports
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INCOMING ORDERS FEED */}
      {/* ========================================================================= */}
      {activeSubTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orderActionError && (
            <div className="badge-danger" style={{ 
              display: 'block', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', textTransform: 'none', letterSpacing: 'normal', lineHeight: '1.4'
            }}>
              <strong>Operation Error:</strong> {orderActionError}
            </div>
          )}

          {loadingOrders ? (
            <div className="flex-center" style={{ minHeight: '300px' }}>
              <div className="spinner" />
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-panel flex-center" style={{ minHeight: '260px', flexDirection: 'column', gap: '16px' }}>
              <FolderSearch size={36} color="var(--text-muted)" />
              <div style={{ textAlign: 'center' }}>
                <h3>No Incoming Requests</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>No seller orders have been submitted yet.</p>
              </div>
            </div>
          ) : (
            orders.map(order => {
              const isExpanded = expandedOrder === order.id;
              const isPending = order.status === 'pending';
              const isApproved = order.status === 'approved';
              const isProcessing = processingOrderId === order.id;
              const formattedTotal = parseFloat(order.total_amount).toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR'
              });

              // Check if all items in order have sufficient stock
              let allStockSufficient = true;
              order.items.forEach(item => {
                if (isPending) {
                  const check = checkItemStockSufficiency(item);
                  if (check.exists && !check.sufficient) {
                    allStockSufficient = false;
                  }
                }
              });

              return (
                <div key={order.id} className="glass-panel" style={{ overflow: 'hidden' }}>
                  {/* Collapsed Header */}
                  <div 
                    className="flex-between" 
                    style={{ padding: '20px', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.015)' : 'transparent' }}
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                          {order.order_number}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>Ordered by: <strong>{order.buyer_name || 'System User'}</strong> ({order.buyer_email || 'no-email'})</span>
                          {order.seller_name && (
                            <span>Confirmed by: <strong>{order.seller_name}</strong> ({order.seller_email})</span>
                          )}
                        </div>
                      </div>
                      
                      <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                      
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Order Value</span>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>{formattedTotal}</div>
                      </div>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} />}
                    </div>
                  </div>

                  {/* Expanded Breakdown & Audit */}
                  {isExpanded && (
                    <div style={{ padding: '24px', borderTop: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.18)' }}>
                      
                      {/* Audit mathematical formulas */}
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Line Item Audit & Unit Conversions
                      </h4>

                      <div className="custom-table-container" style={{ marginBottom: '20px' }}>
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Product Information</th>
                              <th>Ordered Qty</th>
                              <th>Conversion Math & Scaling</th>
                              <th>Base Quantity</th>
                              <th>Base price / Unit</th>
                              <th>Available Stock</th>
                              <th style={{ textAlign: 'right' }}>Item Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(item => {
                              const stockCheck = checkItemStockSufficiency(item);
                              const unitRatio = parseFloat(item.conversion_factor);
                              const isDirect = unitRatio === 1;

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
                                  <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                    {isDirect ? (
                                      <span style={{ color: 'var(--text-muted)' }}>Direct (Ratio 1:1)</span>
                                    ) : (
                                      <span>
                                        {parseFloat(item.ordered_quantity).toFixed(4)} {item.ordered_unit} × {unitRatio}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>
                                      {parseFloat(item.base_quantity).toFixed(8)} {item.base_unit}
                                    </span>
                                  </td>
                                  <td>
                                    <span>₹{parseFloat(item.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {item.base_unit}</span>
                                  </td>
                                  <td>
                                    {isPending ? (
                                      <span style={{ 
                                        fontWeight: 600, 
                                        color: stockCheck.sufficient ? 'var(--color-success)' : 'var(--color-danger)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        {!stockCheck.sufficient && <AlertCircle size={12} />}
                                        {stockCheck.stock.toFixed(4)} {item.base_unit}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>N/A (Processed)</span>
                                    )}
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

                      {/* Admin Workflow Buttons */}
                      <div className="flex-between" style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                        <div>
                          {isPending && !allStockSufficient && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '13px' }}>
                              <AlertTriangle size={16} />
                              <span>Warning: One or more products do not have sufficient stock. Approval is blocked.</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          {isPending && (
                            <>
                              <button
                                className="btn btn-danger"
                                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}
                                onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                                disabled={isProcessing}
                              >
                                Reject Quote
                              </button>
                              
                              <button
                                className="btn btn-success"
                                onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                                disabled={isProcessing || !allStockSufficient}
                              >
                                Approve Order (Deduct Stock)
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                                onClick={() => handleUpdateOrderStatus(order.id, 'pending')}
                                disabled={isProcessing}
                              >
                                Restore to Pending (Return Stock)
                              </button>

                              <button
                                className="btn btn-cyan"
                                onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                disabled={isProcessing}
                              >
                                Mark as Delivered / Completed
                              </button>
                            </>
                          )}

                          {(order.status === 'rejected' || order.status === 'completed') && (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              This order has been archived as <strong>{order.status.toUpperCase()}</strong>. No further actions required.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INVENTORY CATALOG CRUD LIST */}
      {/* ========================================================================= */}
      {activeSubTab === 'products' && (
        <div>
          {/* Action Row */}
          <div className="flex-between" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Total Products Registered: <strong>{products.length}</strong>
            </div>
            
            <button className="btn btn-primary" onClick={openCreateForm} style={{ gap: '6px' }}>
              <Plus size={16} />
              <span>Create Product SKU</span>
            </button>
          </div>

          {/* Catalog list table */}
          {loadingProducts ? (
            <div className="flex-center" style={{ minHeight: '300px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '8px' }}>
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>SKU Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Base Unit</th>
                      <th>Unit Base Price (INR)</th>
                      <th>Stock Level</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => {
                      const stockVal = parseFloat(product.stock_quantity);
                      const isLowStock = stockVal < 5.0 && product.base_unit !== 'g'; // Weight gram base could naturally be small (e.g. gold nano 2g is fine)
                      const isOutOfStock = stockVal <= 0;

                      return (
                        <tr key={product.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{product.sku}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {product.description || 'No description provided'}
                            </div>
                          </td>
                          <td><span className="badge badge-cyan">{product.category}</span></td>
                          <td><span className="badge badge-indigo">{product.base_unit}</span></td>
                          <td style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>
                            ₹{parseFloat(product.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span style={{ 
                              fontWeight: 700, 
                              color: isOutOfStock 
                                ? 'var(--color-danger)' 
                                : isLowStock 
                                  ? 'var(--color-warning)' 
                                  : 'var(--text-primary)'
                            }}>
                              {stockVal.toFixed(4)} {product.base_unit}
                              {isOutOfStock && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--color-danger)' }}>(Out of Stock)</span>}
                              {!isOutOfStock && isLowStock && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--color-warning)' }}>(Low Stock)</span>}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                onClick={() => openEditForm(product)}
                                title="Edit Product"
                              >
                                <Edit2 size={13} />
                              </button>
                              
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px 10px', fontSize: '12px', background: 'rgba(244,63,94,0.1)', border: 'none' }}
                                onClick={() => handleDeleteProduct(product.id)}
                                title="Delete Product"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* PRODUCT CREATION/EDIT MODAL DIALOG */}
      {/* ========================================================================= */}
      {productFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          background: 'rgba(2, 6, 13, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '580px', padding: '32px' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '20px', fontWeight: 600 }}>
                  {editingProduct ? `Modify Product SKU Details` : 'Register New Inventory Product'}
                </h3>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px', borderRadius: '50%', background: 'transparent', borderColor: 'transparent' }}
                onClick={() => setProductFormOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {productError && (
              <div className="badge-danger" style={{ 
                display: 'block', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', fontSize: '13px', textTransform: 'none', letterSpacing: 'normal', lineHeight: '1.4'
              }}>
                <strong>Input Validation Error:</strong> {productError}
              </div>
            )}

            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    SKU Identifier Code *
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="e.g. SOL-ETH-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Product Category Group
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="e.g. Solvents, Acids, Reagents"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Product Display Name *
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Absolute Ethanol"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Technical Description
                </label>
                <textarea
                  className="glass-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  placeholder="Write details like assay purity, manufacturer codes, storage conditions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Base Storage Unit *
                  </label>
                  <select
                    className="glass-input"
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    disabled={!!editingProduct} // Disable unit changes to prevent dimension mismatch on existing orders
                  >
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="mL">Milliliters (mL)</option>
                    <option value="L">Liters (L)</option>
                    <option value="items">Items (count)</option>
                  </select>
                  {editingProduct && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Base unit locked for existing items.
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Price per Unit (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    className="glass-input"
                    placeholder="e.g. 800.00"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Stock Level (Base Unit) *
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    className="glass-input"
                    placeholder="e.g. 150.00"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setProductFormOpen(false)}
                >
                  Cancel
                </button>
                
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Save Product Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATS REPORTS VIEW */}
      {/* ========================================================================= */}
      {!isSeller && activeSubTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {loadingStats ? (
            <div className="glass-panel flex-center" style={{ minHeight: '300px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
              gap: '24px'
            }}>
              {/* User Consumption Card */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-primary)' }}>Medicine Consumption (General Users)</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Total chemical volume and orders completed per user account.</p>
                </div>
                
                {stats.buyerStats.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px 0' }}>No purchases logged yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>User Profile</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Orders</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Quantity</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.buyerStats.map(b => (
                          <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '14px 8px' }}>
                              <div style={{ fontWeight: 600 }}>{b.buyer_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.buyer_email}</div>
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center' }}>{b.total_orders}</td>
                            <td style={{ padding: '14px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {parseFloat(b.total_quantity).toFixed(2)}
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-secondary)' }}>
                              ₹{parseFloat(b.total_spend).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Seller Achievement Card */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-cyan)' }}>Sales Summary (Sellers / Reps)</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Total chemical volume and values confirmed by sales representatives.</p>
                </div>
                
                {stats.sellerStats.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px 0' }}>No sales logged yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Sales Rep</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Confirmed</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Quantity Sold</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sellerStats.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '14px 8px' }}>
                              <div style={{ fontWeight: 600 }}>{s.seller_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.seller_email}</div>
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center' }}>{s.total_sales_orders}</td>
                            <td style={{ padding: '14px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {parseFloat(s.total_quantity_sold).toFixed(2)}
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-cyan)' }}>
                              ₹{parseFloat(s.total_sales_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
