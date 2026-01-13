// API Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'  // Lokal utveckling
    : 'https://tegrevinnan-production.up.railway.app';  // Railway backend

// Export for use in other files
window.API_URL = API_URL;

