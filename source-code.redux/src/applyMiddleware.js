import compose from './compose'
import createStore from "./createStore";

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */

/*
* 首先回顾调用方式：
* createStroe(reducer,preloadedState,enhancer)
* applyMiddleware(...middlewares)也就是enhancer,当enhancer有值时，调用方式如下：
* enhancer(createStore)(reducer, preloadedState)，也就变成了：
* applyMiddleware(...middlewares)(createStore)(reducer,preloadedState)
* 上面的实参刚好能套入下面形参
* 至于为什么要写成这样三层函数的形式
* 看这一句`const store = createStore(...args)`，这里的`...args`就是`reducer和preloadedState`，这就又回到createStore去执行，
* 这里获取到最新的store
*
* */

export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    // 获取最新store
    const store = createStore(...args)
    // 一个会报错的dispatch
    let dispatch = () => {
      throw new Error(
        `Dispatching while constructing your middleware is not allowed. ` +
          `Other middleware would not be applied to this dispatch.`
      )
    }
    // 定义2个API
    const middlewareAPI = {
      getState: store.getState,
      // 到目前，dispatch执行会报错的
      // 因为这时middleware正在构建中，是不允许使用dispatch
      // ```
      // (getState,dispatch)=>{
      //  // 这个阶段不允许使用dispatch
      //  return (next)=>(action)=>{
      //    //...otherCode;
      //  }
      // }
      // ```
      // 至于为什么middleware是上面的写法，继续往下看
      dispatch: (...args) => dispatch(...args)
    }
    // 定义chain 将每一个middleware执行并且传递API
    // 至此 我们能想象出来middleware是一个function，而且第一层参数是接收API，也就是`(getState,dispatch)`的，结构类似如下：
    // `(getState,dispatch)=>{返回值？}`，而通过map后，chain就是一个有middleware返回值组成的数组
    const chain = middlewares.map(middleware => middleware(middlewareAPI))

    // 第一个问题：那么它的返回值是什么呢？
    // 再接着看，compose
    // 先将compose最重要的一句挖出来：`return funcs.reduce((a, b) => (...args) => a(b(...args)))`
    // 可以看出这个chain里面每个值必须也是函数，说明middleware返回值就是函数，再次更新middleware的结构：
    // `(getState,dispatch)=>{(参数？)=>{返回值？}}`

    // 第二个问题：chain的返回值是否有参数？compose()后面那个`(store.dispatch)`有什么用？
    // 现在我们先假设一个数组，有3个函数，分别是x,y,z
    // 那么我们compose([x,y,z])会发生什么了，接下来就一步一步解释
    // 1. 变成reduce模式：`[x,y,z].reduce((a, b) => (...args) => a(b(...args)))
    // 2. reduce第一次执行，a为x，b为y，reduce内部返回(...args)=>x(y(...args))
    // 3. reduce第二次执行，因为会将上一次的返回值作为a，这次b为z，因此将z(...args)套进a的参数，变成：`(...args)=>x(y(z(...args)))`
    // 4. 执行结束，最后compose就返回了这么个东西`(...args)=>x(y(z(...args)))`
    // 因此，如果compose(...)(一些参数)，那么这里的参数将会套进上面返回值的(...args)，最终变成x(y(z(一些参数)))

    // 第三个问题：当z(一些参数)执行完毕后，如果再将参数继续传递给y呢？
    // 比较容易想到的就是，再次返回store.dispatch，dispatch的本质就是改变state，然后更新state（具体见createStore），
    // 因此如果返回store.dispatch，每次执行都是相同state，就算你之前改变了state，后面使用还是会使用未改变的state
    // 那么怎么办呢，这里用了一个很巧妙的办法，将第二个参数名称改为next，返回一个函数，参数就是action：action=>{...}，传递给下一个middleware时，
    // 下一个middleware调用next时,就会执行上一个middleware的代码，因此通过next(action)传递功能

    // 看明白了，这里也就很好理解，这里`store.dispatch`就是嵌套最里层的chain的参数，每次的返回值都是一次加强的"dispatch",再次更新middleware的结构：
    // ```
    // (getState,dispatch)=>{
    //  return (next)=>(action)=>{
    //    //...otherCode;
    //    next(action)
    //  }
    // }
    // ```

    // 这里更新dispatch为带有每个middleware功能的dispatch
    // 到这里，以后调用API的dispatch就是这个加强的dispatch了
    dispatch = compose(...chain)(store.dispatch)

    // 这里的返回值就是 createStore(reducer,state,applyMiddleware(...middleware))的返回值
    return {
      ...store,
      // 返回经过compose更新的dispatch
      dispatch
    }
  }
}
