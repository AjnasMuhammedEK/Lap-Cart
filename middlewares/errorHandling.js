module.exports = (err, req, res, next) => {
    console.error('🚨 Error:', err.stack || err.message);

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(500).json({ error: 'Something went wrong!' });
    }

    res.status(500).render('page-404', {
        message: 'Something went wrong. Please try again later.'
    });
};
