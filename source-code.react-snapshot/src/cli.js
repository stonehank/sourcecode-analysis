import path from 'path'
import fs from 'fs'
import url from 'url'
import Server from './Server'
import Crawler from './Crawler'
import Writer from './Writer'
import program from 'safe-commander'

export default () => {
  program
    .version(require('../package.json').version)
    .option('--build-dir <directory>', `Specify where the JS app lives. Defaults to 'build'`)
    .option('--domain <domain>', `The local domain to use for scraping. Defaults to 'localhost'`)
    .option('--output-dir <directory>', `Where to write the snapshots. Defaults to in-place (i.e. same as build-dir)`)
    .parse(process.argv)

  const {
    buildDir = 'build',
    domain = 'localhost',
    outputDir = buildDir,
  } = program.optsObj

  // process.cwd() 执行node命令时的目录(此处是根目录，因为在根目录调用 npm run build)
  // 读取package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')))
  // 获取package.json内的homepage(/) 或者为 '/'
  const basename = ((p) => p.endsWith('/') ? p : p + '/')(pkg.homepage ? url.parse(pkg.homepage).pathname : '')

  // 获取存在于package.json中的配置项目
  const options = Object.assign({
    include: [],
    exclude: [],
    snapshotDelay: 50,
  }, pkg['react-snapshot'] || pkg.reactSnapshot || {})

  // 将exclude和include路径转变为绝对路径 并且由 '\\a\\b'转换成 '/a/b'
  options.exclude = options.exclude.map((p) => path.join(basename, p).replace(/\\/g, '/'))
  options.include = options.include.map((p) => path.join(basename, p).replace(/\\/g, '/'))
  // include头部插入basename
  options.include.unshift(basename)

  // path.resolve：解析为绝对路径
  const buildDirPath = path.resolve(`./${buildDir}`)
  const outputDirPath = path.resolve(`./${outputDir}`)

  // 如果不存在build文件夹(打包不成功) 抛出错误
  if (!fs.existsSync(buildDir)) throw new Error(`No build directory exists at: ${buildDirPath}`)

  // 将原始的index.html改成200.html
  const writer = new Writer(buildDirPath, outputDirPath)
  writer.move('index.html', '200.html')

  const server = new Server(buildDirPath, basename, 0, pkg.proxy)
  // .start() 默认监听一个未使用的端口
  server.start().then(() => {
    const crawler = new Crawler(`http://${domain}:${server.port()}${basename}`, options.snapshotDelay, options)
    return crawler.crawl(({ urlPath, html }) => {
      // 执行到此处，已经基本完成当前urlPath的监听，这里是最后检查是否以basename开头
      // 相当于会将includes的所有path都检查是否以basename开头
      if (!urlPath.startsWith(basename)) {
        console.log(`❗ Refusing to crawl ${urlPath} because it is outside of the ${basename} sub-folder`)
        return
      }
      // 以basename作为根目录
      urlPath = urlPath.replace(basename, '/')
      let filename = urlPath
      // 如果是以/结尾，例如：/b/a/ 添加index.html， /b/a/index.html
      // 如果无后缀，例如：/b/a 添加后缀.html， /b/a.html
      if (urlPath.endsWith('/')) {
        filename = `${urlPath}index.html`
      } else if (path.extname(urlPath) == '') {
        filename = `${urlPath}.html`
      }
      console.log(`✏️   Saving ${urlPath} as ${filename}`)
      // 写入
      writer.write(filename, html)
    })

  }).then(() => server.stop(), err => console.log(`🔥 ${err}`))
}
