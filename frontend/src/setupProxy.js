// frontend/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        "/api",
        createProxyMiddleware({
            target: 'http://localhost:5000', // your backend dev port
            changeOrigin: true,
            logLevel: 'debug',
        })
    );
};
