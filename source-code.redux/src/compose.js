/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

// 将(fun1,fun2,fun3)转换成fun1(fun2(fun3()))
// 这么嵌套执行的意义是传递统一的参数，后续有说明
export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }
  // 重点理解的一句 这里的reduce内部还返回了一个函数
  // 具体展开在applyMiddleware中
  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}
