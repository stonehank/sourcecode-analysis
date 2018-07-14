/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
// 判断是否简单对象
// 此处的目的是为了让action不要有原型链，即不要使用这种模式
/*
```jsx
  function reducer(state, action) {
    if (action instanceof SomeAction) {
      return ...
    } else {
      return ...
    }
  }
```
根据Dan Abramov所说
>The "plain objects" isn't really the point.
>What we want to enforce is that you don't rely on actions being instances of specific classes in your reducers,
>because this will never be the case after (de)serialization.

使用上面的模式，当通过对象序列化和反序列化后，原型链上的方法都会失效.
 */

export default function isPlainObject(obj) {
  // 先判断typeof
  if (typeof obj !== 'object' || obj === null) return false

  // 通过prototype向上查找，一直查找到原型链的顶端
  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }
  // 判断obj的prototype是否是原型链的顶端
  return Object.getPrototypeOf(obj) === proto
}
