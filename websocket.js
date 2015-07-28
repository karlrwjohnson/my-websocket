'use strict';

const crypto = require('crypto');
const net = require('net');

const Enum = require('./enum');
const logging = require('./logging');

const logTraffic = logging.logTraffic;

logging.trace();

class OpCode extends Enum {
  constructor (name) {
    super(name);
  }
  get isControl () {
    return this.ordinal >= 8;
  }
}
OpCode.values([
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

class BufferScanner {
  constructor(bufferScanner) {
    this._buffers = [];

    if (bufferScanner) {
      for (let buffer of bufferScanner.dumpBuffers()) {
        this.addBuffer(buffer);
      }
    }
  }

  addBuffer (buffer) {
    this._buffers.push(buffer);
  }

  dumpBuffers () {
    return this._buffers.splice(0, Infinity);
  }
}
Object.defineProperty(BufferScanner.prototype, Symbol.iterator, {
  // Workaround for io.js not supporting dynamic property names
  get: function() {
    logging.trace();
    return this._iterator;
  }
});

class BufferLineScanner extends BufferScanner {
  constructor(bufferScanner) {
    super(bufferScanner);
  }

  *_iterator() {
    let line;
    while ((line = this.getNextLine()) !== null) {
      logging.trace();
      yield line;
    }
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

class BufferFrameScanner extends BufferScanner {
  constructor(bufferScanner) {
    super(bufferScanner);
  }

  *_iterator() {
    let frame;
    while ((frame = this.getNextFrame()) !== null) {
      yield frame;
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
      }
      else {
        throw e;
      }
    }
  }
}

function getSecureResponse(key) {
  const RESPONSE_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + RESPONSE_GUID, 'ascii');
  return sha1.digest('base64');
}

function generateFrame(payload, opts) {
  let opCode;

  if (typeof payload === 'string') {
    payload = new Buffer(payload);
    opCode = opts && 'opCode' in opts ? opts.opcode : OpCode.TEXT;
  }
  else if (payload instanceof Buffer) {
    // no need to convert
    opCode = opts && 'opCode' in opts ? opts.opcode : OpCode.BINARY;
  }
  else {
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

  return {
    header: header,
    payload: payload
  };
}

////////////////////////////////////////////////////////////////////////////////

class WebSocket {
  constructor (conn, onConnect) {
    this.conn = conn;
    this.onConnect = onConnect;

    this.textMode = true;
    this.incomingHeaders = new Map();
    this.bufferLineScanner = new BufferLineScanner();
    this.bufferFrameScanner = new BufferFrameScanner();
    this.messageFrames = [];

    this._onData = this.onData.bind(this);
    this._onError = this.onError.bind(this);
    this._onClose = this.onClose.bind(this);
    this._sendMessage = this.sendMessage.bind(this);

    this.conn.on('data', this._onData);
    this.conn.on('error', this._onError);
    this.conn.on('close', this._onClose);
    this.conn.sendMessage = this._sendMessage;
  }

  onData (data) {
    if (this.textMode) {
      this.bufferLineScanner.addBuffer(data);

      for (let line of this.bufferLineScanner) {
        this.processLine(line);
      }
    }
    else {
      this.bufferFrameScanner.addBuffer(data);

      for (let frame of this.bufferFrameScanner) {
        this.processFrame(frame);
      }
    }
  }

  onError (error) {
    logTraffic(error);
  }

  onClose (errorOccurred) {
    logTraffic('Client ' + conn.remoteAddress + ' disconnected ' +
        (errorOccurred ? 'with an error' : 'peacefully'));
  }

  processLine (line) {
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

    line = line.trim();

    logTraffic('> ' + line);

    let match;
    if ((match = line.match(/^GET\s+(\S+)\s+HTTP\/1\../))) {
      this.conn.url = match[1];
    }
    else if ((match = line.match(/^([^:]+):(.+)/i))) {
      this.incomingHeaders.set(match[1].trim(), match[2].trim());
    }
    else if (line === '') {
      this.textMode = false;

      this.conn.write('HTTP/1.1 101 Switching Protocols\n');
      this.conn.write('Upgrade: websocket\n');
      this.conn.write('Connection: Upgrade\n');

      if (this.incomingHeaders.has('Sec-WebSocket-Key')) {
        let response = getSecureResponse(this.incomingHeaders.get('Sec-WebSocket-Key'));
        this.conn.write('Sec-WebSocket-Accept: ' + response + '\n');
      }

      this.conn.write('\n');

      this.bufferFrameScanner.addBuffer(this.bufferLineScanner.dumpBuffers());

      for (let frame of this.bufferFrameScanner) {
        this.processFrame(frame);
      }
    }
  }

  processFrame (frame) {
    if (frame.opcode === OpCode.TEXT ||
        frame.opcode === OpCode.BINARY ||
        frame.opcode === OpCode.CONTINUATION) {
      this.messageFrames.push(frame);

      if (frame.fin) {
        conn.emit('message',
            this.messageFrames
              .map((this.messageFrames.opcode === OpCode.TEXT) ?
                frame => frame.payload.toString('utf8') :
                frame => frame.payload
              )
              .reduce((f1, f2) => f1.concat(f2))
        );

        this.messageFrames.length = 0;
      }
    }
    else if (frame.opcode === OpCode.CONNECTION_CLOSE) {
      // ???
    }
    else {
      console.error('Unhandled message type ' + frame.opcode.name);
    }
  }

  sendMessage (message) {
    let frame = generateFrame(message);
    this.conn.write(frame.header);
    this.conn.write(frame.payload);
  }
}

module.exports.createServer = (onConnect) => {
  return net.createServer(conn => {
    new WebSocket(conn, onConnect);
  });
};




