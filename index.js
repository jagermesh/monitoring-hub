const socketServer = require('socket.io');

module.exports = function(config) {

  const _this = this;

  _this.config = Object.assign({ listenSensorsOnPort: 8082, listenWebOnPort: 8081 }, config);

  _this.log = function(message) {
    console.log(`[HUB] ${message}`);
  };

  _this.error = function(message) {
    console.log(`[HUB] [ERROR] ${message}`);
  };

  _this.start = function() {

    const observers       = [];
    const sensors         = [];
    const sensorDataCache = [];

    // data server

    _this.log('Starting data server');

    const dataServer = socketServer.listen(_this.config.listenWebOnPort, { log: false });

    dataServer.on('connection', function (socket) {
      let observerInfo = { id:      socket.id
                         , address: socket.handshake.address.replace('::1', '127.0.0.1').replace('::ffff:', '')
                         };
      _this.log('New observer connection ' + JSON.stringify(observerInfo));
      socket.on('registerObserver', function(callback) {
        observers[observerInfo.id] = { socket:       socket
                                     , observerInfo: observerInfo
                                     , isActive:     true
                                     };
        _this.log('Observer registered: ' + JSON.stringify(observerInfo));
        _this.log('Sending sensors list');
        for (let id in sensors) {
          if (sensors[id].isActive) {
            socket.emit('sensorRegistered', { sensorInfo: sensors[id].sensorInfo });
          }
        }
        _this.log('Sending cached sensor data');
        for (let id in sensors) {
          if (sensors[id].isActive) {
            _this.log(sensors[id].sensorInfo.sensorName);
            if (sensorDataCache[id]) {
              socket.emit('sensorData', sensorDataCache[id]);
            } else {
              _this.log('Cache empty');
            }
          }
        }
        if (typeof callback == 'function') {
          callback({ observerInfo: observerInfo });
        }
        socket.emit('observerRegistered', { observerInfo: observerInfo });
      });
      socket.on('disconnect', function() {
        _this.log('Observer disconnected: ' + JSON.stringify(observerInfo));
        let observerDesc = observers[observerInfo.id];
        if (observerDesc) {
          observerDesc.isActive = false;
        }
      });
    });

    _this.log('Listening dashboard requests on port ' + _this.config.listenWebOnPort);

    // hub server

    _this.log('Starting hub server');

    const hubServer = socketServer.listen(_this.config.listenSensorsOnPort, { log: false });

    hubServer.on('connection', function (socket) {
      let sensorInfo = { id:      socket.id
                       , address: socket.handshake.address.replace('::1', '127.0.0.1').replace('::ffff:', '')
                       };
      _this.log('New sensor connection ' + JSON.stringify(sensorInfo));
      socket.on('registerSensor', function(data) {
        sensorInfo.sensorName  = data.sensorName;
        sensorInfo.sensorUid   = data.sensorUid;
        sensorInfo.metricsList = data.metricsList;
        sensors[sensorInfo.id] = { socket:     socket
                                 , sensorInfo: sensorInfo
                                 , isActive:   true
                                 };
        for(let id in observers) {
          observers[id].socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
        }
        _this.log('Sensor registered: ' + JSON.stringify(sensorInfo));
        socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
      });
      socket.on('disconnect', function() {
        let sensorDesc = sensors[sensorInfo.id];
        if (sensorDesc) {
          sensorDesc.isActive = false;
          for(let id in observers) {
            if (observers[id].isActive) {
              observers[id].socket.emit('sensorUnregistered', { sensorInfo: sensorInfo });
            }
          }
        }
      });
      socket.on('sensorData', function(data) {
        sensorDataCache[sensorInfo.id] = { sensorInfo: sensorInfo
                                         , metricInfo: data.metricInfo
                                         , metricData: data.metricData
                                         };
        for (let id in observers) {
          if (observers[id].isActive) {
            observers[id].socket.emit( 'sensorData', sensorDataCache[sensorInfo.id] );
          }
        }
      });
    });

    _this.log('Listening sensor requests on port ' + _this.config.listenSensorsOnPort);

  };

};