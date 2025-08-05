const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:9000',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api'
      },
      onProxyReq: function(proxyReq) {
        // 打印代理请求信息
        console.log('Proxying to:', proxyReq.path);
        console.log('Headers:', proxyReq.getHeaders());
      }
    })
  );
}; 