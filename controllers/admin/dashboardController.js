const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

 const loadSaleReport = async (req, res) => {
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
        const orders = allOrders.flatMap(order => order.orderedItems);

         const totalProducts = orders.reduce((acc, val) => acc + val.orderQuantity, 0);
        const totalSaleAmount = allOrders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);
        const totalOrderCount = allOrders.length;
        const totalDiscount = allOrders.reduce((acc, val) => acc + (val.discount || 0), 0);
        const totalCoupons = allOrders.reduce((acc, val) => acc + (val.couponApplied ? val.discount : 0), 0);
        const cancelledOrders = allOrders.filter(order => order.status === 'Cancelled').length;

        const returnedOrders = allOrders.filter(order => 
        order.orderedItems.some(item => item.returnStatus === 'Returned')
        ).length;
        const totalOfferApplied = allOrders.reduce((acc,val) =>acc+val.offerDiscount,0)
        const totalCouponsApplied = allOrders.reduce((acc,val)=>acc+val.couponDiscount,0)
        console.log(returnedOrders);

        res.render('saleReport', {
            totalSaleAmount,
            totalOrderCount,
            totalProducts,
            totalDiscount,
            totalCoupons,
            cancelledOrders,
            returnedOrders,
            allOrders,
            dateRange,
            startDate,
            endDate,
            moment,
            totalOfferApplied,
            totalCouponsApplied
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

        // Same date filtering logic
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
        
        const doc = new PDFDocument();
        let filename = `sales-report-${moment().format('YYYYMMDD')}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

         doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();
        
         const totalSaleAmount = allOrders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);
        const totalOrderCount = allOrders.length;
        const totalDiscount = allOrders.reduce((acc, val) => acc + (val.discount || 0), 0);
        
        doc.fontSize(12)
            .text(`Total Sales: ₹${totalSaleAmount}`)
            .text(`Total Orders: ${totalOrderCount}`)
            .text(`Total Discounts: ₹${totalDiscount}`)
            .moveDown();

        // Orders Table
        allOrders.forEach((order, index) => {
            doc.text(`Order ${index + 1}:`)
                .text(`Order ID: ${order.orderId}`)
                .text(`User: ${order.userId.name}`)
                .text(`Date: ${moment(order.createdAt).format('DD-MM-YYYY')}`)
                .text(`Amount: ₹${order.finalAmount}`)
                .text(`Discount: ₹${order.discount}`)
                .moveDown();
        });

        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating PDF');
    }
};

// Download Excel Report
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

        // Data
        allOrders.forEach(order => {
            worksheet.addRow({
                orderId: order.orderId,
                user: order.userId.name,
                date: moment(order.createdAt).format('DD-MM-YYYY'),
                status: order.status,
                amount: order.finalAmount,
                discount: order.discount,
                coupon: order.couponApplied ? 'Yes' : 'No'
            });
        });

        // Summary
        const totalSaleAmount = allOrders.reduce((acc, val) => acc + (val.finalAmount || 0), 0);
        worksheet.addRow({});
        worksheet.addRow({ orderId: 'Total Sales:', amount: totalSaleAmount });
        worksheet.addRow({ orderId: 'Total Orders:', amount: allOrders.length });
        worksheet.addRow({ orderId: 'Total Discounts:', amount: allOrders.reduce((acc, val) => acc + (val.discount || 0), 0) });

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

module.exports = {
    loadSaleReport,
    downloadPDFReport,
    downloadExcelReport
};