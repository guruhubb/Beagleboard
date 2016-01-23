//
// BTS code to test connectivity to SK cloud
// ddp connect to cloud
// 


var ejson = require('ejson');
var DDPClient = require('ddp');
var async = require('async');

console.log('Testing....')
var btsSensorList=[];


// ddp call

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; //need this to prevent "unable to verify leaf signature" 


// var ddpclient = new DDPClient({
//   host : "ezgrowr.com",
//   port : 3010,
//   ssl  : true,
//   autoReconnect : true,
//   autoReconnectTimer : 500,
//   maintainCollections : true,
//   ddpVersion : '1',  // ['1', 'pre2', 'pre1'] available
//   useSockJs: true
// });
var ddpclient = new DDPClient({
  // host : "ezgrowr.com",
  // port : 3010,  //443
  autoReconnect : true,
  autoReconnectTimer : 500,
  maintainCollections : true,
  ddpVersion : '1',  // ['1', 'pre2', 'pre1'] available
  url: 'wss://ezgrowr.com/websocket'
});
// bts and sensor serial number
var btsID = '4414BBBK0072';  
var sensorID ='a0143d0c6007';

//Connect to the Meteor Server
ddpclient.connect(function(error) {
  if (error) {
    console.log('DDP connection error!',error);
    return;
  }
  console.log('connected!');


  //Subscribe to a Meteor Collection
  ddpclient.subscribe(                 // name of Meteor Publish function to subscribe to
    'BaseStationSensors',
    [btsID],                       // any parameters used by the Publish function
    function (result) {             // callback when the subscription is complete
    }
  );

//   //plant data to be pushed to Cloud; 
//   var plantData = {sn:sensorID, sT:25, aT:26, sEC:0.01, rssi:88, txP:0, bL:88, sL:1.0,sM:0.0,mD:Date.now()};

//   //call cloud methods to push data
//   ddpclient.call( 
//     'resetBTSConfig',             // name of Meteor Method being called
//     [btsID],             // parameters to send to Meteor Method
//     function (err, result) {   // callback which returns the method call results
//       console.log('called resetBTSConfig: ', result, ' err: ', JSON.stringify(err) );
//     },
//     function () {              // callback which fires when server has finished
//       console.log('done resetBTSConfig');  // sending any updated documents as a result of
//     }
//   );
//   ddpclient.call(
//     'resetSensorLED',             // name of Meteor Method being called
//     [sensorID],             // parameters to send to Meteor Method
//     function (err, result) {   // callback which returns the method call results
//       console.log('called resetSensorLED: ', result, ' err: ', JSON.stringify(err) );
//     },
//     function () {              // callback which fires when server has finished
//       console.log('done resetSensorLED');  // sending any updated documents as a result of
//     }
//   );
//   ddpclient.call(
//     'addPlantData',             // name of Meteor Method being called
//     [plantData],             // parameters to send to Meteor Method
//     function (err, result) {   // callback which returns the method call results
//       console.log('called addPlantData: ', result, ' err: ', JSON.stringify(err) );
//     },
//     function () {              // callback which fires when server has finished
//       console.log('done addPlantdata');  // sending any updated documents as a result of
//     }
//   );
});



ddpclient.on('message', function (msg) {
        var bts = ddpclient.collections["base-stations"];
      var sensor = ddpclient.collections.sensors;
  msg = ejson.parse(msg);
  console.log('msg:',msg);
  if(msg["msg"] === "changed"){
    console.log("changed");
    if(msg["collection"] === "base-stations"){
      // console.log('fields:',msg["fields"]); 
      // console.log('btsSerialNo:',msg["fields"]["serialNo"]);
          console.log('maxLedOn =', bts[msg["id"]]["maxLedOnTime"]);
          console.log('scanTime = ', bts[msg["id"]]["scanTime"]);
          console.log('upgradeFW = ',bts[msg["id"]]["upgradeFW"]);
          // rebootBB = collection[msg["id"]]["rebootBB"];
          // restartApp = collection[msg["id"]]["restartApp"];
          // reverseSSH = collection[msg["id"]]["reverseSSH"];
          // closeTunnel = collection[msg["id"]]["closeTunnel"];
          // blinkInterval = collection[msg["id"]]["blinkInterval"];
      // console.log('upgradeFW:',msg["fields"]["upgradeFW"]);
      // console.log('scanTime:',msg["fields"]["scanTime"]);
      // console.log('rebootBB:',msg["fields"]["rebootBB"]);
      // console.log('restartApp:',msg["fields"]["restartApp"]);
      // console.log('maxLedOnTime:',msg["fields"]["maxLedOnTime"]);
      // console.log('blinkInterval:',msg["fields"]["blinkInterval"]);
      // console.log('closeTunnel:',msg["fields"]["closeTunnel"]);
      // console.log('reverseSSH:',msg["fields"]["reverseSSH"]);
    }
    if(msg["collection"] === "sensors"){
         console.log('ledStatus = ', sensor[msg["id"]]["ledStatus"]);

      // console.log('fields:',msg["fields"]);
      // console.log('sensorSerialNo:',msg["fields"]["serialNo"]);
      // console.log('ledStatus:',msg["fields"]["ledStatus"]);
    }
  }
  if (msg["msg"] === "added") {
    console.log("added");
    if(msg["collection"] === "base-stations"){
              // btsSensorList = Object.keys(btsSensorListObjects);

          console.log('maxLedOn =', bts[msg["id"]]["maxLedOnTime"]);
          console.log('scanTime = ', bts[msg["id"]]["scanTime"]);
          console.log('upgradeFW = ',bts[msg["id"]]["upgradeFW"]);
      // console.log('fields:',msg["fields"]);
      // console.log('btsSerialNo:',msg["fields"]["serialNo"]);
      // console.log('upgradeFW:',msg["fields"]["upgradeFW"]);
      // console.log('scanTime:',msg["fields"]["scanTime"]);
      // console.log('rebootBB:',msg["fields"]["rebootBB"]);
      // console.log('restartApp:',msg["fields"]["restartApp"]);
      // console.log('maxLedOnTime:',msg["fields"]["maxLedOnTime"]);
      // console.log('blinkInterval:',msg["fields"]["blinkInterval"]);
      // console.log('closeTunnel:',msg["fields"]["closeTunnel"]);
      // console.log('reverseSSH:',msg["fields"]["reverseSSH"]);
    }
    if(msg["collection"] === "sensors"){
      btsSensorList[msg["id"]]=sensor[msg["id"]]["serialNo"];
      console.log("btsSensorList:", btsSensorList);
      console.log('ledStatus = ', sensor[msg["id"]]["ledStatus"]);

      // console.log('sensorSerialNo:',msg["fields"]["serialNo"]);
      // console.log('ledStatus:',msg["fields"]["ledStatus"]);  //get only led data
    }
  }
  if (msg["msg"] === "removed"){
    console.log("removed");
    
    if(msg["collection"] === "sensors"){
      delete btsSensorList[msg["id"]];
      btsSensorList.splice( btsSensorList.indexOf(msg["id"]), 1 );
      console.log("btsSensorList:", btsSensorList);
    }
  }
});
