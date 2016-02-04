// bts.js
// saswata basu, 2015
// 
// make sure export PATH=$PATH:~/bts is added to /etc/profile
// echo "export PATH=$PATH:~/bts" | sudo tee -a /etc/profile
// get data from sensors and send to cloud
// control led on/off for sensor(s) - auto shut off after maxLedOn time
// upgrade, restart, reboot bts code
//
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var fs = require('fs');
var logger = require('./logger')
var path = require('path');
var child = require('child_process').exec;
var spawn = require('child_process').spawn;
var wget = require('wget-improved');
var async = require('async');
var noble = require('noble/index');
var ejson = require('ejson');
var DDPClient = require('ddp');
var git    = require('gitty');
var myRepo = git('~/bts');
var tunnel = require('tunnel-ssh');
require('shelljs/global');

// require('shelljs/global');

// var btsSensorListObjects = {'a0143d07d532':true,'a0143d0c62af':true,'a0143d0c642a':true, 'a0143d0c63de':true,'9003b7c74ddf':true};
// var btsSensorList = ['a0143d07d532','a0143d0c62af','a0143d0c642a', 'a0143d0c63de','9003b7c74ddf'];


// initial data without cloud
var btsSensorList=[];
var btsSensorListObjects={};
var sensorIdSerialNo={};
var sensorObjects={};
var btsSensorListDone=[];
var btsSensorListObjectsTimer = {};

var scanTime = 10;
var upgradeFW = false;
var restartApp = false;
var rebootBB = false;
var reverseSSH = false;
var closeTunnel = false;
var maxLedOn = 30; 
var blinkInterval = 1500;
var minReadInterval = 60;
var btsID;
var timeIn = (new Date).getTime()/1000 -61;
var timelapsed;

// services UUIDs
var serviceSensorUuid = '39e1fa0084a811e2afba000win2a5d5c51b'
var serviceBattUuid = '180f'
var serviceTimeUuid = '39e1fd0084a811e2afba0002a5d5c51b'
var readServList = ['39e1fa0084a811e2afba0002a5d5c51b','180f','39e1fd0084a811e2afba0002a5d5c51b'];


// characteristics UUIDs
var soilTempUuid = '39e1fa0384a811e2afba0002a5d5c51b'
var airTempUuid = '39e1fa0484a811e2afba0002a5d5c51b'
var soilMoistureUuid = '39e1fa0584a811e2afba0002a5d5c51b'
var soilNutrientUuid = '39e1fa0284a811e2afba0002a5d5c51b'
var sunlightUuid = '39e1fa0184a811e2afba0002a5d5c51b'
var ledStatusUuid = '39e1fa0784a811e2afba0002a5d5c51b'       // turn on/off blinker from cloud, auto shut off after 5 mins
var lastMovedDateUuid = '39e1fa0884a811e2afba0002a5d5c51b'   // check if moved flag is set
var batteryLevelUuid = '2a19'                                // check every month
var currentTimeUuid = '39e1fd0184a811e2afba0002a5d5c51b' 
var readCharList = [ '39e1fa0384a811e2afba0002a5d5c51b', '39e1fa0284a811e2afba0002a5d5c51b',
                          '39e1fa0584a811e2afba0002a5d5c51b','39e1fa0484a811e2afba0002a5d5c51b',
                          '39e1fa0184a811e2afba0002a5d5c51b','39e1fa0884a811e2afba0002a5d5c51b',
                          '2a19','39e1fa0784a811e2afba0002a5d5c51b','39e1fd0184a811e2afba0002a5d5c51b'];
var readCharListObject = { '39e1fa0384a811e2afba0002a5d5c51b':'sT', '39e1fa0284a811e2afba0002a5d5c51b':'sEC',
                          '39e1fa0584a811e2afba0002a5d5c51b':'sM','39e1fa0484a811e2afba0002a5d5c51b':'aT',
                          '39e1fa0184a811e2afba0002a5d5c51b':'sL','39e1fa0884a811e2afba0002a5d5c51b': 'mD',
                          '2a19':'bL','39e1fa0784a811e2afba0002a5d5c51b':'led','39e1fd0184a811e2afba0002a5d5c51b':'t'};


// initial values of global flags, counters, timers
var exploreOn = true;
var counter = 0;
var alreadyScanned=0;
var index = 0;
var start = Math.floor(Date.now() / 1000);
var stop;
var btsID;
var networkOn;
// var btsID = '4414BBBK0072';  //this should be serial number of bbb
// var sensorID = 'S001';



// check network connectivity status
var EventEmitter = require('events').EventEmitter,
    spawn = require('child_process').spawn,
    rl = require('readline');

var RE_SUCCESS = /bytes from/i,
    INTERVAL = 2, // in seconds
    IP = '8.8.8.8';

