'use strict';

/*
function range(limit) {
	var ret = {i: 0, limit:limit};
	ret[Symbol.iterator] = function() {
		return {
			next: function() {
				return ((++ret.i) < ret.limit) ?
					{ value:ret.i } :
					{ done:true };
			}
		};
	};
	return ret;
}

for (let i of range(10)) {
	console.log(i);
}
*/

class Enum {

	constructor (name) {
		let clazz = Object.getPrototypeOf(this).constructor;

		if (!Object.hasOwnProperty(clazz, 'length')) {
			Object.defineProperty(clazz, 'length', { value: 0, configurable: true });
		}

		Object.defineProperties(this, {
			'name': { value: name, enumerable: true },
			'ordinal': { value: clazz.length, enumerable: true },
		});

		Object.defineProperty(clazz, name, { value: this, enumerable: true });
		Object.defineProperty(clazz, clazz.length, { value: this });

		clazz.length ++;

		console.log(this);
		console.log(Object.getPrototypeOf(this).constructor);
	}

	static finalize (enum) {
		Object
	}
}

class Bar extends Enum {
	constructor (name) {
		super(name);
	}
}

new Bar('asdf');
