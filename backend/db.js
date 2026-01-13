const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();
    try {
        // Products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL,
                price INTEGER NOT NULL,
                description TEXT,
                image VARCHAR(255),
                weight VARCHAR(50),
                origin VARCHAR(100),
                in_stock BOOLEAN DEFAULT true,
                featured BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Orders table
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(50),
                address VARCHAR(255),
                postal_code VARCHAR(20),
                city VARCHAR(100),
                items JSONB NOT NULL,
                subtotal INTEGER NOT NULL,
                shipping INTEGER NOT NULL,
                total INTEGER NOT NULL,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                payment_method VARCHAR(50),
                stripe_session_id VARCHAR(255),
                stripe_payment_intent VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP
            )
        `);

        // Admins table
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id UUID PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Categories table
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                icon VARCHAR(10) DEFAULT '📦',
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database tables initialized');
    } finally {
        client.release();
    }
}

// Products
async function getAllProducts() {
    const result = await pool.query(
        'SELECT * FROM products ORDER BY category, name'
    );
    return result.rows.map(formatProduct);
}

async function getProductById(id) {
    const result = await pool.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
    );
    return result.rows[0] ? formatProduct(result.rows[0]) : null;
}

async function createProduct(product) {
    const result = await pool.query(
        `INSERT INTO products (id, name, category, price, description, image, weight, origin, in_stock, featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [product.id, product.name, product.category, product.price, product.description,
         product.image, product.weight, product.origin, product.inStock, product.featured]
    );
    return formatProduct(result.rows[0]);
}

async function updateProduct(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = {
        name: 'name',
        category: 'category',
        price: 'price',
        description: 'description',
        image: 'image',
        weight: 'weight',
        origin: 'origin',
        inStock: 'in_stock',
        featured: 'featured'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
        if (updates[key] !== undefined) {
            fields.push(`${dbField} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
        `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return result.rows[0] ? formatProduct(result.rows[0]) : null;
}

async function deleteProduct(id) {
    const result = await pool.query(
        'DELETE FROM products WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows.length > 0;
}

function formatProduct(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        price: row.price,
        description: row.description,
        image: row.image,
        weight: row.weight,
        origin: row.origin,
        inStock: row.in_stock,
        featured: row.featured,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// Orders
async function getAllOrders() {
    const result = await pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC'
    );
    return result.rows.map(formatOrder);
}

async function getOrderById(id) {
    const result = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
    );
    return result.rows[0] ? formatOrder(result.rows[0]) : null;
}

async function getOrderByStripeSession(sessionId) {
    const result = await pool.query(
        'SELECT * FROM orders WHERE stripe_session_id = $1',
        [sessionId]
    );
    return result.rows[0] ? formatOrder(result.rows[0]) : null;
}

async function createOrder(order) {
    const result = await pool.query(
        `INSERT INTO orders (id, customer_name, customer_email, customer_phone, address, postal_code, city,
                            items, subtotal, shipping, total, notes, status, payment_method, stripe_session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [order.id, order.customer.name, order.customer.email, order.customer.phone,
         order.customer.address, order.customer.postalCode, order.customer.city,
         JSON.stringify(order.items), order.subtotal, order.shipping, order.total,
         order.notes, order.status || 'pending', order.paymentMethod || 'manual',
         order.stripeSessionId]
    );
    return formatOrder(result.rows[0]);
}

async function updateOrder(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
    }
    if (updates.paymentMethod !== undefined) {
        fields.push(`payment_method = $${paramCount++}`);
        values.push(updates.paymentMethod);
    }
    if (updates.stripePaymentIntent !== undefined) {
        fields.push(`stripe_payment_intent = $${paramCount++}`);
        values.push(updates.stripePaymentIntent);
    }
    if (updates.paidAt !== undefined) {
        fields.push(`paid_at = $${paramCount++}`);
        values.push(updates.paidAt);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
        `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return result.rows[0] ? formatOrder(result.rows[0]) : null;
}

function formatOrder(row) {
    return {
        id: row.id,
        customer: {
            name: row.customer_name,
            email: row.customer_email,
            phone: row.customer_phone,
            address: row.address,
            postalCode: row.postal_code,
            city: row.city
        },
        items: row.items,
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        notes: row.notes,
        status: row.status,
        paymentMethod: row.payment_method,
        stripeSessionId: row.stripe_session_id,
        stripePaymentIntent: row.stripe_payment_intent,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        paidAt: row.paid_at
    };
}

// Admins
async function getAdminByUsername(username) {
    const result = await pool.query(
        'SELECT * FROM admins WHERE username = $1',
        [username]
    );
    return result.rows[0];
}

async function createAdmin(admin) {
    const result = await pool.query(
        'INSERT INTO admins (id, username, password) VALUES ($1, $2, $3) RETURNING *',
        [admin.id, admin.username, admin.password]
    );
    return result.rows[0];
}

async function updateAdminPassword(username, hashedPassword) {
    await pool.query(
        'UPDATE admins SET password = $1 WHERE username = $2',
        [hashedPassword, username]
    );
}

async function getAdminCount() {
    const result = await pool.query('SELECT COUNT(*) FROM admins');
    return parseInt(result.rows[0].count);
}

// Categories
async function getAllCategories() {
    const result = await pool.query(
        'SELECT * FROM categories ORDER BY sort_order, name'
    );
    return result.rows.map(formatCategory);
}

async function getCategoryById(id) {
    const result = await pool.query(
        'SELECT * FROM categories WHERE id = $1',
        [id]
    );
    return result.rows[0] ? formatCategory(result.rows[0]) : null;
}

async function getCategoryBySlug(slug) {
    const result = await pool.query(
        'SELECT * FROM categories WHERE slug = $1',
        [slug]
    );
    return result.rows[0] ? formatCategory(result.rows[0]) : null;
}

async function createCategory(category) {
    const result = await pool.query(
        `INSERT INTO categories (id, name, slug, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [category.id, category.name, category.slug, category.icon || '📦', category.sortOrder || 0]
    );
    return formatCategory(result.rows[0]);
}

async function updateCategory(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(updates.name);
    }
    if (updates.slug !== undefined) {
        fields.push(`slug = $${paramCount++}`);
        values.push(updates.slug);
    }
    if (updates.icon !== undefined) {
        fields.push(`icon = $${paramCount++}`);
        values.push(updates.icon);
    }
    if (updates.sortOrder !== undefined) {
        fields.push(`sort_order = $${paramCount++}`);
        values.push(updates.sortOrder);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return result.rows[0] ? formatCategory(result.rows[0]) : null;
}

async function deleteCategory(id) {
    const result = await pool.query(
        'DELETE FROM categories WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows.length > 0;
}

async function getCategoryCount() {
    const result = await pool.query('SELECT COUNT(*) FROM categories');
    return parseInt(result.rows[0].count);
}

function formatCategory(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        icon: row.icon,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

module.exports = {
    pool,
    initDatabase,
    // Products
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    // Orders
    getAllOrders,
    getOrderById,
    getOrderByStripeSession,
    createOrder,
    updateOrder,
    // Admins
    getAdminByUsername,
    createAdmin,
    updateAdminPassword,
    getAdminCount,
    // Categories
    getAllCategories,
    getCategoryById,
    getCategoryBySlug,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryCount
};

