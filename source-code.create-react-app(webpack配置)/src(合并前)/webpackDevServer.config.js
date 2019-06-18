'use strict';

const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const ignoredFiles = require('react-dev-utils/ignoredFiles');
const config = require('./webpack.config.dev');
const paths = require('./paths');
// 判断协议
const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
// 不仅内部localhost可访问，服务器外部也可访问，例如192.168.xxx.xxx
const host = process.env.HOST || '0.0.0.0';

module.exports = function(proxy, allowedHost) {
  return {
    // WebpackDevServer 2.4.3 introduced a security fix that prevents remote
    // websites from potentially accessing local content through DNS rebinding:
    // https://github.com/webpack/webpack-dev-server/issues/887
    // https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
    // However, it made several existing use cases such as development in cloud
    // environment or subdomains in development significantly more complicated:
    // https://github.com/facebookincubator/create-react-app/issues/2271
    // https://github.com/facebookincubator/create-react-app/issues/2233
    // While we're investigating better solutions, for now we will take a
    // compromise. Since our WDS configuration only serves files in the `public`
    // folder we won't consider accessing them a vulnerability. However, if you
    // use the `proxy` feature, it gets more dangerous because it can expose
    // remote code execution vulnerabilities in backends like Django and Rails.
    // So we will disable the host check normally, but enable it if you have
    // specified the `proxy` setting. Finally, we let you override it if you
    // really know what you're doing with a special environment variable.

    // 是否绕过主机检查，这里cra默认为不检查，因此我们可以通过手机或其他访问
    // 当开启了proxy，会进行检查，如果没有proxy，默认为不检查
    disableHostCheck:
    !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    // Enable gzip compression of generated files.

    // 启用gzip压缩
    compress: true,
    // Silence WebpackDevServer's own logs since they're generally not useful.
    // It will still show compile warnings and errors with this setting.

    // 阻止webpack一些没多大用处的消息
    clientLogLevel: 'none',
    // By default WebpackDevServer serves physical files from current directory
    // in addition to all the virtual build products that it serves from memory.
    // This is confusing because those files won’t automatically be available in
    // production build folder unless we copy them. However, copying the whole
    // project directory is dangerous because we may expose sensitive files.
    // Instead, we establish a convention that only files in `public` directory
    // get served. Our build script will copy `public` into the `build` folder.
    // In `index.html`, you can get URL of `public` folder with %PUBLIC_URL%:
    // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
    // In JavaScript code, you can access it with `process.env.PUBLIC_URL`.
    // Note that we only recommend to use `public` folder as an escape hatch
    // for files like `favicon.ico`, `manifest.json`, and libraries that are
    // for some reason broken when imported through Webpack. If you just want to
    // use an image, put it in `src` and `import` it from JavaScript instead.

    // 这里告诉你如果需要在index.html中调用public中的文件，使用 %PUBLIC_URL% ，js中使用 process.env.PUBLIC_URL
    contentBase: paths.appPublic,
    // By default files from `contentBase` will not trigger a page reload.
    // 当修改上面contentBase目录下的文件后，会触发重载
    watchContentBase: true,
    // Enable hot reloading server. It will provide /sockjs-node/ endpoint
    // for the WebpackDevServer client so it can learn when the files were
    // updated. The WebpackDevServer client is included as an entry point
    // in the Webpack development configuration. Note that only changes
    // to CSS are currently hot reloaded. JS changes will refresh the browser.

    // 热模块替换，目前只支持css
    // 可以自己配置支持js的hot，https://medium.com/superhighfives/hot-reloading-create-react-app-73297a00dcad
    hot: true,
    // It is important to tell WebpackDevServer to use the same "root" path
    // as we specified in the config. In development, we always serve from /.

    // root路径
    publicPath: config.output.publicPath,
    // WebpackDevServer is noisy by default so we emit custom message instead
    // by listening to the compiler events with `compiler.plugin` calls above.
    // 只显示初始启动信息
    quiet: true,
    // Reportedly, this avoids CPU overload on some systems.
    // https://github.com/facebookincubator/create-react-app/issues/293
    // src/node_modules is not ignored to support absolute imports
    // https://github.com/facebookincubator/create-react-app/issues/1065



    /*
    * module.exports = function ignoredFiles(appSrc) {
        return new RegExp(
        // ?!表示后面条件匹配的 都是不匹配的
          `^(?!${escape(
          // 调整路径格式并且替换任意个 \ 为 /
            path.normalize(appSrc + '/').replace(/[\\]+/g, '/')
          )}).+/node_modules/`,
          'g'
        );
      };
    *
    * */
    // 除了 src/node_modules 这个文件夹，其他的都不监听
    watchOptions: {
      ignored: ignoredFiles(paths.appSrc),
    },
    // Enable HTTPS if the HTTPS environment variable is set to 'true'
    // 当配置了https环境变量，就使用https
    https: protocol === 'https',
    // 地址，见host变量
    host: host,
    overlay: false,
    historyApiFallback: {
      // Paths with dots should still use the history fallback.
      // See https://github.com/facebookincubator/create-react-app/issues/387.
      // 允许使用 .(点)作为路径名(最后的/之后的) 例如 ：http://xxx.com/a/b.com
      disableDotRule: true,
    },
    // todo
    public: allowedHost,
    // todo
    proxy,
    before(app) {
      // This lets us open files from the runtime error overlay.
      // 根据错误的行号打开文件
      app.use(errorOverlayMiddleware());
      // This service worker file is effectively a 'no-op' that will reset any
      // previous service worker registered for the same host:port combination.
      // We do this in development to avoid hitting the production cache if
      // it used the same host and port.
      // https://github.com/facebookincubator/create-react-app/issues/2272#issuecomment-302832432

      // 当开发和生产模式使用相同端口时，会发生service worker读取缓存的情况，这样在开发模式就不能获取当前最新的数据
      // 这里的作用就是重置开发模式下的service worker并且刷新页面(强制生效)
      app.use(noopServiceWorkerMiddleware());
    },
  };
};
