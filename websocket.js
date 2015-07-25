'use strict';

const crypto = require('crypto');

class BufferedReader {
  constructor() {
    this._buffers = [];
  }

  appendData(buffer) {
    this._buffers.push(buffer);
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

  getNextMessage() {
    
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


function websocketSecureResponse(key) {
  const RESPONSE_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + RESPONSE_GUID, 'ascii');
  return sha1.digest('base64');
}


// "hello"
// 0x81 129      0b10000001 => FIN bit set, so last frame. Opcode = 1, so a text frame
// 0x85 133      0b10000101 => Mask bit set. Payload length is 5 bytes.
// 0x6e 110  n   Masking data, byte 1 of 4
// 0xaa 170      Masking data, byte 2 of 4
// 0x59 89  Y    Masking data, byte 3 of 4
// 0x82 130      Masking data, byte 4 of 4
// 0x6 6         -> 0x68 = h
// 0xcf 207      -> 0x65 = e
// 0x35 53  5    -> 0x6c = l
// 0xee 238      -> 0x6c = l
// 0x1 1         -> 0x6f = o

net.createServer(conn => {
  console.log('client connected');

//  conn.setEncoding('binary');

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

  let secureResponse;
  let textMode = true;
  let continuation = '';

  const bufferedReader = new BufferedReader();

  function onLine(line) {
    console.log('> ' + line);
    let match = line.match(/^sec-websocket-key: (.+)/i);
    if (match) {
      console.log('>> server key is ' + match[1]);
      secureResponse = websocketSecureResponse(match[1]);
      console.log('>> response key is ' + secureResponse);
    }
  }

  function sendAck() {
    conn.write('HTTP/1.1 101 Switching Protocols\n');
    conn.write('Upgrade: websocket\n');
    conn.write('Connection: Upgrade\n');
    conn.write('Sec-WebSocket-Accept: ' + secureResponse + '\n');
    //conn.write('Sec-WebSocket-Protocol: chat\n');
    conn.write('\n');
  }

  function parseFrame(frame) {
    const fin  = !!(frame[0] & 0b10000000);
    const rsv1 = !!(frame[0] & 0b01000000);
    const rsv2 = !!(frame[0] & 0b01000000);
    const rsv3 = !!(frame[0] & 0b01000000);
    const opcode = frame[0] & 0b00001111;

    const masked = !!(frame[1] & 0b10000000);
    const payloadLen = frame[1] & 0b01111111;
    let i = 2;
    if (payloadLen === 126) {
      payloadLen = frame[2] << 8 | frame[3];
      i = 4;
    }
    else if (payloadLen === 127) {
      payloadLen = frame[2] << 56 | frame[3] << 48 | frame[4] << 40 | frame[5] << 32 |
                   frame[6] << 24 | frame[7] << 16 | frame[8] << 8 | frame[9];
      i = 10;
    }

    let payload;
    if (masked) {
      const mask = frame.slice(i, 4);
      i += 4;

      payload = new Buffer(payloadLen);
      for (let j = 0; j < payloadLen; j++, i++) {
        payload[j] = frame[i] ^ mask[i & 4];
      }
    }
    else {
      payload = frame.slice(i, payloadLen);
    }

    const OPCODES = [
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
    ];

    return payload;
  }

  function processBinaryMode(binary) {
    for (let i = 0; i < binary.length; i++) {
      let n = binary[i];
      console.log('0x' + n.toString(16) + ' ' + n + (n >= 32 && n <= 127 ? '  ' + String.fromCharCode(n) : ''));
    }
  }



  conn.on('data', data => {
    if (textMode) {
//      data = continuation + data;
      bufferedReader.appendData(data);

      for (let line of bufferedReader.lineIterator) {
        line = line.trim();
        if (line === '') {
          sendAck();
          textMode = false;
        }
        else {
          onLine(line);
        }
      }
    }
    else {
      processBinaryMode(data);
    }

    //conn.end();
  });
  
//  conn.end();
}).listen(WEBSOCKET_PORT, () => {
  console.log(`Socket running on port ${WEBSOCKET_PORT}`);
})



