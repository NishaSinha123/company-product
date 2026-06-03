import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Configure Neon to use the installed WebSocket driver in Node.js serverless environments
neonConfig.webSocketConstructor = ws;

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set. Ensure your environment variables are configured.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: true // Required by Neon
});

export const query = (text, params) => pool.query(text, params);

/**
 * Transaction helper.
 * Takes a callback function `fn(client)` and runs it inside a transaction block.
 * Handles client acquisition, BEGIN, COMMIT, ROLLBACK, and release.
 */
export const runTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Database schema definition embedded as a string to avoid fs.readFileSync ENOENT crashes in serverless lambda environments
const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'seller', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  base_unit VARCHAR(20) NOT NULL CHECK (base_unit IN ('g', 'kg', 'mL', 'L', 'items')),
  base_price NUMERIC(20, 4) NOT NULL,
  stock_quantity NUMERIC(20, 8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  total_amount NUMERIC(20, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ordered_unit VARCHAR(20) NOT NULL,
  ordered_quantity NUMERIC(20, 8) NOT NULL,
  conversion_factor NUMERIC(20, 8) NOT NULL,
  base_quantity NUMERIC(20, 8) NOT NULL,
  base_unit VARCHAR(20) NOT NULL,
  base_price NUMERIC(20, 4) NOT NULL,
  item_total NUMERIC(20, 2) NOT NULL
);
`;

/**
 * Auto-initialize the database schema and seed initial test data.
 */
export const initDb = async () => {
  try {
    console.log('Initializing database schema...');
    
    // Run schema commands directly from memory
    await pool.query(schemaSql);
    console.log('Database tables verified/created successfully.');

    // Dynamic constraint upgrade to ensure 'user' role is supported
    try {
      await pool.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'seller', 'user'));
      `);
      console.log('Database role constraints upgraded to support General Users.');
    } catch (constraintErr) {
      console.warn('Note: Could not alter role constraint dynamically:', constraintErr.message);
    }

    // Seed default users if users table is empty
    const userCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count, 10);
    
    if (userCount === 0) {
      console.log('Seeding initial system users...');
      
      const adminHash = await bcrypt.hash('admin123', 10);
      const sellerHash = await bcrypt.hash('seller123', 10);
      
      await pool.query(`
        INSERT INTO users (email, password_hash, name, role) VALUES 
        ('admin@aasamedchem.com', $1, 'Dr. Sarah Carter (Admin)', 'admin'),
        ('seller@aasamedchem.com', $2, 'John Doe (Seller)', 'seller')
      `, [adminHash, sellerHash]);
      
      console.log('Default user accounts created:');
      console.log(' - Admin: admin@aasamedchem.com / admin123');
      console.log(' - Seller: seller@aasamedchem.com / seller123');
    }

    // Seed initial products if products table is empty
    const productCountResult = await pool.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(productCountResult.rows[0].count, 10);
    
    if (productCount === 0) {
      console.log('Seeding initial chemical product inventory...');
      
      const testProducts = [
        {
          sku: 'SOL-ETH-001',
          name: 'Ethanol (Absolute, Analytical Grade)',
          description: 'High-purity laboratory solvent (>99.9% purity) for extraction and analysis.',
          category: 'Solvents',
          base_unit: 'L',
          base_price: 800.00, // ₹800 per Liter
          stock_quantity: 250.00 // 250 Liters
        },
        {
          sku: 'REA-NACL-002',
          name: 'Sodium Chloride (Extra Pure)',
          description: 'Laboratory grade reagent sodium chloride, fine crystalline structure.',
          category: 'Reagents',
          base_unit: 'kg',
          base_price: 450.00, // ₹450 per Kilogram
          stock_quantity: 50.00 // 50 kg
        },
        {
          sku: 'NANO-GOLD-003',
          name: 'Gold Nanoparticles (15nm Dispersion)',
          description: 'High-grade stabilized gold nanoparticle suspension in aqueous solution. Priced per gram.',
          category: 'Nanomaterials',
          base_unit: 'g',
          base_price: 15000.00, // ₹15,000 per Gram (High value, high-precision stock)
          stock_quantity: 5.50000000 // 5.50000000 grams
        },
        {
          sku: 'ACD-HCL-004',
          name: 'Hydrochloric Acid (37%, Fuming)',
          description: 'Highly corrosive fuming acid, analytical grade. Managed in milliliters for micro-volumes.',
          category: 'Acids',
          base_unit: 'mL',
          base_price: 2.50, // ₹2.50 per milliliter (e.g. ₹2,500 per Liter)
          stock_quantity: 15000.00000000 // 15,000 mL (15 L)
        },
        {
          sku: 'CON-TIPS-005',
          name: 'Micropipette Tips (100-1000µL)',
          description: 'Sterile, Dnase/Rnase-free universal pipette tips, box of 1000. Managed as count items.',
          category: 'Consumables',
          base_unit: 'items',
          base_price: 1.20, // ₹1.20 per tip
          stock_quantity: 8000.00 // 8,000 tips
        }
      ];

      for (const prod of testProducts) {
        await pool.query(`
          INSERT INTO products (sku, name, description, category, base_unit, base_price, stock_quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [prod.sku, prod.name, prod.description, prod.category, prod.base_unit, prod.base_price, prod.stock_quantity]);
      }
      
      console.log('Seeded 5 multi-unit chemical products.');
    }
    
    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
