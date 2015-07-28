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

module.exports = Enum;
