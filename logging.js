function getCallerInfo() {
  const stackStrings = (new Error()).stack.split('\n');
  const callerInfo = stackStrings[3];
  const parsed = callerInfo.match(/^\s+at (?:.*\()?(.+):(\d+):(\d+)\)?$/);
  return {
    filename: parsed[1],
    line: parsed[2],
    column: parsed[3],
  }
}

function logTraffic() {
  const callerInfo = getCallerInfo();
  const callerString = callerInfo.filename + ':' + callerInfo.line;
  const argsArray = [].slice.apply(arguments);
  console.log.apply(console, [callerString].concat(argsArray));
}

function trace(message) {
  const callerInfo = getCallerInfo();
  const callerString = callerInfo.filename + ':' + callerInfo.line;
  console.log(callerString + (message ? ' ' + message : ''));
}

module.exports = {
  getCallerInfo: getCallerInfo,
  logTraffic: logTraffic,
  trace: trace
}