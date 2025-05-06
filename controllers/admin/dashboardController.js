const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');

const loadSaleReport = async (req, res) => {
    try {
        const { dateRange, startDate, endDate, page = 1 } = req.query;
        const limit = 6; // Number of orders per page
        const skip = (page - 1) * limit;

        let query = {};
        const now = moment();
        if (dateRange === 'daily') {
            query.createdAt = {
                $gte: now.startOf('day').toDate(),
                $lte: now.endOf('day').toDate()
            };
        } else if (dateRange === 'weekly') {
            query.createdAt = {
                $gte: now.startOf('week').toDate(),
                $lte: now.endOf('week').toDate()
            };
        } else if (dateRange === 'monthly') {
            query.createdAt = {
                $gte: now.startOf('month').toDate(),
                $lte: now.endOf('month').toDate()
            };
        } else if (dateRange === 'yearly') {
            query.createdAt = {
                $gte: now.startOf('year').toDate(),
                $lte: now.endOf('year').toDate()
            };
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: moment(startDate).startOf('day').toDate(),
                $lte: moment(endDate).endOf('day').toDate()
            };
        }

        // Fetch all orders for summary metrics (no pagination)
        const allOrdersForSummary = await Order.find(query)
            .populate('orderedItems.product userId');

        // Fetch paginated orders for table display
        const paginatedOrders = await Order.find(query)
            .populate('orderedItems.product userId')
            .skip(skip)
            .limit(limit);

        // Calculate total count of orders for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate metrics using all orders
        const totalSaleAmount = allOrdersForSummary.reduce((acc, val) => acc + (val.totalPrice || 0), 0); // Sum of totalPrice
        const netSale = allOrdersForSummary.reduce((acc, val) => acc + (val.finalAmount || 0), 0); // Sum of finalAmount
        const amountOfCancelledandReturned = allOrdersForSummary.reduce((acc, val) => acc + ((val.cancelledAmount || 0) + (val.returnAmount || 0)), 0); // Sum of cancelledAmount + returnAmount
        const totalOrderCount = allOrdersForSummary.length;
        const totalProducts = allOrdersForSummary.reduce((acc, order) => acc + order.orderedItems.reduce((sum, item) => sum + (item.orderQuantity || 0), 0), 0);
        const totalOfferApplied = allOrdersForSummary.reduce((acc, val) => acc + (val.offerDiscount || 0), 0);
        const totalCouponsApplied = allOrdersForSummary.reduce((acc, val) => acc + (val.couponDiscount || 0), 0);
        const cancelledOrders = allOrdersForSummary.filter(order => order.status === 'Cancelled').length;
        const returnedOrders = allOrdersForSummary.filter(order => 
            order.orderedItems.some(item => item.returnStatus === 'Returned')
        ).length;

        res.render('saleReport', {
            totalSaleAmount,
            netSale,
            amountOfCancelledandReturned,
            totalOrderCount,
            totalProducts,
            totalOfferApplied,
            totalCouponsApplied,
            cancelledOrders,
            returnedOrders,
            allOrders: paginatedOrders, // Use paginated orders for table
            dateRange,
            startDate,
            endDate,
            moment,
            currentPage: parseInt(page),
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

const downloadPDFReport = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.query;
        let query = {};

        const now = moment();
        if (dateRange === 'daily') {
            query.createdAt = {
                $gte: now.startOf('day').toDate(),
                $lte: now.endOf('day').toDate()
            };
        } else if (dateRange === 'weekly') {
            query.createdAt = {
                $gte: now.startOf('week').toDate(),
                $lte: now.endOf('week').toDate()
            };
        } else if (dateRange === 'monthly') {
            query.createdAt = {
                $gte: now.startOf('month').toDate(),
                $lte: now.endOf('month').toDate()
            };
        } else if (dateRange === 'yearly') {
            query.createdAt = {
                $gte: now.startOf('year').toDate(),
                $lte: now.endOf('year').toDate()
            };
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: moment(startDate).startOf('day').toDate(),
                $lte: moment(endDate).endOf('day').toDate()
            };
        }

        const allOrders = await Order.find(query).populate('orderedItems.product userId');

        const doc = new PDFDocument({ font: 'Helvetica', margin: 50 });
        let filename = `sales-report-${moment().format('YYYYMMDD')}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
        doc.moveDown(1.5);

        // Summary Section
        const totalSaleAmount = allOrders.reduce((acc, val) => acc + (val.totalPrice || 0), 0);
        const netSale = allOrders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);
        const amountOfCancelledandReturned = allOrders.reduce((acc, val) => acc + ((val.cancelledAmount || 0) + (val.returnAmount || 0)), 0);
        const totalOrderCount = allOrders.length;

        doc.fontSize(12).font('Helvetica')
           .text(`Total Sales: ₹${totalSaleAmount.toFixed(2)}`, { align: 'left' })
           .text(`Net Sale: ₹${netSale.toFixed(2)}`, { align: 'left' })
           .text(`Cancelled/Returned Amount: ₹${amountOfCancelledandReturned.toFixed(2)}`, { align: 'left' })
           .text(`Total Orders: ${totalOrderCount}`, { align: 'left' })
           .moveDown(2);

        // Table Setup
        const tableTop = doc.y;
        const colWidths = [80, 120, 80, 70, 70, 70, 70];
        const colPositions = [50, 130, 250, 330, 400, 470, 540];
        const rowHeight = 25;
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);

        // Draw Table Header
        doc.fontSize(10).font('Helvetica-Bold');
        const headers = ['Order ID', 'User', 'Date', 'Amount', 'Discount', 'Cancelled', 'Returned'];
        headers.forEach((header, i) => {
            doc.text(header, colPositions[i], tableTop, {
                width: colWidths[i],
                align: 'center'
            });
        });

        // Draw Header Bottom Line
        doc.moveTo(50, tableTop + 15)
           .lineTo(50 + tableWidth, tableTop + 15)
           .lineWidth(1)
           .stroke();

        // Draw Vertical Lines for Header
        colPositions.forEach((pos, i) => {
            doc.moveTo(pos, tableTop)
               .lineTo(pos, tableTop + 20)
               .stroke();
        });
        doc.moveTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], tableTop)
           .lineTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], tableTop + 20)
           .stroke();

        // Table Rows
        doc.font('Helvetica');
        let currentY = tableTop + rowHeight;
        allOrders.forEach((order, index) => {
            if (currentY + rowHeight > doc.page.height - 50) {
                doc.addPage();
                currentY = 50;

                doc.fontSize(10).font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.text(header, colPositions[i], currentY, {
                        width: colWidths[i],
                        align: 'center'
                    });
                });

                doc.moveTo(50, currentY + 15)
                   .lineTo(50 + tableWidth, currentY + 15)
                   .lineWidth(1)
                   .stroke();

                colPositions.forEach((pos, i) => {
                    doc.moveTo(pos, currentY)
                       .lineTo(pos, currentY + 20)
                       .stroke();
                });
                doc.moveTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], currentY)
                   .lineTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], currentY + 20)
                   .stroke();

                currentY += rowHeight;
                doc.font('Helvetica');
            }

            const rowData = [
                order.orderId || '',
                (order.userId?.name || 'Unknown').substring(0, 15),
                moment(order.createdAt).format('DD-MM-YYYY'),
                `₹${Number(order.finalAmount || 0).toFixed(2)}`,
                `₹${Number(order.discount || 0).toFixed(2)}`,
                `₹${Number(order.cancelledAmount || 0).toFixed(2)}`,
                `₹${Number(order.returnAmount || 0).toFixed(2)}`
            ];

            rowData.forEach((data, i) => {
                doc.text(data.toString(), colPositions[i] + 5, currentY + 5, {
                    width: colWidths[i] - 10,
                    align: i < 3 ? 'left' : 'right'
                });
            });

            doc.moveTo(50, currentY + rowHeight)
               .lineTo(50 + tableWidth, currentY + rowHeight)
               .lineWidth(0.5)
               .stroke();

            colPositions.forEach((pos, i) => {
                doc.moveTo(pos, currentY)
                   .lineTo(pos, currentY + rowHeight)
                   .lineWidth(0.5)
                   .stroke();
            });
            doc.moveTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], currentY)
               .lineTo(colPositions[colPositions.length - 1] + colWidths[colWidths.length - 1], currentY + rowHeight)
               .lineWidth(0.5)
               .stroke();

            currentY += rowHeight;
        });

        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating PDF');
    }
};

const downloadExcelReport = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.query;
        let query = {};

        const now = moment();
        if (dateRange === 'daily') {
            query.createdAt = {
                $gte: now.startOf('day').toDate(),
                $lte: now.endOf('day').toDate()
            };
        } else if (dateRange === 'weekly') {
            query.createdAt = {
                $gte: now.startOf('week').toDate(),
                $lte: now.endOf('week').toDate()
            };
        } else if (dateRange === 'monthly') {
            query.createdAt = {
                $gte: now.startOf('month').toDate(),
                $lte: now.endOf('month').toDate()
            };
        } else if (dateRange === 'yearly') {
            query.createdAt = {
                $gte: now.startOf('year').toDate(),
                $lte: now.endOf('year').toDate()
            };
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: moment(startDate).startOf('day').toDate(),
                $lte: moment(endDate).endOf('day').toDate()
            };
        }

        const allOrders = await Order.find(query).populate('orderedItems.product userId');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 30 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Coupon Applied', key: 'coupon', width: 15 }
        ];

        allOrders.forEach(order => {
            worksheet.addRow({
                orderId: order.orderId,
                user: order.userId?.name || 'Unknown',
                date: moment(order.createdAt).format('DD-MM-YYYY'),
                status: order.status,
                amount: order.finalAmount,
                discount: order.discount,
                coupon: order.couponApplied ? 'Yes' : 'No'
            });
        });

        const totalSaleAmount = allOrders.reduce((acc, val) => acc + (val.totalPrice || 0), 0);
        const netSale = allOrders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);
        const amountOfCancelledandReturned = allOrders.reduce((acc, val) => acc + ((val.cancelledAmount || 0) + (val.returnAmount || 0)), 0);

        worksheet.addRow({});
        worksheet.addRow({ orderId: 'Total Sales:', amount: totalSaleAmount });
        worksheet.addRow({ orderId: 'Net Sale:', amount: netSale });
        worksheet.addRow({ orderId: 'Cancelled/Returned:', amount: amountOfCancelledandReturned });
        worksheet.addRow({ orderId: 'Total Orders:', amount: allOrders.length });

        let filename = `sales-report-${moment().format('YYYYMMDD')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating Excel');
    }
};

const loadUserWallet = async (req, res) => {
    try {
        const { userId } = req.query;
        const user = await User.findById(userId);
        const userWallet = await Wallet.findOne({ userId: userId });
        res.render('userWallet', {
            user,
            userWallet
        });
    } catch (error) {
        console.log('error in loadUserWallet', error);
        res.redirect('/admin/pageerror');
    }
};

const getOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
        res.json({ success: true, order: order });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching order');
    }
};

