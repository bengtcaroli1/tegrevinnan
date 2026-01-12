// Script to initialize database with sample products
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./db');

const sampleProducts = [
    {
        id: uuidv4(),
        name: "Earl Grey Imperial",
        category: "te",
        price: 149,
        description: "Ett utsökt svart te aromatiserat med bergamott från Kalabrien. Klassiskt brittiskt te i sin mest raffinerade form.",
        image: "/images/earl-grey.jpg",
        weight: "100g",
        origin: "Sri Lanka",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "English Breakfast",
        category: "te",
        price: 129,
        description: "En kraftfull blandning av Assam, Ceylon och kenyanskt te. Perfekt till frukosten med mjölk.",
        image: "/images/english-breakfast.jpg",
        weight: "100g",
        origin: "Blandning",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "Darjeeling First Flush",
        category: "te",
        price: 219,
        description: "Champagnen bland te. Ljust, blommigt och med en subtil muskatellton. Skördat på våren i Himalaya.",
        image: "/images/darjeeling.jpg",
        weight: "50g",
        origin: "Indien",
        inStock: true,
        featured: false
    },
    {
        id: uuidv4(),
        name: "Lady Grey",
        category: "te",
        price: 159,
        description: "En mildare variant av Earl Grey med tillskott av citrus och blåklint. Elegant och aromatiskt.",
        image: "/images/lady-grey.jpg",
        weight: "100g",
        origin: "Kina",
        inStock: true,
        featured: false
    },
    {
        id: uuidv4(),
        name: "Lapsang Souchong",
        category: "te",
        price: 179,
        description: "Rökt svart te från Fujian-provinsen. Intensiv, rökig smak som påminner om lägereld och whisky.",
        image: "/images/lapsang.jpg",
        weight: "100g",
        origin: "Kina",
        inStock: true,
        featured: false
    },
    {
        id: uuidv4(),
        name: "Ethiopian Yirgacheffe",
        category: "kaffe",
        price: 189,
        description: "Enastående kaffe med toner av blåbär, jasmin och citrus. Lätt rostat för att bevara de komplexa aromerna.",
        image: "/images/ethiopia.jpg",
        weight: "250g",
        origin: "Etiopien",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "Colombian Supremo",
        category: "kaffe",
        price: 169,
        description: "Välbalanserat kaffe med nötiga toner och en touch av karamell. Medelrostat och mycket mångsidigt.",
        image: "/images/colombian.jpg",
        weight: "250g",
        origin: "Colombia",
        inStock: true,
        featured: false
    },
    {
        id: uuidv4(),
        name: "Jamaican Blue Mountain",
        category: "kaffe",
        price: 449,
        description: "Ett av världens mest exklusiva kaffen. Mjukt, komplext och helt utan bitterhet. En sann lyxupplevelse.",
        image: "/images/jamaica.jpg",
        weight: "200g",
        origin: "Jamaica",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "Single Origin Ecuador 70%",
        category: "choklad",
        price: 89,
        description: "Mörk choklad med intensiva toner av röda bär och en lätt floralitet. Handgjord av finaste kakaobönor.",
        image: "/images/ecuador-choc.jpg",
        weight: "100g",
        origin: "Ecuador",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "Belgisk Mjölkchoklad",
        category: "choklad",
        price: 79,
        description: "Krämig och klassisk belgisk mjölkchoklad. Perfekt balans mellan kakao och mjölk.",
        image: "/images/belgian-milk.jpg",
        weight: "100g",
        origin: "Belgien",
        inStock: true,
        featured: false
    },
    {
        id: uuidv4(),
        name: "Chokladpraliner Assorterade",
        category: "choklad",
        price: 249,
        description: "En elegant ask med 16 handgjorda praliner. Smaker inkluderar champagne, hallon, havssalt och karamell.",
        image: "/images/pralines.jpg",
        weight: "200g",
        origin: "Sverige",
        inStock: true,
        featured: true
    },
    {
        id: uuidv4(),
        name: "Varm Choklad Deluxe",
        category: "choklad",
        price: 119,
        description: "Lyxig drickchoklad med 60% kakao. Tillsätt bara het mjölk för en himmelsk upplevelse.",
        image: "/images/hot-choc.jpg",
        weight: "300g",
        origin: "Frankrike",
        inStock: true,
        featured: false
    }
];

async function init() {
    try {
        console.log('🔄 Initializing database...');
        await db.initDatabase();
        
        // Check if products exist
        const existingProducts = await db.getAllProducts();
        if (existingProducts.length === 0) {
            console.log('📦 Adding sample products...');
            for (const product of sampleProducts) {
                await db.createProduct(product);
                console.log(`  ✓ ${product.name}`);
            }
            console.log(`✅ Added ${sampleProducts.length} products`);
        } else {
            console.log(`ℹ️  ${existingProducts.length} products already exist`);
        }
        
        // Check if admin exists
        const adminCount = await db.getAdminCount();
        if (adminCount === 0) {
            console.log('👤 Creating admin user...');
            const hashedPassword = bcrypt.hashSync('tegrevinnan2024', 10);
            await db.createAdmin({
                id: uuidv4(),
                username: 'admin',
                password: hashedPassword
            });
            console.log('✅ Admin created (username: admin, password: tegrevinnan2024)');
        } else {
            console.log('ℹ️  Admin user already exists');
        }
        
        console.log('\n🎉 Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

init();

