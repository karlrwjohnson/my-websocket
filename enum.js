'use strict';

class Enum {
  constructor (name) {
    let clazz = this.__proto__.constructor;
    
    if (Object.isFrozen(clazz)) {
      throw Error('Values already initialized for class ' + this);
    }
    else {
      if (!('__counter' in clazz)) {
        Object.defineProperty(clazz, '__counter', { value: 0, configurable: true, writable: true });
      }
      
      Object.defineProperties(this, {
        'name': { value: name, enumerable: true },
        'ordinal': { value: clazz.__counter, enumerable: true },
      });
  
      Object.defineProperty(clazz, name, { value: this, enumerable: true });
      Object.defineProperty(clazz, clazz.__counter, { value: this });
  
      ++clazz.__counter;
    }
  }
  
  toString () {
    return this.name;
  }

  static values (members) {
    if (Object.isFrozen(this)) {
      throw Error('Values already initialized for class ' + this);
    }
    else {
      for (let member of members) {
        if (typeof member === 'string') {
          new this(member);
        }
        else if ('length' in member) {
          new (Function.prototype.bind.apply(this, [{}].concat(member)));
        }
        else {
          throw Error('Expected a string or an array');
        }
      }
      delete this.__counter;
      Object.defineProperty(this, 'len', { value: members.length });
      Object.freeze(this);
    }
  }
}

Object.defineProperty(Enum, Symbol.iterator, { value: function*() {
  for (let i = 0; i < this.len; i++) {
    yield this[i];
  }
}});

  // class Colors extends Enum {
  //  constructor (name, ansi, rgb) {
  //    super(name);
      
  //    this._ansi = ansi;
  //    this._rgb = Object.freeze(Array.prototype.slice.apply(rgb));
  //  }
    
  //  get ansi () { return this._ansi; }
  //  get rgb () { return this._rgb; }
  // }
  
  // Colors.values([
  //  ['RESET',        '\x1a[0m',    [  0,  0,  0]],
  //  ['BLACK',        '\x1a[0;30m', [  0,  0,  0]],
  //  ['BLUE',         '\x1a[0;34m', [  0,  0,191]],
  //  ['GREEN',        '\x1a[0;32m', [  0,191,  0]],
  //  ['CYAN',         '\x1a[0;36m', [  0,191,191]],
  //  ['RED',          '\x1a[0;31m', [191,  0,  0]],
  //  ['PURPLE',       '\x1a[0;35m', [191,  0,191]],
  //  ['BROWN',        '\x1a[0;33m', [191,191,  0]],
  //  ['LIGHT_GRAY',   '\x1a[0;37m', [ 63, 63, 63]],
  //  ['DARK_GRAY',    '\x1a[1;30m', [191,191,191]],
  //  ['LIGHT_BLUE',   '\x1a[1;34m', [ 63, 63,255]],
  //  ['LIGHT_GREEN',  '\x1a[1;32m', [ 63,255, 63]],
  //  ['LIGHT_CYAN',   '\x1a[1;36m', [ 63,255,255]],
  //  ['LIGHT_RED',    '\x1a[1;31m', [255, 63, 63]],
  //  ['LIGHT_PURPLE', '\x1a[1;35m', [255, 63,255]],
  //  ['YELLOW',       '\x1a[1;33m', [255,255, 63]],
  //  ['WHITE',        '\x1a[1;37m', [255,255,255]],
  // ]);
  
  // for (let color of Colors) {
  //  console.log(color.ordinal + ') ' + color.ansi + color + Colors.RESET + ' = (' + color.rgb.join(',') + ')');
  // }

module.exports = Enum;
