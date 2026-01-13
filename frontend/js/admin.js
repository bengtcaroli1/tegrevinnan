// ==========================================
// TEGREVINNAN - Admin Panel
// ==========================================

// API URL from config
const API_BASE = window.API_URL || '';

// State
let authToken = null;
let products = [];
let orders = [];
let categories = [];
let currentProductId = null;
let currentCategoryId = null;
let deleteItemId = null;
let deleteItemType = null;

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

// Categories
const categoriesTableBody = document.getElementById('categoriesTableBody');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const categoryModal = document.getElementById('categoryModal');
const categoryModalTitle = document.getElementById('categoryModalTitle');
const categoryModalClose = document.getElementById('categoryModalClose');
const categoryForm = document.getElementById('categoryForm');
const cancelCategory = document.getElementById('cancelCategory');

// Delete modal
const deleteModal = document.getElementById('deleteModal');
const deleteItemName = document.getElementById('deleteItemName');
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
    
    // Image upload
    setupImageUpload();
    
    // Categories
    addCategoryBtn.addEventListener('click', () => openCategoryModal());
    categoryModalClose.addEventListener('click', closeCategoryModal);
    cancelCategory.addEventListener('click', closeCategoryModal);
    categoryForm.addEventListener('submit', handleSaveCategory);
    categoryModal.addEventListener('click', (e) => {
        if (e.target === categoryModal) closeCategoryModal();
    });
    
    // Auto-generate slug from name
    document.getElementById('categoryName').addEventListener('input', (e) => {
        const slugField = document.getElementById('categorySlug');
        if (!currentCategoryId) { // Only auto-fill for new categories
            slugField.value = e.target.value.toLowerCase()
                .replace(/[åä]/g, 'a')
                .replace(/ö/g, 'o')
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }
    });
    
    // Delete modal
    cancelDelete.addEventListener('click', closeDeleteModal);
    confirmDelete.addEventListener('click', handleDeleteConfirm);
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
            closeCategoryModal();
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
    loadCategories();
    loadProducts();
    loadOrders();
}

// ==========================================
// NAVIGATION
// ==========================================

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}Section`).classList.add('active');
    
    if (section === 'orders') {
        loadOrders();
    } else if (section === 'categories') {
        loadCategories();
    }
}

// ==========================================
// CATEGORIES
// ==========================================

async function loadCategories() {
    try {
        const response = await fetch(API_BASE + '/api/categories');
        categories = await response.json();
        renderCategoriesTable();
        updateProductCategoryDropdown();
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Kunde inte ladda kategorier', 'error');
    }
}

function renderCategoriesTable() {
    if (categories.length === 0) {
        categoriesTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem;">
                    Inga kategorier. Lägg till din första kategori!
                </td>
            </tr>
        `;
        return;
    }
    
    categoriesTableBody.innerHTML = categories.map(cat => `
        <tr>
            <td style="font-size: 1.5rem;">${cat.icon || '📦'}</td>
            <td><strong>${cat.name}</strong></td>
            <td><code>${cat.slug}</code></td>
            <td>${cat.sortOrder}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit-btn" onclick="editCategory('${cat.id}')">Redigera</button>
                    <button class="delete-btn-small" onclick="confirmDeleteCategory('${cat.id}')">Ta bort</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateProductCategoryDropdown() {
    const dropdown = document.getElementById('productCategory');
    if (categories.length === 0) {
        dropdown.innerHTML = '<option value="">Inga kategorier - skapa en först</option>';
    } else {
        dropdown.innerHTML = categories.map(cat => 
            `<option value="${cat.slug}">${cat.icon} ${cat.name}</option>`
        ).join('');
    }
}

function openCategoryModal(categoryId = null) {
    currentCategoryId = categoryId;
    
    if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;
        
        categoryModalTitle.textContent = 'Redigera kategori';
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categorySlug').value = category.slug;
        document.getElementById('categoryIcon').value = category.icon || '';
        document.getElementById('categorySortOrder').value = category.sortOrder || 0;
    } else {
        categoryModalTitle.textContent = 'Lägg till kategori';
        categoryForm.reset();
        document.getElementById('categoryId').value = '';
        document.getElementById('categorySortOrder').value = '0';
    }
    
    categoryModal.classList.add('active');
}

function closeCategoryModal() {
    categoryModal.classList.remove('active');
    currentCategoryId = null;
}

function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

async function handleSaveCategory(e) {
    e.preventDefault();
    
    const categoryData = {
        name: document.getElementById('categoryName').value,
        slug: document.getElementById('categorySlug').value,
        icon: document.getElementById('categoryIcon').value || '📦',
        sortOrder: parseInt(document.getElementById('categorySortOrder').value) || 0
    };
    
    const categoryId = document.getElementById('categoryId').value;
    
    try {
        let response;
        
        if (categoryId) {
            response = await fetch(`${API_BASE}/api/categories/${categoryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken
                },
                body: JSON.stringify(categoryData)
            });
        } else {
            response = await fetch(API_BASE + '/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken
                },
                body: JSON.stringify(categoryData)
            });
        }
        
        if (!response.ok) throw new Error('Save failed');
        
        closeCategoryModal();
        loadCategories();
        showToast(categoryId ? 'Kategori uppdaterad!' : 'Kategori tillagd!', 'success');
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('Kunde inte spara kategorin', 'error');
    }
}

function confirmDeleteCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    deleteItemId = categoryId;
    deleteItemType = 'category';
    deleteItemName.textContent = category.name;
    deleteModal.classList.add('active');
}

// ==========================================
// IMAGE UPLOAD
// ==========================================

let currentImageUrl = '';

function setupImageUpload() {
    const imagePreview = document.getElementById('imagePreview');
    const imageFileInput = document.getElementById('productImageFile');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    if (!imagePreview) return;
    
    // Click on preview area to trigger file input
    imagePreview.addEventListener('click', (e) => {
        if (e.target !== removeImageBtn && !removeImageBtn.contains(e.target)) {
            imageFileInput.click();
        }
    });
    
    // Handle file selection
    imageFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
            showToast('Bilden får max vara 5 MB', 'error');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Endast bilder är tillåtna', 'error');
            return;
        }
        
        await uploadImage(file);
    });
    
    // Remove image button
    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearImagePreview();
    });
}

async function uploadImage(file) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewImg = document.getElementById('previewImg');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    // Show progress
    uploadPlaceholder.style.display = 'none';
    previewImg.style.display = 'none';
    removeImageBtn.style.display = 'none';
    uploadProgress.style.display = 'flex';
    progressFill.style.width = '30%';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        progressFill.style.width = '60%';
        
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': authToken
            },
            body: formData
        });
        
        progressFill.style.width = '90%';
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
        const data = await response.json();
        progressFill.style.width = '100%';
        
        // Update preview
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            previewImg.src = data.url;
            previewImg.style.display = 'block';
            removeImageBtn.style.display = 'flex';
            
            // Store the URL
            currentImageUrl = data.url;
            document.getElementById('productImage').value = data.url;
        }, 200);
        
        showToast('Bild uppladdad!', 'success');
        
    } catch (error) {
        console.error('Upload error:', error);
        uploadProgress.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';
        showToast(error.message || 'Kunde inte ladda upp bilden', 'error');
    }
}

function clearImagePreview() {
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewImg = document.getElementById('previewImg');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const imageFileInput = document.getElementById('productImageFile');
    
    uploadPlaceholder.style.display = 'flex';
    previewImg.style.display = 'none';
    previewImg.src = '';
    removeImageBtn.style.display = 'none';
    imageFileInput.value = '';
    currentImageUrl = '';
    document.getElementById('productImage').value = '';
}

