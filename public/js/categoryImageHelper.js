/**
 * Category Image Helper
 * Maps category names to local image paths in uploads/categories folder
 */

const categoryImageMap = {
    'Fruits & Vegetables': '/uploads/categories/fruits-vegetables.jpg',
    'Vegetables & Fruits': '/uploads/categories/Vegetables & Fruits.jpg',
    'Dairy & Breakfast': '/uploads/categories/Dairy & Breakfast.jpg',
    'Dairy, Bread & Eggs': '/uploads/categories/dairy-bread-eggs.jpg',
    'Snacks & Munchies': '/uploads/categories/Munchies.jpg',
    'Snacks & Namkeen': '/uploads/categories/snacks.jpg',
    'Cold Drinks & Juices': '/uploads/categories/Cold Drinks & Juices.jpg',
    'Beverages': '/uploads/categories/cold-drinks.jpg',
    'Breakfast & Instant Food': '/uploads/categories/breakfast.jpg',
    'Atta, Rice & Dal': '/uploads/categories/atta-rice-dal.jpg',
    'Atta & Rice': '/uploads/categories/Atta, Rice.jpg',
    'Bakery & Biscuits': '/uploads/categories/bakery.jpg',
    'Tea, Coffee & Health Drink': '/uploads/categories/tea-coffee.jpg',
    'Masala, Oil & More': '/uploads/categories/masala-oil.jpg',
    'Cleaning Essentials': '/uploads/categories/cleaning-essentials.jpg'
};

// Default image to use when no mapping is found
const DEFAULT_CATEGORY_IMAGE = '/uploads/categories/placeholder.jpg';

/**
 * Get the image URL for a category
 * @param {string} categoryName - The name of the category
 * @returns {string} The URL of the image for the category
 */
function getCategoryImage(categoryName) {
    if (!categoryName) return DEFAULT_CATEGORY_IMAGE;

    // Try exact match
    if (categoryImageMap[categoryName]) {
        return categoryImageMap[categoryName];
    }

    // Try to find a partial match
    for (const [category, imagePath] of Object.entries(categoryImageMap)) {
        if (categoryName.includes(category) || category.includes(categoryName)) {
            return imagePath;
        }
    }

    // Return default if no match
    return DEFAULT_CATEGORY_IMAGE;
}

/**
 * Helper functions to manage category images
 */

// Map categories to their default images
const categoryImages = {
    'Fruits & Vegetables': '/img/categories/fruits-vegetables.jpg',
    'Dairy & Eggs': '/img/categories/dairy-eggs.jpg',
    'Meat & Seafood': '/img/categories/meat-seafood.jpg',
    'Bakery': '/img/categories/bakery.jpg',
    'Pantry Items': '/img/categories/pantry.jpg',
    'Snacks': '/img/categories/snacks.jpg',
    'Beverages': '/img/categories/beverages.jpg',
    'Household': '/img/categories/household.jpg',
    'Personal Care': '/img/categories/personal-care.jpg',
    'Baby Products': '/img/categories/baby.jpg',
    'Pet Supplies': '/img/categories/pet.jpg',
    'Health & Wellness': '/img/categories/health.jpg',
    'Electronics': '/img/categories/electronics.jpg',
    'Clothing': '/img/categories/clothing.jpg',
    'Home & Garden': '/img/categories/home-garden.jpg',
    'Toys & Games': '/img/categories/toys.jpg',
    'Sports & Outdoors': '/img/categories/sports.jpg',
    'Handmade & Crafts': '/img/categories/handmade.jpg',
    'Others': '/img/categories/other.jpg'
};

/**
 * Get the default image URL for a category
 * 
 * @param {string} category - The category name
 * @returns {string} - URL to the default image for the category
 */
function getDefaultImageForCategory(category) {
    return categoryImages[category] || '/img/categories/placeholder.jpg';
}

// Export the function for server-side usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDefaultImageForCategory,
        categoryImages
    };
} 