/* Wraps a jsdom call and returns the full page */

import jsdom from 'jsdom'

export default (protocol, host, path, delay) => {
  return new Promise((resolve, reject) => {
    let reactSnapshotRenderCalled = false
    const url = `${protocol}//${host}${path}`
    jsdom.env({
      // 当访问这个url时
      url,
      // 响应头设置
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" },
      // 当前urlPath有外部资源请求时，拦截请求并且进行配置
      resourceLoader(resource, callback) {
        // host相同
        if (resource.url.host === host) {
          // 继续获取资源
          // 相当于
          /*
          resource.defaultFetch(function(err,body){
            if(err) return callback(err);
            callback(null,body)
          });
          */
          resource.defaultFetch(callback);
        } else {
          // 不获取资源(未传参数)
          callback()
        }
      },
      features: {
        // 允许jsdom 获取哪种类型的外部资源
        FetchExternalResources: ["script"],
        // 是否允许js的执行  ["script"] or `false`
        ProcessExternalResources: ["script"],
        // 需要过滤的特定资源
        SkipExternalResources: false
      },
      // 将window.console 转到node的输出
      virtualConsole: jsdom.createVirtualConsole().sendTo(console),
      // 当window属性被创建的时候，执行
      created: (err, window) => {
        if (err) return reject(err)
        if (!window) return reject(`Looks like no page exists at ${url}`)
        // 定义 window.reactSnapshotRender
        window.reactSnapshotRender = () => {
          // 改变flag，说明已经执行了成功处理了请求拦截并且执行了render
          reactSnapshotRenderCalled = true
          setTimeout(() => {
            resolve(window)
          }, delay)
        }
      },
      done: (err, window) => {
        // 如果flag未改变，说明出现问题
        if (!reactSnapshotRenderCalled) {
          reject("'render' from react-snapshot was never called. Did you replace the call to ReactDOM.render()?")
        }
      }
    })
  })
}
