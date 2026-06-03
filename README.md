# AasaMedChem Chemical Inventory & Order Management System

A high-performance, full-stack web application designed for managing laboratory chemical inventory and order quotations. Built with a React (Vite) frontend, an Express.js serverless API backend, and a Neon-hosted PostgreSQL database. Designed for deployment on Vercel.

---

## 🚀 Key Features

- **Double-Agent Authentication (RBAC)**: Distinct interfaces for **Admins** and **Sellers** with automatic redirection.
- **Vibrant Glassmorphic Interface**: A dark, premium dashboard with smooth micro-animations, color-coded badges, and instant search/filters.
- **Multidimensional Metric Converter**: Real-time conversion formula breakdowns directly inside the Seller's shopping cart and Admin's feed.
- **High-Precision Storage**: Fully protected decimals (`NUMERIC(20, 8)`) supporting micro-volume measurement units (e.g. milligrams/milliliters) without floating-point inaccuracies.
- **Database Auto-Seeder**: Automatic schema creation and pre-configured test profiles/chemical inventory upon initial launch.
- **Archival Audit Trail**: Historical snapshot recording of conversion factors and rates within order items.

---

## 🛠️ Tech Stack & Architecture

```mermaid
graph TD
  subgraph "Client Layer (Frontend)"
    UI[Vite + React.js Client]
    CSS[Vanilla CSS Glow Design System]
    Auth[AuthProvider Context]
    ConvFE[Frontend Conversions Utility]
  end

  subgraph "API Gateway & Server (Backend)"
    Srv[Express.js Monolithic Server]
    JWT[JWT auth middleware]
    ConvBE[Backend Conversions Utility]
  end

  subgraph "Data Storage Layer (Neon PostgreSQL)"
    DB[(Neon Serverless DB)]
    Schema[schema.sql Migrations]
    Seed[Seeder: Default Accounts & Catalog]
  end

  UI <-->|HTTP REST / JWT| Srv
  Srv <-->|SQL Queries / Pooled Connection| DB
  ConvFE <-->|Mirror Math Rules| ConvBE
```

1. **Frontend**: Built with **React** (via Vite). Interfaces styled using flexible, custom **Vanilla CSS** (`src/index.css`) designed to create a premium dark glassmorphism layout (backdrop filters, glowing buttons, custom scrollbar).
2. **Backend**: Built with **Node.js** and **Express.js**, structured inside the `api/` directory. For local runs, it boots on port 5000; when deployed to Vercel, it routes requests dynamically to Vercel Serverless Functions.
3. **Database**: Hosted on **Neon PostgreSQL**, connected via WebSocket pools (`@neondatabase/serverless`).

---

## 📐 Database Schema & Precision Types

We chose PostgreSQL `NUMERIC` types instead of `FLOAT` or `DOUBLE PRECISION` to avoid binary-representation errors common in financial/metric calculations.

