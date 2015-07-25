'use strict';

const http = require('http');

const websocket = require('./websocket');

const WEBSERVER_IP = '127.0.0.1';
const WEBSERVER_PORT = 8000;
const WEBSOCKET_PORT = 8080;

/*function getCallerInfo() {
  let stackStrings = (new Error()).stack.split('\n');
  let callerInfo = stackStrings[3];
  let parsed = callerInfo.match(/^\s+at (?:.*\()?(.+):(\d+):(\d+)\)?$/);
  return {
    filename: parsed[1],
    line: parsed[2],
    column: parsed[3],
  }
}

function vlqEncode(number) {
  const digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

}

function genSourceMap(file) {
  let callerInfo = getCallerInfo();
  
  let mapping = [
    0, // Starting column in the generated code
    0, // Index of original code in sources array
    callerInfo.line, // Line number in original code
    0 // Column in original code
  ].map(numberToBase64).join(',');
  
  return {
    'file': file + '\n//# sourceMappingUrl=/index.js.map',
    'map': JSON.stringify({
      version: 3,
      sources: [callerInfo.filename],
      mappings: [mapping]
    })
  };
}*/


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
      })
    ),
    script ({src: 'index.js'})
  )
);

const js = `
  'use strict';
  
  function ServerConnection(url, port) {
    this.url = url;
    this.port = port;
    this._receive_bound = this._receive.bind(this);
  }
  Object.defineProperties(ServerConnection.prototype, {
    init: { value: function() {
      this.ws = new WebSocket('ws://' + this.url + ':' + this.port);
      console.log('Connecting to ws://' + this.url + ':' + this.port);
    }},
    send: { value: function(message) {
      this.ws.send(message);
    }},
    _receive: { value: function() {
      
    }},
    _listeners: { value: [] },
    addListener: { value: function() {
      
    }},
    removeListener: { value: function(listener) {
      
    }}
  });
  
  var serverConnection = new ServerConnection('127.0.0.1', ${WEBSOCKET_PORT});
  serverConnection.init();
  serverConnection.ws.onopen = function() { serverConnection.send("hello") };
  
  var newMessageField = document.getElementById('newMessage');
  newMessageField.addEventListener('keyDown', function(evt) {
    if (evt.keyCode === 13) /* enter key */ {
      serverConnection.send(newMessageField.value);
      newMessageField.value = '';
    }
  });
`;

function functionHeaderOnly(fn) {
  return ('' + fn).match(/^[^{]*/)[0];
}

function summarizeObject(obj) {
  for (let i in obj) {
    console.log(' - ' + i + ' : ' + (obj[i] instanceof Function ? functionHeaderOnly(obj[i]) : obj[i]));
  }
}

http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead('200', {'Content-Type': 'text/html'});
    res.end('<!DOCTYPE html>\n' + index.render());
  }
  else if (req.url === '/index.js') {
    res.writeHead('200', {'Content-Type': 'application/javascript'});
    res.end(js);
  }
  else {
    res.writeHead('404', {'Content-Type': 'text/plain'});
    res.end(`Page ${req.url} not found`);
  }
}).listen(WEBSERVER_PORT, WEBSERVER_IP);

console.log(`Server running at http://${WEBSERVER_IP}:${WEBSERVER_PORT}`);

websocket.createServer(conn => {
  console.log('client connected to websocket from ' + conn.remoteAddress);

  conn.on('message', message => {
    console.log(message.toString('utf8'));
  });
}).listen(WEBSOCKET_PORT, WEBSERVER_IP, () =>
  console.log(`Websocket server running at ws://${WEBSERVER_IP}:${WEBSOCKET_PORT}`)
);



