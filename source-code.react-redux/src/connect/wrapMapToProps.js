import verifyPlainObject from '../utils/verifyPlainObject'

export function wrapMapToPropsConstant(getConstant) {
  return function initConstantSelector(dispatch, options) {
    const constant = getConstant(dispatch, options)

    function constantSelector() {
      return constant
    }
    constantSelector.dependsOnOwnProps = false
    return constantSelector
  }
}

// 判断是否传了 ownProp， 同时也用于 makePurePropsSelector 去决定当 ownProps改变的时候是否 唤醒
// dependsOnOwnProps is used by createMapToPropsProxy to determine whether to pass props as args
// to the mapToProps function being wrapped. It is also used by makePurePropsSelector to determine
// whether mapToProps needs to be invoked when props have changed.
//
// 当 mapToProps 的长度为1 说明 函数形参1个，说明mapToProps 不依赖 ownProps
// A length of one signals that mapToProps does not depend on props from the parent component.
// 当 mapToProps 的长度为0 说明使用了arugment或者...args等方式处理参数，因此判断会不准确
// A length of zero is assumed to mean mapToProps is getting args via arguments or ...args and
// therefore not reporting its length accurately..
export function getDependsOnOwnProps(mapToProps) {
  return mapToProps.dependsOnOwnProps !== null &&
    mapToProps.dependsOnOwnProps !== undefined
    ? Boolean(mapToProps.dependsOnOwnProps)
    : mapToProps.length !== 1
}

// Used by whenMapStateToPropsIsFunction and whenMapDispatchToPropsIsFunction,
// this function wraps mapToProps in a proxy function which does several things:
//
//    检测是否 mapToProps 是否根据ownProps 调用，这个检测的作用是能让 selectorFactory 决定是否观察 props的改变
//  * Detects whether the mapToProps function being called depends on props, which
//    is used by selectorFactory to decide if it should reinvoke on props changes.
//
//    第一次执行 mapToProps 如果还是返回了函数， 再次执行
//  * On first call, handles mapToProps if returns another function, and treats that
//    new function as the true mapToProps for subsequent calls.
//
//    第一次执行，确认返回值是否朴素对象
//  * On first call, verifies the first result is a plain object, in order to warn
//    the developer that their mapToProps function is not returning a valid result.
//

// 目的： 最多执行两次 mapToProps (根据是否传入ownProps参数)，检测返回值是否朴素对象
export function wrapMapToPropsFunc(mapToProps, methodName) {
  return function initProxySelector(dispatch, { displayName }) {
    // 初始 dependsOnOwnProps 为 true，传入 ownProps 并且检查 参数 mapToProps是否需要ownProps
    const proxy = function mapToPropsProxy(stateOrDispatch, ownProps) {
      return proxy.dependsOnOwnProps
        ? proxy.mapToProps(stateOrDispatch, ownProps)
        : proxy.mapToProps(stateOrDispatch)
    }

    // 最初设置为true
    // allow detectFactoryAndVerify to get ownProps
    proxy.dependsOnOwnProps = true

    proxy.mapToProps = function detectFactoryAndVerify(
      stateOrDispatch,
      ownProps
    ) {
      // 第一次执行，这里 再次执行proxy(...)的时候，就是执行 参数 mapToProps
      proxy.mapToProps = mapToProps
      proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps)
      let props = proxy(stateOrDispatch, ownProps)

      // 如果参数 mapToProps 执行后(props) 返回的还是一个函数，那么就要继续执行这个函数
      // 如果 返回的不是函数，那么就直接下一阶段的检测
      if (typeof props === 'function') {
        proxy.mapToProps = props
        proxy.dependsOnOwnProps = getDependsOnOwnProps(props)
        props = proxy(stateOrDispatch, ownProps)
      }

      // 检测 props是否是 朴素对象
      if (process.env.NODE_ENV !== 'production')
        verifyPlainObject(props, displayName, methodName)

      return props
    }

    return proxy
  }
}