var proc = spawn('ping', ['-v', '-n', '-i', INTERVAL, IP]),
    rli = rl.createInterface(proc.stdout, proc.stdin),
    network = new EventEmitter();

network.online = true;

rli.on('line', function(str) {
  if (RE_SUCCESS.test(str)) {
    networkOn = true;
    if (!network.online) {
      network.online = true;
      network.emit('online');
      process.exit(0);
    }
  } else {
    networkOn = false;
    if (network.online) {
      network.online = false;
      network.emit('offline');
    }
  }
});



// then just listen for the `online` and `offline` events ...
network.on('online', function() {
  logger.error('++++++++++++ online! +++++++++++++',networkOn);
  // noble.stopScanning();
  // logger.info('Stopping scan and restarting app');
  // process.exit(0);
}).on('offline', function() {
  logger.error('------------ offline! -------------', networkOn);
});



// run shell command
function run_cmd(cmd, args, callBack ) {
    var spawn = require('child_process').spawn;
    var child = spawn(cmd, args);
    var resp = "";

    child.stdout.on('data', function (buffer) { resp += buffer.toString() });
    child.stdout.on('end', function() { callBack (resp) });
}

// check sensorObjects list to see if sensor has been deleted
function checkSensorObjectsList () {
  var sensorObjectsKeys = Object.keys(sensorObjects);
  for (key in sensorObjects){
    if(!(btsSensorList.indexOf(key) > -1)){    // delete sensor from sensorObjects & btsSensorListDone
      logger.warn('deleting sensor from sensorObjects...') ;
      delete sensorObjects[key]; 
      logger.warn('btsSensorList:',btsSensorList);
      var index = btsSensorListDone.indexOf(key);
      if (index > -1) {
        logger.warn('deleting sensor from btsSensorListDone...')
        btsSensorListDone.splice(index,1);
        logger.warn('btsSensorListDone:',btsSensorListDone);  
      }   
    }
  }
}

// ddp call
// var ddpclient = new DDPClient({
//   host : "ezgrowr.com",
//   port : 3000,  //443
//   ssl  : false, //true
//   autoReconnect : true,
//   autoReconnectTimer : 500,
//   maintainCollections : true,
//   ddpVersion : '1',  // ['1', 'pre2', 'pre1'] available
//   useSockJs: true
// });

// alternate ddp call
var ddpclient = new DDPClient({
  // host : "ezgrowr.com",
  // port : 3010,  //443
  autoReconnect : true,
  autoReconnectTimer : 500,
  maintainCollections : true,
  ddpVersion : '1',  // ['1', 'pre2', 'pre1'] available
  url: 'wss://ezgrowr.com/websocket'
});

