import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query, runTransaction, initDb } from './db.js';
import { areUnitsCompatible, getConversionFactor, calculateItemTotal } from './utils/conversions.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize Database on Startup
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (err) {
      console.error('Failed to initialize database on request:', err);
    }
  }
  next();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'AasaMedChem_Secure_Jwt_Token_Secret_Key_2026', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Role-based Access Middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Forbidden: Requires ${role} role.` });
    }
    next();
  };
};

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register a new user (Open for testing, or admin creates)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields (email, password, name, role) are required.' });
  }

  if (role !== 'admin' && role !== 'seller' && role !== 'user') {
    return res.status(400).json({ error: "Invalid role. Must be 'admin', 'seller', or 'user'." });
  }

  try {
    // Check if user already exists
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, role]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'AasaMedChem_Secure_Jwt_Token_Secret_Key_2026',
      { expiresIn: '24h' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'AasaMedChem_Secure_Jwt_Token_Secret_Key_2026',
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// PRODUCT ENDPOINTS
// ==========================================

// Get Products (Search, Filter)
app.get('/api/products', authenticateToken, async (req, res) => {
  const { search, category } = req.query;
  
  let queryString = 'SELECT * FROM products';
  const queryParams = [];

  const conditions = [];
  if (search) {
    queryParams.push(`%${search}%`);
    conditions.push(`(name ILIKE $${queryParams.length} OR sku ILIKE $${queryParams.length} OR description ILIKE $${queryParams.length})`);
  }
  if (category) {
    queryParams.push(category);
    conditions.push(`category = $${queryParams.length}`);
  }

  if (conditions.length > 0) {
    queryString += ' WHERE ' + conditions.join(' AND ');
  }

  queryString += ' ORDER BY category ASC, name ASC';

  try {
    const result = await query(queryString, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create Product (Admin Only)
app.post('/api/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { sku, name, description, category, base_unit, base_price, stock_quantity } = req.body;

  if (!sku || !name || !base_unit || base_price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ error: 'SKU, Name, Base Unit, Price, and Stock are required.' });
  }

  // Validate base_unit
  const validUnits = ['g', 'kg', 'mL', 'L', 'items'];
  if (!validUnits.includes(base_unit)) {
    return res.status(400).json({ error: `Invalid unit. Supported: ${validUnits.join(', ')}` });
  }

  if (parseFloat(base_price) < 0 || parseFloat(stock_quantity) < 0) {
    return res.status(400).json({ error: 'Price and stock quantity must be non-negative.' });
  }

  try {
    // Check if SKU is unique
    const existingSku = await query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existingSku.rows.length > 0) {
      return res.status(400).json({ error: `Product with SKU '${sku}' already exists.` });
    }

    const result = await query(
      `INSERT INTO products (sku, name, description, category, base_unit, base_price, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sku, name, description, category || 'Uncategorized', base_unit, base_price, stock_quantity]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update Product (Admin Only)
