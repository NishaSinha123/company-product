# 🧪 AasaMedChem Chemical Inventory & Order Management System

A high-performance, full-stack enterprise web application designed for laboratory chemical inventory tracking and real-time order quotation workflows. Built with a responsive **React (Vite) frontend**, an **Express.js serverless API backend**, and a **Neon-hosted PostgreSQL database**.

---

## 🚀 Key Features

*   **Double-Agent RBAC Authentication**: Distinct, custom interfaces tailored for **Admins** and **Sellers/Users** with secure JWT session handshakes and automatic redirection.
*   **Vibrant Glassmorphic UX Design**: A dark, premium visual theme styled using responsive Vanilla CSS with backdrop-blur filters, glowing button cues, and animated metric panels.
*   **Real-Time Math Conversion Engine**: On-the-fly metric calculations in the cart drawer that translate requested amounts to catalog base quantities (e.g. grams vs kilograms) showing the breakdown formula.
*   **High-Precision Numeric Storage**: Zero-floating-point-error decimal safety (`NUMERIC(20, 8)` & `NUMERIC(20, 4)`) built to safely handle micro-volume measurements and financial decimals.
*   **Lazy Database Schema Seeder**: Automatic, zero-setup table migrations and default product catalog loading upon the first network request.
*   **Archival Order Audit Trails**: Snapshots of conversion factors, pricing rates, and item totals at checkout to protect historical invoices from future catalog edits.

---

## 📐 System Architecture Design

```mermaid
graph TD
  subgraph Client_Layer ["Client Layer (React Frontend)"]
    UI["Vite + React Client (App.jsx)"]
    Ctx["AuthProvider Context (JWT Store)"]
    CSS["Vanilla CSS Glow Design System (index.css)"]
    ConvFE["Frontend Conversions Utility (conversions.js)"]
  end

  subgraph API_Layer ["API Gateway & Server (Node.js/Express)"]
    Srv["Express.js Server (api/index.js)"]
    JWT["JWT Auth Middleware"]
    ConvBE["Backend Conversions Utility (conversions.js)"]
  end

  subgraph Database_Layer ["Storage Layer (Neon PostgreSQL)"]
    DB[("Neon Cloud Database Pool")]
    Schema["Schema & Constraint Definitions (schema.sql)"]
    Seeder["Auto-Seeder (Default Accounts & Catalog)"]
  end

  UI <-->|HTTP REST / JWT Header| Srv
  UI --- Ctx
  UI --- CSS
  ConvFE <-->|Mirror Mathematical Rules| ConvBE
  Srv --- JWT
  Srv <-->|Pooled WebSockets / SQL| DB
  DB --- Schema
  DB --- Seeder
```

---

