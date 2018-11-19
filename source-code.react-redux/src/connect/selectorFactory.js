import verifySubselectors from './verifySubselectors'

export function impureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch
) {
  return function impureFinalPropsSelector(state, ownProps) {
    return mergeProps(
      mapStateToProps(state, ownProps),
      mapDispatchToProps(dispatch, ownProps),
      ownProps
    )
  }
}

export function pureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  // 全等比较          shallowEqual       shallowEqual
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  let hasRunAtLeastOnce = false
  let state
  let ownProps
  let stateProps
  let dispatchProps
  let mergedProps

  // 第一次执行
  function handleFirstCall(firstState, firstOwnProps) {
    state = firstState
    ownProps = firstOwnProps
    stateProps = mapStateToProps(state, ownProps)
    dispatchProps = mapDispatchToProps(dispatch, ownProps)
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    hasRunAtLeastOnce = true
    return mergedProps
  }

  function handleNewPropsAndNewState() {
    // 因为state和props都有变动 所以无论是否订阅 ownProps， mapStateToProps都会执行
    // 此处不需要浅比较检查，因为props改变了，mergeProps一定会返回一个新的值
    stateProps = mapStateToProps(state, ownProps)

    // 只有订阅了 ownProps的dispatch 才会执行
    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)

    // 必定执行
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewProps() {
    // state无变动，只有订阅了ownProps的 mapStateToProps 才会执行
    if (mapStateToProps.dependsOnOwnProps)
      stateProps = mapStateToProps(state, ownProps)

    // 只有订阅了 ownProps的 mapDispatchToProps 才会执行
    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)
    // 必定执行
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewState() {
    // props无变动，state有变动，因此 mapDispatchToProps 不执行，mapStateToProps执行
    const nextStateProps = mapStateToProps(state, ownProps)
    // 当state有变动，要检查
    // 之所以这里需要浅比较检查，因为如果没有浅比较检查，而两者浅比较相等，
    // mergedProps返回后，只会全等判断，检查不出来的，那么就会认为返回一个新的props，也就是相当于重复渲染了
    const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps)
    stateProps = nextStateProps

    if (statePropsChanged)
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps)

    // 必定执行
    return mergedProps
  }

  function handleSubsequentCalls(nextState, nextOwnProps) {
    // 浅比较不等
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    // === 比较 不等
    const stateChanged = !areStatesEqual(nextState, state)
    // 更新state 和 ownProps
    state = nextState
    ownProps = nextOwnProps

    // 只要 props 有变动，一定要返回新值(新的引用)
    // 如果 props 相同，state 有变动 则返回新值； state 无变动，返回旧值
    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    return mergedProps
  }

  return function pureFinalPropsSelector(nextState, nextOwnProps) {
    return hasRunAtLeastOnce
      ? handleSubsequentCalls(nextState, nextOwnProps)
      : handleFirstCall(nextState, nextOwnProps)
  }
}

// TODO: Add more comments

// If pure is true, the selector returned by selectorFactory will memoize its results,
// allowing connectAdvanced's shouldComponentUpdate to return false if final
// props have not changed. If false, the selector will always return a new
// object and shouldComponentUpdate will always return true.

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
