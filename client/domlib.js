'use strict';

function elementFactory (tag) {
	return function () {
		var args = Array.prototype.slice.apply(arguments);
		var dom = document.createElement(tag);
		for (var i = 0; i < args.length; i++) {
      if (typeof args[i] === 'string') {
        dom.appendChild(document.createTextNode(args[i]));
      }
      else if (args[i] instanceof Node) {
        dom.appendChild(args[i]);
      }
      else if (typeof args[i] === 'object') {
        for (var j in args[i]) {
          dom.setAttribute(j, args[i][j]);
        }
      }
    }
    return dom;
	}
}

var a      = elementFactory('a');
var body   = elementFactory('body');
var div    = elementFactory('div');
var h1     = elementFactory('h1');
var h2     = elementFactory('h2');
var h3     = elementFactory('h3');
var head   = elementFactory('head');
var html   = elementFactory('html');
var form   = elementFactory('form');
var input  = elementFactory('input');
var li     = elementFactory('li');
var link   = elementFactory('link');
var p      = elementFactory('p');
var pre    = elementFactory('pre');
var script = elementFactory('script');
var span   = elementFactory('span');
var table  = elementFactory('table');
var tbody  = elementFactory('tbody');
var td     = elementFactory('td');
var th     = elementFactory('th');
var thead  = elementFactory('thead');
var title  = elementFactory('title');
var tr     = elementFactory('tr');
var ul     = elementFactory('ul');
