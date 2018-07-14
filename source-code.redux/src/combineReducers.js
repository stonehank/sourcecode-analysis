/*
* 其实 combineReducers 做了一系列的检查，为了能返回符合预期的reducer，大部分检查都是在开发模式下才会进行，来看看一共做了什么检查：
* 1. reducers内部某个key对应的值为undefined，不符合的提示，只在开发模式检测
* 2. 将reducers中key对应的值为function的筛选出来
* 3. 检测reducers每一个reducer是否符合规则(初始state不为undefined，默认返回不为undefined)，不符合规则的报错
* 4. 对筛选的reducers进行检测，不符合的提示，只在开发模式检测
*   1. 是否length为0
*   2. 判断对应的state（后面将会传递给这个reducer的默认state）是否简单对象
*   3. 是否存在某个key，state中有，但reducer中没有（说明reducer监控不到这个key对应的值）
* 5. 开始执行，执行的时候检测匹配到的action的返回值不能是undefined，不符合的抛出错误
* 6. 最后通过nextStateForKey !== previousStateForKey检测是否更新（因此我们设计reducer的时候不能反悔引用的state）
*
*
* */


import ActionTypes from './utils/actionTypes'
import warning from './utils/warning'
import isPlainObject from './utils/isPlainObject'

// 检测是否有action返回undefined(非初始值)
function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action'

  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers)
  // 判断是最外层combineReducer还是内部嵌套combineReducer
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer'
  // 无reducer，直接返回
  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }
  // 判断state是否简单对象
  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }


  const unexpectedKeys = Object.keys(inputState).filter(
    // reducer未包含state中的key值 并且 第一次检测到
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )
  // 放入unexpectedKeyCache
  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })
  // 如果使用了store.replace，则直接返回
  if (action && action.type === ActionTypes.REPLACE) return

  // 提示忽略inputState中reducer不存在的key
  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

// 传入此处的参数是符合条件(key对应的值为function)的reducers
// 此函数作用是检测每一个reducer是否符合规则(初始state不为undefined，返回不为undefined)
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key]
    // 对每一个reducer执行初始化，此处传入undefined就是为了验证必须要有state初始值
    /*
    * 我们写reducer是这样的(state有初始值)
    * let reducer=function(state={},action){
    *   switch(action.type){
    *     //...
    *   }
    * }
    * 如果写成(state无初始值)
    * let reducer=function(state,action){
    *   switch(action.type){
    *     //...
    *   }
    * }
    * 因为此处传入state为undefined，后面检测就会抛出错误
    * */
    const initialState = reducer(undefined, { type: ActionTypes.INIT })
    // 检测是是否有初始值
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }
    // 检测每一个reducer的返回值否是undefined，通过一个无法匹配的未知action，测试默认返回值
    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${
            ActionTypes.INIT
          } or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers)
  const finalReducers = {}
  // 遍历reducer的keys
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    // 开发模式提示未给对应的key赋值
    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    // key对应的值为function，放入finalReducers
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }
  // 获取符合条件的keys
  const finalReducerKeys = Object.keys(finalReducers)

  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  let shapeAssertionError
  try {
    // 检测每一个reducer是否符合规则
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e
  }
  // 返回一个新的reducer
  return function combination(state = {}, action) {
    // 检测有错误，抛出
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

    if (process.env.NODE_ENV !== 'production') {
      // 检测是否有警告的地方
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        // 此处传入的state
        // 如果combineReducer无嵌套，则是createStore里的preloadedState（相当于总state）,
        // 如果有嵌套，则可能是嵌套combineReducer对应的key（相当于总state的分支）
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }
    // 以上都是检查，此处开始真正执行
    let hasChanged = false
    const nextState = {}
    // 执行当前每一个reducer
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i]
      const reducer = finalReducers[key]
      // 保存reducer执行前的state
      const previousStateForKey = state[key]
      // 更新reducer执行后state，如果这里的reducer是嵌套combineReducer则是递归
      const nextStateForKey = reducer(previousStateForKey, action)
      // 如果此处key对应更新后的state是undefined(初始state和默认返回state上面已经检查了，这里应该是某个对应的action的返回值)
      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        // 抛出错误(如果需要忽略某个action返回值，直接返回state便可)
        throw new Error(errorMessage)
      }
      // 将reducer执行后的state放入nextState
      nextState[key] = nextStateForKey
      // 根据reducer执行后的state和执行前的state的引用对比
      // 因此reducer内部如果需要改变state，返回值一定要是新的state对象，不能使用引用
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    // 有改变则返回新的state，否则返回旧的state
    return hasChanged ? nextState : state
  }
}
