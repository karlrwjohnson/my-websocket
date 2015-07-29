'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const logging = require('./logging');
const websocket = require('./websocket');

const WEBSERVER_IP = '127.0.0.1';
const WEBSERVER_PORT = 8000;
const WEBSOCKET_PORT = 8080;
const CLIENT_FILES_DIR = './client';

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
  }
  
  setAttributesFromObject(obj) {
    for (var k in obj) {
      this.attributes.set(k, obj[k]);
    }
  }
  
  addChild(element) {
    this.children.push(element);
  }
  
  escapeHTML(html) {
    return html.replace(/[&<>]/g, char => this.htmlEntities[char]);
  }
  
  render() {
    let ret = '<' + this.tagName;
    for (let pair of this.attributes) {
      ret += ' ' + pair[0] + '="' + pair[1] + '"';
    }
    ret += '>'
    
    for (let child of this.children) {
      if (typeof child === 'string') {
        ret += this.escapeHTML(child);
      }
      else {
        ret += child.render();
      }
    }
    
    ret += '</' + this.tagName + '>';
    return ret;
  }
}
Object.defineProperty(Element.prototype, 'htmlEntities', { value:
   {'&': '&amp;', '<': '&lt;', '>': '&gt'}
});

function elementFactory(tagName) {
  return function() {
    const element = new Element(tagName);
    
    for (let arg of arguments) {
      if (arg instanceof Element) {
        element.addChild(arg);
      }
      else if (typeof arg === 'object') {
        element.setAttributesFromObject(arg);
      }
      else if (typeof arg === 'string') {
        element.addChild(arg);
      }
      else {
        throw Error(`Bad argument ${arg}`);
      }
    }
    
    return element;
  }
}

const a      = elementFactory('a');
const body   = elementFactory('body');
const div    = elementFactory('div');
const h1     = elementFactory('h1');
const h2     = elementFactory('h2');
const h3     = elementFactory('h3');
const head   = elementFactory('head');
const html   = elementFactory('html');
const form   = elementFactory('form');
const input  = elementFactory('input');
const li     = elementFactory('li');
const link   = elementFactory('link');
const p      = elementFactory('p');
const pre    = elementFactory('pre');
const script = elementFactory('script');
const span   = elementFactory('span');
const table  = elementFactory('table');
const tbody  = elementFactory('tbody');
const td     = elementFactory('td');
const th     = elementFactory('th');
const thead  = elementFactory('thead');
const title  = elementFactory('title');
const tr     = elementFactory('tr');
const ul     = elementFactory('ul');

const index = html (
  head (
    title ("Websocket Demo"),
    link ({rel: 'stylesheet',
      href: 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css'})
  ),
  body (
    div ({'class': 'container'},
      h1 ('WebSocket Demo'),
      input ({
        'id': 'newMessage',
        'type': 'text',
        'placeholder': 'Type your message and press [Enter]',
        'class': 'form-control'
      }),
      ul ({'id': 'messageList'})
    ),
    script ({src: 'domlib.js'}),
    script ({src: 'index.js'})
  )
);

function functionHeaderOnly(fn) {
  return ('' + fn).match(/^[^{]*/)[0];
}

function describeObject(obj) {
  logging.debug(typeof obj);
  logging.debug(obj.__proto__.constructor);  
  logging.debug(JSON.encode(obj))
  for (let i in obj) {
    logging.debug(' - ' + i + ' : ' + (obj[i] instanceof Function ? functionHeaderOnly(obj[i]) : obj[i]));
  }
}

const ext2mimeType = {
  'js': 'application/javascript',
  'htm': 'text/html',
  'html': 'text/html',
  'txt': 'text/plain',
  'json': 'application/json',
  'svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead('200', {'Content-Type': 'text/html'});
    res.end('<!DOCTYPE html>\n' + index.render());
  }
  else {
    fs.readdir(CLIENT_FILES_DIR, (err, files) => {
      for (let filename of files) {
        if ('/' + filename === req.url) {
          let header = {};
          let ext = path.extname(filename);
          if (ext in ext2mimeType) {
            header['Content-Type'] = ext2mimeType[ext];
          }
          res.writeHead('200', header);
          fs.createReadStream(CLIENT_FILES_DIR + req.url).pipe(res);
          return;
        }
      }
      res.writeHead('404', {'Content-Type': 'text/plain'});
      res.end(`Page ${req.url} not found`);
    });
  }
}).listen(WEBSERVER_PORT, WEBSERVER_IP);

console.log(`Server running at http://${WEBSERVER_IP}:${WEBSERVER_PORT}`);

const conns = new Set();

websocket.createServer(conn => {
  logging.info('client connected to websocket from ' + conn.remoteAddress);

  conns.forEach((recipient, id) =>
    recipient.sendMessage(JSON.stringify({
      type: 'connection',
      from: conn.remoteAddress + ':' + conn.remotePort
    }))
  );

  conns.add(conn);

  conn.on('message', message => {
    logging.info(message);
    logging.info(typeof message);

    conns.forEach((recipient, id) =>
      recipient.sendMessage(JSON.stringify({
        type: 'message',
        from: conn.remoteAddress + ':' + conn.remotePort,
        message: message,
      }))
    );
  });

  conn.on('close', () => {
    conns.delete(conn);

    conns.forEach((recipient, id) =>
      recipient.sendMessage(JSON.stringify({
        type: 'disconnection',
        from: conn.remoteAddress + ':' + conn.remotePort
      }))
    );
  });

}).listen(WEBSOCKET_PORT, WEBSERVER_IP, () =>
  logging.info(`Websocket server running at ws://${WEBSERVER_IP}:${WEBSOCKET_PORT}`)
);



