/* Loads a URL then starts looking for links.
 Emits a full page whenever a new link is found. */
import url from 'url'
import path from 'path'
import jsdom from 'jsdom'
import glob from 'glob-to-regexp'
import snapshot from './snapshot'

export default class Crawler {
  constructor(baseUrl, snapshotDelay, options) {
    this.baseUrl = baseUrl
    // 解析baseUrl，后续不需要端口号
    const { protocol, host } = url.parse(baseUrl)
    this.protocol = protocol
    this.host = host
    this.paths = [...options.include]
    // glob：将路径转化为正则
    this.exclude = options.exclude.map((g) => glob(g, { extended: true, globstar: true}))
    this.stripJS = options.stripJS
    this.processed = {}
    this.snapshotDelay = snapshotDelay
  }

  crawl(handler) {
    this.handler = handler
    console.log(`🕷   Starting crawling ${this.baseUrl}`)
    return this.snap()
      .then(() => console.log(`🕸   Finished crawling.`))
  }

  // 递归this.paths中的urlPath，添加jsdom监听和处理
  snap() {
    // cli中的basename 即package的homepage
    let urlPath = this.paths.shift()
    // this.paths为空 返回
    if (!urlPath) return Promise.resolve()
    // 给urlPath 头部添加/ 例如：'abc/c/' ==> '/abc/c/'
    urlPath = url.resolve('/', urlPath) // Resolve removes trailing slashes
    // 当前路径已经存在监听了，直接去解析下一个
    if (this.processed[urlPath]) {
      return this.snap()
    } else {
      this.processed[urlPath] = true
    }
    // 一个监听jsdom 的window创建，资源请求拦截的功能
    return snapshot(this.protocol, this.host, urlPath, this.snapshotDelay)
      .then(window => {
        // 执行到达此处，对当前urlPath已经处理了
        // 1. window创建成功
        // 2. 请求的外部资源同源(host相同)并且已经加载
        // 3. 已经执行客户端的render

        // scriptJS是一个需要删除的src的正则字符串
      if (this.stripJS) {
        // 找到匹配的路径 删除
        const strip = new RegExp(this.stripJS)
        Array.from(window.document.querySelectorAll('script')).forEach(script => {
          if (strip.exec(url.parse(script.src).path)) script.remove()
        })
      }
      // 定义一个数据，客户端运行时，能从window.react_snapshot_state获取到这个数据
      if (Boolean(window.react_snapshot_state)) {
        const stateJSON = JSON.stringify(window.react_snapshot_state)
        const script = window.document.createElement('script')
        script.innerHTML = `window.react_snapshot_state = JSON.parse('${stateJSON}');`
        window.document.head.appendChild(script)
      }
      // 序列化这个document
      const html = jsdom.serializeDocument(window.document)
      this.extractNewLinks(window, urlPath)
      this.handler({ urlPath, html })
      window.close() // Release resources used by jsdom
        // 递归处理
      return this.snap()
    }, err => {
      console.log(`🔥 ${err}`)
    })
  }

  // 处理 a 标签和 iframe 的引入其他页面(.html)或者 目录(文件)(后缀为空)
  // 保存这些引入的页面和目录(文件)的快照
  extractNewLinks(window, currentPath) {
    // 当前document
    const document = window.document
    const tagAttributeMap = {
      'a': 'href',
      'iframe': 'src'
    }

    Object.keys(tagAttributeMap).forEach(tagName => {
      // 获取 key对应的value
      const urlAttribute = tagAttributeMap[tagName]
      // 查找tagName带有 value属性的元素 例如 querySelectorAll("a[href]") 就是查找带有href的a元素
      Array.from(document.querySelectorAll(`${tagName}[${urlAttribute}]`)).forEach(element => {
        // 如果是打开新窗口则不处理返回
        if (element.getAttribute('target') === '_blank') return
        // 获取链接路径并且解析
        const href = url.parse(element.getAttribute(urlAttribute))
        // 过滤url 保留文件资源路径
        if (href.protocol || href.host || href.path === null) return;
        // 文件路径开头添加currentPath(urlPath)
        const relativePath = url.resolve(currentPath, href.path)
        // 只处理文件扩展名为 html 或者 为 空
        if (path.extname(relativePath) !== '.html' && path.extname(relativePath) !== '') return;
        // 路径监听已经存在，返回
        if (this.processed[relativePath]) return;
        // 在exclude里面，返回
        if (this.exclude.filter((regex) => regex.test(relativePath)).length > 0) return
        // 添加到this.paths里，作为待监听
        this.paths.push(relativePath)
      })
    })
  }
}
