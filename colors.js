'use strict';

const Enum = require('./enum');

class Colors extends Enum {
 constructor (name, ansi, rgb) {
   super(name);

   this._ansi = ansi;
   this._rgb = Object.freeze(Array.prototype.slice.apply(rgb));
 }
  
 get ansi () { return this._ansi; }
 get rgb () { return this._rgb; }
}

Colors.values([
 ['RESET',        '\x1b[0m',    [  0,  0,  0]],
 ['BLACK',        '\x1b[0;30m', [  0,  0,  0]],
 ['BLUE',         '\x1b[0;34m', [  0,  0,191]],
 ['GREEN',        '\x1b[0;32m', [  0,191,  0]],
 ['CYAN',         '\x1b[0;36m', [  0,191,191]],
 ['RED',          '\x1b[0;31m', [191,  0,  0]],
 ['PURPLE',       '\x1b[0;35m', [191,  0,191]],
 ['BROWN',        '\x1b[0;33m', [191,191,  0]],
 ['LIGHT_GRAY',   '\x1b[0;37m', [ 63, 63, 63]],
 ['DARK_GRAY',    '\x1b[1;30m', [191,191,191]],
 ['LIGHT_BLUE',   '\x1b[1;34m', [ 63, 63,255]],
 ['LIGHT_GREEN',  '\x1b[1;32m', [ 63,255, 63]],
 ['LIGHT_CYAN',   '\x1b[1;36m', [ 63,255,255]],
 ['LIGHT_RED',    '\x1b[1;31m', [255, 63, 63]],
 ['LIGHT_PURPLE', '\x1b[1;35m', [255, 63,255]],
 ['YELLOW',       '\x1b[1;33m', [255,255, 63]],
 ['WHITE',        '\x1b[1;37m', [255,255,255]],
]);

module.exports = Colors;
