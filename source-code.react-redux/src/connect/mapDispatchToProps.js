import { bindActionCreators } from 'redux'
import { wrapMapToPropsConstant, wrapMapToPropsFunc } from './wrapMapToProps'

export function whenMapDispatchToPropsIsFunction(mapDispatchToProps) {
  // 如果是function  返回一个执行函数，
  // 可以给这个函数传入state或者dispatch（取决于是 mapStateToProps 还是 mapDispatchToProps）和displayName
  // 这个返回的函数执行后的作用是，检测是否需要ownProps并且执行 mapStateToProps()
  // 最终返回一个朴素对象，如果不是朴素对象则报错
  return typeof mapDispatchToProps === 'function'
    ? wrapMapToPropsFunc(mapDispatchToProps, 'mapDispatchToProps')
    : undefined
}

export function whenMapDispatchToPropsIsMissing(mapDispatchToProps) {
  // 如果不存在，则默认提供 dispatch
  return !mapDispatchToProps
    ? wrapMapToPropsConstant(dispatch => ({ dispatch }))
    : undefined
}

// 如果type是object，通过 bindActionCreators 绑定dispatch到定义的object
export function whenMapDispatchToPropsIsObject(mapDispatchToProps) {
  return mapDispatchToProps && typeof mapDispatchToProps === 'object'
    ? wrapMapToPropsConstant(dispatch =>
        bindActionCreators(mapDispatchToProps, dispatch)
      )
    : undefined
}

export default [
  whenMapDispatchToPropsIsFunction,
  whenMapDispatchToPropsIsMissing,
  whenMapDispatchToPropsIsObject
]
