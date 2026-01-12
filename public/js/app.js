// ==========================================
// TEGREVINNAN - Main Application
// ==========================================

// State
let products = [];
let cart = [];
let currentCategory = 'all';
let stripeConfig = { isConfigured: false, publishableKey: null };

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const productModal = document.getElementById('productModal');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');
const checkoutModal = document.getElementById('checkoutModal');
const checkoutClose = document.getElementById('checkoutClose');
const checkoutForm = document.getElementById('checkoutForm');
const orderSummary = document.getElementById('orderSummary');
const confirmationModal = document.getElementById('confirmationModal');
const confirmationClose = document.getElementById('confirmationClose');
const orderId = document.getElementById('orderId');

// Category icons
const categoryIcons = {
    te: '🍵',
    kaffe: '☕',
    choklad: '🍫'
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    loadProducts();
    loadStripeConfig();
    setupEventListeners();
    checkForCancelledPayment();
});

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        productsGrid.innerHTML = '<p class="error">Kunde inte ladda produkter. Försök igen senare.</p>';
    }
}

async function loadStripeConfig() {
    try {
        const response = await fetch('/api/stripe/config');
        stripeConfig = await response.json();
        console.log('Stripe configured:', stripeConfig.isConfigured);
    } catch (error) {
        console.error('Error loading Stripe config:', error);
    }
}

function checkForCancelledPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cancelled') === 'true') {
        // Show a message that payment was cancelled
        setTimeout(() => {
            alert('Betalningen avbröts. Din varukorg finns kvar om du vill försöka igen.');
        }, 500);
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
    }
}

function setupEventListeners() {
    // Cart
    cartBtn.addEventListener('click', openCart);
    closeCart.addEventListener('click', closeCartSidebar);
    cartOverlay.addEventListener('click', closeCartSidebar);
    checkoutBtn.addEventListener('click', openCheckout);
    
    // Product modal
    modalClose.addEventListener('click', closeProductModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });
    
    // Checkout modal
    checkoutClose.addEventListener('click', closeCheckoutModal);
    checkoutModal.addEventListener('click', (e) => {
        if (e.target === checkoutModal) closeCheckoutModal();
    });
    checkoutForm.addEventListener('submit', handleCheckout);
    
    // Confirmation modal
    confirmationClose.addEventListener('click', closeConfirmationModal);
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeConfirmationModal();
    });
    
    // Category tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            renderProducts();
        });
    });
    
    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentCategory = link.dataset.category;
            
            // Update tab buttons to match
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === currentCategory);
            });
            
            renderProducts();
            
            // Scroll to products section
            document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ==========================================
// PRODUCTS
// ==========================================

function renderProducts() {
    const filteredProducts = currentCategory === 'all' 
        ? products 
        : products.filter(p => p.category === currentCategory);
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">Inga produkter hittades.</p>';
        return;
    }
    
    productsGrid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image">
                ${categoryIcons[product.category] || '📦'}
                ${product.featured ? '<span class="product-badge">Utvalt</span>' : ''}
            </div>
            <div class="product-info">
                <div class="product-category">${getCategoryName(product.category)}</div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-meta">
                    <div>
                        <div class="product-price">${product.price} kr</div>
                        <div class="product-weight">${product.weight}</div>
                    </div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        Lägg i korg
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers for product cards
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => openProductModal(card.dataset.id));
    });
}

function getCategoryName(category) {
    const names = {
        te: 'Te',
        kaffe: 'Kaffe',
        choklad: 'Choklad'
    };
    return names[category] || category;
}

function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    modalBody.innerHTML = `
        <div class="product-modal-image">
            ${categoryIcons[product.category] || '📦'}
        </div>
        <div class="product-modal-category">${getCategoryName(product.category)}</div>
        <h2 class="product-modal-title">${product.name}</h2>
        <div class="product-modal-details">
            <span>📦 ${product.weight}</span>
            <span>🌍 ${product.origin}</span>
            <span>${product.inStock ? '✓ I lager' : '✗ Slut i lager'}</span>
        </div>
        <div class="product-modal-price">${product.price} kr</div>
        <p class="product-modal-description">${product.description}</p>
        <div class="product-modal-actions">
            <div class="qty-selector">
                <button type="button" onclick="decrementQty()">−</button>
                <input type="number" id="modalQty" value="1" min="1" max="99" readonly>
                <button type="button" onclick="incrementQty()">+</button>
            </div>
            <button class="add-to-cart-large" onclick="addToCartFromModal('${product.id}')">
                Lägg i varukorg
            </button>
        </div>
    `;
    
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
}

function incrementQty() {
    const input = document.getElementById('modalQty');
    if (input && parseInt(input.value) < 99) {
        input.value = parseInt(input.value) + 1;
    }
}

