(function() {
  "use strict";
  const hasVargs = (f) => {
    const s = f+"",
      i = s.indexOf("...");
    return i>=0 && i<s.indexOf(")" || s.indexOf("arguments")>=0);
  };
  function nanomemoize (fn, options={}) {
    // for single argument functions, just use a JS object key look-up
    // 单个复杂参数使用序列化
    function single (f,s,change,serializer,arg) {
      // strings must be stringified because cache[1] should not equal or overwrite cache["1"] for value = 1 and value = "1"
      const key = (!arg || typeof arg === "number" || typeof arg ==="boolean" ? arg : serializer(arg));
      if(change) change(key);
      return s[key] || ( s[key] = f.call(this, arg));
    }
    // for multiple arg functions, loop through a cache of all the args
    // looking at each arg separately so a test can abort as soon as possible
    function multiple(f,k,v,eq,change,max=0,...args) {
      // 用来储存i(当前对比的参数索引)和缓存值
      const rslt = {};
      // k是一个专门存放多个参数的数组 格式类似
      // [[...args],[...args],[...args]...]
      for(let i=0;i<k.length;i++) { // an array of arrays of args
        let key = k[i];
        // 判断是否需要使用max
        if(max) { key = key.slice(0,max); }
        // 当前长度相等或者有max值，开始进行对比
        if(key.length===args.length || (max && key.length<args.length)) {
          // 获取长度
          const max = key.length - 1;
          for(let j=0;j<=max;j++) {
            // 如果发现不等，直接跳出
            if(!eq(key[j],args[j])) { break; } // go to next key if args don't match
            // 当到了最后一项都没跳出 说明参数相同
            if(j===max) { // the args matched
              // 记录当前索引
              rslt.i = i;
              // 调用当前参数的缓存
              rslt.v = v[i]; // get the cached value
            }
          }
        }
      }
      // 如果有i 说明是调用缓存，如果没有i，则添加缓存
      const i = rslt.i>=0 ? rslt.i : v.length;
      if(change) { change(i); }
      // 如果缓存不存在就执行func，存在直接返回缓存
      return typeof rslt.v === "undefined" ? v[i] = f.call(this,...(k[i] = args)) : rslt.v;
    }
    const {
        serializer = (value) => JSON.stringify(value),
        equals,
        maxAge,
        maxArgs,
        vargs = hasVargs(fn)
      } = options,
      s = {}, // single arg function key/value cache
      k = [], // multiple arg function arg key cache
      v = [], // multiple arg function result cache
      c = {}, // key change cache
      change = (cache,key) => { // logs key changes
        c[key] = {key,cache};
      },
      t =  {},
      timeout = (change) => { // deletes timed-out keys
        if(t[change.key]) { clearTimeout(t[change.key]); }
        t[change.key] = setTimeout(() => {
          delete change.cache[change.key];
          delete t[change.key];
        },maxAge);
      };
    setInterval(() => { // process key changes out of cycle for speed
      for(let p in c) {
        if(maxAge) { timeout(c[p]); }
        delete c[p];
      }
    },1);
    let f,
      unary = fn.length===1 && !equals && !vargs;
    // pre-bind core arguments, faster than using a closure or passing on stack or in this case using a partial
    if(unary) {
      f = single.bind(
        this,
        fn,
        s,
        (maxAge ? change.bind(this,s): null), // turn change logging on and bind to arg cache s
        serializer
      );
    } else {
// 注入参数，提升性能
      f = multiple.bind(
        this,
        fn,
        k,
        v,
        // 逐个判断方式默认为 ===
        equals || ((a,b) => a===b), // default to just a regular strict comparison
        (maxAge ? change.bind(this,v): null), // turn change logging on and bind to arg cache v
        maxArgs
      );
    }
    // 清空缓存
    // reset all the caches, must change array length or delete keys on objects to retain bind integrity
    f.clear = () => {
      Object.keys(s).forEach((k) => delete s[k]);
      k.length = 0; //k.splice(0,k.length);
      v.length = 0; //v.splice(0,v.length);
      Object.keys(c).forEach(k => delete c[k]);
      Object.keys(t).forEach(k => { clearTimeout(t[k]); delete t[k]; });
    };
    f.keys = () => (!unary ? k.slice() : null);
    f.values = () => (!unary ? v.slice() : null);
    f.keyValues = () => (unary ? Object.assign({},s) : null);
    return f;
  }

  if(typeof(module)!=="undefined") module.exports = nanomemoize;
  if(typeof(window)!=="undefined") window.nanomemoize = nanomemoize;
}).call(this);