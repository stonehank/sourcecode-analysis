function defaultEqualityCheck(a, b) {
  return a === b
}

// 对prev和next进行浅比较
function areArgumentsShallowlyEqual(equalityCheck, prev, next) {
  if (prev === null || next === null || prev.length !== next.length) {
    return false
  }

  // Do this in a for loop (and not a `forEach` or an `every`) so we can determine equality as fast as possible.
  // 遍历比较
  const length = prev.length
  for (let i = 0; i < length; i++) {
    if (!equalityCheck(prev[i], next[i])) {
      return false
    }
  }

  return true
}
// 缓存函数，只保存上一次缓存
export function defaultMemoize(func, equalityCheck = defaultEqualityCheck) {
  // 闭包
  let lastArgs = null
  let lastResult = null
  // we reference arguments instead of spreading them for performance reasons
  return function () {
    // 判断当前参数和上一次的参数是否相同，默认为 ===(全等)
    if (!areArgumentsShallowlyEqual(equalityCheck, lastArgs, arguments)) {
      // apply arguments instead of spreading for performance.
      // 不同则调用func
      lastResult = func.apply(null, arguments)
    }
    // 保存当前参数
    lastArgs = arguments
    // 返回result
    return lastResult
  }
}

function getDependencies(funcs) {
  // 判断是否数组 [[xxx]]-->[xxx] else [xxx]-->[xxx]
  const dependencies = Array.isArray(funcs[0]) ? funcs[0] : funcs

  // 有非函数的，报错
  if (!dependencies.every(dep => typeof dep === 'function')) {
    const dependencyTypes = dependencies.map(
      dep => typeof dep
    ).join(', ')
    throw new Error(
      'Selector creators expect all input-selectors to be functions, ' +
      `instead received the following types: [${dependencyTypes}]`
    )
  }
  // 返回（一个数组）
  return dependencies
}

/*
* 2种情况会返回缓存
* 1. store引用不变（同一个selector缓存函数，并且参数引用不变），直接返回上一次的结果
* 2. store引用改变，但依赖项(数据处理函数的参数)全等相等，
* */
// 因此要改变结果(不使用缓存)，必须改变store的引用和内部依赖项的引用
// 可自己定义比较函数
export function createSelectorCreator(memoize, ...memoizeOptions) {
  // 每次执行后
  //1. 分割出当前的 数据处理函数 和 依赖数据函数
  //2. 返回值是一个缓存函数
  //3. 缓存函数执行前会对参数全等对比，比较不同才会执行内部
  return (...funcs) => {
    let recomputations = 0
    // 去除参数最后一项 (数据处理函数)
    const resultFunc = funcs.pop()
    // funcs是依赖的项(必须是函数格式)
    const dependencies = getDependencies(funcs)

    // 默认调用 defaultMemoize
    // 这里是对 数据处理函数 的缓存
    const memoizedResultFunc = memoize(
      function () {
        // 此处是首先经过selector参数比较不同，再经过数据处理函数比较参数（依赖数据函数的返回值）不同后，执行
        recomputations++
        // apply arguments instead of spreading for performance.
        return resultFunc.apply(null, arguments)
      },
      ...memoizeOptions
    )

    // If a selector is called with the exact same arguments we don't need to traverse our dependencies again.
    // 这里是对 依赖项 的缓存，它的返回的结果作为 数据处理函数 的参数
    // 如果 selector的参数 全等，就不用处理以下函数了，直接返回上一次的值
    const selector = memoize(function () {
      // 此处都是经过比较参数不同之后，才会执行
      const params = []
      const length = dependencies.length

      // 分别执行每一项 依赖数据函数
      for (let i = 0; i < length; i++) {
        // apply arguments instead of spreading and mutate a local list of params for performance.
        params.push(dependencies[i].apply(null, arguments))
      }

      // 并将执行依赖数据函数结果作为参数传递给 数据处理函数
      // apply arguments instead of spreading for performance.
      return memoizedResultFunc.apply(null, params)
    })

    // export 数据处理函数
    selector.resultFunc = resultFunc
    // export 依赖数据函数所组成的数组 （一维数组）
    selector.dependencies = dependencies
    // export 重新计算的次数
    selector.recomputations = () => recomputations
    // export 清空重计次数
    selector.resetRecomputations = () => recomputations = 0
    return selector
  }
}
// 默认比较函数就是全等
export const createSelector = createSelectorCreator(defaultMemoize)



// 一个更改数据的key值的函数，通过嵌套可以更改数据的结构
/*
* {a:1,b:2,c:3}
* 更改key值：---->{x:1,y:2,z:3}
* 更改数据的结构：---->{nest:{x:1,y:2},z:3}
* */
export function createStructuredSelector(selectors, selectorCreator = createSelector) {
  // 非object 报错
  if (typeof selectors !== 'object') {
    throw new Error(
      'createStructuredSelector expects first argument to be an object ' +
      `where each property is a selector, instead received a ${typeof selectors}`
    )
  }

  // 提取key
  const objectKeys = Object.keys(selectors)

  /*
   * 默认使用createSelector
   */
  return selectorCreator(
    // 获取每一项的value (Object.values ?)
    // 相当于依赖数据函数组成的数组
    objectKeys.map(key => selectors[key]),
    // 参数(...values)表示将所有参数用一个数组包裹
    // 例如
    // let x=(...v)=>v
    // x(1,2,3)   // [1,2,3]
    // 此处value为上面每个依赖数据函数执行的返回值，并用数组包裹
    (...values) => {
      // 对依赖数据函数的返回值，使用设定的key
      return values.reduce((composition, value, index) => {
        composition[objectKeys[index]] = value
        return composition
      }, {})
    }
  )
}