function decrementQty() {
    const input = document.getElementById('modalQty');
    if (input && parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

function addToCartFromModal(productId) {
    const qty = parseInt(document.getElementById('modalQty').value) || 1;
    addToCart(productId, qty);
    closeProductModal();
}

// ==========================================
// CART
// ==========================================

function loadCart() {
    const saved = localStorage.getItem('tegrevinnan_cart');
    if (saved) {
        cart = JSON.parse(saved);
    }
    updateCartCount();
}

function saveCart() {
    localStorage.setItem('tegrevinnan_cart', JSON.stringify(cart));
}

function addToCart(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            category: product.category,
            weight: product.weight,
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartCount();
    renderCart();
    
    // Show cart briefly
    openCart();
    
    // Flash effect on cart button
    cartBtn.style.transform = 'scale(1.1)';
    setTimeout(() => {
        cartBtn.style.transform = '';
    }, 200);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartCount();
    renderCart();
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        updateCartCount();
        renderCart();
    }
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = count;
}

function calculateTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calculateShipping() {
    const total = calculateTotal();
    return total >= 500 ? 0 : 59;
}

function renderCart() {
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p>Din varukorg är tom</p>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">
                    ${categoryIcons[item.category] || '📦'}
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price} kr × ${item.quantity}</div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                        <span class="cart-item-qty">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}')" title="Ta bort">🗑</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
    
    cartTotal.textContent = `${calculateTotal()} kr`;
}

function openCart() {
    renderCart();
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
}

function closeCartSidebar() {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
}

// ==========================================
// CHECKOUT
// ==========================================

function openCheckout() {
    closeCartSidebar();
    renderOrderSummary();
    updatePaymentButtons();
    checkoutModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
    checkoutModal.classList.remove('active');
    document.body.style.overflow = '';
}

function updatePaymentButtons() {
    const submitBtn = checkoutForm.querySelector('.submit-order-btn');
    if (stripeConfig.isConfigured) {
        submitBtn.innerHTML = '💳 Betala säkert med kort';
        submitBtn.classList.add('stripe-btn');
    } else {
        submitBtn.innerHTML = 'Skicka Beställning';
        submitBtn.classList.remove('stripe-btn');
    }
}

function renderOrderSummary() {
    const total = calculateTotal();
    const shipping = calculateShipping();
    
    orderSummary.innerHTML = `
        ${cart.map(item => `
            <div class="order-summary-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${item.price * item.quantity} kr</span>
            </div>
        `).join('')}
        <div class="order-summary-item">
            <span>Frakt ${total >= 500 ? '(Fri frakt!)' : ''}</span>
            <span>${shipping} kr</span>
        </div>
        <div class="order-summary-item">
            <span>Totalt</span>
            <span>${total + shipping} kr</span>
        </div>
    `;
}

async function handleCheckout(e) {
    e.preventDefault();
    
    const formData = new FormData(checkoutForm);
    const total = calculateTotal();
    const shipping = calculateShipping();
    
    const customer = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        postalCode: formData.get('postalCode'),
        city: formData.get('city')
    };
    
    const items = cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
    }));
    
    // If Stripe is configured, use Stripe Checkout
    if (stripeConfig.isConfigured) {
        await handleStripeCheckout(customer, items, shipping);
    } else {
        // Fallback to manual order
        await handleManualOrder(customer, items, total, shipping, formData.get('notes'));
    }
}

async function handleStripeCheckout(customer, items, shipping) {
    const submitBtn = checkoutForm.querySelector('.submit-order-btn');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Förbereder betalning...';
        
        const response = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                })),
                customer,
                shipping
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Checkout failed');
        }
        
        const { url } = await response.json();
        
        // Redirect to Stripe Checkout
        window.location.href = url;
        
    } catch (error) {
        console.error('Stripe checkout error:', error);
        alert('Ett fel uppstod vid betalningen. Försök igen eller kontakta oss.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function handleManualOrder(customer, items, total, shipping, notes) {
    const orderData = {
        customer,
        items,
        subtotal: total,
        shipping,
        total: total + shipping,
        notes: notes || ''
    };
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) throw new Error('Order failed');
        
        const result = await response.json();
        
        // Clear cart
        cart = [];
        saveCart();
        updateCartCount();
        
        // Show confirmation
        closeCheckoutModal();
        orderId.textContent = result.id;
        confirmationModal.classList.add('active');
        checkoutForm.reset();
        
    } catch (error) {
        console.error('Order error:', error);
        alert('Ett fel uppstod. Försök igen eller kontakta oss.');
    }
}

function closeConfirmationModal() {
    confirmationModal.classList.remove('active');
    document.body.style.overflow = '';
}

// ==========================================
// KEYBOARD NAVIGATION
// ==========================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (confirmationModal.classList.contains('active')) {
            closeConfirmationModal();
        } else if (checkoutModal.classList.contains('active')) {
            closeCheckoutModal();
        } else if (productModal.classList.contains('active')) {
            closeProductModal();
        } else if (cartSidebar.classList.contains('active')) {
            closeCartSidebar();
        }
    }
});
