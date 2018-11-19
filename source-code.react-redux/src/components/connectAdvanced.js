import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'
import React, { Component, PureComponent } from 'react'
import { isValidElementType } from 'react-is'

import { ReactReduxContext } from './Context'

export default function connectAdvanced(
  /*
    selectorFactory is a func that is responsible for returning the selector function used to
    compute new props from state, props, and dispatch. For example:

      export default connectAdvanced((dispatch, options) => (state, props) => ({
        thing: state.things[props.thingId],
        saveThing: fields => dispatch(actionCreators.saveThing(props.thingId, fields)),
      }))(YourComponent)

    Access to dispatch is provided to the factory so selectorFactories can bind actionCreators
    outside of their selector as an optimization. Options passed to connectAdvanced are passed to
    the selectorFactory, along with displayName and WrappedComponent, as the second argument.

    Note that selectorFactory is responsible for all caching/memoization of inbound and outbound
    props. Do not use connectAdvanced directly without memoizing results between calls to your
    selector, otherwise the Connect component will re-render on every state or props change.
  */

  // 提供给 selectFactory  dispatch和options，并且使用 memoization，防止重复渲染
  selectorFactory,
  // options object:
  {
    // the func used to compute this HOC's displayName from the wrapped component's displayName.
    // probably overridden by wrapper functions such as connect()
    getDisplayName = name => `ConnectAdvanced(${name})`,

    // shown in error messages
    // probably overridden by wrapper functions such as connect()
    methodName = 'connectAdvanced',

    // REMOVED: if defined, the name of the property passed to the wrapped element indicating the number of
    // calls to render. useful for watching in react devtools for unnecessary re-renders.
    renderCountProp = undefined,

    // determines whether this HOC subscribes to store changes
    shouldHandleStateChanges = true,

    // REMOVED: the key of props/context to get the store
    storeKey = 'store',

    // REMOVED: expose the wrapped component via refs
    withRef = false,

    // use React's forwardRef to expose a ref of the wrapped component
    forwardRef = false,

    // React的createContext
    // the context consumer to use
    context = ReactReduxContext,

    // additional options are passed through to the selectorFactory
    ...connectOptions
  } = {}
) {
  // 不满足 参数1 则发出 参数2 的消息
  invariant(
    renderCountProp === undefined,
    `renderCountProp is removed. render counting is built into the latest React dev tools profiling extension`
  )

  invariant(
    !withRef,
    'withRef is removed. To access the wrapped instance, use a ref on the connected component'
  )

  const customStoreWarningMessage =
    'To use a custom Redux store for specific components,  create a custom React context with ' +
    "React.createContext(), and pass the context object to React-Redux's Provider and specific components" +
    ' like:  <Provider context={MyContext}><ConnectedComponent context={MyContext} /></Provider>. ' +
    'You may also pass a {context : MyContext} option to connect'

  invariant(
    storeKey === 'store',
    'storeKey has been removed and does not do anything. ' +
      customStoreWarningMessage
  )

  const Context = context

  return function wrapWithConnect(WrappedComponent) {
    // 检查 WrappedComponent 是否符合要求
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        isValidElementType(WrappedComponent),
        `You must pass a component to the function returned by ` +
          `${methodName}. Instead received ${JSON.stringify(WrappedComponent)}`
      )
    }

    /* ...获取传入的WrappedComponent的名称... */
    const wrappedComponentName =
      WrappedComponent.displayName || WrappedComponent.name || 'Component'

    /* ...通过WrappedComponent的名称计算出当前HOC的名称... */
    const displayName = getDisplayName(wrappedComponentName)

    const selectorFactoryOptions = {
      // 其他参数
      ...connectOptions,
      // HOC displayname
      getDisplayName,
      // 方法名称 "connectAdvanced"
      methodName,
      // 指定渲染次数，用于调试
      renderCountProp,
      // 是否监控stroe改变
      shouldHandleStateChanges,
      storeKey,
      // 获取的display
      displayName,
      // 被包裹组件名称
      wrappedComponentName,
      // 被包裹组件
      WrappedComponent
    }

    const { pure } = connectOptions

    // Component就是React.Component
    let OuterBaseComponent = Component
    let FinalWrappedComponent = WrappedComponent

    // 是否纯组件
    if (pure) {
      OuterBaseComponent = PureComponent
    }

    // 更新数据
    function makeDerivedPropsSelector() {
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
          // 返回一个接受 nextState 和 nextProps的函数（也就是最新的Provider的value）
          // 这个函数作用是 比较是否有变化，并且是否执行新的 mapStateToProps 和 mapDispatchToProps 传递给组件
          sourceSelector = selectorFactory(
            store.dispatch,
            selectorFactoryOptions
          )
        }

        // 更新
        lastProps = props
        lastState = state

        // 传递最新的数据，返回一个数据(有可能是新的(引用)，有可能是旧的)
        // 判断标准在于 检查props和state是否有变化
        // 具体看 selectorFactory.js 的 pureFinalPropsSelector
        const nextProps = sourceSelector(state, props)

        // 上面返回的结果(也就是内部函数pureFinalPropsSelector，返回的mergeProps，这里仅仅是全等比较)
        if (lastDerivedProps === nextProps) {
          return lastDerivedProps
        }

        // 更新 lastDerivedProps
        // 返回 lastDerivedProps，也就是（包裹了 mapStateToProps、mapDispatchToProps等结果）要传递给组件的最新props结果
        lastDerivedProps = nextProps
        return lastDerivedProps
      }
    }

    // 渲染自定义组件 也就是WrappedComponent
    function makeChildElementSelector() {
      let lastChildProps, lastForwardRef, lastChildElement

      return function selectChildElement(childProps, forwardRef) {
        if (childProps !== lastChildProps || forwardRef !== lastForwardRef) {
          lastChildProps = childProps
          lastForwardRef = forwardRef
          lastChildElement = (
            <FinalWrappedComponent {...childProps} ref={forwardRef} />
          )
        }

        return lastChildElement
      }
    }

    class Connect extends OuterBaseComponent {
      constructor(props) {
        super(props)
        invariant(
          forwardRef ? !props.wrapperProps[storeKey] : !props[storeKey],
          'Passing redux store in props has been removed and does not do anything. ' +
            customStoreWarningMessage
        )
        this.selectDerivedProps = makeDerivedPropsSelector()
        this.selectChildElement = makeChildElementSelector()
        this.renderWrappedComponent = this.renderWrappedComponent.bind(this)
      }

      // Provider 提供的 value ，包括{store,storeState}，其中storeState=store.getState()
      renderWrappedComponent(value) {
        invariant(
          value,
          `Could not find "store" in the context of ` +
            `"${displayName}". Either wrap the root component in a <Provider>, ` +
            `or pass a custom React context provider to <Provider> and the corresponding ` +
            `React context consumer to ${displayName} in connect options.`
        )
        const { storeState, store } = value

        // 传入自定义组件的props
        let wrapperProps = this.props
        let forwardedRef

        if (forwardRef) {
          wrapperProps = this.props.wrapperProps
          forwardedRef = this.props.forwardedRef
        }

        // 返回经过与 前一次结果比较后的 最终结果(包括最新的state,props)
        let derivedProps = this.selectDerivedProps(
          storeState,
          wrapperProps,
          store
        )

        // 返回最终渲染的自定义组件
        return this.selectChildElement(derivedProps, forwardedRef)
      }

      render() {
        // React的createContext
        const ContextToUse = this.props.context || Context

        return (
          <ContextToUse.Consumer>
            {this.renderWrappedComponent}
          </ContextToUse.Consumer>
        )
      }
    }

    Connect.WrappedComponent = WrappedComponent
    Connect.displayName = displayName

    if (forwardRef) {
      const forwarded = React.forwardRef(function forwardConnectRef(
        props,
        ref
      ) {
        return <Connect wrapperProps={props} forwardedRef={ref} />
      })

      forwarded.displayName = displayName
      forwarded.WrappedComponent = WrappedComponent
      return hoistStatics(forwarded, WrappedComponent)
    }
    // 拷贝 WrappedComponent 组件内部的所有静态方法到 Connect 组件内，返回 Connect 组件
    return hoistStatics(Connect, WrappedComponent)
  }
}