//Log all messages if a "changed" or "added" message is received and then update the sensor lists and parameters
ddpclient.on('message', function (msg) {
  logger.warn("ddp message: " + msg);
  var bts = ddpclient.collections["base-stations"];
  var sensor = ddpclient.collections.sensors;
  msg = ejson.parse(msg);
  if (msg["msg"] === "changed") {
    logger.error("ooooo changed ooooo");
    console.log("changed");
    if(msg["collection"] === "base-stations"){
      async.series([
        function(callback){
          if (bts[msg["id"]]["maxLedOnTime"])
            maxLedOn = bts[msg["id"]]["maxLedOnTime"]
          if (bts[msg["id"]]["scanTime"])
            scanTime = bts[msg["id"]]["scanTime"];
          if (bts[msg["id"]]["minReadInterval"])
            scanTime = bts[msg["id"]]["minReadInterval"];
          if (bts[msg["id"]]["upgradeFW"])
            upgradeFW = bts[msg["id"]]["upgradeFW"];
          if (bts[msg["id"]]["rebootBB"])
            rebootBB = bts[msg["id"]]["rebootBB"];
          if (bts[msg["id"]]["restartApp"])
            restartApp = bts[msg["id"]]["restartApp"];
          if (bts[msg["id"]]["reverseSSH"])
            reverseSSH = bts[msg["id"]]["reverseSSH"];
          if (bts[msg["id"]]["closeTunnel"])
            closeTunnel = bts[msg["id"]]["closeTunnel"];
          if (bts[msg["id"]]["blinkInterval"])
            blinkInterval = bts[msg["id"]]["blinkInterval"];
          logger.debug('scanTime: %d, minReadInterval: %d, upgradeFW: %s, rebootBB: %s, restartApp: %s,\
            reverseSSH: %s, closeTunnel: %s, maxLedOn: %d, blinkInterval: %d',scanTime, minReadInterval, upgradeFW,
            rebootBB,restartApp,reverseSSH,closeTunnel,maxLedOn,blinkInterval);
          callback();
        },
        function(callback){
          if (rebootBB) reboot();
          callback();
        },
        function(callback){
          if (restartApp) restart();
          callback();
        },
        function(callback){
          if (upgradeFW) upgrade();
          callback();
        },
        function(callback){
          if (reverseSSH) reverse();
          callback();
        },
        function(callback){
          if (closeTunnel) closeSSH();
          callback();
        }
      ])
    }
    if(msg["collection"] === "sensors"){
      if (sensor[msg["id"]]["ledStatus"])
        btsSensorListObjects[sensorIdSerialNo[msg["id"]]]=sensor[msg["id"]]["ledStatus"];
      logger.debug('btsSensorListObjects:',btsSensorListObjects);
    }
  }
  if (msg["msg"] === "added") {
    logger.error("+++++ added +++++");
    console.log("added");
    if(msg["collection"] === "base-stations"){
      async.series([
        function(callback){
          if (bts[msg["id"]]["maxLedOnTime"])
            maxLedOn = bts[msg["id"]]["maxLedOnTime"]
          if (bts[msg["id"]]["scanTime"])
            scanTime = bts[msg["id"]]["scanTime"];
          if (bts[msg["id"]]["minReadInterval"])
            scanTime = bts[msg["id"]]["minReadInterval"];
          if (bts[msg["id"]]["upgradeFW"])
            upgradeFW = bts[msg["id"]]["upgradeFW"];
          if (bts[msg["id"]]["rebootBB"])
            rebootBB = bts[msg["id"]]["rebootBB"];
          if (bts[msg["id"]]["restartApp"])
            restartApp = bts[msg["id"]]["restartApp"];
          if (bts[msg["id"]]["reverseSSH"])
            reverseSSH = bts[msg["id"]]["reverseSSH"];
          if (bts[msg["id"]]["closeTunnel"])
            closeTunnel = bts[msg["id"]]["closeTunnel"];
          if (bts[msg["id"]]["blinkInterval"])
            blinkInterval = bts[msg["id"]]["blinkInterval"];
          logger.debug('scanTime: %d, minReadInterval: %d, upgradeFW: %s, rebootBB: %s, restartApp: %s,\
            reverseSSH: %s, closeTunnel: %s, maxLedOn: %d, blinkInterval: %d',scanTime, minReadInterval, upgradeFW,
            rebootBB,restartApp,reverseSSH,closeTunnel,maxLedOn,blinkInterval);
          callback();
        },
        function(callback){
          if (rebootBB) reboot();
          callback();
        },
        function(callback){
          if (restartApp) restart();
          callback();
        },
        function(callback){
          if (upgradeFW) upgrade();
          callback();
        },
        function(callback){
          if (reverseSSH) reverse();
          callback();
        },
        function(callback){
          if (closeTunnel) closeSSH();
          callback();
        }
      ])
    }
    if(msg["collection"] === "sensors"){
      if (sensor[msg["id"]]["serialNo"] && !(btsSensorList.indexOf(sensor[msg["id"]]["serialNo"]) > -1) ) {   //check if sensor is on list
        sensorIdSerialNo[msg["id"]]=sensor[msg["id"]]["serialNo"];
        btsSensorList.push(sensorIdSerialNo[msg["id"]].toLowerCase());    
        if (sensor[msg["id"]]["ledStatus"])
          btsSensorListObjects[sensorIdSerialNo[msg["id"]]]=sensor[msg["id"]]["ledStatus"];
      }
      logger.debug('btsSensorList: ', btsSensorList);
      logger.debug('btsSensorListObjects:',btsSensorListObjects);
      logger.debug("sensorIdSerialNo:", sensorIdSerialNo);
    }
  }
  if (msg["msg"] === "removed") {
    logger.error("------ removed ------");
    if(msg["collection"] === "sensors"){
      delete btsSensorListObjects[sensorIdSerialNo[msg["id"]]];
      index = btsSensorList.indexOf(sensorIdSerialNo[msg["id"]]);
      delete sensorIdSerialNo[msg["id"]];
      if (index>-1) btsSensorList.splice(index,1)
      logger.warn("New btsSensorList:", btsSensorList);
      logger.warn("New btsSensorListObjects:", btsSensorListObjects);
      logger.warn("New sensorIdSerialNo:", sensorIdSerialNo);
    }
  }
});

connect();

