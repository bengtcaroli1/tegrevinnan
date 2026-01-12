// API Configuration
// Ändra API_URL till din Railway-backend URL när du deployar
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'  // Lokal utveckling
    : 'https://tegrevinnan-backend-production.up.railway.app';  // Ändra till din Railway URL

// Export for use in other files
window.API_URL = API_URL;