### 1. `users` Table
Stores authentication profiles and access credentials.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `email`: `VARCHAR(255) UNIQUE NOT NULL`
- `password_hash`: `VARCHAR(255) NOT NULL` (hashed with `bcryptjs`)
- `name`: `VARCHAR(255) NOT NULL`
- `role`: `VARCHAR(50) NOT NULL` (checked as `'admin'` or `'seller'`)
- `created_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### 2. `products` Table
Houses product listings, current stock quantities, and base rates.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `sku`: `VARCHAR(100) UNIQUE NOT NULL`
- `name`: `VARCHAR(255) NOT NULL`
- `description`: `TEXT`
- `category`: `VARCHAR(100)`
- `base_unit`: `VARCHAR(20) NOT NULL` (checked as `'g'`, `'kg'`, `'mL'`, `'L'`, or `'items'`)
- `base_price`: `NUMERIC(20, 4) NOT NULL` — The base cost in INR per one base unit.
- `stock_quantity`: `NUMERIC(20, 8) NOT NULL` — Quantity available, stored in terms of the `base_unit`.
- `created_at` / `updated_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### 3. `orders` Table
Tracks order proposals and status workflows.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `order_number`: `VARCHAR(100) UNIQUE NOT NULL`
- `user_id`: `UUID REFERENCES users(id)` (placing seller)
- `status`: `VARCHAR(50) NOT NULL DEFAULT 'pending'` (checked as `'pending'`, `'approved'`, `'rejected'`, or `'completed'`)
- `total_amount`: `NUMERIC(20, 2) NOT NULL` — Total cost of the order in INR.
- `created_at` / `updated_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### 4. `order_items` Table
Audit trail capturing the item configurations at the exact moment of order checkout.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `order_id`: `UUID REFERENCES orders(id) ON DELETE CASCADE`
- `product_id`: `UUID REFERENCES products(id) ON DELETE SET NULL`
- `ordered_unit`: `VARCHAR(20) NOT NULL` — The unit chosen by the seller.
- `ordered_quantity`: `NUMERIC(20, 8) NOT NULL` — The quantity input by the seller.
- `conversion_factor`: `NUMERIC(20, 8) NOT NULL` — The scaling factor applied to map the ordered unit to the product base unit.
- `base_quantity`: `NUMERIC(20, 8) NOT NULL` — Converted amount (`ordered_quantity * conversion_factor`).
- `base_unit`: `VARCHAR(20) NOT NULL` — The product's base unit.
- `base_price`: `NUMERIC(20, 4) NOT NULL` — Rate per base unit.
- `item_total`: `NUMERIC(20, 2) NOT NULL` — Calculated cost (`base_quantity * base_price`), rounded to 2 decimal places.

---

## ⚖️ Unit Storage & Conversion Strategy

### Dimensions and Conversion Factors
Sellers can request quantities in **any unit** compatible with the product's dimension. The dimensions are defined as:

| Dimension | Supported Units | System Math Scale Rules (To Base Unit) |
| :--- | :--- | :--- |
| **Weight** | `g`, `kg` | `1 kg = 1000 g` <br> - Factor `g -> kg` = `0.001` <br> - Factor `kg -> g` = `1000.0` |
| **Volume** | `mL`, `L` | `1 L = 1000 mL` <br> - Factor `mL -> L` = `0.001` <br> - Factor `L -> mL` = `1000.0` |
| **Count** | `items` | - Factor `items -> items` = `1.0` |

### Math Logic
1. **Quantity Conversion**:
   $$\text{Quantity}_{\text{base}} = \text{Quantity}_{\text{ordered}} \times \text{Conversion Factor}$$
   *Quantity conversions are calculated and rounded to 8 decimal places to handle micro-milligrams and micro-volumes.*
2. **Item Pricing**:
   $$\text{Price}_{\text{total}} = \text{Quantity}_{\text{base}} \times \text{Price}_{\text{base}}$$
   *Totals are rounded to 2 decimal places to match INR paisa precision.*

### Where Conversions are Applied
- **Real-Time in Frontend (`src/utils/conversions.js`)**: Runs instantly inside the Seller's shopping cart drawer as they type, showing a live breakdown equation:
  `250 mL × 0.001 = 0.25000000 L @ ₹800.00 / L = ₹200.00`.
- **Verified in Backend (`api/utils/conversions.js`)**: Re-calculated securely on order submission before storing in `order_items` and during stock audits.

---

## ⚙️ Local Development Setup

Follow these steps to run the application on your computer:

### 1. Clone the repository and install dependencies
```bash
# Install NPM dependencies
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Create a file named `.env` in the root folder of the project:
```env
DATABASE_URL=postgresql://neondb_owner:npg_aTJ8X7owxmEi@ep-cold-thunder-aqpr7whh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=AasaMedChem_Secure_Jwt_Token_Secret_Key_2026
PORT=5000
NODE_ENV=development
```

### 3. Run Development Server
```bash
# Starts both frontend (port 5173) and backend (port 5000) concurrently
npm run dev
```

Open `http://localhost:5173` in your browser. The database will automatically initialize its schema and seed initial products and users.

---

## 🎯 Test Credentials & User Guides

Quick Login buttons are provided on the login page to easily click and login.

### Test Credentials
- **Admin Login**: `admin@aasamedchem.com` / `admin123`
- **Seller Login**: `seller@aasamedchem.com` / `seller123`

---

## 📦 Deploying to Vercel

This application is fully optimized for Vercel Serverless deployment with a single project structure.

### Automatic Vercel Deploy Steps
1. Push your code repository to GitHub.
2. Open [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
3. Select your repository.
4. Vercel will automatically detect **Vite** as the framework.
5. In **Environment Variables**, add:
   - `DATABASE_URL` = `your-neon-postgres-url`
   - `JWT_SECRET` = `your-jwt-signing-secret`
6. Click **Deploy**. Vercel will build the frontend (`dist/`), serve it statically, and deploy the `/api` directory as serverless functions.
