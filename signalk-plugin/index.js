module.exports = function (app) {
  const plugin = {
    id: 'signalk-pna-header',
    name: 'Private Network Access Header',
    description: 'Adds Access-Control-Allow-Private-Network: true so Chrome mobile can fetch from local IPs',

    start: function () {
      // Set header before any middleware or route sends the response.
      // We push to app.use() then move the layer to the front of Express's
      // router stack so it runs before Signal K's own CORS middleware.
      const setHeader = function (req, res, next) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        next();
      };

      app.use(setHeader);

      // Move our layer to index 0 so it precedes all previously registered middleware
      if (app._router && app._router.stack && app._router.stack.length > 0) {
        const layer = app._router.stack.pop();
        app._router.stack.unshift(layer);
      }
    },

    stop: function () {},
    schema: {},
  };

  return plugin;
};
