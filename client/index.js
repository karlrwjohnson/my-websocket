'use strict';

var newMessageField = document.getElementById('newMessage');
var messageList = document.getElementById('messageList');

document.addEventListener('DOMContentLoaded', function() {
  newMessageField = document.getElementById('newMessage');
  messageList = document.getElementById('messageList');

  newMessageField.focus();

  var ws = new WebSocket('ws://127.0.0.1:8080');
  ws.onopen = function() {
    //ws.send("hello");
  };
  ws.onmessage = function(evt) {
    console.log(evt.data);

    var data = JSON.parse(evt.data);
    messageList.appendChild(li(
      data.type === 'message' ? '[' + data.from + ']: ' + data.message :
      data.type === 'connection' ? '[' + data.from + '] has connected ':
      data.type === 'disconnection' ? '[' + data.from + '] has disconnected' :
      'error'
    ));
  };

  newMessageField.addEventListener('keydown', function(evt) {
    if (evt.keyCode === 13) /* enter key */ {
      ws.send(newMessageField.value);
      newMessageField.value = '';
    }
  });
});
