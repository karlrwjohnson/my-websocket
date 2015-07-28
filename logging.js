'use strict';

const path = require('path');

const Enum = require('./enum');
const Colors = require('./colors');

class LogLevel extends Enum {
  constructor(name, color) {
    super(name);

    this._color = color;
  }

  get color () { return this._color; }
}

LogLevel.values([
  ['TRACE', Colors.LIGHT_CYAN],
  ['DEBUG', Colors.YELLOW],
  ['INFO', Colors.LIGHT_BLUE],
  ['ERROR', Colors.LIGHT_RED],
]);

function getCallerInfo(height) {
  height = (height === undefined) ? 2 : height;
  const stackStrings = (new Error()).stack.split('\n');
  const callerInfo = stackStrings[1 + height];
  const parsed = callerInfo.match(/^\s+at (.+) \((.+):(\d+):(\d+)\)$/);
  return {
    fn: parsed[1],
    filename: parsed[2],
    line: parsed[3],
    column: parsed[4],
  }
}

function log(level, message) {
  const callerInfo = getCallerInfo(3);
  const callerString = level.color.ansi + level.name + ':' +
    path.basename(callerInfo.filename) + ':' +
    callerInfo.line + ':' + callerInfo.fn + ':' + Colors.RESET.ansi;
  console.log(callerString + (message ? ' ' + message : ''));
}

function logTraffic() {
  const callerInfo = getCallerInfo();
  const callerString = callerInfo.filename + ':' + callerInfo.line;
  const argsArray = [].slice.apply(arguments);
  console.log.apply(console, [callerString].concat(argsArray));
}

function trace(message) {
  if (message === undefined) {
    message = '--';
  }
  log(LogLevel.TRACE, message);
}

function debug(message) {
  log(LogLevel.DEBUG, message);
}


function info(message) {
  log(LogLevel.INFO, message);
}

function error(message) {
  log(LogLevel.ERROR, message);
}

module.exports = {
  getCallerInfo: getCallerInfo,
  logTraffic: logTraffic,
  trace: trace,
  debug: debug,
  info: info,
  error: error,
}