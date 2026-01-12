// ==========================================
// TEGREVINNAN - Admin Panel
// ==========================================

// API URL from config
const API_BASE = window.API_URL || '';

// State
let authToken = null;
let products = [];
let orders = [];
let currentProductId = null;
let deleteProductId = null;

// Category icons
const categoryIcons = {
    te: '🍵',
    kaffe: '☕',
    choklad: '🍫'
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Products
const productsTableBody = document.getElementById('productsTableBody');
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const productForm = document.getElementById('productForm');
const cancelProduct = document.getElementById('cancelProduct');

// Delete modal
const deleteModal = document.getElementById('deleteModal');
const deleteProductName = document.getElementById('deleteProductName');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');

// Orders
const ordersList = document.getElementById('ordersList');
const orderModal = document.getElementById('orderModal');
const orderModalClose = document.getElementById('orderModalClose');
const orderDetail = document.getElementById('orderDetail');

// Settings
const passwordForm = document.getElementById('passwordForm');

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

async function checkAuth() {
    authToken = localStorage.getItem('tegrevinnan_admin_token');
    
    if (authToken) {
        try {
            const response = await fetch(API_BASE + '/api/verify', {
                headers: { 'Authorization': authToken }
            });
            
            if (response.ok) {
                showDashboard();
                return;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
        
        // Token invalid, clear it
        localStorage.removeItem('tegrevinnan_admin_token');
        authToken = null;
    }
    
    showLogin();
}

function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // Products
    addProductBtn.addEventListener('click', () => openProductModal());
    modalClose.addEventListener('click', closeProductModal);
    cancelProduct.addEventListener('click', closeProductModal);
    productForm.addEventListener('submit', handleSaveProduct);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });
    
    // Delete modal
    cancelDelete.addEventListener('click', closeDeleteModal);
    confirmDelete.addEventListener('click', handleDeleteProduct);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    
    // Order modal
    orderModalClose.addEventListener('click', closeOrderModal);
    orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeOrderModal();
    });
    
    // Settings
    passwordForm.addEventListener('submit', handleChangePassword);
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeDeleteModal();
            closeOrderModal();
        }
    });
}

// ==========================================
// AUTH
// ==========================================

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(API_BASE + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error('Login failed');
        }
        
        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('tegrevinnan_admin_token', authToken);
        
        showDashboard();
        
    } catch (error) {
        loginError.textContent = 'Felaktigt användarnamn eller lösenord';
    }
}

async function handleLogout() {
    try {
        await fetch(API_BASE + '/api/logout', {
            method: 'POST',
            headers: { 'Authorization': authToken }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    localStorage.removeItem('tegrevinnan_admin_token');
    authToken = null;
    showLogin();
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    adminDashboard.classList.remove('active');
    loginForm.reset();
    loginError.textContent = '';
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    adminDashboard.classList.add('active');
    loadProducts();
    loadOrders();
}

// ==========================================
// NAVIGATION
// ==========================================

function switchSection(section) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    // Update sections
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}Section`).classList.add('active');
    
    // Load data if needed
    if (section === 'orders') {
        loadOrders();
    }
}

// ==========================================
// PRODUCTS
// ==========================================

async function loadProducts() {
    try {
        const response = await fetch(API_BASE + '/api/products');
        products = await response.json();
        renderProductsTable();
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Kunde inte ladda produkter', 'error');
    }
}

function renderProductsTable() {
    if (products.length === 0) {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    Inga produkter. Lägg till din första produkt!
                </td>
            </tr>
        `;
        return;
    }
    
    productsTableBody.innerHTML = products.map(product => `
        <tr>
            <td>
                <div class="product-cell">
                    <div class="product-icon">${categoryIcons[product.category] || '📦'}</div>
                    <span class="product-name-cell">${product.name}</span>
                </div>
            </td>
            <td><span class="category-badge">${getCategoryName(product.category)}</span></td>
            <td>${product.price} kr</td>
            <td>${product.weight}</td>
            <td>
                <span class="stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}">
                    ${product.inStock ? 'Ja' : 'Nej'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="edit-btn" onclick="editProduct('${product.id}')">Redigera</button>
                    <button class="delete-btn-small" onclick="confirmDeleteProduct('${product.id}')">Ta bort</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getCategoryName(category) {
    const names = { te: 'Te', kaffe: 'Kaffe', choklad: 'Choklad' };
    return names[category] || category;
}

function openProductModal(productId = null) {
    currentProductId = productId;
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        modalTitle.textContent = 'Redigera produkt';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productWeight').value = product.weight;
        document.getElementById('productOrigin').value = product.origin || '';
        document.getElementById('productInStock').checked = product.inStock;
        document.getElementById('productFeatured').checked = product.featured;
        document.getElementById('productDescription').value = product.description;
    } else {
        modalTitle.textContent = 'Lägg till produkt';
        productForm.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productInStock').checked = true;
        document.getElementById('productFeatured').checked = false;
    }
    
    productModal.classList.add('active');
}

function closeProductModal() {
    productModal.classList.remove('active');
    currentProductId = null;
}

function editProduct(productId) {
    openProductModal(productId);
}

async function handleSaveProduct(e) {
    e.preventDefault();
    
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseInt(document.getElementById('productPrice').value),
        weight: document.getElementById('productWeight').value,
        origin: document.getElementById('productOrigin').value || '',
        inStock: document.getElementById('productInStock').checked,
        featured: document.getElementById('productFeatured').checked,
        description: document.getElementById('productDescription').value
    };
    
    const productId = document.getElementById('productId').value;
    
    try {
        let response;
        
        if (productId) {
            response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken
                },
                body: JSON.stringify(productData)
            });
        } else {
            response = await fetch(API_BASE + '/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken
                },
                body: JSON.stringify(productData)
            });
        }
        
        if (!response.ok) throw new Error('Save failed');
        
        closeProductModal();
        loadProducts();
        showToast(productId ? 'Produkt uppdaterad!' : 'Produkt tillagd!', 'success');
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('Kunde inte spara produkten', 'error');
    }
}

function confirmDeleteProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    deleteProductId = productId;
    deleteProductName.textContent = product.name;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deleteProductId = null;
}

async function handleDeleteProduct() {
    if (!deleteProductId) return;
    
    try {
        const response = await fetch(`/api/products/${deleteProductId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authToken }
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        closeDeleteModal();
        loadProducts();
        showToast('Produkt borttagen!', 'success');
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Kunde inte ta bort produkten', 'error');
    }
}