function connect(){
  async.series([
    function(callback){
      if (!btsID) getSerialNumber();
      callback();
    },
    function(){
      ddpclient.connect(function(error, wasReconnect) {
        if (error) {
          logger.error('error: DDP connection error!',error);
          noble.stopScanning();
          logger.info('Stopping scan and restarting app');
          process.exit(0);
          return;
        } 
        logger.info('connected!');
        if (wasReconnect) {
          logger.info('Reestablishment of a connection');
          noble.stopScanning();
          logger.info('Stopping scan and restarting app');
          process.exit(0);
        }
        //Subscribe to a Meteor Collection

        ddpclient.subscribe(                 // name of Meteor Publish function to subscribe to
          'BaseStationSensors',
          [btsID],                       // any parameters used by the Publish function
          function (error) {             // callback when the subscription is complete
            if (error){
              // var collection = ddpclient.collections.bts;
              // logger.debug('bts collection: ', collection);
            // } else {
              logger.error('Error9 bts collection subscription error: ', error);
            }
          }
        );

      // noble.connect(btsSensorList[0]);
      // logger.debug('connected to ------- :',btsSensorList[0]);
      // logger.debug('read battery value ****** :',readBatteryLevel(noble.read(btsSensorList[0], serviceBattUuid, batteryLevelUuid)));

        noble.on('discover', function(peripheral) {
          logger.debug('discovered:',peripheral.uuid);
          noble.stopScanning();
          if (exploreOn){
            exploreOn=false;
            setTimeout(function(){  //stop scan completely first
              if (isEmpty(sensorObjects)) logger.debug('sensorObjects is empty');
              // else logger.debug('sensorObjects are:',sensorObjects);
              // if (btsSensorListDone.length===0) {
              //   logger.debug("start time: ",start);
              // }
              if (btsSensorList.length) { // if sensor list is empty do nothing
                if (btsSensorList.indexOf(peripheral.uuid.toString()) > -1) {  //check if sensor is on list
                  if (!(btsSensorListDone.indexOf(peripheral.uuid.toString()) > -1)) {  //check if we have already read sensor
                    alreadyScanned=0;
                    sensorObjects[peripheral.uuid]=peripheral;
                    btsSensorListDone.push(peripheral.uuid);  // add sensor on 'done' list
                    logger.info('sensor with UUID ' + peripheral.uuid + ' found');
                      exploreOn = true;
                      noble.startScanning(readServList);
                  } 
                  else {
                    alreadyScanned++;
                    stop = Math.floor(Date.now() / 1000);
                    logger.info('\n already scanned : '+ btsSensorListDone);
                    logger.info('scanned:',alreadyScanned);
                    logger.info('scanTime:',scanTime);
                    logger.info('btsSensorList:',btsSensorList.length);
                    logger.info('stop-start:',stop-start);

                    var done = arraysEqual(btsSensorListDone,btsSensorList);
                    if (done || stop-start > scanTime*btsSensorList.length || 
                      alreadyScanned > btsSensorList.length ) {    
                      if (done) logger.warn("***** All Sensors accounted for *****");  
                      counter =0;
                      alreadyScanned=0;
                      logger.debug("*************** Done Scanning ***************")
                      logger.debug("Scan time was ",stop-start,' seconds');

                      // timelapsed = (new Date).getTime()/1000 - timeIn;
                      // logger.info('timelapsed is ',timelapsed)
                      // if (timelapsed > 60)
                          exploreAllSensors();
                      // else {
                      //     logger.info('timeout for 60s...')
                      //     setTimeout(function(){
                      //         exploreAllSensors();
                      //     }, 1000*minReadInterval);
                      // }
                      // timeIn = (new Date).getTime()/1000;
                      // exploreAllSensors()
                      // async.whilst(
                      //   function () {
                      //     logger.debug("index is: ",index, " number of sensors: ",length);
                      //     return (index < length);  
                      //   },
                      //   function(callback) {
                      //     async.series([
                      //       function(callback) { 
                      //         logger.warn('exploring...',keys[index]);
                      //         timelapsed = (new Date).getTime()/1000 - timeIn;
                      //         timeIn = (new Date).getTime()/1000;
                      //         if (timelapsed > 60)
                      //           explore(sensorObjects[keys[index]],callback);
                      //         else {
                      //           logger.info('timeout for 60s...')
                      //           setTimeout(function(){
                      //                       explore(sensorObjects[keys[index]],callback);
                      //                   }, 1000*minReadInterval);
                      //         }
                      //       },
                      //       function(callback) {
                      //         index++;
                      //         // if list is done exploring
                      //         if (index > length-1  ){
                      //             async.series ([
                      //               function(callback){
                      //                 // check if Led is ON
                      //                 sensorLedOnCheck();
                      //                 logger.warn('check if Led is ON:',index);
                      //                 callback();
                      //               },
                      //               function(callback){
                      //                 // check if sensor has been removed by cloud
                      //                 checkSensorObjectsList();
                      //                 length = Object.keys(sensorObjects).length;
                      //                 keys = Object.keys(sensorObjects);
                      //                 logger.warn('checkSensorObjectsList:',length);
                      //                 callback();
                      //               }, 
                      //               function(callback){
                      //                 // check if list is complete or any sensor additions from cloud
                      //                 if (!arraysEqual(btsSensorListDone,btsSensorList)) {
                      //                   logger.info('scanning again ...')
                      //                   start = Math.floor(Date.now() / 1000);
                      //                   //scan again if we are missing some sensors on the list
                      //                   setTimeout(function(){
                      //                       exploreOn = true;
                      //                       noble.startScanning(readServList);
                      //                       callback();
                      //                   }, 500);
                      //                 } else {
                      //                   logger.info('reset index to 0 ...');
                      //                   index = 0;
                      //                   callback();
                      //                 }
                      //                 logger.warn('index is:',index);
                      //                 // callback();
                      //               }, function(){
                      //                 callback();
                      //               }
                      //             ])
                      //         } else {
                      //             callback();
                      //         }
                      //       }, 
                      //       function(){
                      //         callback();
                      //       }
                      //     ]);
                      //   },
                      //   function() {
                      //     logger.info('++++++++ Done exploring all sensors on list ++++++++');
                      //   }
                      // );
                    } else {
                      exploreOn = true;
                      noble.startScanning(readServList);
                    }
                  }
                } else {
                  exploreOn = true;
                  noble.startScanning(readServList);
                }
              } else {
                logger.error('Error12: BTS Sensor List is empty');
                noble.startScanning(readServList);
              }
            }, 500);
          } else {
            logger.debug('Looking at previous sensor...discarding current discovery');
          }
        });
      });
    }
  ])
}

