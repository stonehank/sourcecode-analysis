import { wrapMapToPropsConstant, wrapMapToPropsFunc } from './wrapMapToProps'

// 如果 mapStateToProps 是函数， 返回一个执行函数，
// 可以给这个函数传入state或者dispatch（取决于是 mapStateToProps 还是 mapDispatchToProps） 和displayName
// 这个返回的函数执行后的作用是，检测是否需要ownProps并且执行 mapStateToProps()
// 最终返回一个朴素对象，如果不是朴素对象则报错
export function whenMapStateToPropsIsFunction(mapStateToProps) {
  return typeof mapStateToProps === 'function'
    ? wrapMapToPropsFunc(mapStateToProps, 'mapStateToProps')
    : undefined
}

// 如果不存在 mapStateToProps，默认传递 空函数
export function whenMapStateToPropsIsMissing(mapStateToProps) {
  return !mapStateToProps ? wrapMapToPropsConstant(() => ({})) : undefined
}

// 除了函数，其它格式会报错
export default [whenMapStateToPropsIsFunction, whenMapStateToPropsIsMissing]