app.put('/api/products/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { sku, name, description, category, base_unit, base_price, stock_quantity } = req.body;

  if (!sku || !name || !base_unit || base_price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ error: 'SKU, Name, Base Unit, Price, and Stock are required.' });
  }

  // Validate unit
  const validUnits = ['g', 'kg', 'mL', 'L', 'items'];
  if (!validUnits.includes(base_unit)) {
    return res.status(400).json({ error: `Invalid unit. Supported: ${validUnits.join(', ')}` });
  }

  if (parseFloat(base_price) < 0 || parseFloat(stock_quantity) < 0) {
    return res.status(400).json({ error: 'Price and stock quantity must be non-negative.' });
  }

  try {
    // Check product exists
    const checkProduct = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (checkProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const oldProduct = checkProduct.rows[0];

    // Check SKU uniqueness if changed
    if (oldProduct.sku !== sku) {
      const existingSku = await query('SELECT id FROM products WHERE sku = $1 AND id <> $2', [sku, id]);
      if (existingSku.rows.length > 0) {
        return res.status(400).json({ error: `Product with SKU '${sku}' already exists.` });
      }
    }

    // Verify unit dimension compatibility if changed
    if (oldProduct.base_unit !== base_unit) {
      if (!areUnitsCompatible(oldProduct.base_unit, base_unit)) {
        return res.status(400).json({
          error: `Cannot change unit from '${oldProduct.base_unit}' to '${base_unit}' because they belong to different dimensions.`
        });
      }
    }

    const result = await query(
      `UPDATE products 
       SET sku = $1, name = $2, description = $3, category = $4, base_unit = $5, base_price = $6, stock_quantity = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [sku, name, description, category, base_unit, base_price, stock_quantity, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete Product (Admin Only)
app.delete('/api/products/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const checkProduct = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (checkProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// ORDER / QUOTATION ENDPOINTS
// ==========================================

// Get Orders (Admin sees all, Seller sees only their own)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let ordersQuery = '';
    let queryParams = [];

    if (req.user.role === 'admin') {
      ordersQuery = `
        SELECT o.*, u.name as seller_name, u.email as seller_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `;
    } else {
      ordersQuery = `
        SELECT o.*, u.name as seller_name, u.email as seller_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.user_id = $1
        ORDER o.created_at DESC
      `;
      queryParams.push(req.user.id);
    }

    const ordersResult = await query(ordersQuery, queryParams);
    const orders = ordersResult.rows;

    // Fetch order items for each order
    for (const order of orders) {
      const itemsResult = await query(
        `SELECT oi.*, p.name as product_name, p.sku as product_sku
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;
    }

    res.json(orders);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create Order/Quotation (Seller or User)
app.post('/api/orders', authenticateToken, (req, res, next) => {
  if (req.user.role !== 'seller' && req.user.role !== 'user') {
    return res.status(403).json({ error: "Forbidden: Only sellers and general users can place order quotations." });
  }
  next();
}, async (req, res) => {
  const { items } = req.body; // Array of { productId, orderedUnit, orderedQuantity }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    // We will validate products and perform calculations in memory first
    const preparedItems = [];
    let orderTotal = 0;

    for (const item of items) {
      const { productId, orderedUnit, orderedQuantity } = item;
      
      const qVal = parseFloat(orderedQuantity);
      if (!productId || !orderedUnit || isNaN(qVal) || qVal <= 0) {
        return res.status(400).json({ error: 'Invalid product details, unit, or quantity in cart.' });
      }

      // Fetch product to verify
      const prodResult = await query('SELECT * FROM products WHERE id = $1', [productId]);
      if (prodResult.rows.length === 0) {
        return res.status(404).json({ error: `Product with ID '${productId}' not found.` });
      }

      const product = prodResult.rows[0];

      // Verify unit dimension compatibility
      if (!areUnitsCompatible(orderedUnit, product.base_unit)) {
        return res.status(400).json({
          error: `Incompatible unit dimensions for product '${product.name}'. Ordered: '${orderedUnit}', Base: '${product.base_unit}'.`
        });
      }

      // Perform conversion and pricing calculations
      const conversionFactor = getConversionFactor(orderedUnit, product.base_unit);
      const baseQuantity = qVal * conversionFactor;
      const itemTotal = calculateItemTotal(qVal, orderedUnit, product.base_unit, product.base_price);
      
      // Check stock at checkout placement
      const currentStock = parseFloat(product.stock_quantity);
      if (baseQuantity > currentStock) {
        return res.status(400).json({
          error: `Insufficient stock for product '${product.name}'. Available: ${currentStock} ${product.base_unit}. Ordered: ${qVal} ${orderedUnit} (${baseQuantity} ${product.base_unit}).`
        });
      }

      preparedItems.push({
        product_id: product.id,
        ordered_unit: orderedUnit,
        ordered_quantity: qVal,
        conversion_factor: conversionFactor,
        base_quantity: baseQuantity,
        base_unit: product.base_unit,
        base_price: parseFloat(product.base_price),
        item_total: itemTotal
      });

      orderTotal += itemTotal;
    }

    // Insert Order & Order Items using a Database Transaction
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = await runTransaction(async (client) => {
      // 1. Insert order
      const orderInsert = await client.query(
        `INSERT INTO orders (order_number, user_id, status, total_amount) 
         VALUES ($1, $2, 'pending', $3) 
         RETURNING *`,
        [orderNumber, req.user.id, orderTotal]
      );
      const order = orderInsert.rows[0];

      // 2. Insert items
      for (const item of preparedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, ordered_unit, ordered_quantity, conversion_factor, base_quantity, base_unit, base_price, item_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            order.id,
            item.product_id,
            item.ordered_unit,
            item.ordered_quantity,
            item.conversion_factor,
            item.base_quantity,
            item.base_unit,
            item.base_price,
            item.item_total
          ]
        );
        
        // Note: We do NOT deduct stock upon order creation (it is a pending quotation).
        // Stock deduction will happen when the admin approves the order.
      }

      return order;
    });

    res.status(201).json({ message: 'Order quotation submitted successfully.', order: newOrder });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update Order Status (Admin Only)
// Transitions: pending -> approved/completed (deducts stock), approved/completed -> rejected/pending (restores stock)
app.patch('/api/orders/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved', 'rejected', 'completed', 'pending'

  const allowedStatuses = ['approved', 'rejected', 'completed', 'pending'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Choose from: ${allowedStatuses.join(', ')}` });
  }

  try {
    // Get current order and items
    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderResult.rows[0];
    const oldStatus = order.status;

    if (oldStatus === status) {
      return res.json({ message: `Order status is already '${status}'.`, order });
    }

    const itemsResult = await query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    const items = itemsResult.rows;

    const resultOrder = await runTransaction(async (client) => {
      // 1. Handle stock movements
      const activeStates = ['approved', 'completed'];
      
      const wasActive = activeStates.includes(oldStatus);
      const isNowActive = activeStates.includes(status);

      // Scenario A: Transitioning from Pending/Rejected to Approved/Completed (DEDUCT STOCK)
      if (!wasActive && isNowActive) {
        for (const item of items) {
          // Fetch current stock
          const prodResult = await client.query('SELECT stock_quantity, name FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
          if (prodResult.rows.length === 0) {
            throw new Error(`Product for item not found.`);
          }
          
          const product = prodResult.rows[0];
          const stock = parseFloat(product.stock_quantity);
          const reqQty = parseFloat(item.base_quantity);

          if (stock < reqQty) {
            throw new Error(`Insufficient stock for product '${product.name}'. Available: ${stock} ${item.base_unit}, Required: ${reqQty} ${item.base_unit}.`);
          }

          // Decrement stock
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
            [reqQty, item.product_id]
          );
        }
      }
      
      // Scenario B: Transitioning from Approved/Completed to Pending/Rejected (RESTORE STOCK)
      if (wasActive && !isNowActive) {
        for (const item of items) {
          const reqQty = parseFloat(item.base_quantity);
          // Increment stock
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [reqQty, item.product_id]
          );
        }
      }

      // 2. Update order status
      const updatedOrder = await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      
      return updatedOrder.rows[0];
    });

    res.json({ message: `Order status successfully updated to '${status}'.`, order: resultOrder });
  } catch (err) {
    console.error('Update order status error:', err.message);
    res.status(400).json({ error: err.message || 'Internal server error.' });
  }
});

// ==========================================
// RUN THE EXPRESS SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[AasaMedChem Backend] Server running on port ${PORT}`);
  });
}

export default app;