function exploreAllSensors (){
  var keys = Object.keys(sensorObjects);
  var index = 0;
  var length = Object.keys(sensorObjects).length;
  async.whilst(
    function () {
      logger.debug("index is: ",index, " number of sensors: ",length);
      return (index < length);  
    },
    function(callback) {
      async.series([
        function(callback) { 
          logger.warn('exploring...',keys[index]);
          timelapsed = (new Date).getTime()/1000 - timeIn;
          logger.info('timelapsed is ',timelapsed);
          timeIn = (new Date).getTime()/1000;
          if (timelapsed > minReadInterval || index != 0)
            explore(sensorObjects[keys[index]],callback);
          else {
            logger.info('timeout for minReadInterval ...')
            setTimeout(function(){
              explore(sensorObjects[keys[index]],callback);
              }, 1000*(minReadInterval-timelapsed));
          }
        },
        function(callback) {
          index++;
          // if list is done exploring
          if (index > length-1  ){
              async.series ([
                function(callback){
                  // check if Led is ON
                  sensorLedOnCheck();
                  logger.warn('check if Led is ON:',index);
                  callback();
                },
                function(callback){
                  // check if sensor has been removed by cloud
                  checkSensorObjectsList();
                  length = Object.keys(sensorObjects).length;
                  keys = Object.keys(sensorObjects);
                  logger.warn('checkSensorObjectsList:',length);
                  callback();
                }, 
                function(callback){
                  // check if list is complete or any sensor additions from cloud
                  if (!arraysEqual(btsSensorListDone,btsSensorList)) {
                    logger.info('scanning again ...')
                    start = Math.floor(Date.now() / 1000);
                    //scan again if we are missing some sensors on the list
                    setTimeout(function(){
                        exploreOn = true;
                        noble.startScanning(readServList);
                        callback();
                    }, 500);
                  } else {
                    logger.info('reset index to 0 ...');
                    index = 0;
                    callback();
                  }
                  logger.warn('index is:',index);
                  // callback();
                }, function(){
                  callback();
                }
              ])
          } else {
              callback();
          }
        }, 
        function(){
          callback();
        }
      ]);
    },
    function() {
      logger.info('++++++++ Done exploring all sensors on list ++++++++');
    }
  );
}

// if app is powered on start scanning, else exit app
noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    logger.info('poweredOn');
    // logger.info('readServList:',readServList);
    exploreOn = true;
    noble.startScanning(readServList);
  } else {
    logger.info('poweredOff')
    noble.stopScanning();
    process.exit(0); //exit so that UpStart can restart it
  }
});


