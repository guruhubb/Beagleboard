//
// BaseStation code
// 
// 
// ddp connect to cloud
// first time - send serial number to get a key
// log in with key
// 
// 
// 

var ejson = require('ejson');
var DDPClient = require('ddp');
var async = require('async');
var serialNumber = require('serial-number');

console.log('Testing....')
var btsSensorList=[];

// get serial number of bbb

serialNumber.preferUUID = true;
serialNumber(function (err, value) {
    console.log('serial number is: ',value);
    return value;
});

// ddp call

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; //need this to prevent "unable to verify leaf signature" 

// use this to talk to cloud on your local machine
// var ddpclient = new DDPClient({
//   host : "localhost",
//   port : 3000,
//   path : "websocket",
//   ssl  : false,
//   autoReconnect : true,
//   autoReconnectTimer : 500,
//   maintainCollections : true,
//   ddpVersion : '1'  // ['1', 'pre2', 'pre1'] available
// });


var ddpclient = new DDPClient({
  host : "ezgrowr.com",
  port : 443,
  ssl  : true,
  // Use a full url instead of a set of `host`, `port` and `ssl`
  // do not set `useSockJs` option if `url` is used
  // url: 'wss://ezgrowr.com/websocket'
  autoReconnect : true,
  autoReconnectTimer : 500,
  maintainCollections : true,
  ddpVersion : '1',  // ['1', 'pre2', 'pre1'] available
  // path:websocket,
  // uses the SockJs protocol to create the connection
  // this still uses websockets, but allows to get the benefits
  // from projects like meteorhacks:cluster
  // (for load balancing and service discovery)
  // do not use `path` option when you are using useSockJs
  useSockJs: true
});

var number = '2414BBBK2433';  //this should be serial number

//Connect to the Meteor Server
ddpclient.connect(function(error) {
  if (error) {
    console.log('DDP connection error!',error);
    return;
  }
  console.log('connected!');



  //Subscribe to a Meteor Collection
  ddpclient.subscribe(                 // name of Meteor Publish function to subscribe to
    'bts',
    [number],                       // any parameters used by the Publish function
    function (result) {             // callback when the subscription is complete
      // resultParsed = ejson.parse(result);
      console.log('result is: ', result, 'bts collection: ', ddpclient.collections.bts);
     
      for (obj in ddpclient.collections.bts){
        console.log(obj);
        console.log('id:',ddpclient.collections.bts[obj]._id,' btsID: ', ddpclient.collections.bts[obj].btsID);
        btsSensorListObjects = ddpclient.collections.bts[obj].sensorList;
        console.log('subscribed btsSensorListObjects: ',btsSensorListObjects);
      }

      btsSensorList = Object.keys(btsSensorListObjects);
      console.log('subscribed btsSensorList: ',btsSensorList);
    }
  );
  
     // * Call a Meteor Method
     

  // ddpclient.call(
  //     'sensorList',             // name of Meteor Method being called
  //     [number],            // parameters to send to Meteor Method
  //     function (err, result) {   // callback which returns the method call results
  //       // number = result._id;
  //       console.log('called function, sensor list is ' + JSON.stringify(result));
  //     },
  //     function () {              // callback which fires when server has finished
  //       console.log('updated');  // sending any updated documents as a result of
  //       // console.log(ddpclient.collections.posts);  // calling this method
  //       // console.log(result);
  //     }
  //   );



  async.series([
  function(callback) { //This is the first task, and callback is its callback task
    var data = {sn: 1290, sL: 70, sT:24, aT:26, bL:89, sM:85, sEC: 0.3, led:true}
    data.t = 1442942151;
    data.mD = Math.floor( Date.now() / 1000 ) - 50000
    ddpclient.call(
      'addPlantData',             // name of Meteor Method being called
      [data],            // parameters to send to Meteor Method
      function (err, result) {   // callback which returns the method call results
        console.log('called addPlantdata: ', result, ' err: ', err );
      },
      function () {              // callback which fires when server has finished
        console.log('updated');  // sending any updated documents as a result of
      }
    );
          //Now we have saved to the DB, so let's tell async that this task is done
          callback();
  },
  function(callback) { //This is the second task, and callback is its callback task
    var data = {sn: 120, sL: 7, sT:2, aT:2, bL:8, sM:8, sEC: 0.36, led:false}
    data.t = 1442942150;
    data.mD = Math.floor( Date.now() / 1000 ) - 50000
    ddpclient.call(
      'addPlantData',             // name of Meteor Method being called
      [data],             // parameters to send to Meteor Method
      function (err, result) {   // callback which returns the method call results
        console.log('called addPlantdata: ', result, ' err: ', JSON.stringify(err) );
      },
      function () {              // callback which fires when server has finished
        console.log('updated');  // sending any updated documents as a result of
      }
    );
    callback();
  }
  ], function(err) { //This is the final callback
      console.log('Both jobs are done now');
  });


});

