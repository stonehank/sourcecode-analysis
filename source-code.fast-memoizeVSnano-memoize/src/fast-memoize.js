//
// Main
//

function memoize (fn, options) {
  // 使用自定义cache 或者 默认cache（一个无prototype的对象）
  var cache = options && options.cache
    ? options.cache
    : cacheDefault

  // 使用自定义序列化 或者默认序列化(JSON.stringify)
  var serializer = options && options.serializer
    ? options.serializer
    : serializerDefault

  // 使用自定义策略或者默认策略
  var strategy = options && options.strategy
    ? options.strategy
    : strategyDefault

  // 返回一个绑定了 fn,cache和序列化方法的 strategy
  return strategy(fn, {
    cache: cache,
    serializer: serializer
  })
}

//
// Strategy
//

// 判断是否原始数据
function isPrimitive (value) {
  return value == null || typeof value === 'number' || typeof value === 'boolean' // || typeof value === "string" 'unsafe' primitive for our needs
}

// todo 问题1、stringify对deep对象相当于深拷贝，当遇到执行简单但是参数是deep对象的时候
// todo 问题2、当对多个参数序列化的时候，有可能参数只有第一个改变了，其他都没有改变，那么就很多重复
// todo 问题3、对function ，因为stringify会为null：给函数添加一个独一无二的id属性
// todo 问题4、对ES6 spread，fn.length无效始终为1：使用多个参数的序列化
function monadic (fn, cache, serializer, arg) {
  // 是否原始数据（null，number，boolean），直接返回，否则就序列化
  // 为什么string被认为不安全？
  // 如果我想缓存两个值 1、{x:1}2、'{"x":1}'
  // 如果允许字符串，那么JSON.stringify({x:1})==='{"x":1}'的，当调用第二种情况就是使用第一种的缓存
  var cacheKey = isPrimitive(arg) ? arg : serializer(arg)
  // 查找缓存值
  var computedValue = cache.get(cacheKey)
  // 无缓存值
  if (typeof computedValue === 'undefined') {
    // 执行fn
    computedValue = fn.call(this, arg)
    // 设置缓存值
    cache.set(cacheKey, computedValue)
  }

  return computedValue
}

function variadic (fn, cache, serializer) {
  // 取出参数
  var args = Array.prototype.slice.call(arguments, 3)
  // 序列化参数数组
  var cacheKey = serializer(args)
  // 对序列化的查找缓存，无则执行fn
  var computedValue = cache.get(cacheKey)
  if (typeof computedValue === 'undefined') {
    computedValue = fn.apply(this, args)
    cache.set(cacheKey, computedValue)
  }

  return computedValue
}

// 给strategy方法注入参数（省去执行的时候去查找参数）
// todo 亮点
function assemble (fn, context, strategy, cache, serialize) {
  return strategy.bind(
    context,
    fn,
    cache,
    serialize
  )
}

function strategyDefault (fn, options) {
  // todo 使用fn.length替换 arguments.length ？
  var strategy = fn.length === 1 ? monadic : variadic

  // 返回strategy，绑定在当前环境
  return assemble(
    fn,
    // 获取当前环境，浏览器就是window
    this,
    strategy,
    options.cache.create(),
    options.serializer
  )
}

// 多个参数的解决方案
function strategyVariadic (fn, options) {
  var strategy = variadic

  return assemble(
    fn,
    this,
    strategy,
    options.cache.create(),
    options.serializer
  )
}

// 单个参数的解决方案
function strategyMonadic (fn, options) {
  var strategy = monadic

  return assemble(
    fn,
    this,
    strategy,
    options.cache.create(),
    options.serializer
  )
}

//
// Serializer
//

function serializerDefault () {
  return JSON.stringify(arguments)
}

//
// Cache
//

// 默认cache的基础操作
function ObjectWithoutPrototypeCache () {
  this.cache = Object.create(null)
}

ObjectWithoutPrototypeCache.prototype.has = function (key) {
  return (key in this.cache)
}

ObjectWithoutPrototypeCache.prototype.get = function (key) {
  return this.cache[key]
}

ObjectWithoutPrototypeCache.prototype.set = function (key, value) {
  this.cache[key] = value
}

// ObjectWithoutPrototypeCache 一个无prototype的对象
var cacheDefault = {
  create: function create () {
    return new ObjectWithoutPrototypeCache()
  }
}

//
// API
//

module.exports = memoize
module.exports.strategies = {
  variadic: strategyVariadic,
  monadic: strategyMonadic
}
