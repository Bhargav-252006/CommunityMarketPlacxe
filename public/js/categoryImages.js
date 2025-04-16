/**
 * Category Image Mappings
 * Maps category names to their corresponding image files
 */

const categoryImageMap = {
    'Fruits & Vegetables': '/images/Vegetables & Fruits.jpg',
    'Dairy & Breakfast': '/images/Dairy & Breakfast.jpg',
    'Snacks & Munchies': '/images/Munchies.jpg',
    'Beverages': '/images/Cold Drinks & Juices.jpg',
    'Atta & Rice': '/images/Atta, Rice.jpg'
};

// Function to get image URL for a category
function getCategoryImageUrl(categoryName) {
    // Return the mapped image URL or a default image if not found
    return categoryImageMap[categoryName] || '/images/default-profile.jpg';
} 