function explore(peripheral,callback) {
  logger.info('exploring sensor');

  peripheral.once('disconnect', function() {
    logger.debug('counter: ',counter)
    var stop = Math.floor(Date.now() / 1000);
    logger.debug("-----------------Disconnect----------------")
    logger.debug("Time elapsed to explore: ",stop-start);
    callback();
  });

  peripheral.connect(function(err) {
    logger.info('inside connect function...');
    if (!err) {
      logger.debug("connected to ... ",peripheral.uuid);
      if (!peripheral){
        logger.error('Error20 - peripheral error: ',err);
      } else {
        peripheral.discoverSomeServicesAndCharacteristics(readServList, readCharList, function(error, services, characteristics){
          if (!error){
            readWriteToBLE(peripheral,services,characteristics);
          } else {
            logger.error('Error2 - Discover Services error: ',error);
            peripheral.disconnect();
          }
        });
      }
    } else { 
      logger.error('Error1 - Sensor connect error: ',err);
      peripheral.disconnect();
    }
  });
}
function readWriteToBLE (peripheral,services,characteristics) {
  // logger.info("services: ",services.length);
  // logger.info("characteristics: ",characteristics.length);
  var sensorData={};
  var serviceIndex = 0;  //start at sensor data service, skip first 3 services
  async.whilst(
    function () {
      return (serviceIndex < services.length-2);  //skip last two services
    },
    function(callback) {
      // logger.warn('service:',services[serviceIndex].uuid.toString());
      var serviceInfo = services[serviceIndex].uuid;
      var characteristicIndex = 0;
      async.whilst(
        function () {
          return (characteristicIndex < characteristics.length);
        },
        function(callback) {
          // logger.warn('characteristic:',characteristics[characteristicIndex].uuid.toString());
          var characteristic = characteristics[characteristicIndex];
          var characteristicInfo = characteristic.uuid.toString();

          //read/write data if characteristic is on list
          async.series ([
            function() {
              if (characteristicInfo in readCharListObject) {
                if (characteristic.properties.indexOf('read') !== -1) {
                  characteristic.read(function(error, data) {
                    if (error){
                      logger.error('Error5 - Characteristic Read error: ', error);
                    } else {
                      if (data) {
                        // logger.info('serviceInfo:',serviceInfo,'characteristicInfo:',characteristicInfo);
                        switch (readCharListObject[characteristicInfo]){
                          case 'sT':
                              data=convertTemperatureData(data).toFixed(4);
                              break;
                          case 'sEC':
                              data=convertSoilElectricalConductivityData(data).toFixed(4);
                              break;
                          case 'sM':
                              data=convertSoilMoistureData(data).toFixed(4);
                              break;
                          case 'aT':
                              data=convertTemperatureData(data).toFixed(4);
                              break;
                          case 'sL':
                              data=convertSunlightData(data).toFixed(4);
                              break;
                          case 'mD':
                              data=readLastMovedDate(data);
                              break;                                        
                          case 't':
                              data=getStartupTime(data);
                              break;
                          case 'bL':
                              data=readBatteryLevel(data);
                              break;
                          case 'led':
                              // data=readLedStatus(data);
                              if ((characteristicInfo === ledStatusUuid) && btsSensorListObjects[peripheral.uuid]){  // if led is configured to be ON, then turn it ON
                              // logger.error('checking ledStatus');  // led is always off initially because it always goes off upon disconnect
                              // if (btsSensorListObjects[peripheral.uuid]){  //if config list value is true
                                logger.error('********  turning on LED LED LED ********');
                                characteristic.write(new Buffer([0x01]), false, function(err){
                                  if(err){
                                   logger.error('Error15: write led error'); 
                                  }
                                });  //todo - error check
                                // data=1;
                              }
                              data=readLedStatus(data);
                              break;
                          default:
                              logger.error('Error6 - Characteristic not part of list');
                        }
                      } else {
                        logger.error('Error7 - Bad Characteristic Data');
                      }
                      sensorData[readCharListObject[characteristicInfo]]= data;
                      // logger.warn(characteristicIndex,'  ---  ', sensorData);
                    }
                    characteristicIndex++;
                    callback();
                  });
                } else {
                  characteristicIndex++;
                  callback();
                }
              } 
            },
            function(){
              characteristicIndex++;
            }
          ]);
        },
        function() {
          serviceIndex++;
          callback();
        }
      );
    },
    function () {
      async.series([ 
        function(callback){
          counter++;
          sensorData['rssi']=peripheral.rssi;
          sensorData['txP']=peripheral.advertisement.txPowerLevel;
          sensorData['sn']=peripheral.uuid;
          logger.debug('sensorData:',sensorData);
          callback();
        },
        function(callback){
          addPlantData(sensorData,callback);
        },
        function(){  // if led is ON then have it blink on for 1.5s
          if (sensorData['led']){
            setTimeout(function(){
              if (peripheral){
                peripheral.disconnect();
              }
            }, blinkInterval);
          } else {
            setTimeout(function(){
              if (peripheral){
                peripheral.disconnect();                
              }
            }, 100);          
          }
        }               
      ]);
    }
  );
}

// call cloud to set the sensor config to current state
function updateSensorConfig(sn,led){
  // data = {btsID:btsID, sn:sn, led:led};
  if (networkOn){
    ddpclient.call(
      'resetSensorLED',            // name of Meteor Method being called
      [sn],                       // parameters to send to Meteor Method
      function (err, result) {      // callback which returns the method call results
        logger.warn('called resetSensorLED: ', result);
        if (err){
          logger.error('Error10 - DDP update Sensor config error: ',err);  
          process.exit(0);
        }
      },
      function () {                 // fires when server has finished
        logger.debug('done resetSensorLED');  
        // callback();
      }
    );
  }
}
  
