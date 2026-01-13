const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Stripe setup
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_PLACEHOLDER';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_PLACEHOLDER';
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// Multer setup for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Endast bilder är tillåtna'), false);
        }
    }
});

// CORS - allow frontend to access API
app.use(cors({
    origin: [
        FRONTEND_URL, 
        'http://localhost:3000', 
        'http://localhost:5173',
        'https://tegrevinnan.vercel.app',
        /\.vercel\.app$/  // Allow all vercel.app subdomains
    ],
    credentials: true
}));

// Stripe webhook (must be before express.json())
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            event = JSON.parse(req.body);
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await handleSuccessfulPayment(session);
    }
    
    res.json({ received: true });
});

// Regular middleware
app.use(express.json());

// Session store
const sessions = new Map();

// Auth middleware
function requireAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Handle successful Stripe payment
async function handleSuccessfulPayment(session) {
    try {
        const order = await db.getOrderByStripeSession(session.id);
        if (order && order.status !== 'paid') {
            await db.updateOrder(order.id, {
                status: 'paid',
                stripePaymentIntent: session.payment_intent,
                paidAt: new Date().toISOString()
            });
            console.log(`✅ Order ${order.id} marked as paid`);
        }
    } catch (error) {
        console.error('Error handling payment:', error);
    }
}

// Initialize database and admin
async function initialize() {
    try {
        await db.initDatabase();
        
        // Create default admin if none exists
        const adminCount = await db.getAdminCount();
        if (adminCount === 0) {
            const hashedPassword = bcrypt.hashSync('tegrevinnan2024', 10);
            await db.createAdmin({
                id: uuidv4(),
                username: 'admin',
                password: hashedPassword
            });
            console.log('👤 Admin user created. Username: admin, Password: tegrevinnan2024');
        }
        
        // Create default categories if none exist
        const categoryCount = await db.getCategoryCount();
        if (categoryCount === 0) {
            const defaultCategories = [
                { id: uuidv4(), name: 'Te', slug: 'te', icon: '🍵', sortOrder: 1 },
                { id: uuidv4(), name: 'Kaffe', slug: 'kaffe', icon: '☕', sortOrder: 2 },
                { id: uuidv4(), name: 'Choklad', slug: 'choklad', icon: '🍫', sortOrder: 3 }
            ];
            for (const cat of defaultCategories) {
                await db.createCategory(cat);
            }
            console.log('🏷️ Default categories created');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Image Upload ---
// Compresses and converts image to base64 for database storage
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Ingen bild bifogad' });
    }
    
    try {
        // Compress and resize image using Sharp
        // Max 400x400px, WebP format, quality 75 = ~10-30KB per image
        const compressedBuffer = await sharp(req.file.buffer)
            .resize(400, 400, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 75 })
            .toBuffer();
        
        // Convert to base64 data URL
        const base64 = compressedBuffer.toString('base64');
        const dataUrl = `data:image/webp;base64,${base64}`;
        
        // Calculate size for info
        const sizeKB = Math.round(compressedBuffer.length / 1024);
        
        console.log(`📸 Image compressed: ${Math.round(req.file.size / 1024)}KB → ${sizeKB}KB`);
        
        res.json({
            url: dataUrl,
            size: sizeKB,
            format: 'webp'
        });
        
    } catch (error) {
        console.error('Image compression error:', error);
        res.status(500).json({ error: 'Kunde inte bearbeta bilden' });
    }
});

