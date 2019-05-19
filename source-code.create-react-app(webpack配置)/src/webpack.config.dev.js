// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end
'use strict';

const autoprefixer = require('autoprefixer');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const eslintFormatter = require('react-dev-utils/eslintFormatter');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const getClientEnvironment = require('./env');
const paths = require('./paths');
const ManifestPlugin = require('webpack-manifest-plugin');

// Webpack uses `publicPath` to determine where the app is being served from.
// In development, we always serve from the root. This makes config easier.
const publicPath = '/';
// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = '';
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// 通用的 style-loader和css-loader，后面还会根据sass和css-module分类
// common function to get style loaders
const getStyleLoaders = (cssOptions, preProcessor) => {
  const loaders = [
    require.resolve('style-loader'),
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      // Options for PostCSS as we reference these options twice
      // Adds vendor prefixing based on your specified browser support in
      // package.json
      loader: require.resolve('postcss-loader'),
      options: {
        // Necessary for external CSS imports to work
        // https://github.com/facebook/create-react-app/issues/2677
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          autoprefixer({
            flexbox: 'no-2009',
          }),
        ],
      },
    },
  ];
  if (preProcessor) {
    loaders.push(require.resolve(preProcessor));
  }
  return loaders;
};


module.exports = {
  // 模式为 development
  mode: 'development',
  // https://github.com/facebook/create-react-app/pull/109#issuecomment-234674331
  // 讨论了为什么不用eval-source-map
  // 1. 断点显示问题
  // 2. 速度问题
  // 每个模式区别可看：https://webpack.docschina.org/configuration/devtool/#%E7%89%B9%E5%AE%9A%E5%9C%BA%E6%99%AF
  devtool: 'cheap-module-source-map',
  // These are the "entry points" to our application.
  // This means they will be the "root" imports that are included in JS bundle.
  // The first two entry points enable "hot" CSS and auto-refreshes for JS.
  entry: [
    // We ship a few polyfills by default:
    require.resolve('./polyfills'),
    // Include an alternative client for WebpackDevServer. A client's job is to
    // connect to WebpackDevServer by a socket and get notified about changes.
    // When you save a file, the client will either apply hot updates (in case
    // of CSS changes), or refresh the page (in case of JS changes). When you
    // make a syntax error, this client will display a syntax error overlay.
    // Note: instead of the default WebpackDevServer client, we use a custom one
    // to bring better experience for Create React App users. You can replace
    // the line below with these two lines if you prefer the stock client:
    // require.resolve('webpack-dev-server/client') + '?/',
    // require.resolve('webpack/hot/dev-server'),
    // 配置热刷新
    require.resolve('react-dev-utils/webpackHotDevClient'),
    // Finally, this is your app's code:
    paths.appIndexJs,
    // We include the app code last so that if there is a runtime error during
    // initialization, it doesn't blow up the WebpackDevServer client, and
    // changing JS code would still trigger a refresh.
  ],
  output: {
    // Add /* filename */ comments to generated require()s in the output.
    // 在生成代码时，引入相关的模块、导出、请求等有帮助的路径信息。
    pathinfo: true,
    // This does not produce a real file. It's just the virtual path that is
    // served by WebpackDevServer in development. This is the JS bundle
    // containing code from all our entry points, and the Webpack runtime.
    // 此处不会生成实际代码，因为dev模式是交给webpackDevServer执行，生成的代码在内存中
    filename: 'static/js/bundle.js',
    // There are also additional JS chunk files if you use code splitting.
    // 使用代码分割后的名称
    chunkFilename: 'static/js/[name].chunk.js',
    // This is the URL that app is served from. We use "/" in development.
    publicPath: publicPath,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: info =>
      path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
  },
  // 配置共享模块
  optimization: {
    // Automatically split vendor and commons
    // https://twitter.com/wSokra/status/969633336732905474
    // https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366

    splitChunks: {
      //all,initial,async，共享模块的共享方式，推荐all
      chunks: 'all',
      name: 'vendors',
    },
    // Keep the runtime chunk seperated to enable long term caching
    // https://twitter.com/wSokra/status/969679223278505985
    // 分离manifest，开启长效缓存
    runtimeChunk: true,
  },
  // 对引用和别名解析
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebook/create-react-app/issues/253
    // 遇到 module 去node_modules找
    // NODE_PATH是一个高级功能，需要自己去定义，默认只提供node_modules
    // 定义了NODE_PATH后 如果`import {abc} from 'abc'
    // 就会先在`node_modules`里找，找不到就去自定义的目录找
    modules: ['node_modules'].concat(
      // It is guaranteed to exist because we tweak it in `env.js`
      // 这里是对 process.env.NODE_PATH 分割，然后过滤出值为true的
      process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    ),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebook/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    // 解析的后缀名
    extensions: ['.web.js', '.mjs', '.js', '.json', '.web.jsx', '.jsx'],
    // 别名设置
    alias: {
      // @remove-on-eject-begin
      // Resolve Babel runtime relative to react-scripts.
      // It usually still works on npm 3 without this but it would be
      // unfortunate to rely on, as react-scripts could be symlinked,
      // and thus @babel/runtime might not be resolvable from the source.
      '@babel/runtime': path.dirname(
        require.resolve('@babel/runtime/package.json')
      ),
      // @remove-on-eject-end
      // Support React Native Web
      // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
      'react-native': 'react-native-web',
    },
    // 配置插件
    plugins: [
      // Prevents users from importing files from outside of src/ (or node_modules/).
      // This often causes confusion because we only process files within src/ with babel.
      // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
      // please link the files into your node_modules/ and let module-resolution kick in.
      // Make sure your source files are compiled, as they will not be processed in any way.
      // 这个插件是防止从除了src和node_modules以外的地方 import 文件
      // 如果有自定义包，需要自行放置到node_modules中
      new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
    ],
  },
  module: {
    // 当引用了不存在的exports的时候，是否使用报错替代警告
    // 例如：
    // const {notExist} from './app.js'
    strictExportPresence: true,
    rules: [
      // Disable require.ensure as it's not a standard language feature.
      // 解析器的选项
      // 具体：https://webpack.docschina.org/configuration/module/#rule-parser
      // 禁用require-ensure
      { parser: { requireEnsure: false } },

      // First, run the linter.
      // It's important to do this before Babel processes the JS.
      {
        test: /\.(js|jsx|mjs)$/,
        // loaders按照 pre,inline,normal,post顺序执行,不写就是normal
        // 因此此处这个会优先解析
        enforce: 'pre',
        use: [
          {
            options: {
              // 指定一个控制台打印错误的格式
              formatter: eslintFormatter,
              // 指向eslint实例的路径
              eslintPath: require.resolve('eslint'),
              baseConfig: {
                extends: [require.resolve('eslint-config-react-app')],
              },
              // @remove-on-eject-begin
              ignore: false,
              useEslintrc: false,
              // @remove-on-eject-end
            },
            // 解析器
            loader: require.resolve('eslint-loader'),
          },
        ],
        // 被解析文件位置
        include: paths.srcPaths,
        // 被解析文件不从以下位置寻找
        exclude: [/[/\\\\]node_modules[/\\\\]/],
      },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        // oneOf遍历以下，直到找到第一个符合的解析器，如果未找到，使用最后的fileLoader
        oneOf: [
          // "url" loader works like "file" loader except that it embeds assets
          // smaller than specified limit in bytes as data URLs to avoid requests.
          // A missing `test` is equivalent to a match.
          {
            test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
            loader: require.resolve('url-loader'),
            options: {
              // 超过这个大小就跳过，会使用file-loader，此处单位是bytes
              limit: 10000,
              // 定义路径和名称
              name: 'static/media/[name].[hash:8].[ext]',
            },
          },
          // Process application JS with Babel.
          // The preset includes JSX, Flow, and some ESnext features.
          {
            test: /\.(js|jsx|mjs)$/,
            include: paths.srcPaths,
            exclude: [/[/\\\\]node_modules[/\\\\]/],
            use: [
              // This loader parallelizes code compilation, it is optional but
              // improves compile time on larger projects
              {
                // thread-load 让后面的babel-loader在一个新的worker-pool中执行
                // 让耗时的加载不影响webpack的其他加载
                loader: require.resolve('thread-loader'),
                // 更多配置参考  https://webpack.docschina.org/loaders/thread-loader/
                options: {
                  // 定时删除闲置的worker Infinity即不会自动删除worker进程，即使它是闲置的
                  poolTimeout: Infinity // keep workers alive for more effective watch mode
                },
              },
              {
                loader: require.resolve('babel-loader'),
                options: {
                  // @remove-on-eject-begin
                  // 不使用 .babelrc文件的配置
                  babelrc: false,
                  // @remove-on-eject-end
                  // 使用解析的预置，这里使用 babel-preset-react-app目录下的配置
                  presets: [require.resolve('babel-preset-react-app')],
                  plugins: [
                    [
                      // todo
                      require.resolve('babel-plugin-named-asset-import'),
                      {
                        loaderMap: {
                          svg: {
                            ReactComponent: 'svgr/webpack![path]',
                          },
                        },
                      },
                    ],
                  ],
                  // This is a feature of `babel-loader` for webpack (not Babel itself).
                  // It enables caching results in ./node_modules/.cache/babel-loader/
                  // directory for faster rebuilds.
                  // 使用缓存，不用每次执行babel编译
                  cacheDirectory: true,
                  highlightCode: true,
                },
              },
            ],
          },
          // Process any JS outside of the app with Babel.
          // Unlike the application JS, we only compile the standard ES features.
          {
            test: /\.js$/,
            use: [
              // This loader parallelizes code compilation, it is optional but
              // improves compile time on larger projects
              {
                loader: require.resolve('thread-loader'),
                options: {
                  poolTimeout: Infinity // keep workers alive for more effective watch mode
                },
              },
              {
                loader: require.resolve('babel-loader'),
                options: {
                  babelrc: false,
                  // todo
                  compact: false,

                  presets: [
                    require.resolve('babel-preset-react-app/dependencies'),
                  ],
                  cacheDirectory: true,
                  highlightCode: true,
                },
              },
            ],
          },
          // "postcss" loader applies autoprefixer to our CSS.
          // "css" loader resolves paths in CSS and adds assets as dependencies.
          // "style" loader turns CSS into JS modules that inject <style> tags.
          // In production, we use a plugin to extract that CSS to a file, but
          // in development "style" loader enables hot editing of CSS.
          // By default we support CSS Modules with the extension .module.css
          {
            // 匹配css
            test: cssRegex,
            // 不匹配 css-module
            exclude: cssModuleRegex,
            use: getStyleLoaders({
              // 在一个css中引入另一个css，也会执行loader的数量
              // 此处就是getStyleLoaders内的 postcss-loader
              importLoaders: 1,
            }),
          },
          // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
          // using the extension .module.css
          {
            // 匹配 css 和 css-module
            test: cssModuleRegex,
            use: getStyleLoaders({
              // 同上
              importLoaders: 1,
              // 启用css-module规范
              modules: true,
              getLocalIdent: getCSSModuleLocalIdent,
            }),
          },
          // Opt-in support for SASS (using .scss or .sass extensions).
          // Chains the sass-loader with the css-loader and the style-loader
          // to immediately apply all styles to the DOM.
          // By default we support SASS Modules with the
          // extensions .module.scss or .module.sass
          {
            // 匹配sass
            test: sassRegex,
            // 但不匹配 css-module
            exclude: sassModuleRegex,
            // 此处loader数量为2 是 postcss-loader和sass-loader
            use: getStyleLoaders({ importLoaders: 2 }, 'sass-loader'),
          },
          // Adds support for CSS Modules, but using SASS
          // using the extension .module.scss or .module.sass
          {
            // 匹配sass和css-module
            test: sassModuleRegex,
            use: getStyleLoaders(
              {
                // 同上
                importLoaders: 2,
                modules: true,
                getLocalIdent: getCSSModuleLocalIdent,
              },
              'sass-loader'
            ),
          },
          // The GraphQL loader preprocesses GraphQL queries in .graphql files.
          // 解析GraphQL
          {
            test: /\.(graphql)$/,
            loader: 'graphql-tag/loader',
          },
          // "file" loader makes sure those assets get served by WebpackDevServer.
          // When you `import` an asset, you get its (virtual) filename.
          // In production, they would get copied to the `build` folder.
          // This loader doesn't use a "test" so it will catch all modules
          // that fall through the other loaders.
          {
            // Exclude `js` files to keep "css" loader working as it injects
            // its runtime that would otherwise be processed through "file" loader.
            // Also exclude `html` and `json` extensions so they get processed
            // by webpacks internal loaders.
            // 不包括js和html，json 其中html和json是通过webpack的内部loader处理，保持了对css的
            // 处理，因为如果css在运行时注入，也能通过file-loader处理
            exclude: [/\.(js|jsx|mjs)$/, /\.html$/, /\.json$/],
            loader: require.resolve('file-loader'),
            options: {
              name: 'static/media/[name].[hash:8].[ext]',
            },
          },
        ],
      },
      // ** STOP ** Are you adding a new loader?
      // Make sure to add the new loader(s) before the "file" loader.
    ],
  },
  plugins: [
    // Generates an `index.html` file with the <script> injected.
    // html模板处理插件
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
    }),
    // Makes some environment variables available in index.html.
    // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
    // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
    // In development, this will be an empty string.
    // 对html模板内的变量 例如 %PUBLIC_URL% 替换成实际值
    new InterpolateHtmlPlugin(env.raw),
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === 'development') { ... }. See `./env.js`.
    // 在js内部可以使用配置环境数据，参数内则是需要定义的键值对
    new webpack.DefinePlugin(env.stringified),
    // This is necessary to emit hot updates (currently CSS only):
    //启动模块热替换(hot module replacement)，目前只对css有效，即无刷新更新数据
    new webpack.HotModuleReplacementPlugin(),
    // Watcher doesn't work well if you mistype casing in a path so we use
    // a plugin that prints an error when you attempt to do this.
    // See https://github.com/facebook/create-react-app/issues/240
    // 强制要求引入模块的大小写要匹配(watcher能进行良好工作的条件)
    new CaseSensitivePathsPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    // See https://github.com/facebook/create-react-app/issues/186
    // 对于新增的module，无须重新启动服务，会自动查找
    new WatchMissingNodeModulesPlugin(paths.appNodeModules),
    // Moment.js is an extremely popular library that bundles large locale files
    // by default due to how Webpack interprets its code. This is a practical
    // solution that requires the user to opt into importing specific locales.
    // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
    // You can remove this if you don't use Moment.js:
    // 忽略 moment 的本地化内容（否则moment太臃肿）
    // 参数1 为匹配(test)资源请求路径的正则表达式
    // 参数2 为（可选）匹配(test)资源上下文（目录）的正则表达式。
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    // Generate a manifest file which contains a mapping of all asset filenames
    // to their corresponding output file so that tools can pick it up without
    // having to parse `index.html`.
    // 生成manifest文件，包含了资源的名称和对应的输出文件
    new ManifestPlugin({
      fileName: 'asset-manifest.json',
      publicPath: publicPath,
    }),
  ],

  // Some libraries import Node modules but don't use them in the browser.
  // Tell Webpack to provide empty mocks for them so importing them works.
  // 提供node的功能
  // https://webpack.docschina.org/configuration/node/#node
  node: {
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
  },
  // Turn off performance processing because we utilize
  // our own hints via the FileSizeReporter
  // 这里使用了FileSizeReporter 就不需要使用performance
  performance: false,
};