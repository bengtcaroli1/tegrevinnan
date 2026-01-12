# Deployment Guide - Tegrevinnan

## Projektstruktur

```
tegrevinnan/
├── backend/          ← Railway (Node.js + PostgreSQL)
│   ├── server.js
│   ├── db.js
│   ├── db-init.js
│   ├── package.json
│   └── railway.json
│
└── frontend/         ← Vercel (Statiska filer)
    ├── index.html
    ├── admin.html
    ├── success.html
    ├── css/
    ├── js/
    └── vercel.json
```

---

## 🚂 Backend på Railway

### 1. Skapa nytt projekt på Railway

1. Gå till [railway.app](https://railway.app)
2. Klicka "New Project"
3. Välj "Deploy from GitHub repo"
4. Välj ditt repo och välj `/backend` som root directory

### 2. Lägg till PostgreSQL

1. I Railway-projektet, klicka "+ New"
2. Välj "Database" → "PostgreSQL"
3. Vänta tills databasen är igång

### 3. Konfigurera miljövariabler

Gå till backend-tjänsten → "Variables" och lägg till:

| Variabel | Värde |
|----------|-------|
| `DATABASE_URL` | (skapas automatiskt när du kopplar PostgreSQL) |
| `STRIPE_SECRET_KEY` | `sk_test_51SosEGCL1944Yn1E...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_51SosEGCL1944Yn1E...` |
| `FRONTEND_URL` | `https://tegrevinnan.vercel.app` (din Vercel URL) |
| `NODE_ENV` | `production` |

### 4. Koppla PostgreSQL till backend

1. Klicka på PostgreSQL-databasen
2. Gå till "Connect"
3. Klicka "Add Variable Reference" till din backend

### 5. Initiera databasen

Första gången behöver du köra:
```bash
railway run npm run db:init
```

Eller gör det manuellt via Railway shell.

### 6. Notera din backend-URL

Efter deploy får du en URL som:
`https://tegrevinnan-backend-production.up.railway.app`

---

## ▲ Frontend på Vercel

### 1. Skapa nytt projekt på Vercel

1. Gå till [vercel.com](https://vercel.com)
2. Klicka "New Project"
3. Importera ditt GitHub-repo
4. **Viktigt:** Sätt "Root Directory" till `frontend`

### 2. Uppdatera API URL

Innan deploy, uppdatera `/frontend/js/config.js`:

```javascript
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://din-backend-url.railway.app';  // ← Ändra till din Railway URL

window.API_URL = API_URL;
```

### 3. Deploy

1. Push till GitHub
2. Vercel bygger och deployar automatiskt

---

## 🔧 Lokal utveckling

### Backend
```bash
cd backend
npm install

# Starta med lokal PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/tegrevinnan \
STRIPE_SECRET_KEY=sk_test_xxx \
STRIPE_PUBLISHABLE_KEY=pk_test_xxx \
FRONTEND_URL=http://localhost:3000 \
npm start
```

### Frontend
```bash
cd frontend
# Använd valfri statisk server, t.ex:
npx serve .
# eller
python3 -m http.server 3000
```

---

## 🔒 Produktions-checklist

- [ ] Byt Stripe test-nycklar till live-nycklar
- [ ] Konfigurera Stripe webhook (`/api/stripe/webhook`)
- [ ] Byt admin-lösenord
- [ ] Lägg till custom domain på Vercel
- [ ] Konfigurera SSL (automatiskt på Vercel/Railway)

---

## 📧 Stripe Webhook

För att ordrar automatiskt ska markeras som betalda i produktion:

1. Gå till [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Lägg till endpoint: `https://din-backend.railway.app/api/stripe/webhook`
3. Välj event: `checkout.session.completed`
4. Kopiera webhook-hemligheten
5. Lägg till i Railway: `STRIPE_WEBHOOK_SECRET=whsec_xxx`

