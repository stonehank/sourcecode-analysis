### 介绍
[react-loadable](https://github.com/jamiebuilds/react-loadable)是一个组件延迟加载的工具，它本身也是一个组件，通过HOC的方式对参数组件进行处理，
具体的延迟加载方式是使用`import().then()`方法，那么为什么要用这个组件呢？

### 初识

`react-loadable`针对多种情况进行抽象处理，例如延迟加载失败，多个延迟加载的逻辑和服务端渲染使用延迟加载...

当这些情况整合起来后，我们只需要简单的API即可处理每个情况对应的组件。

它对外暴露的API有
```
// 基本的延迟加载处理
Loadable
// 多个延迟加载处理
Loadable.Map
// Loadable或Loadable.Map的返回值
LoadableComponent
// 预加载
LoadableComponent.preLoad
// 全部预加载
Loadable.preloadAll
// 对已经加载完毕的组件处理
Loadable.preloadReady
// 服务端渲染使用
Loadable.Capture
```
Loadable和Loadable.Map还可加入一些options参数，作用如下：
```
// 延迟加载组件
loader: null,
// loading组件
loading: null,
// 加载组件时等待多少时间才开始渲染Loading
delay: 200,
// 超时时间
timeout: null,
// 对已加载的组件渲染方法
render: render,

/* 以下2个是服务端渲染使用 */

// 函数，执行后会获取当前延迟加载模块
// 这里用途是判断模块是否已经可用，作用于preLoadReady上
webpack: null,
// 函数，执行后会获取当前import的路径，作为moduleId
// 这里用途是通过getBundles将moduleId转换成bundles
modules: null
```

先介绍以下它的工作流程：

客户端的单个延迟加载组件`Loadable`处理：

当开始载入`Loadable`组件，会返回`LoadableComponent`组件，

这个组件在生命周期中的`constructor`下会执行`init`方法，这个方法首先会执行`参数loader(也就是import(...))`，

并且将根据执行结果(then或者catch)对3个状态(loading,loaded,error)进行更新，返回一个包含所有状态和import执行结果的对象；
在willMount下会根据options里的参数(例如delay，timeout)对当前状态进行更新，并且继续监听init返回的对象，一旦处理完毕，更新状态。

render里面则根据当前状态，渲染对应的组件(例如loading和error都调用Loading组件，并且传递props)

而客户端多个延迟加载`Loadable.Map`的处理也是基于单个组件处理的，

使用了Promise.all()的基础上调用单个延迟加载处理函数，它的工作逻辑：只要任何一个组件还在加载，整体的loading状态就是true，任意一个组件延迟加载出错，整体的error状态就是true