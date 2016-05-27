// btsGM.js
// saswata basu, 2015
// 
// this file reads from Guy's base which can be connected to several nodes
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

// initialize port and open it to receive data
var macPort = '/dev/cu.usbserial-AI041TNY';
var beaglePort = '/dev/ttyUSB0';
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var port = new SerialPort(beaglePort, {  //change to beaglePort for a beagle
  baudrate: 115200,
  parser: serialport.parsers.readline('\n')
});
var seqNumber;

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
var maxExploreTime = 10000;
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
var connected = false;
var counter = 0;
var alreadyScanned=0;
var index = 0;
var start = Math.floor(Date.now() / 1000);
var stop;
var btsID;
var networkOn;
var btsID = '4414BBBK0072';  //this should be serial number of bbb
var sensorID = 'S001';



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
  logger.error('restarting dbus ...')
  setTimeout(function(){
    exec('sudo service dbus restart',function(code,output){ logger.error(code);logger.warn(output);});
  }, 1000);
}).on('offline', function() {
  logger.error('------------ offline! -------------', networkOn);
});


//send data to cloud as soon as you receive it

port.on('data', function (data) {
  logger.debug('Data: ' + data);
  var str = data.toString();
  if (str.charAt(0) === "{") {
    var replace = str.replace(/(\w+)=/ig,'"$1":');
    var json = replace.replace(/:(\w+)([,\}])/g,':"$1"$2')
    var obj = JSON.parse(json);
    var sensorData={}
    // check if sequence number is in sequence
    if (seqNumber != obj["seq"]-1){
      logger.error ('Out of sequence')
    }
    seqNumber = obj["seq"]
    logger.debug("object:", obj);
    convertObjToSensorData(sensorData,obj);
    addPlantData(sensorData);
  }
  // else {
  //   logger.debug ('data ignored');
  // }
});

function convertObjToSensorData(sensorData,obj){
  sensorData["sn"]=btsSensorList[0]
  // sensorData["seq"]=obj["seq"]
  sensorData["sT"]= 1.2
  sensorData["aT"]= 2.3
  sensorData["sM"] = 10.2
  sensorData["sL"] = 2.5
  sensorData["sEC"] = 3.4
  sensorData["mD"] = 14560 
  sensorData["t"] = Date.now() / 1000 
  sensorData["led"] = 1
  sensorData["rssi"] = -80
  sensorData["txP"] = 2
  sensorData["bL"] = obj['seq']
  logger.info('sensorData:',sensorData);
}


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
  url: 'wss://ezgrowr.com:3010/websocket/'
});

