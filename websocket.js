'use strict';

const crypto = require('crypto');
const net = require('net');

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


function declareEnum(fn, members) {
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const instance = new fn();
    Object.defineProperty(fn, member, { value: instance, enumerable: true });
    Object.defineProperty(fn, i, { value: instance, enumerable: true });
    Object.defineProperty(fn.prototype, member, { value: instance, enumerable: true });
    Object.defineProperties(instance, {
      'name': { value: member, enumerable: true },
      'ordinal': { value: i, enumerable: true },
    });
  }
  Object.defineProperty(fn.prototype, 'toString', { value: function() {
    return this.name;
  }});
}

class OpCode {};
declareEnum(OpCode, [
  'CONTINUATION',
  'TEXT',
  'BINARY',
  'RESERVED_3',
  'RESERVED_4',
  'RESERVED_5',
  'RESERVED_6',
  'RESERVED_7',
  'CONNECTION_CLOSE',
  'PING',
  'PONG',
  'RESERVED_11',
  'RESERVED_12',
  'RESERVED_13',
  'RESERVED_14',
  'RESERVED_15'
]);

module.exports.OpCode = OpCode;

class BufferedReader {
  constructor() {
    this._buffers = [];
  }

  appendData (buffer) {
    this._buffers.push(buffer);
  }

  dumpBuffers () {
    return this._buffers.splice(0, Infinity);
  }

  getNextLine () {
    const CR = 0x0d;
    const LF = 0x0a;

    for (let i = 0; i < this._buffers.length; i++) {
      for (let offset = 0; offset < this._buffers[i].length; offset++) {
        if (this._buffers[i][offset] === LF) {
          let ret = this._buffers.slice(0, i)
            .map(buffer => buffer.toString('utf8'))
            .concat(this._buffers[i].toString('utf8', 0, offset + 1))
            .reduce((a,b) => a + b);

          this._buffers[i] = this._buffers[i].slice(offset + 1);
          this._buffers = this._buffers.slice(i);

          return ret;
        }
      }
    }

    // else
    return null;
  }

  get lineIterator() {
    let that = this;
    let ret = {};
    ret[Symbol.iterator] = () => ({
      next: () => {
        let line = that.getNextLine();
        return (line === null) ?
          { done: true } :
          { done: false, value: line };
      }
    });
    return ret;
  }
}

class BufferByteIterator {
  constructor (buffers) {
    this.buffers = buffers;

    // Buffer and byte offset of cursor
    this.buffer_i = 0;
    this.offset = 0;
  }

  // Returns the next byte in the series of buffers
  // If there's nothing left, throws this.END. (Exceptions are used instead
  // of return values so the value doesn't need to be checked every time
  // the function is used)
  next () {
    // Wrap cursor to the beginning of the next non-empty buffer if at the
    // end of the current buffer
    while (this.buffer_i < this.buffers.length &&
           this.offset >= this.buffers[this.buffer_i].length) {
      this.offset = 0;
      this.buffer_i ++;
    }

    if (this.buffer_i < this.buffers.length) {
      let byte = this.buffers[this.buffer_i][this.offset];

      // Advance cursor
      this.offset++;
      return byte;
    }
    else {
      throw this.END_OF_DATA;
    }
  }

  popToCursor () {
    this.buffers[this.buffer_i] = this.buffers[this.buffer_i].slice(this.offset);
    this.buffers.splice(0, this.buffer_i);

    // Reset cursor
    this.buffer_i = 0;
    this.offset = 0;
  }
}
Object.defineProperty(BufferByteIterator.prototype, 'END_OF_DATA', {
  value: Symbol('END_OF_DATA')
});

class WSBufferedReader {
  constructor() {
    const that = this;

    this._buffers = [];
    this._frames = [];

    this[Symbol.iterator] = () => ({
      next: () => {
        let message = that.getNextMessage();
        if (message === null) {
          return { done: true };
        } else {
          return { done: false, value: message };
        }
      }
    });
  }

  appendData (buffers) {
    if (buffers instanceof Array) {
      Array.prototype.push.apply(this._buffers, buffers);
    } else {
      this._buffers.push(buffers);
    }

    let frame;
    while ((frame = this.getNextFrame()) !== null) {
      this._frames.push(frame);
    }
  }

  getNextFrame () {
    const itr = new BufferByteIterator(this._buffers);

    try {
      const frame = {};
      let byte;

      byte = itr.next();
      frame.fin           = !!(byte & 0b10000000);
      frame.rsv1          = !!(byte & 0b01000000);
      frame.rsv2          = !!(byte & 0b00100000);
      frame.rsv3          = !!(byte & 0b00010000);
      frame.opcode        = OpCode[byte & 0b00001111];

      byte = itr.next();
      frame.masked        = !!(byte & 0b10000000);
      frame.payloadLen    =    byte & 0b01111111;

      if (frame.payloadLen === 126) {
        frame.payloadLen = itr.next() << 8 | itr.next();
      }
      else if (frame.payloadLen === 127) {
        frame.payloadLen =
          itr.next() << 56 | itr.next() << 48 | itr.next() << 40 | itr.next() << 32 |
          itr.next() << 24 | itr.next() << 16 | itr.next() <<  8 | itr.next();
      }

      frame.payload = new Buffer(frame.payloadLen);

      if (frame.masked) {
        const mask = new Uint8Array([ itr.next(), itr.next(), itr.next(), itr.next() ]);
   
        for (let i = 0; i < frame.payloadLen; i++) {
          frame.payload[i] = itr.next() ^ mask[i & 0b11];
        }
      }
      else {
        for (let i = 0; i < frame.payloadLen; i++) {
          frame.payload[i] = itr.next();
        }
      }

      itr.popToCursor();

      logTraffic(frame);
      return frame;
    } catch (e) {
      if (e === itr.END_OF_DATA) {
        return null;
      } else {
        throw e;
      }
    }
  }

