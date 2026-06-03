import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query, runTransaction, initDb } from './db.js';
import { areUnitsCompatible, getConversionFactor, calculateItemTotal } from './utils/conversions.js';

// Load our local keys and configs from the environment file (.env)
dotenv.config();

const app = express();

// Set up standard Express middleware
app.use(cors()); // Allow cross-origin requests from our Vite frontend dev server
app.use(express.json()); // Parse incoming JSON payloads automatically

// Lazy Database Initializer Middleware
// This checks if the schema is verified and seeded on the very first incoming request.
// It avoids timing conflicts and keeps the startup flow extremely smooth.
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

// Authentication Token Validator Middleware
// This intercepts private endpoints, extracts the Bearer token, and verifies it with JWT.
// If valid, it attaches the authenticated user profile details directly to the request object (req.user).
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'AasaMedChem_Secure_Jwt_Token_Secret_Key_2026', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    req.user = user;
    next();
  });
};

// Access Control Guard (Role-based check)
// Ensures the user has a specific authorized role before letting them pass to administrative pages.
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access forbidden: Requires '${role}' privilege level.` });
    }
    next();
  };
};

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register a New Account
// Accepts: email, password, name, role ('admin', 'seller', or 'user')
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  // Make sure they filled in everything
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields (email, password, name, role) are required.' });
  }

  // Validate the chosen role matches our database check constraint definitions
  if (role !== 'admin' && role !== 'seller' && role !== 'user') {
    return res.status(400).json({ error: "Invalid role. Must be 'admin', 'seller', or 'user'." });
  }

  try {
    // Check if the email is already in use
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Securely hash the password before inserting
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user details in our PostgreSQL database
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, role]
    );

    const user = result.rows[0];

    // Sign a fresh session token so they are immediately logged in
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

// Authenticate Credentials (Log In)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Find the record by email
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Verify hash matches
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Issue a session JWT
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

// Resolve Active Session Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// PRODUCT INVENTORY ENDPOINTS
// ==========================================

// Get Products Catalog (Supports instant text search and categories filter)
app.get('/api/products', authenticateToken, async (req, res) => {
  const { search, category } = req.query;
  
  let queryString = 'SELECT * FROM products';
  const queryParams = [];
  const conditions = [];

  // Build the WHERE clause dynamically based on filters
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

  // Sort them cleanly so the listing doesn't jump around
  queryString += ' ORDER BY category ASC, name ASC';

  try {
    const result = await query(queryString, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create a New Product SKU (Admin Only)
app.post('/api/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { sku, name, description, category, base_unit, base_price, stock_quantity } = req.body;

  if (!sku || !name || !base_unit || base_price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ error: 'SKU, Name, Base Unit, Price, and Stock are required.' });
  }

  // Validate base unit matches our dimensional types
  const validUnits = ['g', 'kg', 'mL', 'L', 'items'];
  if (!validUnits.includes(base_unit)) {
    return res.status(400).json({ error: `Invalid unit. Supported: ${validUnits.join(', ')}` });
  }

  // Prevent illogical negative settings
  if (parseFloat(base_price) < 0 || parseFloat(stock_quantity) < 0) {
    return res.status(400).json({ error: 'Price and stock quantity must be non-negative.' });
  }

  try {
    // SKUs must be unique for correct tracking
    const existingSku = await query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existingSku.rows.length > 0) {
      return res.status(400).json({ error: `Product with SKU '${sku}' already exists.` });
    }

    const result = await query(
      `INSERT INTO products (sku, name, description, category, base_unit, base_price, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sku, name, description, category || 'General', base_unit, base_price, stock_quantity]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update Product Details (Admin Only)