//Log all messages if a "changed" or "added" message is received and then update the sensor lists and parameters
ddpclient.on('message', function (msg) {
  logger.warn("ddp message: " + msg);
  var bts = ddpclient.collections["base-stations"];
  var sensor = ddpclient.collections.sensors;
  msg = ejson.parse(msg);
  if (msg["msg"] === "changed") {
    logger.error("ooooo changed ooooo");
    if(msg["collection"] === "base-stations"){
      async.series([
        function(callback){
          if (bts[msg["id"]]["maxLedOnTime"])
            maxLedOn = bts[msg["id"]]["maxLedOnTime"]
          if (bts[msg["id"]]["scanTime"])
            scanTime = bts[msg["id"]]["scanTime"];
          if (bts[msg["id"]]["minReadInterval"])
            minReadInterval = bts[msg["id"]]["minReadInterval"];
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
    if(msg["collection"] === "base-stations"){
      async.series([
        function(callback){
          if (bts[msg["id"]]["maxLedOnTime"])
            maxLedOn = bts[msg["id"]]["maxLedOnTime"]
          if (bts[msg["id"]]["scanTime"])
            scanTime = bts[msg["id"]]["scanTime"];
          if (bts[msg["id"]]["minReadInterval"])
            minReadInterval = bts[msg["id"]]["minReadInterval"];
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

ddpclient.on('socket-close', function(code, message) {
  logger.error("DDP SOCKET Close: code - ", code," message - ", message);
});

connect();


function connect(){
  async.series([
    function(callback){
      if (!btsID) getSerialNumber();
      callback();
    },
    function(callback){
      ddpclient.connect(function(error, wasReconnect) {
        if (error) {
          logger.error('error: DDP connection error!',error);
          setTimeout(function(){ 
            noble.stopScanning();
            logger.info('Stopping scan and restarting app');
            restart();
          }, 2000);
          return;
        } 
        logger.info('connected!');
        if (wasReconnect) {
          logger.info('Reestablishment of a connection');
          restart();
        } 


        //Subscribe to a Meteor Collection

        ddpclient.subscribe(                 // name of Meteor Publish function to subscribe to
          'BaseStationSensors',
          [btsID],                       // any parameters used by the Publish function
          function (error) {             // callback when the subscription is complete
            if (error){
              logger.error('Error9 bts collection subscription error: ', error);
            }
          }
        );
        callback();
      });
    }
  ])
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
          // process.exit(0);
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
        }
      },
      function () {                 // fires when server has finished
        logger.debug('done resetBTSConfig');  
      }
    );
  }
}

// send plant data to cloud
function addPlantData(sensorData){
  if (networkOn){
    logger.info('inside addPlantdata')
    ddpclient.call(
      'addPlantData',            // name of Meteor Method being called
      [sensorData],              // parameters to send to Meteor Method
      function (err, result) {   // callback which returns the method call results
        logger.debug('called addPlantdata: ', result);
        if (err){
          logger.error('Error4 - DDP upload data error: ',err);  
        }
      },
      function () {              // fires when server has finished
        logger.debug('updated');  
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
    function(callback){
      logger.error('Setting up reverseSSH...')
      setTimeout(function(){
        exec('sudo -u growr ssh -f -v -T -N -R 13200:localhost:22 grow@ezgrowr.com -o StrictHostKeyChecking=no',{async:true}).code;
        callback();
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
    function(callback){
      logger.error('Closing tunnel...')
      setTimeout(function(){
        exec('sudo kill $(pidof ssh)').code;  
        callback();
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
    function(callback){
      logger.error('Rebooting...')
      setTimeout(function(){
        exec('shutdown -r now').code;
        callback();
      }, 1500);
    }
  ]);
}


function restart () {
  logger.info('restartApp ...');
  async.series ([
    function(callback){
      restartApp = false;
      updateBTSConfig();
      callback()
    },
    function(callback){
      logger.error('restarting dbus ...')
      setTimeout(function(){
        exec('sudo service dbus restart',function(code,output){ logger.error(code);logger.warn(output);});
        callback();
      }, 100);
    },
    function(callback){
      logger.error('resetting hci ...')
      setTimeout(function(){
        exec('sudo hciconfig hci0 reset',function(code,output){ logger.error(code);logger.warn(output);});
        callback();  
      }, 100);
    },
    function(callback){
      logger.error('Restarting...')
      setTimeout(function(){
        process.exit(0);
        callback();
      }, 100);
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
        exec('sudo -u growr git pull origin master',function(code,output){ logger.error(code);logger.warn(output);});
        callback();  
      }, 1000);
    },
    function(callback){
      logger.error('Copying upstart and logrotate conf files ...')
      setTimeout(function(){
        exec('cd ~/bts/node_modules/',function(code,output){ logger.error(code);logger.warn(output);});
        exec('sudo npm update',function(code,output){ logger.error(code);logger.warn(output);});
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
    function(callback){
      logger.error('Reload logrotate ...')
      setTimeout(function(){
        exec('sudo -u growr logrotate -df /etc/logrotate.d/btsLogrotate',function(code,output){ logger.error(code);logger.warn(output);});  
        callback();
      }, 1000);
    }
  ]);
}

function getSerialNumber() {
  logger.info('getSerialNumber ...');
  exec('sudo ./btsSerialNumber.sh',function(code,output){ btsID = output;logger.error(code);logger.warn(output);logger.warn('btsID = ',btsID);});  
}




