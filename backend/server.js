const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Stripe setup
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_PLACEHOLDER';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_PLACEHOLDER';
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// CORS - allow frontend to access API
app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
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
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

