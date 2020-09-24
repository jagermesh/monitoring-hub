const colors       = require('colors');
const socketServer = require('socket.io');

module.exports = function(config) {

  const _this = this;

  _this.config = Object.assign({ hubPort: 8082 }, config);

  let logTag = 'HUB';

  _this.log = function(message, tag) {
    tag = tag || logTag;
    console.log(colors.yellow(`[${tag}]`) + ' ' + message);
  };

  _this.error = function(message, tag) {
    tag = tag || logTag;
    console.log(colors.yellow(`[${tag}]`) + ' ' + colors.red('[HUB]') + ' ' + message);
  };

  _this.start = function() {

    const observers       = [];
    const sensors         = [];
    const sensorDataCache = [];

    const clients = {};

    // hub server

    _this.log('Starting hub server');

    const hubServer = socketServer.listen(_this.config.hubPort, { log: false });

    hubServer.on('connection', function (socket) {
      let connectionInfo = { id: socket.id
                           , address: socket.handshake.address.replace('::1', '127.0.0.1').replace('::ffff:', '')
                           };
      _this.log('New connection ' + JSON.stringify(connectionInfo));
      socket.on('registerSensor', function(data) {
        let sensorInfo = Object.assign({ sensorUid:   data.sensorUid
                                       , sensorName:  data.sensorName
                                       , metricsList: data.metricsList }, connectionInfo);
        _this.log('Sensor registration request received ' + JSON.stringify(sensorInfo));
        sensors[connectionInfo.id] = { socket: socket, sensorInfo: sensorInfo, isActive: true};
        socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
        _this.log('Sensor registered ' + JSON.stringify(sensorInfo));

        setTimeout(function() {
          _this.log('Sending sensor info to observers ' + JSON.stringify(sensorInfo));
          for(let observerId in observers) {
            observers[observerId].socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
          }
        });
      });
      socket.on('registerObserver', function(data) {
        let observerInfo = Object.assign({ }, connectionInfo);
        _this.log('Observer registration request received ' + JSON.stringify(observerInfo));
        observers[connectionInfo.id] = { socket: socket, observerInfo: observerInfo, isActive: true};
        socket.emit('observerRegistered', { observerInfo: observerInfo });
        _this.log('Observer registered: ' + JSON.stringify(observerInfo));

        setTimeout(function() {
          _this.log('Sending sensors list to observers');
          for (let sensorId in sensors) {
            if (sensors[sensorId].isActive) {
              let sensorInfo = sensors[sensorId].sensorInfo;
              _this.log('Sending sensor info to observer ' + JSON.stringify(sensorInfo));
              socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
            }
          }
          setTimeout(function() {
            _this.log('Sending sensors data to observer');
            for (let sensorId in sensors) {
              if (sensors[sensorId].isActive) {
                let sensorInfo = sensors[sensorId].sensorInfo;
                let sensorData = sensorDataCache[sensorId];
                if (sensorData) {
                  _this.log('Sending sensor data to observer ' + JSON.stringify(sensorInfo));
                  socket.emit('sensorData', sensorData);
                }
              }
            }
          });
        });
      });
      socket.on('sensorData', function(data) {
        let sensorData = Object.assign({ }, data);
        sensorDataCache[sensorData.sensorUid] = sensorData;
        for (let observerId in observers) {
          if (observers[observerId].isActive) {
            observers[observerId].socket.emit('sensorData', sensorData);
          }
        }
      });
      socket.on('disconnect', function() {
        let sensor = sensors[connectionInfo.id];
        if (sensor) {
          sensor.isActive = false;
          for(let observerId in observers) {
            if (observers[observerId].isActive) {
              observers[observerId].socket.emit('sensorUnregistered', { sensorInfo: sensor.sensorInfo });
            }
          }
          _this.log('Sensor disconnected ' + JSON.stringify(sensor.sensorInfo));
        }
        let observer = observers[connectionInfo.id];
        if (observer) {
          observer.isActive = false;
          _this.log('Observer disconnected ' + JSON.stringify(observer.observerInfo));
        }
      });
    });

    _this.log('Listening on port ' + _this.config.hubPort);

  };

};