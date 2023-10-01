const colors = require('colors');
const socketServer = require('socket.io');

class MonitoringHub {
  constructor(config) {
    this.hubConfig = Object.assign({
      hubPort: 8082,
    }, config);
  }

  log(message, attributes, isError) {
    const logTag = 'HUB';

    let text = colors.yellow(`[${logTag}]`);
    if (isError) {
      text += ` ${colors.yellow('[ERROR]')}`;
    }
    text += ` ${message}`;
    if (attributes) {
      text += ` ${colors.green(JSON.stringify(attributes))}`;
    }

    console.log(text);
  }

  start() {
    const observers = [];
    const metrics = [];

    // hub server

    this.log('Starting hub');

    const hubServer = socketServer.listen(this.hubConfig.hubPort, {
      log: false,
    });

    hubServer.on('connection', (socket) => {
      let connectionInfo = {
        id: socket.id,
        address: socket.handshake.address.replace('::1', '127.0.0.1').replace('::ffff:', ''),
      };

      let connection = {
        metrics: [],
        observers: [],
      };

      this.log('New connection', connectionInfo);

      socket.on('registerMetric', (metricDescriptor) => {
        if (!metrics[metricDescriptor.metricInfo.metricUid]) {
          metricDescriptor.sensorInfo.sensorId = connectionInfo.id;
          metricDescriptor.sensorInfo.sensorLocation = connectionInfo.address;
          let metric = {
            socket: socket,
            metricDescriptor: metricDescriptor,
          };
          this.log('New connection is metric', {
            metricUid: metric.metricDescriptor.metricInfo.metricUid,
          });
          metrics[metric.metricDescriptor.metricInfo.metricUid] = metric;
          connection.metrics.push(metric);
          socket.emit('metricRegistered', metric.metricDescriptor);
          this.log('Metric registered', metric.metricDescriptor);
          this.log('Sending metric info to observers', metric.metricDescriptor);
          for (let observerId in observers) {
            let observer = observers[observerId];
            this.log('Sending metric info to observer', {
              observerId: observer.observerInfo.observerId,
              metricUid: metric.metricDescriptor.metricInfo.metricUid,
            });
            observer.socket.emit('registerMetric', metric.metricDescriptor);
          }
        }
      });

      socket.on('registerObserver', () => {
        let observerInfo = {};
        if (!observers[connectionInfo.id]) {
          observerInfo.observerId = connectionInfo.id;
          observerInfo.observerLocation = connectionInfo.address;
          let observer = {
            socket: socket,
            observerInfo: observerInfo,
          };
          this.log('New connection is observer', {
            observerId: observer.observerInfo.observerId,
          });
          observers[connectionInfo.id] = observer;
          socket.emit('observerRegistered', {
            observerInfo: observerInfo,
          });
          this.log('Observer registered', observer.observerInfo);
          for (let metricUid in metrics) {
            let metric = metrics[metricUid];
            this.log('Sending metric info to observer', {
              observerId: observer.observerInfo.observerId,
              metricUid: metric.metricDescriptor.metricInfo.metricUid,
            });
            socket.emit('registerMetric', metric.metricDescriptor);
          }
          for (let metricUid in metrics) {
            let metric = metrics[metricUid];
            if (metric.metricData) {
              this.log('Sending metric data to observer', {
                observerId: observer.observerInfo.observerId,
                metricUid: metric.metricDescriptor.metricInfo.metricUid,
              });
              socket.emit('metricData', metric.metricData);
            }
          }
        }
      });

      socket.on('metricData', (data) => {
        let metric = metrics[data.metricUid];
        if (metric) {
          metric.metricData = data.metricData;
          for (let observerId in observers) {
            let observer = observers[observerId];
            observer.socket.emit('metricData', data);
          }
        }
      });

      socket.on('disconnect', () => {
        this.log('Disconnection', connectionInfo);
        connection.metrics.map((metric) => {
          delete metrics[metric.metricDescriptor.metricInfo.metricUid];
          this.log('Disconnection of metric', metric.metricDescriptor);
          this.log('Informing observers about metric disconnection', metric.metricDescriptor);
          for (let observerId in observers) {
            let observer = observers[observerId];
            this.log('Informing observer about metric disconnection', {
              observerId: observer.observerInfo.observerId,
              metricUid: metric.metricDescriptor.metricInfo.metricUid,
            });
            observer.socket.emit('unregisterMetric', metric.metricDescriptor);
          }
          this.log('Metric disconnected', metric.metricDescriptor);
        });
        let observer = observers[connectionInfo.id];
        delete observers[connectionInfo.id];
        if (observer) {
          this.log('Disconnection of observer', {
            observerId: observer.observerInfo.observerId,
          });
        }
      });
    });

    this.log(`Listening on port ${this.hubConfig.hubPort}`);
  }
}

module.exports = MonitoringHub;