function setImagePreview(url) {
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewImg = document.getElementById('previewImg');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    if (url) {
        uploadPlaceholder.style.display = 'none';
        previewImg.src = url;
        previewImg.style.display = 'block';
        removeImageBtn.style.display = 'flex';
        currentImageUrl = url;
        document.getElementById('productImage').value = url;
    } else {
        clearImagePreview();
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

function getCategoryIcon(slug) {
    const category = categories.find(c => c.slug === slug);
    return category ? category.icon : '📦';
}

function getCategoryName(slug) {
    const category = categories.find(c => c.slug === slug);
    return category ? category.name : slug;
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
                    ${product.image 
                        ? `<img src="${product.image}" alt="${product.name}" class="product-thumb">`
                        : `<div class="product-icon">${getCategoryIcon(product.category)}</div>`
                    }
                    <span class="product-name-cell">${product.name}</span>
                </div>
            </td>
            <td><span class="category-badge">${getCategoryName(product.category)}</span></td>
            <td>${product.price} kr</td>
            <td>${product.weight || '-'}</td>
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

function openProductModal(productId = null) {
    currentProductId = productId;
    updateProductCategoryDropdown();
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        modalTitle.textContent = 'Redigera produkt';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productWeight').value = product.weight || '';
        document.getElementById('productOrigin').value = product.origin || '';
        document.getElementById('productInStock').checked = product.inStock;
        document.getElementById('productFeatured').checked = product.featured;
        document.getElementById('productDescription').value = product.description;
        
        // Set image preview
        setImagePreview(product.image || '');
    } else {
        modalTitle.textContent = 'Lägg till produkt';
        productForm.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productInStock').checked = true;
        document.getElementById('productFeatured').checked = false;
        
        // Clear image preview
        clearImagePreview();
    }
    
    productModal.classList.add('active');
}

function closeProductModal() {
    productModal.classList.remove('active');
    currentProductId = null;
    clearImagePreview();
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
        image: document.getElementById('productImage').value || '',
        inStock: document.getElementById('productInStock').checked,
        featured: document.getElementById('productFeatured').checked,
        description: document.getElementById('productDescription').value
    };
    
    const productId = document.getElementById('productId').value;
    
    try {
        let response;
        
        if (productId) {
            response = await fetch(`${API_BASE}/api/products/${productId}`, {
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
    
    deleteItemId = productId;
    deleteItemType = 'product';
    deleteItemName.textContent = product.name;
    deleteModal.classList.add('active');
}

// ==========================================
// DELETE HANDLING
// ==========================================

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deleteItemId = null;
    deleteItemType = null;
}

async function handleDeleteConfirm() {
    if (!deleteItemId || !deleteItemType) return;
    
    try {
        const endpoint = deleteItemType === 'product' 
            ? `${API_BASE}/api/products/${deleteItemId}`
            : `${API_BASE}/api/categories/${deleteItemId}`;
            
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': authToken }
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        closeDeleteModal();
        
        if (deleteItemType === 'product') {
            loadProducts();
            showToast('Produkt borttagen!', 'success');
        } else {
            loadCategories();
            showToast('Kategori borttagen!', 'success');
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Kunde inte ta bort', 'error');
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
                <span class="order-customer">${order.customer?.name || 'Okänd'}</span>
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
        pending_payment: 'Väntar betalning',
        paid: 'Betald',
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
                <div class="order-detail-item"><strong>Betalmetod:</strong> ${order.paymentMethod || 'Ej angiven'}</div>
                <div class="order-detail-item">
                    <strong>Status:</strong>
                    <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Väntar</option>
                        <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Betald</option>
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
                <div class="order-detail-item"><strong>Namn:</strong> ${order.customer?.name || '-'}</div>
                <div class="order-detail-item"><strong>E-post:</strong> ${order.customer?.email || '-'}</div>
                <div class="order-detail-item"><strong>Telefon:</strong> ${order.customer?.phone || '-'}</div>
                <div class="order-detail-item"><strong>Adress:</strong> ${order.customer?.address || '-'}, ${order.customer?.postalCode || ''} ${order.customer?.city || ''}</div>
            </div>
        </div>
        
        <div class="order-detail-section">
            <h3>Produkter</h3>
            <div class="order-items-list">
                ${(order.items || []).map(item => `
                    <div class="order-item-row">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>${item.subtotal || item.price * item.quantity} kr</span>
                    </div>
                `).join('')}
                <div class="order-item-row">
                    <span>Frakt</span>
                    <span>${order.shipping || 0} kr</span>
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
        const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
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
