// set up logger
var winston = require('winston');
winston.emitErrs = true;
var logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: 'debug',
      filename: '/var/log/bts.log',
      handleExceptions: true,
      json: false,
      // maxsize: 1000000, //~5MB
      // maxFiles: 1,
      maxsize: 5242880, //5MB
      maxFiles: 20,  //make this 30
      colorize: true,
      timestamp: true
    }),
    new winston.transports.Console({
      level: 'debug',
      humanReadableUnhandledException: true,
      handleExceptions: true,
      json: false,
      colorize: true,
      timestamp: true
      })
  ],
  exitOnError: false
});
module.exports = logger;
module.exports.stream = {
  write: function(message, encoding){
    logger.info(message);
  }
};