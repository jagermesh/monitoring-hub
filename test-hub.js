const MonitoringHub = require(__dirname + '/index.js');

const config = {
  hub: {
    listenSensorsOnPort: 8082
  , listenWebOnPort:     8081
  }
};

const hub = new MonitoringHub(config.hub);

hub.start();
