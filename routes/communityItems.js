const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const VendorItem = require('../models/VendorItem');
const { getDefaultImageForCategory } = require('../public/js/categoryImageHelper');

// Get all available items for community users
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Fetch all available items and populate vendor info
        const items = await VendorItem.find({ isAvailable: true })
            .populate('vendorId', 'businessName')
            .sort({ category: 1, itemName: 1 }); // Sort by category first, then item name

        // Standardize categories for consistency
        const standardizedItems = items.map(item => {
            // Create a new object with all properties from the original item
            const standardizedItem = item.toObject();

            // Standardize category names for better display
            if (item.category.includes("Fruit") || item.category.includes("Vegetable")) {
                standardizedItem.standardCategory = "Fruits & Vegetables";
            } else if (item.category.includes("Dairy") || item.category.includes("Milk") ||
                item.category.includes("Egg") || item.category.includes("Bread")) {
                standardizedItem.standardCategory = "Dairy, Bread & Eggs";
            } else if (item.category.includes("Drink") || item.category.includes("Juice") ||
                item.category.includes("Cold")) {
                standardizedItem.standardCategory = "Cold Drinks & Juices";
            } else if (item.category.includes("Snack") || item.category.includes("Munchie")) {
                standardizedItem.standardCategory = "Snacks & Munchies";
            } else if (item.category.includes("Breakfast") || item.category.includes("Instant")) {
                standardizedItem.standardCategory = "Breakfast & Instant Food";
            } else if (item.category.includes("Bakery") || item.category.includes("Biscuit")) {
                standardizedItem.standardCategory = "Bakery & Biscuits";
            } else if (item.category.includes("Tea") || item.category.includes("Coffee") ||
                item.category.includes("Health")) {
                standardizedItem.standardCategory = "Tea, Coffee & Health Drink";
            } else if (item.category.includes("Atta") || item.category.includes("Rice") ||
                item.category.includes("Dal")) {
                standardizedItem.standardCategory = "Atta, Rice & Dal";
            } else if (item.category.includes("Masala") || item.category.includes("Oil") ||
                item.category.includes("Spice")) {
                standardizedItem.standardCategory = "Masala, Oil & More";
            } else if (item.category.includes("Clean") || item.category.includes("Essential")) {
                standardizedItem.standardCategory = "Cleaning Essentials";
            } else {
                standardizedItem.standardCategory = item.category; // Keep original if no match
            }

            return standardizedItem;
        });

        // Group items by category for easier display
        const itemsByCategory = {};
        standardizedItems.forEach(item => {
            const category = item.standardCategory;
            if (!itemsByCategory[category]) {
                itemsByCategory[category] = [];
            }
            itemsByCategory[category].push(item);
        });

        // Get unique categories in preferred order
        const preferredCategoryOrder = [
            "Fruits & Vegetables",
            "Dairy, Bread & Eggs",
            "Cold Drinks & Juices",
            "Snacks & Munchies",
            "Breakfast & Instant Food",
            "Bakery & Biscuits",
            "Tea, Coffee & Health Drink",
            "Atta, Rice & Dal",
            "Masala, Oil & More",
            "Cleaning Essentials"
        ];

        // Sort categories according to preferred order
        const categories = Object.keys(itemsByCategory).sort((a, b) => {
            const indexA = preferredCategoryOrder.indexOf(a);
            const indexB = preferredCategoryOrder.indexOf(b);

            // If both categories are in the preferred order, sort by that order
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // If only one category is in the preferred order, it comes first
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // Otherwise, alphabetical order
            return a.localeCompare(b);
        });

        res.render('communityItems', {
            items: standardizedItems,
            itemsByCategory,
            categories,
            currentPage: 'items',
            getDefaultImageForCategory,
            messages: {
                success: req.flash('success') || [],
                error: req.flash('error') || []
            }
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).render('error', {
            message: 'Error fetching items',
            error: error.message
        });
    }
});

// Get items by category
router.get('/category/:categorySlug', ensureAuthenticated, async (req, res) => {
    try {
        const categorySlug = req.params.categorySlug;
        let categoryName = categorySlug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase()); // Convert slug to title case

        // Map from slug to actual category name if needed
        const categoryMap = {
            'fruits-vegetables': 'Fruits & Vegetables',
            'dairy-bread-eggs': 'Dairy, Bread & Eggs',
            'cold-drinks-juices': 'Cold Drinks & Juices',
            'snacks-munchies': 'Snacks & Munchies',
            'breakfast-instant-food': 'Breakfast & Instant Food',
            'bakery-biscuits': 'Bakery & Biscuits',
            'tea-coffee-health-drink': 'Tea, Coffee & Health Drink',
            'atta-rice-dal': 'Atta, Rice & Dal',
            'masala-oil-more': 'Masala, Oil & More',
            'cleaning-essentials': 'Cleaning Essentials'
        };

        if (categoryMap[categorySlug]) {
            categoryName = categoryMap[categorySlug];
        }

        // Find items that belong to this category or similar categories
        let query = { isAvailable: true };

        if (categoryName !== 'All Items') {
            // Create a regex pattern to match similar category names
            const categoryPattern = categoryName.replace(/&/g, '').replace(/,/g, '');
            const regex = new RegExp(categoryPattern.split(' ').join('|'), 'i');
            query.category = regex;
        }

        const items = await VendorItem.find(query)
            .populate('vendorId', 'businessName')
            .sort({ itemName: 1 });

        res.render('communityItems', {
            items,
            categoryName,
            currentPage: 'items',
            getDefaultImageForCategory,
            messages: {
                success: req.flash('success') || [],
                error: req.flash('error') || []
            }
        });
    } catch (error) {
        console.error('Error fetching category items:', error);
        res.status(500).render('error', {
            message: 'Error fetching category items',
            error: error.message
        });
    }
});

module.exports = router; 