//test code to call method and add data by connecting outside the connect 
// ddpclient.connect(function(error) {
//   if (error) {
//     console.log('DDP connection error!');
//     return;
//   }
//   console.log('connected!');

//   var data = {sn: 1290, sL: 70, sT:24, aT:26, bL:89, sM:85, sEC: 0.3, led:true}
//   data.t = 1442942159;
//   data.mD = Math.floor( Date.now() / 1000 ) - 50000
//   ddpclient.call(
//     'addPlantData',             // name of Meteor Method being called
//     [data],            // parameters to send to Meteor Method
//     function (err, result) {   // callback which returns the method call results
//       console.log('called addPlantdata: ', result, ' err: ', err );
//     },
//     function () {              // callback which fires when server has finished
//       console.log('updated');  // sending any updated documents as a result of
//     }
//   );
// });
//Log all messages if a "changed" message is received and then change the btsSensorList

// ddpclient.on('message', function (msg) {
//   console.log("ddp message: " + msg);
//   msgParsed = ejson.parse(msg);
//   // msgParsed = JSON.stringify(msg);

//   if(msgParsed["msg"] === "changed"){
//     console.log("Change message for:" + JSON.stringify(ddpclient.collections.bts[msgParsed["id"]]["sensorList"]));
//     console.log('ddpclient.on ',number, ' id is',ddpclient.collections.bts[msgParsed["id"]]);
//     console.log('btsID is ',ddpclient.collections.bts[msgParsed["id"]]["btsID"]);
//     console.log('number is ',number);
//     if(ddpclient.collections.bts[msgParsed["id"]]["btsID"]=== number){
//       console.log("updated sensor list" + JSON.stringify(ddpclient.collections.bts[msgParsed["id"]]["sensorList"]));
//     }
//   }
// });

ddpclient.on('message', function (msg) {
  console.log("ddp message: " + msg);
  // var msgParsed = msg;
  msgParsed = ejson.parse(msg);
  // msg = JSON.stringify(msg);

  if(msgParsed["msg"] === "changed"){
    console.log("changed");
    // console.log("Change message for:" + JSON.stringify(ddpclient.collections.bts[msgParsed["id"]]["sensorList"]));
    // console.log('ddpclient.on ',number, ' id is',ddpclient.collections.bts[msgParsed["id"]]);
    // console.log('btsID is ',ddpclient.collections.bts[msgParsed["id"]]["btsID"]);
    // console.log('number is ',number);
    if(ddpclient.collections.bts[msgParsed["id"]]["btsID"]=== number){
      btsSensorListObjects=ddpclient.collections.bts[msgParsed["id"]]["sensorList"];
      console.log('btsSensorListObjects: ',btsSensorListObjects);
      btsSensorList = Object.keys(btsSensorListObjects);
      console.log('btsSensorList: ',btsSensorList);
    }
  }
  if (msgParsed["msg"] === "added") {
    console.log("added");
    if(ddpclient.collections.bts[msgParsed["id"]]["btsID"]=== number){
      btsSensorListObjects=ddpclient.collections.bts[msgParsed["id"]]["sensorList"];
      console.log('btsSensorListObjects: ',btsSensorListObjects);
      btsSensorList = Object.keys(btsSensorListObjects);
      console.log('btsSensorList: ',btsSensorList);
    }
  }
});
