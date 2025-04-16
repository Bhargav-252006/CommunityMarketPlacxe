const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const VendorItem = require('../models/VendorItem');
const Order = require('../models/Order');

// Get analytics dashboard
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Find all items for this vendor
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        const itemIds = vendorItems.map(item => item._id);

        // Find orders that contain any of these items
        const orders = await Order.find({
            'items.itemId': { $in: itemIds }
        }).sort({ createdAt: -1 });

        // Calculate total revenue for this vendor
        let totalRevenue = 0;
        let totalOrders = 0;
        let itemSoldCount = 0;

        // Sales by category
        const salesByCategory = {};

        // Sales by date (last 30 days)
        const salesByDate = {};
        const lastThirtyDays = new Date();
        lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);

        // Top selling items
        const itemSales = {};

        // Process orders to get analytics data
        orders.forEach(order => {
            // Check if this order has any of our vendor's items
            const vendorOrderItems = order.items.filter(item =>
                itemIds.includes(item.itemId.toString())
            );

            // If there are vendor items in the order
            if (vendorOrderItems.length > 0) {
                totalOrders++;

                // Calculate order date for sales by date
                const orderDate = new Date(order.createdAt).toISOString().split('T')[0];

                // Process each item in the order that belongs to this vendor
                vendorOrderItems.forEach(item => {
                    // Find the corresponding item in our vendorItems array
                    const vendorItem = vendorItems.find(vItem =>
                        vItem._id.toString() === item.itemId.toString()
                    );

                    if (vendorItem) {
                        // Item revenue
                        const itemRevenue = (item.price || vendorItem.costPerUnit) * item.quantity;
                        totalRevenue += itemRevenue;
                        itemSoldCount += item.quantity;

                        // Sales by category
                        const category = vendorItem.category;
                        if (!salesByCategory[category]) {
                            salesByCategory[category] = {
                                revenue: 0,
                                count: 0
                            };
                        }
                        salesByCategory[category].revenue += itemRevenue;
                        salesByCategory[category].count += item.quantity;

                        // Sales by date
                        if (!salesByDate[orderDate]) {
                            salesByDate[orderDate] = {
                                revenue: 0,
                                count: 0
                            };
                        }
                        salesByDate[orderDate].revenue += itemRevenue;
                        salesByDate[orderDate].count += item.quantity;

                        // Top selling items
                        const itemName = vendorItem.itemName;
                        if (!itemSales[itemName]) {
                            itemSales[itemName] = {
                                revenue: 0,
                                count: 0,
                                id: vendorItem._id
                            };
                        }
                        itemSales[itemName].revenue += itemRevenue;
                        itemSales[itemName].count += item.quantity;
                    }
                });
            }
        });

        // Convert salesByCategory to array and sort
        const categorySalesArray = Object.entries(salesByCategory).map(([category, data]) => ({
            category,
            revenue: data.revenue,
            count: data.count
        })).sort((a, b) => b.revenue - a.revenue);

        // Convert salesByDate to array and sort by date
        const salesByDateArray = Object.entries(salesByDate).map(([date, data]) => ({
            date,
            revenue: data.revenue,
            count: data.count
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get dates for the last 30 days
        const dateLabels = [];
        const dateData = [];
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            dateLabels.push(dateString);

            const salesForDate = salesByDateArray.find(sale => sale.date === dateString);
            dateData.push(salesForDate ? salesForDate.revenue : 0);
        }

        // Convert itemSales to array and sort by revenue
        const topSellingItems = Object.entries(itemSales).map(([itemName, data]) => ({
            itemName,
            revenue: data.revenue,
            count: data.count,
            id: data.id
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        res.render('vendorAnalytics', {
            totalRevenue,
            totalOrders,
            itemSoldCount,
            categorySalesArray,
            salesByDateArray,
            dateLabels: JSON.stringify(dateLabels),
            dateData: JSON.stringify(dateData),
            topSellingItems,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            title: 'Vendor Analytics',
            currentPage: 'analytics'
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).render('error', {
            message: 'Error fetching analytics',
            error: error.message
        });
    }
});

module.exports = router; 