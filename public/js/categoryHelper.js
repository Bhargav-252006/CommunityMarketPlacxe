/**
 * Category Helper Functions
 * Utility functions for working with categories and their images
 */

// Map of categories to image paths
const categoryImageMap = {
    'Fruits & Vegetables': '/images/Vegetables & Fruits.jpg',
    'Dairy & Breakfast': '/images/Dairy & Breakfast.jpg',
    'Dairy & Paneer': '/images/Dairy & Breakfast.jpg',
    'Snacks & Munchies': '/images/Munchies.jpg',
    'Snacks & Namkeen': '/images/Munchies.jpg',
    'Beverages': '/images/Cold Drinks & Juices.jpg',
    'Cold Drinks & Juices': '/images/Cold Drinks & Juices.jpg',
    'Atta & Rice': '/images/Atta, Rice.jpg'
};

// Default image to use when no mapping is found
const DEFAULT_CATEGORY_IMAGE = '/images/default-profile.jpg';

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

// Make functions available globally
window.getCategoryImage = getCategoryImage; 