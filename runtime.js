// This will be a compiler when the runtime is attached to a jison parser.
var parse;
var assert = require('assert');

var forms = {}
exports.Form = Form;
function Form(name) {
  if (forms[name]) return forms[name];
  if (!(this instanceof Form)) return new Form(name);
  this.name = name;
  forms[name] = this;
}
Form.prototype.inspect = function () {
  return "\033[34;1m@" + this.name + "\033[0m";
};
var symbols = {}
exports.Symbol = Symbol;
function Symbol(name) {
  if (symbols[name]) return symbols[name];
  if (!(this instanceof Symbol)) return new Symbol(name);
  this.name = name;
  symbols[name] = this;
}
Symbol.prototype.inspect = function () {
  return "\033[35m:" + this.name + "\033[0m";
};

var metas = new WeakMap();
function getMeta(obj) {
  if (metas.has(obj)) {
    return metas.get(obj);
  }
  var meta = {};
  metas.set(obj, meta);
  if (Array.isArray(obj)) {
    meta.len = function () { return obj.length; };
  }
  else if (typeof obj === "function") {
    meta.call = obj;
  }
  else {
    meta.keys = function () { return Object.keys(obj); };
  }
  return meta;
}
function metaSet(obj, key, value) {
  if (typeof obj !== "object") return;
  var meta = getMeta(obj);
  if (key instanceof Form) {
    return meta[key.name] = value;
  }
  if (key in obj) {
    return obj[key] = value;
  }
  if (meta.set) {
    return meta.set(key, value);
  }
  return obj[key] = value;
}
function metaGet(obj, key) {
  if (typeof obj !== "object") return;
  var meta = getMeta(obj);
  if (key instanceof Form) {
    return meta[key.name];
  }
  if (key in obj) {
    return obj[key];
  }
  if (meta.get) {
    return meta.get(key);
  }
}

function Scope(parent) {
  this.scope = Object.create(parent || null);
}

function getForm(array) {
  return Array.isArray(array) && array[0] instanceof Form && array[0].name;
}

Scope.prototype.run = function (code) {
  // Evaluate form codes
  var form = getForm(code);
  if (form) {
    // console.log("running", code)
    return this[form].apply(this, code.slice(1));
  }
  if (code instanceof Symbol) {
    return this.lookup(code.name);
  }
  return code;
};

Scope.prototype.runCodes = function (codes) {
  var result;
  for (var i = 0, l = codes.length; i < l; i++) {
    var code = codes[i];
    result = this.run(code);
  }
  return result;
}

var hasOwn = Object.prototype.hasOwnProperty;
var slice = Array.prototype.slice;
var map = Array.prototype.map;


Scope.prototype.spawn = function () {
  return new Scope(this.scope);
};

Scope.prototype.params = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    this.scope[arguments[i]] = this.arguments[i];
  }
};

Scope.prototype.vars = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    this.scope[arguments[i]] = undefined;
  }
};

Scope.prototype.fn = function () {
  var closure = this.scope;
  var codes = slice.call(arguments);
  return function jackFunction() {
    var child = new Scope(closure);
    child.arguments = arguments;
    return child.runCodes(codes);
  };
};

Scope.prototype.call = function (val) {
  val = this.run(val);
  if (!val instanceof Function) {
    return this.abort("Attempt to call non-function");
  }
  try {
    return val.apply(null, slice.call(arguments, 1).map(this.run, this));
  }
  catch (err) {
    if (err.code === "RETURN") return err.value;
    throw err;
  }
};

Scope.prototype.le = function (a, b) {
  return this.run(a) <= this.run(b);
};

Scope.prototype.lt = function (a, b) {
  return this.run(a) < this.run(b);
};

Scope.prototype.eq = function (a, b) {
  return this.run(a) === this.run(b);
};

Scope.prototype.neq = function (a, b) {
  return this.run(a) !== this.run(b);
};

Scope.prototype.in = function (val, key) {
  val = this.run(val);
  key = this.run(key);
  var meta = getMeta(val);
  if (meta.has) {
    return meta.has(key);
  }
  return typeof val === "object" && key in val;
};

Scope.prototype.add = function (a, b) {
  return this.run(a) + this.run(b);
};

Scope.prototype.sub = function (a, b) {
  return this.run(a) - this.run(b);
};

Scope.prototype.mul = function (a, b) {
  return this.run(a) * this.run(b);
};

Scope.prototype.div = function (a, b) {
  return this.run(a) / this.run(b);
};

Scope.prototype.pow = function (a, b) {
  return Math.pow(this.run(a), this.run(b));
};

Scope.prototype.mod = function (a, b) {
  return this.run(a) % this.run(b);
};

Scope.prototype.unm = function (a) {
  return -this.run(a);
};

Scope.prototype.or = function (a, b) {
  return this.run(a) || this.run(b);
};

Scope.prototype.and = function (a, b) {
  return this.run(a) && this.run(b);
};

Scope.prototype.xor = function (a, b) {
  return !this.run(a) !== !this.run(b);
};

Scope.prototype.not = function (a) {
  return !this.run(a);
};

Scope.prototype.len = function (obj) {
  obj = this.run(obj);
  return obj.length;
};

Scope.prototype.set = function (obj, key, value) {
  obj = this.run(obj);
  key = this.run(key);
  value = this.run(value);
  return metaSet(obj, key, value);
};

Scope.prototype.get = function (obj, key) {
  obj = this.run(obj);
  key = this.run(key);
  return metaGet(obj, key);
};

