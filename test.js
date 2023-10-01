const MonitoringHub = require(`${__dirname}/index.js`);

const config = {
  hub: {
    hubPort: 8082,
  },
};

const hub = new MonitoringHub(config.hub);

hub.start();