// Database initialization endpoint (run once to seed products)
app.post('/api/init-database', async (req, res) => {
    const initSecret = req.headers['x-init-secret'];
    if (initSecret !== 'tegrevinnan-init-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const existingProducts = await db.getAllProducts();
        if (existingProducts.length > 0) {
            return res.json({ message: 'Database already has products', count: existingProducts.length });
        }
        
        const sampleProducts = [
            { id: require('uuid').v4(), name: "Earl Grey Imperial", category: "te", price: 149, description: "Ett utsökt svart te aromatiserat med bergamott från Kalabrien.", weight: "100g", origin: "Sri Lanka", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "English Breakfast", category: "te", price: 129, description: "En kraftfull blandning av Assam, Ceylon och kenyanskt te.", weight: "100g", origin: "Blandning", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "Darjeeling First Flush", category: "te", price: 219, description: "Champagnen bland te. Ljust, blommigt och med en subtil muskatellton.", weight: "50g", origin: "Indien", inStock: true, featured: false },
            { id: require('uuid').v4(), name: "Lady Grey", category: "te", price: 159, description: "En mildare variant av Earl Grey med citrus och blåklint.", weight: "100g", origin: "Kina", inStock: true, featured: false },
            { id: require('uuid').v4(), name: "Lapsang Souchong", category: "te", price: 179, description: "Rökt svart te från Fujian-provinsen. Intensiv, rökig smak.", weight: "100g", origin: "Kina", inStock: true, featured: false },
            { id: require('uuid').v4(), name: "Ethiopian Yirgacheffe", category: "kaffe", price: 189, description: "Enastående kaffe med toner av blåbär, jasmin och citrus.", weight: "250g", origin: "Etiopien", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "Colombian Supremo", category: "kaffe", price: 169, description: "Välbalanserat kaffe med nötiga toner och en touch av karamell.", weight: "250g", origin: "Colombia", inStock: true, featured: false },
            { id: require('uuid').v4(), name: "Jamaican Blue Mountain", category: "kaffe", price: 449, description: "Ett av världens mest exklusiva kaffen. Mjukt och komplext.", weight: "200g", origin: "Jamaica", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "Single Origin Ecuador 70%", category: "choklad", price: 89, description: "Mörk choklad med intensiva toner av röda bär.", weight: "100g", origin: "Ecuador", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "Belgisk Mjölkchoklad", category: "choklad", price: 79, description: "Krämig och klassisk belgisk mjölkchoklad.", weight: "100g", origin: "Belgien", inStock: true, featured: false },
            { id: require('uuid').v4(), name: "Chokladpraliner Assorterade", category: "choklad", price: 249, description: "En elegant ask med 16 handgjorda praliner.", weight: "200g", origin: "Sverige", inStock: true, featured: true },
            { id: require('uuid').v4(), name: "Varm Choklad Deluxe", category: "choklad", price: 119, description: "Lyxig drickchoklad med 60% kakao.", weight: "300g", origin: "Frankrike", inStock: true, featured: false }
        ];
        
        for (const product of sampleProducts) {
            await db.createProduct(product);
        }
        
        res.json({ message: 'Database initialized', productsCreated: sampleProducts.length });
    } catch (error) {
        console.error('Init error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Stripe Config ---
app.get('/api/stripe/config', (req, res) => {
    res.json({ 
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        isConfigured: STRIPE_SECRET_KEY !== 'sk_test_PLACEHOLDER'
    });
});

// --- Create Stripe Checkout Session ---
app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
        const { items, customer, shipping } = req.body;
        const products = await db.getAllProducts();
        
        // Validate and build line items
        const lineItems = items.map(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            return {
                price_data: {
                    currency: 'sek',
                    product_data: {
                        name: product.name,
                        description: `${product.weight} - ${product.origin || 'Blandning'}`,
                    },
                    unit_amount: product.price * 100,
                },
                quantity: item.quantity,
            };
        });
        
        // Add shipping
        if (shipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'sek',
                    product_data: {
                        name: 'Frakt',
                        description: 'Leverans inom 2-5 arbetsdagar',
                    },
                    unit_amount: shipping * 100,
                },
                quantity: 1,
            });
        }
        
        // Calculate totals
        const subtotal = items.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            return sum + (product.price * item.quantity);
        }, 0);
        
        // Create order in database
        const orderId = uuidv4();
        const orderItems = items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                productId: item.productId,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                subtotal: product.price * item.quantity
            };
        });

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'klarna'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
            cancel_url: `${FRONTEND_URL}/?cancelled=true`,
            customer_email: customer.email,
            metadata: {
                order_id: orderId,
            },
            shipping_address_collection: {
                allowed_countries: ['SE', 'NO', 'DK', 'FI'],
            },
            locale: 'sv',
        });
        
        // Save order to database
        await db.createOrder({
            id: orderId,
            customer,
            items: orderItems,
            subtotal,
            shipping,
            total: subtotal + shipping,
            status: 'pending_payment',
            paymentMethod: 'stripe',
            stripeSessionId: session.id
        });
        
        res.json({ 
            sessionId: session.id, 
            url: session.url,
            orderId: orderId 
        });
        
    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Verify Stripe Session ---
app.get('/api/stripe/session/:sessionId', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        
        if (session.payment_status === 'paid') {
            await handleSuccessfulPayment(session);
        }
        
        res.json({
            status: session.payment_status,
            customerEmail: session.customer_details?.email,
            amountTotal: session.amount_total / 100,
        });
    } catch (error) {
        console.error('Session verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Categories ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await db.getAllCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.get('/api/categories/:id', async (req, res) => {
    try {
        const category = await db.getCategoryById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

app.post('/api/categories', requireAuth, async (req, res) => {
    try {
        const category = await db.createCategory({
            id: uuidv4(),
            ...req.body
        });
        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
    try {
        const category = await db.updateCategory(req.params.id, req.body);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update category' });
    }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
        const deleted = await db.deleteCategory(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// --- Products ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.getAllProducts();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await db.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.post('/api/products', requireAuth, async (req, res) => {
    try {
        const product = await db.createProduct({
            id: uuidv4(),
            ...req.body
        });
        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const product = await db.updateProduct(req.params.id, req.body);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const deleted = await db.deleteProduct(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// --- Orders ---
app.get('/api/orders', requireAuth, async (req, res) => {
    try {
        const orders = await db.getAllOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await db.getOrderById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Return limited info for public access
        res.json({
            id: order.id,
            status: order.status,
            total: order.total,
            items: order.items,
            createdAt: order.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const order = await db.createOrder({
            id: uuidv4(),
            ...req.body,
            status: 'pending',
            paymentMethod: 'manual'
        });
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
    try {
        const order = await db.updateOrder(req.params.id, req.body);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// --- Auth ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await db.getAdminByUsername(username);
        
        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = uuidv4();
        sessions.set(token, { username, loginAt: new Date() });
        res.json({ token, username });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    const token = req.headers['authorization'];
    if (token) {
        sessions.delete(token);
    }
    res.json({ message: 'Logged out' });
});

app.get('/api/verify', requireAuth, (req, res) => {
    res.json({ valid: true });
});

app.post('/api/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const token = req.headers['authorization'];
        const session = sessions.get(token);
        
        const admin = await db.getAdminByUsername(session.username);
        
        if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await db.updateAdminPassword(session.username, hashedPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Start server
initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`🍵 Tegrevinnan API running on port ${PORT}`);
        if (STRIPE_SECRET_KEY === 'sk_test_PLACEHOLDER') {
            console.log('⚠️  Stripe is not configured');
        } else {
            console.log('✅ Stripe is configured');
        }
    });
});

