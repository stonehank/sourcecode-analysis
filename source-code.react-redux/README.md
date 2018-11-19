> 注意：文章很长，只想了解逻辑而不深入的，可以直接跳到最后的[总结部分](#总结)。

-----

## 初识


首先，从它暴露对外的`API`开始

```
ReactReduxContext
/*
提供了 React.createContext(null)
*/

Provider  
/*
一个储存数据的组件，渲染了ContextProvider，内部调用redux中store.subscribe
订阅数据，每当redux中的数据变动，比较新值与旧值，判断是否重新渲染
*/ 

connect
/* 
一个高阶组件，第一阶传入对数据处理方法，第二阶传入要渲染的组件
内部处理了：
1. 对参数的检查
2. 对传入的数据处理方法进行处理
(没传怎么处理，传了提供什么参数，传的类型不同怎么处理，结果如何比较等等)
3. 静态方法转移
4. 对渲染组件的传递(传递给connectAdvanced)
*/

connectAdvanced
/*
保存每一次执行的数据，执行connect定义的方案和逻辑，新旧数据对比(全等对比)，渲染组件
这里作为公开API，如果我们去使用，那么connect里面的逻辑就需要我们自定义了。
*/
```

现在对它的大概工作范围有了解后，我们可以开始沿着执行顺序分析。

-----

## 抽丝

### Provider 

我们使用时，当写完了redux的`reducer`, `action`, `bindActionCreators`, `combineReducers`, `createStore`这一系列内容后，
我们得到了一个`store`

会先使用`<Provider store={store}`包裹住根组件。

这时，`Provider`组件开始工作

```
componentDidMount() {
  this._isMounted = true
  this.subscribe()
}
```
第一次加载，需要执行`subscribe`

`subscribe`是什么呢，就是对`redux`的`store`执行`subscribe`一个自定义函数，
这样，每当数据变动，这个函数便会执行

```js
subscribe() {
  const { store } = this.props
  // redux 的 store 订阅
  // 订阅后，每当state改变 则自动执行这个函数
  this.unsubscribe = store.subscribe(() => {
    // store.getState() 获取最新的 state
    const newStoreState = store.getState()
    // 组件未加载，取消
    if (!this._isMounted) {
      return
    }
    // 比较state是否相等，全等的不更新
    this.setState(providerState => {
      if (providerState.storeState === newStoreState) {
        return null
      }
      return { storeState: newStoreState }
    })
  })
  /* ... */
}
```

看到吗，这个自定义函数非常简单，每次收到数据，进行全等比较，不等则更新数据。

这个组件的另2个生命周期函数：
```
componentWillUnmount() {
  if (this.unsubscribe) this.unsubscribe()
  this._isMounted = false
}

componentDidUpdate(prevProps) {
  // 比较store是否相等,如果相等则跳过
  if (this.props.store !== prevProps.store) {
    // 取消订阅之前的，再订阅现在的(因为数据(store)不同了)
    if (this.unsubscribe) this.unsubscribe()
    this.subscribe()
  }
}
```
这2段的意思就是，每当数据变了，就取消上一次数据的订阅，在订阅本次的数据，
当要销毁组件，取消订阅。

> 一段题外话(可跳过)：
> 
> 这个逻辑用`Hooks`的`useEffect`简直完美匹配！
> 
> ```js
> useEffect(()=>{
>   subscribe()
>   return ()=>{
>     unSubscribe()
>   }
> },props.data)
> ```
> 这段的意思就是，当`props.data`发生改变，执行`unSubscribe()`，再执行`subscribe()`。
> 
> 逻辑完全一致有没有！

最后的`render`：

这里`Context`就是`React.createContext(null)`

```js
<Context.Provider value={this.state}>
  {this.props.children}
</Context.Provider>
```

到这里我称为`react-redux`的第一阶段。

一个小总结，第一阶段就做了1件事：

定义了`Provider`组件，内部订阅了`store`。

-----

### connect

到主菜了，先看它的`export`

`export default createConnect()`

一看，我们应该有个猜测，这货`createConnect`是个高阶函数。

看看它的参数吧。
```js
export function createConnect({
  connectHOC = connectAdvanced,
  mapStateToPropsFactories = defaultMapStateToPropsFactories,
  mapDispatchToPropsFactories = defaultMapDispatchToPropsFactories,
  mergePropsFactories = defaultMergePropsFactories,
  selectorFactory = defaultSelectorFactory
} = {}) {
  /* ... */
}
```

> 题外话：一个编写默认对象内部含有默认值的方法
> ```
> function a({x=1,y=2}={}){}
> 
> a()      // x:1,y:2
> a({})    // x:1,y:2
> a({x:2,z:5}) //x:2,y:2
> ```

这里先说明一下它的参数，后面读起来会很顺。

```
connectHOC: 一个重要组件，用于执行已确定的逻辑，渲染最终组件，后面会详细说。
mapStateToPropsFactories: 对 mapStateToProps 这个传入的参数的类型选择一个合适的方法。
mapDispatchToPropsFactories: 对 mapDispatchToProps 这个传入的参数的类型选择一个合适的方法。
mergePropsFactories: 对 mergeProps 这个传入的参数的类型选择一个合适的方法。 
selectorFactory: 以上3个只是简单的返回另一个合适的处理方法，它则执行这些处理方法，并且对结果定义了如何比较的逻辑。
```

可能有点绕，但`react-redux`就是这么一个个高阶函数组成的，`selectorFactory`后面会详细说。

首先我们再次确定这3个名字很长，实际很简单的函数(源码这里不放了)

`mapStateToPropsFactories`

 `mapDispatchToPropsFactories`
 
 `mergePropsFactories`
 
它们只是判断了参数是否存在，是什么类型，并且返回一个合适的处理方法，它们并没有任何处理逻辑。

* 举个例子：

    `const MyComponent=connect((state)=>state.articles})`
    
    这里我只定义了`mapStateToProps`，并且是个`function`，那么`mapStateToPropsFactories`就会返回一个
    处理`function`的方法。
    
    我没有定义`mapDispatchToProps`，那么`mapDispatchToPropsFactories`检测不到参数，
    则会提供一个默认值`dispatch => ({ dispatch })`，返回一个处理`非function`(object)的方法。

那么处理逻辑是谁定义呢？

#### wrapMapToProps

`wrapMapToProps.js`这个文件内部做了以下事情：

1. 定义了一个处理`object`的方法(简单的返回即可，因为最终目的就是要object)。
2. 定义了一个处理`函数`和`高阶函数`(执行2次)的方法，这个方法比上面的复杂在于它需要检测参数是否订阅了`ownProps`。

检测方法很简单，就是检查参数的`length`（这里`dependsOnOwnProps`是上一次检查的结果，如果存在则不需要再次检查）
```js
export function getDependsOnOwnProps(mapToProps) {
  return mapToProps.dependsOnOwnProps !== null &&
    mapToProps.dependsOnOwnProps !== undefined
    ? Boolean(mapToProps.dependsOnOwnProps)
    : mapToProps.length !== 1
}
```

回到connect，继续往下看

```js
export function createConnect({
  /* 上面所讲的参数 */
} = {}) {
  return function connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    {
      pure = true,
      areStatesEqual = strictEqual,
      areOwnPropsEqual = shallowEqual,
      areStatePropsEqual = shallowEqual,
      areMergedPropsEqual = shallowEqual,
      ...extraOptions
    } = {}
  ) {
  /* ... */
  }
}
```

已经到了我们传递参数的地方，前3个参数意思就不解释了，最后的参数`options`

```
areStatesEqual = strictEqual,           // ===比较
areOwnPropsEqual = shallowEqual,        // 浅比较
areStatePropsEqual = shallowEqual,      // 浅比较
areMergedPropsEqual = shallowEqual,     // 浅比较
```

它们用在`selectorFactory`这个比较数据结果的方法内部。

继续往下看

```js
export function createConnect({
  /* 上面已讲 */
} = {}) {
  return function connect(
    /* 上面已讲 */
  ) {
    const initMapStateToProps = match(
      mapStateToProps,
      mapStateToPropsFactories,
      'mapStateToProps'
    )
    const initMapDispatchToProps = match(
      mapDispatchToProps,
      mapDispatchToPropsFactories,
      'mapDispatchToProps'
    )
    const initMergeProps = match(mergeProps, mergePropsFactories, 'mergeProps')
```

这里定义了3个变量(函数)，`match`的作用是什么？

以`mapStateToProps`举例来说，

因为上面也说了，`mapStateToPropsFactories`里面有多个方法，需要找到一个适合`mapStateToProps`的，
`match`就是干这事了。

`match`方法内部遍历`mapStateToPropsFactories`所有的处理方法，任何一个方法能够匹配参数`mapStateToProps`，便被`match`捕获返回，
如果一个都找不到则报错提示参数配置错误。

现在这3个变量定义明确了，都是对应的参数的合适的处理方法。

至此，我们已经完成了第二阶段，

做个小总结，第二阶段做了哪些事：

1. `connect`接收了对参数处理方案(3个`...Factories`)。
2. `connect`接收了参数的结果比较方案(`selectFactory`)
3. `connect`接收了参数(`mapStateToProps`,`mapDispatchToProps`,`mergeProps`,`options`)。
4. 定义了比较方案(4个`are...Equal`，其实就是`全等比较`和`浅比较`)。


前2个阶段都是定义阶段，接下来需要我们传入自定义组件，也就是最后一个阶段

`connect(...)(Component)`

-----

接着看`connect`源码

```js
export function createConnect({
  /* 上面已讲 */
} = {}) {
  return function connect(
    /* 上面已讲 */
  ) {
    /* 上面已讲 */
    return connectHOC(selectorFactory, {
      // 方法名称，用在错误提示信息
      methodName: 'connect',
      // 最终渲染的组件名称
      getDisplayName: name => `Connect(${name})`,
      shouldHandleStateChanges: Boolean(mapStateToProps),
      // 以下是传递给 selectFactory
      initMapStateToProps,
      initMapDispatchToProps,
      initMergeProps,
      pure,
      areStatesEqual,
      areOwnPropsEqual,
      areStatePropsEqual,
      areMergedPropsEqual,

      // any extra options args can override defaults of connect or connectAdvanced
      ...extraOptions
    })
  }
}
```

这里执行了`connectHOC()`，传递了上面已经讲过的参数，而`connectHOC = connectAdvanced`

因此我们进入最后一个对外`API`，`connectAdvanced`

### connectAdvanced

`connectAdvanced`函数，之前也提过，就是一个执行、组件渲染和组件更新的地方。

它里面没有什么新概念，都是将我们上面讲到的参数进行调用，最后根据结果进行渲染新组件。

还是从源码开始

```js
export default function connectAdvanced(
  selectorFactory,
  {
    // 执行后作用于connect这个HOC组件名称
    getDisplayName = name => `ConnectAdvanced(${name})`,
    // 用于错误提示
    methodName = 'connectAdvanced',
    // 有REMOVED标志，这里不关注
    renderCountProp = undefined,
    // 确定connect这个HOC是否订阅state变动，好像已经没有用到了
    shouldHandleStateChanges = true,
    // 有REMOVED标志，这里不关注
    storeKey = 'store',
    // 有REMOVED标志，这里不关注
    withRef = false,
    // 是否通过 forwardRef 暴露出传入的Component的DOM
    forwardRef = false,
    // React的createContext
    context = ReactReduxContext,

    // 其余的(比较方法，参数处理方法等)将会传递给上面的 selectFactory
    ...connectOptions
  } = {}
) {
  /* ... */
}
```

参数也没什么特别的，有一个`forwardRef`作用就是能获取到我们传入的`Component`的DOM。
这里也不深入。

接着看

```js
export default function connectAdvanced(
  /* 上面已讲 */
) {
  /* ...对参数的一些验证和提示哪些参数已经作废... */
  
  // 定义Context
  const Context = context

  return function wrapWithConnect(WrappedComponent) {
    /* ...检查 WrappedComponent 是否符合要求... */
   
    /* ...获取传入的WrappedComponent的名称... */
   
    /* ...通过WrappedComponent的名称计算出当前HOC的名称... */

    /* ...获取一些上面的参数(没有新的参数,都是之前见过的)... */

    // Component就是React.Component
    let OuterBaseComponent = Component
    let FinalWrappedComponent = WrappedComponent

    // 是否纯组件
    if (pure) {
      OuterBaseComponent = PureComponent
    }

    /* 定义 makeDerivedPropsSelector 方法，作用后面讲 */

    /* 定义 makeChildElementSelector 方法，作用后面讲 */

    /* 定义 Connect 组件，作用后面讲 */

    Connect.WrappedComponent = WrappedComponent
    Connect.displayName = displayName

    /* ...如果是forWardRef 为true的情况，此处不深入... */
    
    // 静态方法转换
    return hoistStatics(Connect, WrappedComponent)
  }
}
```

这一段特别长，因此我将不太重要的直接用注释说明了它们在做什么，具体代码就不放了(不重要)。

并且定义了3个新东西，`makeDerivedPropsSelector`，`makeChildElementSelector`,`Connect`。

先看最后一句`hoistStatics`就是`hoist-non-react-statics`，它的作用是将组件`WrappedComponent`的所有非`React`
静态方法传递到`Connect`内部。

那么最终它还是返回了一个`Connect`组件。

#### Connect组件

这个组件已经是我们写了完整`connect(...)(Component)`的返回值了，所以能确定，只要调用`<Connect />`，就能渲染出一个新的组件出来。

因此它的功能就是确定是否重复更新组件和确定到底更新什么？

看一个组件，从`constructor`看起

```js
class Connect extends OuterBaseComponent {
  constructor(props) {
    super(props)
   
    /* ...提示一些无用的参数...*/
    
    this.selectDerivedProps = makeDerivedPropsSelector()
    this.selectChildElement = makeChildElementSelector()
    this.renderWrappedComponent = this.renderWrappedComponent.bind(this)
  }
  /* ... */
}
```

绑定了一个方法，看名字是render的意思，先不管它。

执行了2个函数。

`Connect`组件还没完，这里先放着，我们先看`makeDerivedPropsSelector`和`makeChildElementSelector`

#### makeDerivedPropsSelector

```js
function makeDerivedPropsSelector() {
  // 闭包储存上一次的执行结果
  let lastProps
  let lastState
  let lastDerivedProps
  let lastStore
  let sourceSelector

  return function selectDerivedProps(state, props, store) {
    // props和state都和之前相等 直接返回上一次的结果
    if (pure && lastProps === props && lastState === state) {
      return lastDerivedProps
    }

    // 当前store和lastStore不等，更新lastStore
    if (store !== lastStore) {
      lastStore = store
      
      // 终于调用 selectorFactory 了
      sourceSelector = selectorFactory(
        store.dispatch,
        selectorFactoryOptions
      )
    }

    // 更新数据
    lastProps = props
    lastState = state

    // 返回的就是最终的包含所有相应的 state 和 props 的结果
    const nextProps = sourceSelector(state, props)

    // 最终的比较
    if (lastDerivedProps === nextProps) {
      return lastDerivedProps
    }
    lastDerivedProps = nextProps
    return lastDerivedProps
  }
}
```

大概的说，`makeDerivedPropsSelector`的执行，先判断了当前传入的`props(组件的props)`和`state(redux传入的state)`
跟以前的是否全等，如果全等就不需要更新了；

如果不等，则调用了高阶函数`selectFactory`，并且获得最终数据，最后再判断最终数据和之前的最终数据是否全等。

为什么第一次判断了，还要判断第二次，而且都是`===`判断？

因为第一次获取的`state`是`redux`传入的，是整个APP的所有数据，它们不等说明有组件更新了，但不确定是否是当前组件；

第二次比较的是当前组件的最新数据和以前数据对比。

现在，我们知道`selectFactory`的作用是获取当前组件的的最新数据，深入源码看看。

#### selectFactory

```js
export default function finalPropsSelectorFactory(
  // redux store的store.dispatch
  dispatch,
  // 3种已经确定了的处理方法
  { initMapStateToProps, initMapDispatchToProps, initMergeProps, ...options }
) {
  // 返回一个针对用户传入的类型的解析函数
  // 例如 mapStateToProps 如果是function，那么就返回proxy，proxy可以判断是否需要ownProps，并且对高阶函数的 mapStateToProps 进行2次处理，
  // 最终确保返回一个plainObject，否则报错
  const mapStateToProps = initMapStateToProps(dispatch, options)
  const mapDispatchToProps = initMapDispatchToProps(dispatch, options)
  const mergeProps = initMergeProps(dispatch, options)

  if (process.env.NODE_ENV !== 'production') {
    verifySubselectors(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options.displayName
    )
  }

  const selectorFactory = options.pure
    ? pureFinalPropsSelectorFactory
    : impureFinalPropsSelectorFactory

  // 默认pure问题true，因此执行 pureFinalPropsSelectorFactory(...)
  return selectorFactory(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    dispatch,
    options
  )
}
```

参数就不说了，看注释。

以下3个，到底返回了什么，源码在`wrapMapToProps.js`，[上面](#wrapMapToProps)也说过这个文件内部做了什么事情。
```
const mapStateToProps = initMapStateToProps(dispatch, options)
const mapDispatchToProps = initMapDispatchToProps(dispatch, options)
const mergeProps = initMergeProps(dispatch, options)
```

这3个调用返回的一个函数，名字叫`proxy`，这个`proxy`一旦调用，
就能返回经过`mapStateToProps`, `mapDispatchToProps`, `mergeProps`这3个参数处理过后的数据(`plainObject`)。

接下来：

```js
const selectorFactory = options.pure
    ? pureFinalPropsSelectorFactory
    : impureFinalPropsSelectorFactory

  // 默认pure问题true，因此执行 pureFinalPropsSelectorFactory(...)
  return selectorFactory(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    dispatch,
    options
  )
```

返回了`selectorFactory`的调用值，也就是`pureFinalPropsSelectorFactory`(pure默认为true)。

看`pureFinalPropsSelectorFactory`，它的代码不少，但逻辑很明了，大方向就是对比数据。

这里关键的如何比较不列代码，只用注释讲明白它的逻辑。

```js
export function pureFinalPropsSelectorFactory(
  // 接受3个proxy方法
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  // 接受3个比较方法
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  
  /* ...定义变量保存之前的数据(闭包)... */

  function handleFirstCall(firstState, firstOwnProps) {
    /* ...定义第一次执行数据比较的方法，也就是简单的赋值给上面定义的闭包变量... */
  }

  function handleNewPropsAndNewState() {
    /* 当state和props都有变动时的处理方法 */
  }

  function handleNewProps() {
    /* 当state无变动，props有变动时的处理方法 */
  }

  function handleNewState() {
    /* 当state有变动，props无变动时的处理方法 */
  }

  // 后续数据比较的方法
  function handleSubsequentCalls(nextState, nextOwnProps) {
    // 浅比较
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    // 全等比较
    const stateChanged = !areStatesEqual(nextState, state)
    // 更新数据
    state = nextState
    ownProps = nextOwnProps
    // 当发生不相等的3种情况(关键)
    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    // 比较都相等，直接返回旧值
    return mergedProps
  }
  return function pureFinalPropsSelector(nextState, nextOwnProps) {
    return hasRunAtLeastOnce
      ? handleSubsequentCalls(nextState, nextOwnProps)
      : handleFirstCall(nextState, nextOwnProps)
  }
}
```
上面的闭包变量储存了上一次的数据，关键点就是当和这一次的数据比较后，如果处理更新。

`react-redux`将它分为3种情况

* `state`和`props`都相等。
* `state`相等，`props`不等。
* `state`不等，`props`相等。

-----

* 第一种：`state`和`props`都相等

    * mapStateToProps(proxy)：
    
      不管是否订阅`ownProps`，执行`mapStateToProps`， 因为`state`有变动。
    
    * mapDispatchToProps(proxy)：
    
        只有订阅了`ownProps`，才会执行`mapDispatchToProps`，因为`state`变动与`mapDispatchToProps`无影响。
    
    * mergedProps(proxy)：
    
        必定执行，将所有结果合并。

* 第二种：`state`相等，`props`不等

    * mapStateToProps(proxy)：
    
      只有订阅了`ownProps`，才会执行`mapStateToProps`， 因为`state`无变动。
    
    * mapDispatchToProps(proxy)：
    
        只有订阅了`ownProps`，才会执行`mapDispatchToProps`，因为`state`变动与`mapDispatchToProps`无影响。
    
    * mergedProps(proxy)：
    
        必定执行，将所有结果合并。

* 第三种：`state`不等，`props`相等

    * mapStateToProps(proxy)：
    
        不管是否订阅`ownProps`，执行`mapStateToProps`， 因为`state`有变动。
    
        注意，这里结果需要`浅比较`判断
        
        因为如果没有`浅比较`检查，而两者刚好`浅比较相等`，
        那么最后也会认为返回一个新的props，也就是相当于重复更新了。
        
        之所以第一个`state`和`props`都有变动的不需要浅比较检查，
        是因为如果`props`变了，则必须要更新组件。
    
    * mapDispatchToProps(proxy)：
    
        不会执行，因为它只关注`props`。
        
    * mergedProps(proxy)：
    
        只有上面浅比较不等，才会执行。


`makeDerivedPropsSelector`的总结：

通过闭包管理数据，并且通过浅比较和全等比较判断是否需要更新组件数据。

#### makeChildElementSelector

`makeChildElementSelector`也是一个高阶函数，储存了之前的`数据`和`组件`，并且判断与当前的判断。

这里是最终渲染组件的地方，因为需要判断一下刚才最终给出的数据是否需要去更新组件。

2个逻辑：

1. 数据与之前不等(`===`)，更新组件。
2. `forWardRef`属性值与之前不等，更新组件。

否则，返回旧组件(不更新)。

继续回到`Connect`组件。

之后就是`render`了

```js
render() {
  // React的createContext
  const ContextToUse = this.props.context || Context

  return (
    <ContextToUse.Consumer>
      {this.renderWrappedComponent}
    </ContextToUse.Consumer>
  )
}
```

`Context.Consumer`内部必须是一个函数，这个函数的参数就是`Context.Provider`的`value`，也就是`redux`的`store`。

#### renderWrappedComponent

最后一个函数：`renderWrappedComponent`

```js
renderWrappedComponent(value) {
  /* ...验证参数有效性... */
  
  // 这里 storeState=store.getState()
  const { storeState, store } = value

  // 传入自定义组件的props
  let wrapperProps = this.props
  
  let forwardedRef
  if (forwardRef) {
    wrapperProps = this.props.wrapperProps
    forwardedRef = this.props.forwardedRef
  }

  // 上面已经讲了，返回最终数据
  let derivedProps = this.selectDerivedProps(
    storeState,
    wrapperProps,
    store
  )

  // 返回最终渲染的自定义组件
  return this.selectChildElement(derivedProps, forwardedRef)
}
```

总算结束了，可能有点混乱，做个总结吧。

-----

## 总结

我把`react-redux`的执行流程分为3个阶段，分别对应我们的代码编写(搭配导图阅读)

-----

一张导图：

![react-redux导图 by stonehank](https://raw.githubusercontent.com/stonehank/sourcecode-analysis/master/source-code.react-redux/React-Redux.png)

-----

第一阶段：

对应的用户代码：
```
<Provider store={store}>
  <App />
</Provider>
```
执行内容有：

1. 定义了`Provider`组件，这个组件内部订阅了`redux`的`store`，保证当`store`发生变动，会立刻执行更新。

-----

第二阶段：

对应的用户代码：
```
connect(mapStateToProps,mapDispatchToProps,mergeProps,options)
```

执行内容有：

1. `connect`接收了参数(`mapStateToProps`,`mapDispatchToProps`,`mergeProps`,`options`)。
2. `connect`接收了对参数如何处理方案(3个`...Factories`)。
3. `connect`接收了参数的结果比较方案(`selectFactory`)
4. 定义了比较方案(4个`are...Equal`，其实就是`全等比较`和`浅比较`)。

-----

第三阶段：

对应的用户代码：
```
let newComponent=connect(...)(Component)

<newComponent />
```

执行内容有：

1. 接受自定义组件(`Component`)。
2. 创建一个`Connect`组件。
3. 将`Component`的非`React`静态方法转移到`Connect`。
4. 获取`Provider`传入的`数据`(`redux`的整个数据)，利用闭包保存数据，用于和未来数据做比较。
5. 当比较(`===`)有变动，执行上一阶段传入的参数，获取当前组件真正的数据。
6. 利用闭包保存当前组件真正的数据，用于和未来作比较。
7. 通过全等和浅比较，处理`state`变动和`props`变动的逻辑，判断返回新数据还是旧数据。
8. 利用闭包保存渲染的组件，通过上面返回的最终数据，判断需要返回新组件还是就组件。

逻辑理顺了，还是很好理解的。

其中第三阶段就是对外API`connectAdvanced`的执行内容。

-----

[此处](https://github.com/stonehank/sourcecode-analysis)查看更多前端源码阅读内容。

或许哪一天，我们需要设计一个专用的数据管理系统，那么就利用好`connectAdvanced`，
我们要做的就是编写一个自定义`第二阶段`的逻辑体系。

感谢阅读！

