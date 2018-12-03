/* Spin up a simple express server */
import express from 'express'
import httpProxyMiddleware from 'http-proxy-middleware'
import historyApiFallback from 'connect-history-api-fallback'

export default class Server {
  // baseDir:./build
  // publicPath: package.json['homepage'] || '/'
  // port : 0
  // proxy : package.json['proxy'] || null
  constructor(baseDir, publicPath, port, proxy) {
    const app = express()

    app.get('*', (req, res, next) => {
      // This makes sure the sockets close down so that
      // we can gracefully shutdown the server
      // 服务器给客户端发送信息之后就断开
      res.set('Connection', 'close');
      next()
    })

    // Yes I just copied most of this from react-scripts ¯\_(ツ)_/¯
    app.use(publicPath,
      historyApiFallback({
        // 当SPA 刷新后路由路径无效，会请求 200.html
        index: '/200.html',
        // 允许使用 .(点)作为路径名(最后的/之后的) 例如 ：http://xxx.com/a/b.com
        disableDotRule: true,
        // 允许的请求头type
        htmlAcceptHeaders: ['text/html'],
      }),
      // 静态资源文件 可以使用 /{publicPath}/xxx 请求去加载 {baseDir}/xxx 内部文件
      // index 为静态文件夹的主页
      express.static(baseDir, { index: '200.html' })
    )

    // 使用代理
    if (proxy) {
      if (typeof proxy !== "string") throw new Error("Only string proxies are implemented currently.")
      app.use(httpProxyMiddleware({
        target: proxy,
        onProxyReq: proxyReq => {
          if (proxyReq.getHeader('origin')) proxyReq.setHeader('origin', proxy)
        },
        changeOrigin: true,
        xfwd: true,
      }))
    }

    // 注入配置好的app参数
    this.start = this.start.bind(this, app, port)
  }

  start(app, port) {
    return new Promise((resolve, reject) => {
      // port默认为0 即任意一个未使用端口
      this.instance = app.listen(port, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  }

  port() {
    return this.instance.address().port
  }

  stop() {
    this.instance.close()
  }
}