app.put('/api/products/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { sku, name, description, category, base_unit, base_price, stock_quantity } = req.body;

  if (!sku || !name || !base_unit || base_price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ error: 'SKU, Name, Base Unit, Price, and Stock are required.' });
  }

  const validUnits = ['g', 'kg', 'mL', 'L', 'items'];
  if (!validUnits.includes(base_unit)) {
    return res.status(400).json({ error: `Invalid unit. Supported: ${validUnits.join(', ')}` });
  }

  if (parseFloat(base_price) < 0 || parseFloat(stock_quantity) < 0) {
    return res.status(400).json({ error: 'Price and stock quantity must be non-negative.' });
  }

  try {
    // Verify product exists
    const checkProduct = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (checkProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const oldProduct = checkProduct.rows[0];

    // Check SKU uniqueness if they changed it
    if (oldProduct.sku !== sku) {
      const existingSku = await query('SELECT id FROM products WHERE sku = $1 AND id <> $2', [sku, id]);
      if (existingSku.rows.length > 0) {
        return res.status(400).json({ error: `Product with SKU '${sku}' already exists.` });
      }
    }

    // Lock unit dimension modifications to avoid breaking existing orders (e.g. weight to volume)
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
// ORDER / QUOTATION PROPOSALS ENDPOINTS
// ==========================================

// Get Quotation Requests (Admins and Sellers inspect all proposals, users check their own list)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let ordersQuery = '';
    let queryParams = [];

    if (req.user.role === 'admin' || req.user.role === 'seller') {
      ordersQuery = `
        SELECT o.*, 
               u_buyer.name as buyer_name, u_buyer.email as buyer_email,
               u_seller.name as seller_name, u_seller.email as seller_email
        FROM orders o
        LEFT JOIN users u_buyer ON o.user_id = u_buyer.id
        LEFT JOIN users u_seller ON o.seller_id = u_seller.id
        ORDER BY o.created_at DESC
      `;
    } else {
      // General Users retrieve only their personal checkouts
      ordersQuery = `
        SELECT o.*, 
               u_buyer.name as buyer_name, u_buyer.email as buyer_email,
               u_seller.name as seller_name, u_seller.email as seller_email
        FROM orders o
        LEFT JOIN users u_buyer ON o.user_id = u_buyer.id
        LEFT JOIN users u_seller ON o.seller_id = u_seller.id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `;
      queryParams.push(req.user.id);
    }

    const ordersResult = await query(ordersQuery, queryParams);
    const orders = ordersResult.rows;

    // Fetch sub-items for each order to build the detailed listings
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

// Submit a New Quotation Order (Authorized for Sellers or General Users)
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
    const preparedItems = [];
    let orderTotal = 0;

    // 1. Verify item configurations and compute prices in memory
    for (const item of items) {
      const { productId, orderedUnit, orderedQuantity } = item;
      
      const qVal = parseFloat(orderedQuantity);
      if (!productId || !orderedUnit || isNaN(qVal) || qVal <= 0) {
        return res.status(400).json({ error: 'Invalid product details, unit, or quantity in cart.' });
      }

      const prodResult = await query('SELECT * FROM products WHERE id = $1', [productId]);
      if (prodResult.rows.length === 0) {
        return res.status(404).json({ error: `Product with ID '${productId}' not found.` });
      }

      const product = prodResult.rows[0];

      // Block dimension mismatch (e.g. ordering liters of solid salt)
      if (!areUnitsCompatible(orderedUnit, product.base_unit)) {
        return res.status(400).json({
          error: `Incompatible unit dimensions for product '${product.name}'. Ordered: '${orderedUnit}', Base: '${product.base_unit}'.`
        });
      }

      // Convert quantity and calculate total price
      const conversionFactor = getConversionFactor(orderedUnit, product.base_unit);
      const baseQuantity = qVal * conversionFactor;
      const itemTotal = calculateItemTotal(qVal, orderedUnit, product.base_unit, product.base_price);
      
      // Stock check on submission to warn user
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

    // 2. Perform DB commits inside a single Transaction Block
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = await runTransaction(async (client) => {
      // Create main order proposal
      const orderInsert = await client.query(
        `INSERT INTO orders (order_number, user_id, status, total_amount) 
         VALUES ($1, $2, 'pending', $3) 
         RETURNING *`,
        [orderNumber, req.user.id, orderTotal]
      );
      const order = orderInsert.rows[0];

      // Save item details as a historical audit snapshot
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
      }

      return order;
    });

    res.status(201).json({ message: 'Order quotation submitted successfully.', order: newOrder });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update Order Status & Handle Stock Movements (Admin and Sellers)
// Transitions: pending -> approved/completed (deducts stock), approved/completed -> rejected/pending (returns stock)
app.patch('/api/orders/:id/status', authenticateToken, (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'seller') {
    return res.status(403).json({ error: "Forbidden: Only admins and sellers can confirm order status." });
  }
  next();
}, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved', 'rejected', 'completed', 'pending'

  const allowedStatuses = ['approved', 'rejected', 'completed', 'pending'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Choose from: ${allowedStatuses.join(', ')}` });
  }

  try {
    // Fetch order record
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

    // Run order status transition and stock audits inside a transaction
    const resultOrder = await runTransaction(async (client) => {
      const activeStates = ['approved', 'completed'];
      const wasActive = activeStates.includes(oldStatus);
      const isNowActive = activeStates.includes(status);

      // Scenario A: Transitioning from Pending/Rejected to Approved/Completed (DEDUCT STOCK)
      if (!wasActive && isNowActive) {
        for (const item of items) {
          // Lock the product row for update to prevent concurrent race conditions
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

          // Decrement stock levels
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
          // Return the stock to database inventory
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [reqQty, item.product_id]
          );
        }
      }

      // Update order status field and record who updated it if they are a seller
      let updatedOrder;
      if (req.user.role === 'seller') {
        updatedOrder = await client.query(
          'UPDATE orders SET status = $1, seller_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
          [status, req.user.id, id]
        );
      } else {
        updatedOrder = await client.query(
          'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [status, id]
        );
      }
      
      return updatedOrder.rows[0];
    });

    res.json({ message: `Order status successfully updated to '${status}'.`, order: resultOrder });
  } catch (err) {
    console.error('Update order status error:', err.message);
    res.status(400).json({ error: err.message || 'Internal server error.' });
  }
// Get Admin Reports/Statistics
app.get('/api/admin/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const buyerStatsResult = await query(`
      SELECT u.id, u.name as buyer_name, u.email as buyer_email,
             COUNT(DISTINCT o.id) as total_orders,
             COALESCE(SUM(oi.item_total), 0) as total_spend,
             COALESCE(SUM(oi.base_quantity), 0) as total_quantity
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status IN ('approved', 'completed')
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_spend DESC
    `);

    const sellerStatsResult = await query(`
      SELECT u.id, u.name as seller_name, u.email as seller_email,
             COUNT(DISTINCT o.id) as total_sales_orders,
             COALESCE(SUM(oi.item_total), 0) as total_sales_amount,
             COALESCE(SUM(oi.base_quantity), 0) as total_quantity_sold
      FROM users u
      LEFT JOIN orders o ON u.id = o.seller_id AND o.status IN ('approved', 'completed')
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE u.role = 'seller'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_sales_amount DESC
    `);

    res.json({
      buyerStats: buyerStatsResult.rows,
      sellerStats: sellerStatsResult.rows
    });
  } catch (err) {
    console.error('Fetch admin stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// RUN THE EXPRESS SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[AasaMedChem Backend] Server running on port ${PORT}`);
  });
}

export default app;