const loadDashboard = async (req, res) => {
    try {
        const { dateRange = 'weekly', startDate, endDate } = req.query;

        // Initialize response data
        const dashboardData = {
            stats: {
                netSale: 0,
            },
            charts: {
                netSales: { labels: [], data: [] },
                bestProducts: {
                    labels: [],
                    data: [],
                    backgroundColor: 'rgba(130, 87, 237, 0.6)',
                    borderColor: 'rgba(130, 87, 237, 1)',
                },
                bestCategories: {
                    labels: [],
                    data: [],
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FFCD56', '#4BC0C0', '#36A2EB', '#FF6384'],
                },
                bestBrands: {
                    labels: [],
                    data: [],
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FFCD56', '#4BC0C0', '#36A2EB', '#FF6384'],
                },
            },
        };

        // Build date query
        let query = {};
        const now = moment();
        if (dateRange === 'daily') {
            query.createdAt = {
                $gte: now.startOf('day').toDate(),
                $lte: now.endOf('day').toDate(),
            };
        } else if (dateRange === 'weekly') {
            query.createdAt = {
                $gte: now.startOf('week').toDate(),
                $lte: now.endOf('week').toDate(),
            };
        } else if (dateRange === 'monthly') {
            query.createdAt = {
                $gte: now.startOf('month').toDate(),
                $lte: now.endOf('month').toDate(),
            };
        } else if (dateRange === 'yearly') {
            query.createdAt = {
                $gte: now.startOf('year').toDate(),
                $lte: now.endOf('year').toDate(),
            };
        } else if (dateRange === 'custom' && startDate && endDate) {
            query.createdAt = {
                $gte: moment(startDate).startOf('day').toDate(),
                $lte: moment(endDate).endOf('day').toDate(),
            };
        }

        // Fetch orders with populated product, category, and brand
        const orders = await Order.find(query).populate({
            path: 'orderedItems.product',
            populate: [
                { path: 'category', model: 'Category' },
                { path: 'brand', model: 'Brand' },
            ],
        });

        // Calculate Stats
        dashboardData.stats.netSale = orders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);

        // Net Sales Chart
        if (dateRange === 'yearly') {
            const salesByYear = {};
            orders.forEach(order => {
                const year = moment(order.createdAt).year();
                const netSale = order.finalAmount || 0;
                salesByYear[year] = (salesByYear[year] || 0) + netSale;
            });
            dashboardData.charts.netSales.labels = Object.keys(salesByYear).sort();
            dashboardData.charts.netSales.data = dashboardData.charts.netSales.labels.map(year => salesByYear[year] || 0);
        } else if (dateRange === 'monthly') {
            const salesByMonth = {};
            orders.forEach(order => {
                const key = moment(order.createdAt).format('MMM YYYY');
                const netSale = order.finalAmount || 0;
                salesByMonth[key] = (salesByMonth[key] || 0) + netSale;
            });
            dashboardData.charts.netSales.labels = Array(12)
                .fill()
                .map((_, i) => moment().subtract(i, 'months').format('MMM YYYY'))
                .reverse();
            dashboardData.charts.netSales.data = dashboardData.charts.netSales.labels.map(label => salesByMonth[label] || 0);
        } else if (dateRange === 'weekly') {
            const salesByWeek = {};
            orders.forEach(order => {
                const week = moment(order.createdAt).week();
                const year = moment(order.createdAt).year();
                const key = `Week ${week} ${year}`;
                const netSale = order.finalAmount || 0;
                salesByWeek[key] = (salesByWeek[key] || 0) + netSale;
            });
            dashboardData.charts.netSales.labels = Array(8)
                .fill()
                .map((_, i) => {
                    const week = moment().subtract(i, 'weeks');
                    return `Week ${week.week()} ${week.year()}`;
                })
                .reverse();
            dashboardData.charts.netSales.data = dashboardData.charts.netSales.labels.map(label => salesByWeek[label] || 0);
        } else if (dateRange === 'daily') {
            const salesByDay = {};
            orders.forEach(order => {
                const key = moment(order.createdAt).format('DD MMM YYYY');
                const netSale = order.finalAmount || 0;
                salesByDay[key] = (salesByDay[key] || 0) + netSale;
            });
            dashboardData.charts.netSales.labels = Array(8)
                .fill()
                .map((_, i) => moment().subtract(i, 'days').format('DD MMM YYYY'))
                .reverse();
            dashboardData.charts.netSales.data = dashboardData.charts.netSales.labels.map(label => salesByDay[label] || 0);
        } else if (dateRange === 'custom' && startDate && endDate) {
            const daysDiff = moment(endDate).diff(moment(startDate), 'days') + 1;
            const salesByDay = {};
            orders.forEach(order => {
                const key = moment(order.createdAt).format('DD MMM YYYY');
                const netSale = order.finalAmount || 0;
                salesByDay[key] = (salesByDay[key] || 0) + netSale;
            });
            dashboardData.charts.netSales.labels = Array(daysDiff)
                .fill()
                .map((_, i) => moment(startDate).add(i, 'days').format('DD MMM YYYY'));
            dashboardData.charts.netSales.data = dashboardData.charts.netSales.labels.map(label => salesByDay[label] || 0);
        }

        // Best Selling Products
        const productSales = {};
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.product && item.product.productName) {
                    const productId = item.product._id.toString();
                    productSales[productId] = {
                        name: item.product.productName,
                        unitsSold: (productSales[productId]?.unitsSold || 0) + (item.orderQuantity || 0),
                    };
                }
            });
        });
        const bestProducts = Object.values(productSales)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10);
        dashboardData.charts.bestProducts.labels = bestProducts.map(p => p.name);
        dashboardData.charts.bestProducts.data = bestProducts.map(p => p.unitsSold);

        // Best Selling Categories
        const categorySales = {};
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.product && item.product.category && item.product.category.name && !item.product.category.isDeleted) {
                    const categoryId = item.product.category._id.toString();
                    categorySales[categoryId] = {
                        name: item.product.category.name,
                        unitsSold: (categorySales[categoryId]?.unitsSold || 0) + (item.orderQuantity || 0),
                    };
                }
            });
        });
        const bestCategories = Object.values(categorySales)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10);
        dashboardData.charts.bestCategories.labels = bestCategories.map(c => c.name);
        dashboardData.charts.bestCategories.data = bestCategories.map(c => c.unitsSold);

        // Best Selling Brands
        const brandSales = {};
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.product && item.product.brand && item.product.brand.brandName && !item.product.brand.isDeleted) {
                    const brandId = item.product.brand._id.toString();
                    brandSales[brandId] = {
                        name: item.product.brand.brandName,
                        unitsSold: (brandSales[brandId]?.unitsSold || 0) + (item.orderQuantity || 0),
                    };
                }
            });
        });
        const bestBrands = Object.values(brandSales)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10);
        dashboardData.charts.bestBrands.labels = bestBrands.map(b => b.name);
        dashboardData.charts.bestBrands.data = bestBrands.map(b => b.unitsSold);

        res.render('dashboard', { dashboardData, dateRange, startDate, endDate });

    } catch (error) {
        console.error('Error in loadDashboard:', error);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    loadSaleReport,
    downloadPDFReport,
    downloadExcelReport,
    loadUserWallet,
    getOrder,
    loadDashboard,
};