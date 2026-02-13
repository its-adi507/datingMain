const { app, httpServer } = require('../server');

module.exports = (req, res) => {
    // Translate Vercel serverless request to Express request
    app(req, res);
};