Scope.prototype.delete = function (obj, key) {
  obj = this.run(obj);
  key = this.run(key);
  var meta = getMeta(obj);
  if (meta.delete) {
    return meta.delete(key);
  }
  delete obj[key];
};

Scope.prototype.return = function (val) {
  throw {code:"RETURN", value: this.run(val)};
};

Scope.prototype.abort = function (message) {
  console.error(message);
  process.exit();
  // console.log("ABORT", {message:message});
  // throw new Error(message);
};


Scope.prototype.assign = function (name, value) {
  var scope = this.scope;
  while (scope) {
    if (hasOwn.call(scope, name)) return scope[name] = this.run(value);
    scope = Object.getPrototypeOf(scope);
  }
  return this.abort("Attempt to access undefined variable '" + name + "'");
};

Scope.prototype.lookup = function (name) {
  if (name in this.scope) {
    return this.scope[name];
  }
  return this.abort("Attempt to access undefined variable '" + name + "'");
};

Scope.prototype.if = function () {
  var pairs = slice.call(arguments);
  for (var i = 0, l = pairs.length; i + 1 < l; i += 2) {
    var cond = this.run(pairs[i]);
    if (cond) {
      return this.runCodes(pairs[i + 1]);
    }
  }
  if (i < l) {
    return this.runCodes(pairs[i]);
  }
};

Scope.prototype.while = function (cond) {
  var child = this.spawn();
  var code = slice.call(arguments, 1);
  var ret;
  while (child.run(cond)) {
    ret = child.runCodes(code);
  }
  return ret;
};

Scope.prototype.for = function (list, names) {
  list = this.run(list);
  var code = slice.call(arguments, 2);
  var child = this.spawn();
  var ret;
  var meta = getMeta(list);
  if (meta.call) {
    var i = 0;
    var item;
    while ((item = meta.call()) !== undefined) {
      if (names.length === 2) {
        child.scope[names[0]] = i++;
        child.scope[names[1]] = item;
      }
      else {
        child.scope[names[0]] = item;
      }
      ret = child.runCodes(code);
    }
  }
  else if (meta.len) {
    for (var i = 0, l = meta.len(); i < l; i++) {
      var item = metaGet(list, i);
      if (names.length === 2) {
        child.scope[names[0]] = i;
        child.scope[names[1]] = item;
      }
      else {
        child.scope[names[0]] = item;
      }
      ret = child.runCodes(code);
    }
  }
  else if (meta.keys) {
    var keys = meta.keys();
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      var item = metaGet(list, key);
      if (names.length === 2) {
        child.scope[names[0]] = key;
        child.scope[names[1]] = item;
      }
      else {
        child.scope[names[0]] = item;
      }
      ret = child.runCodes(code);
    }
  }
  return ret;
};


Scope.prototype.list = function () {
  return map.call(arguments, this.run, this);
};

function Tuple(len) {
  Array.call(this, len);
  this.length = len;
}
Tuple.prototype.__proto__ = Array.prototype;
Tuple.prototype.inspect = function () {
  return "(" + this.map(inspect).join(", ") + ")";
};

Scope.prototype.tuple = function () {
  var l = arguments.length;
  var tuple = new Tuple(l);
  for (var i = 0; i < l; i++) {
    tuple[i] = this.run(arguments[i]);
  }
  return tuple;
};



Scope.prototype.object = function () {
  var obj = Object.create(null);
  for (var i = 0, l = arguments.length; i < l; i += 2) {
    var key = this.run(arguments[i]);
    var value = this.run(arguments[i + 1]);
    metaSet(obj, key, value);
  }
  return obj;
};

var is = {
  Integer: function (val) {
    return val >>> 0 === val;
  },
  Null: function (val) {
    return val === undefined;
  },
  Boolean: function (val) {
    return val === true || val === false;
  },
  String: function (val) {
    return typeof val === "string";
  },
  Buffer: function (val) {
    return Buffer.isBuffer(val);
  },
  Function: function (val) {
    return typeof val === "function"
  },
  Tuple: function (val) {
    return val instanceof Tuple;
  },
  List: function (val) {
    return Array.isArray(val);
  },
  Object: function (val) {
    return val && val.__proto__ === null;
  }
}

Scope.prototype.is = function (a, b) {
  a = this.run(a);
  var fn = is[b];
  if (!fn) return this.abort("Unknown type " + b);
  return fn(a);
};

var inspect = require('util').inspect;

Scope.prototype.eval = function (string) {
  var codes = parse(string);
  console.log(inspect(codes, false, 15, true));
  // console.log({
  //   originalLength: Buffer.byteLength(string),
  //   msgpackLength: require('msgpack-js').encode(codes).length,
  //   jsonLength: Buffer.byteLength(JSON.stringify(codes)),
  //   binaryLength: exports.save(codes).length
  // });

  return this.runCodes(codes);
};

exports.eval = function (string) {
  var scope = new Scope({
    print: console.log.bind(console),
    range: function (n) {
      var i = 0, v;
      return function () {
        v = i;
        i++;
        if (v < n) return v;
      };
    }
  });
  return scope.eval(string);
};

exports.attachParser = function (parser) {
  parser.yy.F = Form
  parser.yy.S = Symbol;
  parse = parser.parse.bind(parser);
};

Number.prototype.times = function (callback) {
  var value;
  for (var i = 0; i < this; i++) {
    value = callback(i);
  }
  return value;
};