## 🗄️ Database Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
  users {
    UUID id PK "DEFAULT gen_random_uuid()"
    VARCHAR email UK "NOT NULL"
    VARCHAR password_hash "NOT NULL"
    VARCHAR name "NOT NULL"
    VARCHAR role "CHECK role IN ('admin', 'seller', 'user')"
    TIMESTAMP created_at "DEFAULT CURRENT_TIMESTAMP"
  }

  products {
    UUID id PK "DEFAULT gen_random_uuid()"
    VARCHAR sku UK "NOT NULL"
    VARCHAR name "NOT NULL"
    TEXT description
    VARCHAR category
    VARCHAR base_unit "CHECK base_unit IN ('g', 'kg', 'mL', 'L', 'items')"
    NUMERIC base_price "NUMERIC(20, 4) NOT NULL"
    NUMERIC stock_quantity "NUMERIC(20, 8) NOT NULL"
    TIMESTAMP created_at "DEFAULT CURRENT_TIMESTAMP"
    TIMESTAMP updated_at "DEFAULT CURRENT_TIMESTAMP"
  }

  orders {
    UUID id PK "DEFAULT gen_random_uuid()"
    VARCHAR order_number UK "NOT NULL"
    UUID user_id FK "REFERENCES users(id) ON DELETE SET NULL"
    UUID seller_id FK "REFERENCES users(id) ON DELETE SET NULL"
    VARCHAR status "CHECK status IN ('pending', 'approved', 'rejected', 'completed')"
    NUMERIC total_amount "NUMERIC(20, 2) NOT NULL"
    TIMESTAMP created_at "DEFAULT CURRENT_TIMESTAMP"
    TIMESTAMP updated_at "DEFAULT CURRENT_TIMESTAMP"
  }

  order_items {
    UUID id PK "DEFAULT gen_random_uuid()"
    UUID order_id FK "REFERENCES orders(id) ON DELETE CASCADE"
    UUID product_id FK "REFERENCES products(id) ON DELETE SET NULL"
    VARCHAR ordered_unit "NOT NULL"
    NUMERIC ordered_quantity "NUMERIC(20, 8) NOT NULL"
    NUMERIC conversion_factor "NUMERIC(20, 8) NOT NULL"
    NUMERIC base_quantity "NUMERIC(20, 8) NOT NULL"
    VARCHAR base_unit "NOT NULL"
    NUMERIC base_price "NUMERIC(20, 4) NOT NULL"
    NUMERIC item_total "NUMERIC(20, 2) NOT NULL"
  }

  users ||--o{ orders : "places (as user)"
  users ||--o{ orders : "approves/manages (as seller)"
  orders ||--|{ order_items : "contains"
  products ||--o{ order_items : "referenced in"
```

---

## 🔄 Component Context & Application State Flow

The React 19 app relies on unified context and state parameters to propagate user profile details, shopping cart structures, and tab selections:

```mermaid
graph TD
  App["App.jsx (Root Entry)"] --> Auth["AuthProvider.jsx (Context)"]
  Auth --> Main["AppContent() (Conditional Routing)"]
  
  Main -->|Token Valid & Role: admin| Admin["DashboardAdmin.jsx (Admin Console)"]
  Main -->|Token Valid & Role: seller| Seller["DashboardSeller.jsx (Seller Console)"]
  Main -->|No JWT / Invalid| Login["Login.jsx (Auth Form)"]
  
  Admin --> SubTabsAdmin["Active Views: Products / Orders / Stats Reports"]
  Seller --> SubTabsSeller["Active Views: Catalog / My Orders / Cart Drawer"]
  
  Navbar["Navbar.jsx"] <-->|Shared Cart Size & Tab Switches| Main
```

---

## ⚖️ High-Precision Conversions & Request Lifecycle

To ensure strict financial and scientific compliance, ordering quantities are double-verified across both client and server layers.

```mermaid
sequenceDiagram
  autonumber
  actor User as Seller / Buyer
  participant Cart as React Cart Drawer
  participant API as Express Endpoint (/api/orders)
  participant DB as Neon Database

  User->>Cart: Input quantity & select unit (e.g., 250 mL for L-base item)
  Note over Cart: Frontend conversion math:<br/>baseQuantity = orderedQuantity * factor<br/>itemTotal = baseQuantity * basePrice
  Cart-->>User: Render formula breakdown: 250 mL x 0.001 = 0.25 L @ ₹800 = ₹200.00
  
  User->>Cart: Click "Place Order"
  Cart->>API: POST /api/orders { items: [{ productId, orderedUnit, orderedQuantity }] } (JWT in Header)
  
  activate API
  Note over API: Extract JWT & Check permissions
  API->>DB: Query product base price, unit, and stock
  DB-->>API: Return product details
  Note over API: Recompute mathematical conversions securely:<br/>Verify compatibility (e.g. Volume to Volume)<br/>Confirm baseQuantity <= availableStock
  
  alt Insufficient Stock / Bad Unit Dimension
    API-->>Cart: 400 Bad Request (Error Alert Box)
  else Validation Passes
    API->>DB: Begin Database Transaction
    DB->>DB: Insert record into `orders`
    DB->>DB: Insert record into `order_items` (snapshot factor & base rates)
    DB-->>API: Commit Transaction Success
    API-->>Cart: 201 Created (Confetti celebration triggered)
  end
  deactivate API
```

### Supported Metric Dimensions

| Dimension | Supported Units | Scaling Rules (To Base Unit) |
| :--- | :--- | :--- |
| **Weight** | `g`, `kg` | `1 kg = 1000 g` <br> - Factor `g -> kg` = `0.001` <br> - Factor `kg -> g` = `1000.0` |
| **Volume** | `mL`, `L` | `1 L = 1000 mL` <br> - Factor `mL -> L` = `0.001` <br> - Factor `L -> mL` = `1000.0` |
| **Count** | `items` | - Factor `items -> items` = `1.0` |

---

## 📂 Project Directory Structure

Here is the annotated tree directory layout highlighting the technology extensions and functional purposes:

```text
company-product/
├── .env                       # Local developer database URLs and JWT secrets keys
├── .gitignore                 # Excluded directories (node_modules, build outputs, environment configs)
├── .npmrc                     # Configuration parameters for Node Package Manager
├── index.html                 # Main single-page application entry HTML template
├── eslint.config.js           # Lint configurations for style and syntax checks
├── package.json               # Manifest file detailing scripts, dependencies, and engines
├── vercel.json                # Vercel Serverless Function rewrites & routing rules
├── vite.config.js             # Development configurations for Vite bundler plugins
│
├── api/                       # SERVERLESS BACKEND (Express / Node.js)
│   ├── db.js                  # Database connection, transaction handlers, and seeder
│   ├── index.js               # Express Server endpoints, RBAC middleware, and configuration
│   ├── schema.sql             # SQL schema migrations (users, products, orders, order_items)
│   └── utils/
│       └── conversions.js     # Shared conversion math calculations and validation logic
│
└── src/                       # CLIENT FRONTEND (Vite / React 19)
    ├── App.css                # Root-level CSS style overrides
    ├── App.jsx                # Router handler and layout initializer
    ├── config.js              # Global configurations (resolves server routes dynamically)
    ├── index.css              # Custom Vanilla CSS Dark-Theme Glow Design System
    ├── main.jsx               # React virtual DOM bootstrap script
    │
    ├── context/
    │   └── AuthProvider.jsx   # Context hook storing JWT payloads in localStorage
    │
    ├── components/
    │   ├── DashboardAdmin.jsx # Admin panel: CRUD stock logs, review requests, and stats reports
    │   ├── DashboardSeller.jsx# Seller panel: Instant catalog search, cart drawer, math breakdowns
    │   ├── Login.jsx          # Beautiful login card featuring Quick Login testing helpers
    │   └── Navbar.jsx         # Global navigation bar showing credentials, role badges, and cart
    │
    └── utils/
        └── conversions.js     # Client-side mirror of the mathematical conversions utility
```

---

## 🛠️ Local Developer Setup

Follow this step-by-step instruction sheet to run the application on your computer:

### 1. Clone & Install Dependencies
First, open your terminal client, clone your repository, and install the required modules:
```bash
# Clone the repository
git clone https://github.com/NishaSinha123/company-product.git
cd company-product

# Install Node modules
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Create a file named `.env` in the root folder of the project. Fill in the default PostgreSQL database connection string and a secret key:
```env
DATABASE_URL=postgresql://neondb_owner:npg_aTJ8X7owxmEi@ep-cold-thunder-aqpr7whh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=AasaMedChem_Secure_Jwt_Token_Secret_Key_2026
PORT=5000
NODE_ENV=development
```

### 3. Run the Development Server
Execute the development command which concurrent-starts both backend (port 5000) and frontend (port 5173):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

*Note: On your very first network action or login attempt, the database server lazily checks table configurations. If they are empty, it automatically executes migration scripts and seeds 5 initial chemical items.*

### 🔑 Default Developer Test Profiles
Quick Login click-buttons are embedded directly inside the login form to ease testing:
*   **Admin Profile**: `admin@aasamedchem.com` / password: `admin123`
*   **Seller Profile**: `seller@aasamedchem.com` / password: `seller123`

---

## 📦 Cloud Deployment Guide (Vercel)

This application is pre-optimized for **Vercel Serverless hosting** using a single consolidated repository structure.

### Detailed Deployment Checklists
1.  Push your code changes to your personal **GitHub** repository.
2.  Log in to your [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
3.  Choose your repository from the imported list.
4.  Vercel automatically detects the **Vite** frontend project framework.
5.  Open the **Environment Variables** drop-accordion panel and add your keys:
    *   `DATABASE_URL` = `your-neon-postgres-connection-string`
    *   `JWT_SECRET` = `your-custom-session-encryption-string`
6.  Click **Deploy**.
7.  Vercel builds static frontend resources, stores them in `dist/`, and registers requests heading to `/api/*` to be processed as Express Serverless lambdas configured by the [vercel.json](file:///c:/Users/Nisha%20Sinha/Desktop/companys/vercel.json) file.

---

## 🔌 Recommended VS Code Developer Extensions

To view diagrams and maintain style consistency throughout development, install the following editor extensions:

1.  **Mermaid Chart** or **Markdown Preview Mermaid Support**: Allows previewing system architecture and database ERD maps directly inside markdown files.
2.  **Prettier - Code Formatter**: Automatically formats `.jsx`, `.js`, and `.css` source files on save.
3.  **ESLint**: Inspects code for potential bugs, missing React hooks, and syntax inconsistencies matching the rules in `eslint.config.js`.
4.  **Postman** / **Thunder Client**: For testing REST API routes directly inside VS Code.
5.  **PostgreSQL Explorer**: Connects to the Neon database instance to inspect user tables, products, and checkouts logs.
