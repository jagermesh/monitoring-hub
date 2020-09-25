const colors       = require('colors');
const socketServer = require('socket.io');

module.exports = function(config) {

  const _this = this;

  _this.config = Object.assign({ hubPort: 8082 }, config);

  let logTag = 'HUB';

  _this.log = function(message, attributes) {
    let text = colors.yellow(`[${logTag}]`) + ' ' + message;
    if (attributes) {
      text += ' ' + colors.green(JSON.stringify(attributes));
    }
    console.log(text);
  };

  _this.error = function(message, attributes) {
    let text = colors.yellow(`[${logTag}]`) + ' ' + colors.yellow(`[ERROR]`) + ' ' + message;
    if (attributes) {
      text += ' ' + colors.green(JSON.stringify(attributes));
    }
    console.log(text);
  };

  _this.start = function() {

    const observers = [];
    const sensors   = [];

    // hub server

    _this.log('Starting hub');

    const hubServer = socketServer.listen(_this.config.hubPort, { log: false });

    hubServer.on('connection', function (socket) {
      let connectionInfo = { id: socket.id
                           , address: socket.handshake.address.replace('::1', '127.0.0.1').replace('::ffff:', '')
                           };
      _this.log('New connection', connectionInfo);
      socket.on('registerSensor', function(data) {
        let sensorInfo = Object.assign({ sensorUid:   data.sensorUid
                                       , sensorName:  data.sensorName
                                       , metricsList: data.metricsList }, connectionInfo);
        _this.log('New connection is sensor', { sensorUid: data.sensorUid });
        sensors[connectionInfo.id] = { socket: socket, sensorInfo: sensorInfo };
        socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
        _this.log('Sensor registered', { sensorUid: data.sensorUid });

        _this.log('Sending sensor info to observers', { sensorUid: sensorInfo.sensorUid });
        for(let observerId in observers) {
          let observer = observers[observerId];
          _this.log('Sending sensor info to observer', { sensorUid: sensorInfo.sensorUid, observerId: observer.observerInfo.observerId });
          observer.socket.emit('sensorRegistered', { sensorInfo: sensorInfo });
        }
      });
      socket.on('registerObserver', function(data) {
        let observerInfo = Object.assign({ observerId: connectionInfo.id }, connectionInfo);
        _this.log('New connection is observer', { observerId: observerInfo.id });
        observers[connectionInfo.id] = { socket: socket, observerInfo: observerInfo };
        socket.emit('observerRegistered', { observerInfo: observerInfo });
        _this.log('Observer registered', { observerId: observerInfo.id });

        _this.log('Sending sensors list to observers');
        for (let sensorId in sensors) {
          let sensor = sensors[sensorId];
          _this.log('Sending sensor info to observer',  { sensorUid: sensor.sensorInfo.sensorUid, observerId: observerInfo.observerId });
          socket.emit('sensorRegistered', { sensorInfo: sensor.sensorInfo });
        }
        _this.log('Sending sensors data to observers');
        for (let sensorId in sensors) {
          let sensor = sensors[sensorId];
          if (sensor.sensorData) {
            _this.log('Sending sensor data to observer',  { sensorUid: sensor.sensorInfo.sensorUid, metricUid: sensor.sensorData.metricUid, observerId: observerInfo.observerId });
            socket.emit('sensorData', sensor.sensorData);
          }
        }
      });
      socket.on('sensorData', function(data) {
        let sensor = sensors[connectionInfo.id];
        if (sensor) {
          let sensorData = Object.assign({ }, data);
          sensor.sensorData = sensorData;
          for (let observerId in observers) {
            let observer = observers[observerId];
            // _this.log('Sending sensor data to observer',  { sensorUid: sensorData.sensorUid, metricUid: sensorData.metricUid, observerId: observer.observerInfo.observerId });
            observer.socket.emit('sensorData', sensorData);
          }
        }
      });
      socket.on('disconnect', function() {
        _this.log('Disconnection', connectionInfo);
        let sensor = sensors[connectionInfo.id];
        delete sensors[connectionInfo.id];
        if (sensor) {
          _this.log('Disconnection of sensor', { sensorUid: sensor.sensorInfo.sensorUid });
          _this.log('Informing observers about sensor disconnection',  { sensorUid: sensor.sensorInfo.sensorUid });
          for(let observerId in observers) {
            let observer = observers[observerId];
            _this.log('Informing observer about sensor disconnection',  { sensorUid: sensor.sensorInfo.sensorUid, observerId: observer.observerInfo.observerId });
            observer.socket.emit('sensorUnregistered', { sensorInfo: sensor.sensorInfo });
          }
          _this.log('Sensor disconnected', { sensorUid: sensor.sensorInfo.sensorUid });
        }
        let observer = observers[connectionInfo.id];
        delete observers[connectionInfo.id];
        if (observer) {
          _this.log('Disconnection of observer', { observerId: observer.observerInfo.observerId });
        }
      });
    });

    _this.log('Listening on port ' + _this.config.hubPort);

  };

};