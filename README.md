# Tegrevinnan - Webshop

En elegant webshop för Te, Kaffe & Choklad med klassisk engelsk tebutik-stil.

## Funktioner

- 🍵 **Produktkatalog** - Te, kaffe och choklad med kategorisering
- 🛒 **Varukorg** - Lägg till, ta bort och ändra antal
- 💳 **Stripe-betalning** - Säker kortbetalning, Apple Pay, Google Pay, Klarna
- 📋 **Beställningar** - Komplett beställningshantering
- 👤 **Admin-panel** - Hantera produkter och beställningar
- 📱 **Responsiv design** - Fungerar på alla enheter

## Installation

1. **Installera beroenden:**
   ```bash
   npm install
   ```

2. **Konfigurera Stripe (valfritt men rekommenderat):**
   
   Skapa ett konto på [Stripe](https://stripe.com) och hämta dina API-nycklar från [Dashboard](https://dashboard.stripe.com/apikeys).
   
   Starta servern med Stripe-nycklar:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx STRIPE_PUBLISHABLE_KEY=pk_test_xxx npm start
   ```

3. **Starta servern:**
   ```bash
   npm start
   ```

4. **Öppna i webbläsare:**
   - Butik: http://localhost:3000
   - Admin: http://localhost:3000/admin.html

## Stripe-konfiguration

### Testnycklarar (för utveckling)
Använd Stripes testnycklar för att testa betalningar utan riktiga pengar:
- Testkort: `4242 4242 4242 4242`
- Utgångsdatum: Valfritt framtida datum
- CVC: Valfria 3 siffror

### Produktionsnycklar
När du är redo för produktion, byt till live-nycklar i Stripe Dashboard.

### Miljövariabler

| Variabel | Beskrivning |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Din Stripe secret key (sk_test_xxx eller sk_live_xxx) |
| `STRIPE_PUBLISHABLE_KEY` | Din Stripe publishable key (pk_test_xxx eller pk_live_xxx) |
| `STRIPE_WEBHOOK_SECRET` | Webhook-hemlighet för produktion |
| `PORT` | Server-port (standard: 3000) |
| `BASE_URL` | Bas-URL för callbacks (standard: http://localhost:PORT) |

### Webhook (för produktion)

För att automatiskt hantera betalningsbekräftelser i produktion, konfigurera en webhook i Stripe Dashboard:

1. Gå till Stripe Dashboard → Developers → Webhooks
2. Lägg till endpoint: `https://din-domän.se/api/stripe/webhook`
3. Välj event: `checkout.session.completed`
4. Kopiera webhook-hemligheten till `STRIPE_WEBHOOK_SECRET`

## Admin-inloggning

- **Användarnamn:** admin
- **Lösenord:** tegrevinnan2024

⚠️ **Viktigt:** Byt lösenord direkt efter första inloggningen!

## Projektstruktur

```
tegrevinnan/
├── server.js           # Express-server med Stripe-integration
├── package.json
├── data/
│   ├── products.json   # Produktdatabas
│   ├── orders.json     # Slutförda beställningar
│   ├── pending_orders.json # Väntande betalningar
│   └── admin.json      # Adminanvändare
├── public/
│   ├── index.html      # Butikens frontend
│   ├── success.html    # Betalningsbekräftelse
│   ├── admin.html      # Admin-panel
│   ├── css/
│   │   ├── style.css   # Butikens styling
│   │   └── admin.css   # Admin styling
│   ├── js/
│   │   ├── app.js      # Butikens JavaScript
│   │   └── admin.js    # Admin JavaScript
│   └── images/         # Produktbilder
└── README.md
```

## API

### Stripe
- `GET /api/stripe/config` - Hämta Stripe-konfiguration
- `POST /api/stripe/create-checkout-session` - Skapa checkout-session
- `GET /api/stripe/session/:id` - Verifiera betalning
- `POST /api/stripe/webhook` - Webhook för betalningsbekräftelser

### Produkter
- `GET /api/products` - Hämta alla produkter
- `GET /api/products/:id` - Hämta enskild produkt
- `POST /api/products` - Skapa produkt (auth)
- `PUT /api/products/:id` - Uppdatera produkt (auth)
- `DELETE /api/products/:id` - Ta bort produkt (auth)

### Beställningar
- `GET /api/orders` - Hämta alla beställningar (auth)
- `GET /api/orders/:id` - Hämta enskild beställning
- `POST /api/orders` - Skapa manuell beställning
- `PUT /api/orders/:id` - Uppdatera beställning (auth)

### Autentisering
- `POST /api/login` - Logga in
- `POST /api/logout` - Logga ut
- `GET /api/verify` - Verifiera token (auth)
- `POST /api/change-password` - Byt lösenord (auth)

## Betalningsmetoder via Stripe

- 💳 Visa / Mastercard / Amex
- 🍎 Apple Pay
- 📱 Google Pay
- K Klarna (Betala nu, Betala senare)
- SEPA (banköverföring)

## Teknisk stack

- **Backend:** Node.js + Express
- **Betalning:** Stripe Checkout
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Databas:** JSON-filer
- **Autentisering:** bcryptjs + enkla tokens
- **Typsnitt:** Cormorant Garamond + Libre Baskerville

## Prissättning Stripe

| Typ | Avgift |
|-----|--------|
| Svenska kort | 1,4% + 1,80 kr |
| EU-kort | 1,4% + 1,80 kr |
| Internationella kort | 2,9% + 1,80 kr |
| Klarna | 2,49% + 1,80 kr |

Inga månadsavgifter eller startavgifter.

## Support

Kontakta oss på info@tegrevinnan.se