// call cloud to set the bts config to current state
function updateBTSConfig(){
  // data = {rebootBB:rebootBB, restartApp:restartApp, upgradeFW:upgradeFW, reverseSSH:reverseSSH,closeTunnel:closeTunnel
  //   , btsID:btsID};
  if (networkOn){ 
    ddpclient.call(
      'resetBTSConfig',            // name of Meteor Method being called
      [btsID],                       // parameters to send to Meteor Method
      function (err, result) {      // callback which returns the method call results
        logger.warn('called resetBTSConfig: ', result );
        if (err){
          logger.error('Error11 - DDP update BTS config error: ',err);  
          process.exit(0);
        }
      },
      function () {                 // fires when server has finished
        logger.debug('done resetBTSConfig');  
        // callback();
      }
    );
  }
}

// send plant data to cloud
function addPlantData(sensorData,callback){
  // network.on('online', function() {
  //   logger.error('++++++++++++ online! addPlantdata +++++++++++++');
  // }).on('offline', function() {
  //   logger.error('------------ offline! addPlantdata -------------');
  // });
  if (networkOn){
    logger.info('inside addPlantdata')
    ddpclient.call(
      'addPlantData',            // name of Meteor Method being called
      [sensorData],              // parameters to send to Meteor Method
      function (err, result) {   // callback which returns the method call results
        logger.debug('called addPlantdata: ', result);
        if (err){
          logger.error('Error4 - DDP upload data error: ',err);  
           process.exit(0);
        }
      },
      function () {              // fires when server has finished
        logger.debug('updated');  
        callback();
      }
    );
  }
}

// Check LED on/off. For every sensor that is ON, check start time and compare with current time
// turn LED off if time exceeds 5 mins
// call this function every maxLedOn interval
function sensorLedOnCheck () {
  var nowTime = Date.now() / 1000 | 0;
  logger.debug('sensorLedOnCheck')
  for (key in btsSensorListObjects){
    if (btsSensorListObjects[key] === true){
      if(btsSensorListObjectsTimer[key]){  // check if sensor is on timer list
        if ( (nowTime-btsSensorListObjectsTimer[key]) > maxLedOn + minReadInterval){
          btsSensorListObjects[key] = false;
          delete btsSensorListObjectsTimer[key];  //remove sensor from timer list if led is reset
          //call method to update sensor config in cloud
          updateSensorConfig(key,false);
        }
      } else {   // unlikely, but will turn timer on if not done yet
        btsSensorListObjectsTimer[key] = nowTime;
      }
    }
  }
}


// read file
function readServiceFile(file){
  var contents = fs.readFileSync(file).toString();
  logger.debug(contents);
  return contents;
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      logger.error('Error reading file: ' + err);
      return null;
    }
    data = JSON.parse(data);
    console.dir(data);
    return data;
  });
}


// write file
function writeServiceFile(outputFilename, myData){
  var dir = '/opt/node_modules/flower-power/node_modules/noble/examples/'
  var outputFilename = dir+'peripherals.json';
  fs.writeFile(outputFilename, myData, function(err) {
      if(err) {
        logger.error('Error writing to file: ', err);
        return err;
      } else {
        logger.debug("JSON saved to " + outputFilename);
        return 'OK';
      }
  });
}


// test if object is empty
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

// check if the arrays are equal, doesn't matter the order of the contents
function arraysEqual(a, b) {    
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; ++i) {
    if (!(b.indexOf(a[i]) > -1)) return false;
  }
  return true;
}

function readLastMovedDate (data) {
  var rawValue = data.readUInt32LE(0) * 1.0;
  return rawValue;
};

function readBatteryLevel (data) {
  var rawValue =  data.readUInt8(0) * 1.0;
  return rawValue;
};

function readLedStatus (data) {
  var rawValue =  data.readUInt8(0) * 1.0;
  return rawValue;
};

function convertSunlightData (data) {
  var rawValue = data.readUInt16LE(0) * 1.0;
  var sunlight = 0.08640000000000001 * (192773.17000000001 * Math.pow(rawValue, -1.0606619));
  // var sunlight = 11.574 * rawValue
  return sunlight;
};

function convertSoilElectricalConductivityData (data) {
  var rawValue = data.readUInt16LE(0) * 1.0;
  //  convert raw (0 - 1771) to 0 to 10 (mS/cm)
  var soilElectricalConductivity = rawValue/200;
  return soilElectricalConductivity;
};

function convertTemperatureData (data) {
  var rawValue = data.readUInt16LE(0) * 1.0;
  var temperature = 0.00000003044 * Math.pow(rawValue, 3.0) - 0.00008038 * Math.pow(rawValue, 2.0) + rawValue * 0.1149 - 30.449999999999999;
  if (temperature < -10.0) {
    temperature = -10.0;
  } else if (temperature > 55.0) {
    temperature = 55.0;
  }
  return temperature;
};