  getNextMessage () {
    for (let i = 0; i < this._frames.length; i++) {
      if (this._frames[i].fin) {
        let message = this._frames.slice(0, i + 1)
          .map(
            (this._frames[0].opcode === OpCode.TEXT) ?
              frame => frame.payload.toString('utf8') :
              frame => frame.payload
          )
          .reduce((f1, f2) => f1.concat(f2));

        this._frames.splice(0, i + 1);
        return message; 
      }
    }
    // else
    return null;
  }
}

function websocketSecureResponse(key) {
  const RESPONSE_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + RESPONSE_GUID, 'ascii');
  return sha1.digest('base64');
}

function sendAck(conn, incomingHeaders) {
  conn.write('HTTP/1.1 101 Switching Protocols\n');
  conn.write('Upgrade: websocket\n');
  conn.write('Connection: Upgrade\n');

  if (incomingHeaders.has('Sec-WebSocket-Key')) {
    let response = websocketSecureResponse(incomingHeaders.get('Sec-WebSocket-Key'));
    logTraffic('Response key is ' + response);
    conn.write('Sec-WebSocket-Accept: ' + response + '\n');
  }

  conn.write('\n');
}

function writeWSFrame(conn, payload, opts) {
  let opCode;

  if (typeof payload === 'string') {
    payload = new Buffer(payload);
    opCode = opts && 'opCode' in opts ? opts.opcode : OpCode.TEXT;
  } else if (payload instanceof Buffer) {
    // no need to convert
    opCode = opts && 'opCode' in opts ? opts.opcode : OpCode.BINARY;
  } else {
    throw Error('Not sure how to handle payload of type ' + payload);
  }

  if (typeof opCode !== 'number') {
    opCode = opCode.ordinal;
  }

  const payloadHeaderLength =
    (payload.length >= 2 << 16) ? 10 :
    (payload.length >= 126) ? 4 :
    2;

  const header = new Buffer(payloadHeaderLength);
  header[0] = 0b10000000 | (opCode & 0b00001111);

  if (payload.length >= 2 << 16) {
    header[1] = 127;
    header[2] = payload.length >> 56;
    header[3] = (payload.length >> 48) & 0xff;
    header[4] = (payload.length >> 40) & 0xff;
    header[5] = (payload.length >> 32) & 0xff;
    header[6] = (payload.length >> 24) & 0xff;
    header[7] = (payload.length >> 16) & 0xff;
    header[8] = (payload.length >> 8) & 0xff;
    header[9] = payload.length & 0xff;
  }
  else if (payload.length >= 126) {
    header[1] = 126;
    header[2] = payload.length >> 8;
    header[3] = payload.length & 0xff;
  }
  else {
    header[1] = payload.length;
  }

  conn.write(header);
  conn.write(payload);
}

////////////////////////////////////////////////////////////////////////////////

module.exports.createServer = function(callback) {
  return net.createServer(conn => {
    // GET / HTTP/1.1
    // Host: 127.0.0.1:8080
    // Connection: Upgrade
    // Pragma: no-cache
    // Cache-Control: no-cache
    // Upgrade: websocket
    // Origin: http://localhost:8000
    // Sec-WebSocket-Version: 13
    // DNT: 1
    // User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.134 Safari/537.36
    // Accept-Encoding: gzip, deflate, sdch
    // Accept-Language: en-US,en;q=0.8
    // Sec-WebSocket-Key: S+w5xLaB43ihnN68ybtHLQ==
    // Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits

    logTraffic('client connected from ' + conn.remoteAddress);

    let secureResponse;
    let textMode = true;
    let continuation = '';

    const incomingHeaders = new Map();

    const bufferedReader = new BufferedReader();
    const wsBufferedReader = new WSBufferedReader();

    conn.on('data', data => {
      if (textMode) {
        bufferedReader.appendData(data);

        for (let line of bufferedReader.lineIterator) {
          line = line.trim();

          logTraffic('> ' + line);

          let match;
          if ((match = line.match(/^GET\s+(\S+)\s+HTTP\/1\../))) {
            conn.url = match[1];
          }
          else if ((match = line.match(/^([^:]+):(.+)/i))) {
            incomingHeaders.set(match[1].trim(), match[2].trim());
          }
          else if (line === '') {
            sendAck(conn, incomingHeaders);
            textMode = false;

            callback(conn);

            wsBufferedReader.appendData(bufferedReader.dumpBuffers());

            for (let message of wsBufferedReader) {
              conn.emit('message', message);
            }
          }
        }
      }
      else {
        wsBufferedReader.appendData(data);

        for (let message of wsBufferedReader) {
          conn.emit('message', message);
        }
      }

      //conn.end();
    });

    conn.on('error', error => logTraffic(error));

    conn.on('close', errorOcurred => {
      logTraffic('Client ' + conn.remoteAddress + ' disconnected ' +
        (errorOcurred ? 'with an error' : 'peacefully'));
    });

    conn.sendMessage = message => writeWSFrame(conn, message);
  });
};



