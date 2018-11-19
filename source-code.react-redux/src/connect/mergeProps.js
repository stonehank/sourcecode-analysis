import verifyPlainObject from '../utils/verifyPlainObject'

export function defaultMergeProps(stateProps, dispatchProps, ownProps) {
  return { ...ownProps, ...stateProps, ...dispatchProps }
}

export function wrapMergePropsFunc(mergeProps) {
  return function initMergePropsProxy(
    dispatch,
    // areMergedPropsEqual 就是 shallowEqual
    { displayName, pure, areMergedPropsEqual }
  ) {
    let hasRunOnce = false
    let mergedProps

    return function mergePropsProxy(stateProps, dispatchProps, ownProps) {
      // 执行 mergeProps
      const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps)

      // 后续是否重复更新(判断结果是否相等)
      if (hasRunOnce) {
        // 后续执行
        // 非pure 或者 不等(浅比较)，更新数据
        if (!pure || !areMergedPropsEqual(nextMergedProps, mergedProps))
          mergedProps = nextMergedProps
      } else {
        // 第一次执行 直接更新数据
        hasRunOnce = true
        mergedProps = nextMergedProps

        if (process.env.NODE_ENV !== 'production')
          verifyPlainObject(mergedProps, displayName, 'mergeProps')
      }

      return mergedProps
    }
  }
}

// 返回一个高阶函数，这个函数的需求是 dispatch 和 { displayName, pure, areMergedPropsEqual }
export function whenMergePropsIsFunction(mergeProps) {
  return typeof mergeProps === 'function'
    ? wrapMergePropsFunc(mergeProps)
    : undefined
}

export function whenMergePropsIsOmitted(mergeProps) {
  // 如果没有传 mergeProps，提供函数 默认返回包含所有数据(state,props)的对象
  return !mergeProps ? () => defaultMergeProps : undefined
}

export default [whenMergePropsIsFunction, whenMergePropsIsOmitted]