function convertSoilMoistureData (data) {
  var rawValue = data.readUInt16LE(0) * 1.0;
  var soilMoisture = 11.4293 + (0.0000000010698 * Math.pow(rawValue, 4.0) - 0.00000152538 * Math.pow(rawValue, 3.0) +  0.000866976 * Math.pow(rawValue, 2.0) - 0.169422 * rawValue);
  soilMoisture = 100.0 * (0.0000045 * Math.pow(soilMoisture, 3.0) - 0.00055 * Math.pow(soilMoisture, 2.0) + 0.0292 * soilMoisture - 0.053);
  if (soilMoisture < 0.0) {
    soilMoisture = 0.0;
  } else if (soilMoisture > 60.0) {
    soilMoisture = 60.0;
  }
  return soilMoisture;
};

function getStartupTime (data) {
  var startupTime = data.readUInt32LE(0) * 1.0;
  return startupTime; 
};

function ledOn (callback) {
  this.writeDataCharacteristic(LIVE_SERVICE_UUID, LED_UUID, new Buffer([0x01]), callback);
};

function ledOff (callback) {
  this.writeDataCharacteristic(LIVE_SERVICE_UUID, LED_UUID, new Buffer([0x00]), callback);
};

function execute(command, callback){
    child(command, function(error, stdout, stderr){ 
      if (error) {
        logger.error('error:',error);
        callback(error);
      }
      logger.warn('stderr:',stderr);
      logger.info('stdout:', stdout); 
      callback(stdout);
    });
}

function reverse () {
  logger.info('reverseSSH...');
  async.series ([
    function(callback){
      reverseSSH = false;
      updateBTSConfig();
      callback();
    },
    function(){
      logger.error('Setting up reverseSSH...')
      setTimeout(function(){
        exec('sudo -u growr ssh -f -v -T -N -R 13200:localhost:22 grow@ezgrowr.com -o StrictHostKeyChecking=no',{async:true}).code;
      }, 2500);
    }
  ]);
}


function closeSSH () {
  logger.info('close tunnel...');
  async.series ([
    function(callback){
      closeTunnel = false;
      updateBTSConfig();
      callback();
    },
    function(){
      logger.error('Closing tunnel...')
      setTimeout(function(){
        exec('sudo kill $(pidof ssh)').code;  
      }, 1500);
    }
  ]);
}



function reboot () {
  logger.info('rebootBB...');
  async.series ([
    function(callback){
      rebootBB = false;
      updateBTSConfig();
      callback();
    },
    function(){
      logger.error('Rebooting...')
      setTimeout(function(){
        execute('shutdown -r now');
      }, 1500);

    }
  ]);
}


function restart () {
  logger.info('restartApp ...');
  async.series ([
    function(callback){
      restartApp=false;
      updateBTSConfig();
      callback()
    },
    function(){
      logger.error('Restarting...')
      setTimeout(function(){
        process.exit(0);
        callback();
      }, 1500);
    }
  ]);
}

function upgrade () {
  logger.info('upgrade fw ...');
  async.series ([
    function(callback){
      upgradeFW=false;
      updateBTSConfig();
      callback()
    },
    function(callback){
      logger.error('Upgrading FW ...')
      setTimeout(function(){
        exec('sudo -u growr git pull',function(code,output){ logger.error(code);logger.warn(output);});
        callback();  
      }, 1000);
    },
    function(callback){
      logger.error('Copying upstart and logrotate conf files ...')
      setTimeout(function(){
        exec('sudo cp /home/growr/bts/bts.conf /etc/init/bts.conf',function(code,output){ logger.error(code);logger.warn(output);});
        exec('sudo cp /home/growr/bts/btsLogrotate /etc/logrotate.d/btsLogrotate',function(code,output){ logger.error(code);logger.warn(output);});
        exec('cp /home/growr/bts/private/privateKey /home/growr/.ssh/id_rsa',function(code,output){ logger.error(code);logger.warn(output);});
        exec('cp /home/growr/bts/private/publicKey /home/growr/.ssh/id_rsa.pub',function(code,output){ logger.error(code);logger.warn(output);});
        callback();
      }, 2000);
    },
    function(callback){
      logger.error('Reload UpStart ...')
      setTimeout(function(){
        exec('sudo initctl -v reload-configuration ',function(code,output){ logger.error(code);logger.warn(output);});  
        callback();
      }, 1000);
    },
    function(){
      logger.error('Reload logrotate ...')
      setTimeout(function(){
        exec('sudo -u growr logrotate -df /etc/logrotate.d/btsLogrotate',function(code,output){ logger.error(code);logger.warn(output);});  
      }, 1000);
    }
  ]);
}

function getSerialNumber() {
  logger.info('getSerialNumber ...');
  execute('sudo ./btsSerialNumber.sh', function(callback){
    btsID = callback;
    logger.warn('btsID = ',btsID);
    // btsID='4414BBBK0072'
  });
}