// ==========================================
// ORDERS
// ==========================================

async function loadOrders() {
    try {
        const response = await fetch(API_BASE + '/api/orders', {
            headers: { 'Authorization': authToken }
        });
        orders = await response.json();
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Kunde inte ladda beställningar', 'error');
    }
}

function renderOrders() {
    if (orders.length === 0) {
        ordersList.innerHTML = `
            <div class="no-orders">
                <p>Inga beställningar ännu.</p>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = orders.map(order => `
        <div class="order-card" onclick="openOrderModal('${order.id}')">
            <div class="order-header">
                <div>
                    <div class="order-id">#${order.id.slice(0, 8).toUpperCase()}</div>
                    <div class="order-date">${formatDate(order.createdAt)}</div>
                </div>
                <span class="order-status ${order.status}">${getStatusName(order.status)}</span>
            </div>
            <div class="order-info">
                <span class="order-customer">${order.customer.name}</span>
                <span class="order-total">${order.total} kr</span>
            </div>
        </div>
    `).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusName(status) {
    const names = {
        pending: 'Väntar',
        confirmed: 'Bekräftad',
        shipped: 'Skickad',
        completed: 'Slutförd',
        cancelled: 'Avbruten'
    };
    return names[status] || status;
}

function openOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    orderDetail.innerHTML = `
        <div class="order-detail-section">
            <h3>Beställningsinformation</h3>
            <div class="order-detail-grid">
                <div class="order-detail-item"><strong>Ordernummer:</strong> #${order.id.slice(0, 8).toUpperCase()}</div>
                <div class="order-detail-item"><strong>Datum:</strong> ${formatDate(order.createdAt)}</div>
                <div class="order-detail-item">
                    <strong>Status:</strong>
                    <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Väntar</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Bekräftad</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Skickad</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Slutförd</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Avbruten</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="order-detail-section">
            <h3>Kund</h3>
            <div class="order-detail-grid">
                <div class="order-detail-item"><strong>Namn:</strong> ${order.customer.name}</div>
                <div class="order-detail-item"><strong>E-post:</strong> ${order.customer.email}</div>
                <div class="order-detail-item"><strong>Telefon:</strong> ${order.customer.phone}</div>
                <div class="order-detail-item"><strong>Adress:</strong> ${order.customer.address}, ${order.customer.postalCode} ${order.customer.city}</div>
            </div>
        </div>
        
        <div class="order-detail-section">
            <h3>Produkter</h3>
            <div class="order-items-list">
                ${order.items.map(item => `
                    <div class="order-item-row">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>${item.subtotal} kr</span>
                    </div>
                `).join('')}
                <div class="order-item-row">
                    <span>Frakt</span>
                    <span>${order.shipping} kr</span>
                </div>
                <div class="order-item-row total">
                    <span>Totalt</span>
                    <span>${order.total} kr</span>
                </div>
            </div>
        </div>
        
        ${order.notes ? `
            <div class="order-detail-section">
                <h3>Meddelande från kund</h3>
                <p>${order.notes}</p>
            </div>
        ` : ''}
    `;
    
    orderModal.classList.add('active');
}

function closeOrderModal() {
    orderModal.classList.remove('active');
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Update failed');
        
        loadOrders();
        showToast('Status uppdaterad!', 'success');
        
    } catch (error) {
        console.error('Update error:', error);
        showToast('Kunde inte uppdatera status', 'error');
    }
}

// ==========================================
// SETTINGS
// ==========================================

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showToast('Lösenorden matchar inte', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Lösenordet måste vara minst 6 tecken', 'error');
        return;
    }
    
    try {
        const response = await fetch(API_BASE + '/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Password change failed');
        }
        
        passwordForm.reset();
        showToast('Lösenordet har ändrats!', 'success');
        
    } catch (error) {
        console.error('Password change error:', error);
        showToast(error.message === 'Current password is incorrect' 
            ? 'Nuvarande lösenord är felaktigt' 
            : 'Kunde inte ändra lösenordet', 'error');
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

