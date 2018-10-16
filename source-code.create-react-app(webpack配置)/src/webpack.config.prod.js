'use strict';

const path = require('path');
const webpack = require('webpack');
const PnpWebpackPlugin = require('pnp-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const paths = require('./paths');
const getClientEnvironment = require('./env');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');


// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
// 公共路径，可以在package.json的homepage设置，默认为 /，会自动添加尾部的 /
const publicPath = paths.servedPath;

// Some apps do not use client-side routing with pushState.
// For these, "homepage" can be set to "." to enable relative asset paths.
// 如果homepage设置成相对路径，后面的css打包插件的publicpath也需要更改
const shouldUseRelativeAssetPaths = publicPath === './';

// Source maps are resource heavy and can cause out of memory issue for large source files.
// 通过配置GENERATE_SOURCEMAP可以取消生成sourceMap
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';

// Some apps do not need the benefits of saving a web request, so not inlining the chunk
// makes for a smoother build process.
// 配置是否需要内联某个chunk 进入index.html, 默认是true
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
// 这里publicUrl就是取消尾部的/ 因为当使用的时候 %PUBLIC_URL%/xyz 比 %PUBLIC_URL%xyz更好看
const publicUrl = publicPath.slice(0, -1);

// Get environment variables to inject into our app.
// 返回非REACT_APP开头的环境变量的object，包括env.raw，原始object数据，env.stringify 对value序列化后的object数据
const env = getClientEnvironment(publicUrl);

// Assert this just to be safe.
// Development builds of React are slow and not intended for production.
// 确保是 production
if (env.stringified['process.env'].NODE_ENV !== '"production"') {
  throw new Error('Production builds must have NODE_ENV=production.');
}

// style files regexes
// 定义css匹配的正则
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// common function to get style loaders
// 通用的 style-loader和css-loader，后面还会根据sass和css-module分类
const getStyleLoaders = (cssOptions, preProcessor) => {
  const loaders = [
    {
      loader: MiniCssExtractPlugin.loader,
      options: Object.assign(
        {},
        shouldUseRelativeAssetPaths ? { publicPath: '../../' } : undefined
      ),
    },
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
        // 根据2677问题这里有必要添加ident
        // webpack需要的一个标识符，唯一值
        ident: 'postcss',
        plugins: () => [
          // 对flex一些bug变通解决方案
          require('postcss-flexbugs-fixes'),
          // 能使用未来的css语法，变量嵌套等
          require('postcss-preset-env')({
            autoprefixer: {
              // 给flexbox添加前缀，只在最终版本？和ie中添加
              flexbox: 'no-2009',
            },
            // stage从0到4，0功能最全(实验性)，4最稳定
            stage: 3,
          }),
        ],
        sourceMap: shouldUseSourceMap,
      },
    },
  ];
  if (preProcessor) {
    loaders.push({
      loader: require.resolve(preProcessor),
      options: {
        sourceMap: shouldUseSourceMap,
      },
    });
  }
  return loaders;
};

// This is the production configuration.
// It compiles slowly and is focused on producing a fast and minimal bundle.
// The development configuration is different and lives in a separate file.
module.exports = {
  // 模式是production
  mode: 'production',
  // Don't attempt to continue if there are any errors.
  // 在第一个错误出现时抛出失败结果，而不是容忍它
  bail: true,
  // We generate sourcemaps in production. This is slow but gives good results.
  // You can exclude the *.map files from the build during deployment.
  // 判断是否使用source-map，文件过大使用source-map有可能出现崩溃
  devtool: shouldUseSourceMap ? 'source-map' : false,
  // In production, we only want to load the app code.
  // 只读取app的index.js
  entry: [paths.appIndexJs],
  output: {
    // The build folder.
    // 根目录下的build
    path: paths.appBuild,
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    // 使用了唯一的名称
    // 目前并没有使用splitChunks（代码分离）
    filename: 'static/js/[name].[chunkhash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: publicPath,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    // 设置source-map的路径为返回资源相对于src的路径，例如src为：D:/project/src，资源为：D:/project/src/index.js 就返回index.js
    // 如果资源为：D:/project/node_modules/xxx/a.js  ，返回 ../node_modules/xxx/a.js
    // 接着讲 \\ 替换成 / ，兼容windows
    devtoolModuleFilenameTemplate: info =>
      path
        .relative(paths.appSrc, info.absoluteResourcePath)
        .replace(/\\/g, '/'),
  },
  // 配置共享模块
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            // we want terser to parse ecma 8 code. However, we don't want it
            // to apply any minfication steps that turns valid ecma 5 code
            // into invalid ecma 5 code. This is why the 'compress' and 'output'
            // sections only apply transformations that are ecma 5 safe
            // https://github.com/facebook/create-react-app/pull/4234
            // 解析esma8的代码
            ecma: 8,
          },
          compress: {
            // 最低压缩到esma5，但如果是es6的代码，不会变转换成es5
            ecma: 5,
            // 不提示警告
            warnings: false,
            // Disabled because of an issue with Uglify breaking seemingly valid code:
            // https://github.com/facebook/create-react-app/issues/2376
            // Pending further investigation:
            // https://github.com/mishoo/UglifyJS2/issues/2011
            // 二元比较符的简化，一些看起来有效的代码(可能实际不太符合规范)被简化后会出现问题
            comparisons: false,
            // Disabled because of an issue with Terser breaking valid code:
            // https://github.com/facebook/create-react-app/issues/5250
            // Pending futher investigation:
            // https://github.com/terser-js/terser/issues/120
            // 内联调用函数的方式，2是内联调用带参数的简单函数
            inline: 2,
          },
          // 解决safari关于循环中使用let的报错bug
          // https://bugs.webkit.org/show_bug.cgi?id=171041
          mangle: {
            safari10: true,
          },
          output: {
            // es6不会转换成es5
            ecma: 5,
            // 不要注释
            comments: false,
            // Turned on because emoji and regex is not minified properly using default
            // https://github.com/facebook/create-react-app/issues/2488
            // 如果设为false，Unicode会被转换，那么表情和正则可能会无效
            ascii_only: true,
          },
        },
        // Use multi-process parallel running to improve the build speed
        // Default number of concurrent runs: os.cpus().length - 1
        // 使用多进程执行提升速度
        parallel: true,
        // Enable file caching
        // 使用缓存
        cache: true,
        sourceMap: shouldUseSourceMap,
      }),
      new OptimizeCSSAssetsPlugin({
        cssProcessorOptions: {
          // 使用safe-postcss
          parser: safePostCssParser,
          map: shouldUseSourceMap
            ? {
              // `inline: false` forces the sourcemap to be output into a
              // separate file
              // sourcemap单独打包
              inline: false,
              // `annotation: true` appends the sourceMappingURL to the end of
              // the css file, helping the browser find the sourcemap
              // 在css尾部添加sourcemap的链接，方便查找
              annotation: true,
            }
            : false,
        },
      }),
    ],
    // Automatically split vendor and commons
    // https://twitter.com/wSokra/status/969633336732905474
    // https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366
    //all,initial,async，共享模块的共享方式，推荐all
    splitChunks: {
      chunks: 'all',
      name: false,
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
      // 在env.js中NODE_PATH默认设置为''，因此这里需要过滤，当node_modules和src都找不到模块，会找NODE_PATH路径里的
      // path.delimiter是平台指定的路径分隔符 window为 ;
      // 这里是对 process.env.NODE_PATH 分割，然后过滤出存在的的
      process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    ),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebook/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    // 解析的后缀名
    extensions: ['.mjs', '.web.js', '.js', '.json', '.web.jsx', '.jsx'],
    // 别名设置
    alias: {
      // Support React Native Web
      // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
      'react-native': 'react-native-web',
    },
    plugins: [
      // Adds support for installing with Plug'n'Play, leading to faster installs and adding
      // guards against forgotten dependencies and such.
      PnpWebpackPlugin,
      // Prevents users from importing files from outside of src/ (or node_modules/).
      // This often causes confusion because we only process files within src/ with babel.
      // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
      // please link the files into your node_modules/ and let module-resolution kick in.
      // Make sure your source files are compiled, as they will not be processed in any way.
      // 这个插件是防止从除了src和node_modules以外的地方 import 文件
      // 如果有自定义包，需要自行npm-link到node_modules中
      new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
    ],
  },
  resolveLoader: {
    plugins: [
      // Also related to Plug'n'Play, but this time it tells Webpack to load its loaders
      // from the current package.
      PnpWebpackPlugin.moduleLoader(module),
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
        test: /\.(js|mjs|jsx)$/,
        // loaders按照 pre,inline,normal,post顺序执行,不写就是normal
        // 因此此处这个会优先解析
        enforce: 'pre',
        use: [
          {
            options: {
              // 指定一个控制台打印错误的格式
              formatter: require.resolve('react-dev-utils/eslintFormatter'),
              // 指向eslint实例的路径
              eslintPath: require.resolve('eslint'),

            },
            // 解析器
            loader: require.resolve('eslint-loader'),
          },
        ],
        // 被解析文件位置
        include: paths.appSrc,
      },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        // oneOf遍历以下，直到找到第一个符合的解析器，如果未找到，使用最后的fileLoader
        oneOf: [
          // "url" loader works just like "file" loader but it also embeds
          // assets smaller than specified size as data URLs to avoid requests.
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
            test: /\.(js|mjs|jsx)$/,
            include: paths.appSrc,

            loader: require.resolve('babel-loader'),
            options: {
              // 使用解析的预置，这里使用 babel-preset-react-app目录下的配置
              customize: require.resolve(
                'babel-preset-react-app/webpack-overrides'
              ),

              plugins: [
                [
                  require.resolve('babel-plugin-named-asset-import'),
                  {
                    loaderMap: {
                      svg: {
                        ReactComponent: '@svgr/webpack?-prettier,-svgo![path]',
                      },
                    },
                  },
                ],
              ],
              // 使用缓存，不用每次执行babel编译
              cacheDirectory: true,
              // Save disk space when time isn't as important
              // 会执行GZIP压缩，但消耗更多时间
              cacheCompression: true,
              // 是否使用紧凑模式
              compact: true,
            },
          },
          // Process any JS outside of the app with Babel.
          // Unlike the application JS, we only compile the standard ES features.
          {
            test: /\.(js|mjs)$/,
            exclude: /@babel(?:\/|\\{1,2})runtime/,
            loader: require.resolve('babel-loader'),
            options: {
              babelrc: false,
              configFile: false,
              compact: false,
              presets: [
                [
                  require.resolve('babel-preset-react-app/dependencies'),
                  { helpers: true },
                ],
              ],
              cacheDirectory: true,
              // Save disk space when time isn't as important
              cacheCompression: true,

              // If an error happens in a package, it's possible to be
              // because it was compiled. Thus, we don't want the browser
              // debugger to show the original code. Instead, the code
              // being evaluated would be much more helpful.
              sourceMaps: false,
            },
          },
          // "postcss" loader applies autoprefixer to our CSS.
          // "css" loader resolves paths in CSS and adds assets as dependencies.
          // `MiniCSSExtractPlugin` extracts styles into CSS
          // files. If you use code splitting, async bundles will have their own separate CSS chunk file.
          // By default we support CSS Modules with the extension .module.css
          {
            // 匹配css
            test: cssRegex,
            exclude: cssModuleRegex,
            loader: getStyleLoaders({
              // css-loader之前应用的loader数量
              // 此处就是getStyleLoaders内的 postcss-loader
              importLoaders: 1,
              sourceMap: shouldUseSourceMap,
            }),
            // Don't consider CSS imports dead code even if the
            // containing package claims to have no side effects.
            // Remove this when webpack adds a warning or an error for this.
            // See https://github.com/webpack/webpack/issues/6571
            sideEffects: true,
          },
          // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
          // using the extension .module.css
          // 匹配 css 和 css-module
          {
            test: cssModuleRegex,
            loader: getStyleLoaders({
              importLoaders: 1,
              sourceMap: shouldUseSourceMap,
              // 启用css-module规范
              modules: true,
              getLocalIdent: getCSSModuleLocalIdent,
            }),
          },
          // Opt-in support for SASS. The logic here is somewhat similar
          // as in the CSS routine, except that "sass-loader" runs first
          // to compile SASS files into CSS.
          // By default we support SASS Modules with the
          // extensions .module.scss or .module.sass
          // 匹配sass
          {
            test: sassRegex,
            // 但不匹配 sass-module
            exclude: sassModuleRegex,
            loader: getStyleLoaders(
              {
                // 此处loader数量为2 是 postcss-loader和sass-loader
                importLoaders: 2,
                sourceMap: shouldUseSourceMap,
              },
              // 预加载loader（最先加载）
              'sass-loader'
            ),
            // Don't consider CSS imports dead code even if the
            // containing package claims to have no side effects.
            // Remove this when webpack adds a warning or an error for this.
            // See https://github.com/webpack/webpack/issues/6571
            // sideEffect指引入但未使用的文件
            sideEffects: true,
          },
          // Adds support for CSS Modules, but using SASS
          // using the extension .module.scss or .module.sass
          {
            // 匹配sass-module
            test: sassModuleRegex,
            loader: getStyleLoaders(
              {
                importLoaders: 2,
                sourceMap: shouldUseSourceMap,
                modules: true,
                getLocalIdent: getCSSModuleLocalIdent,
              },
              'sass-loader'
            ),
          },
          // "file" loader makes sure assets end up in the `build` folder.
          // When you `import` an asset, you get its filename.
          // This loader doesn't use a "test" so it will catch all modules
          // that fall through the other loaders.
          {
            loader: require.resolve('file-loader'),
            // Exclude `js` files to keep "css" loader working as it injects
            // it's runtime that would otherwise be processed through "file" loader.
            // Also exclude `html` and `json` extensions so they get processed
            // by webpacks internal loaders.
            // 不包括js和html，json 其中html和json是通过webpack的内部loader处理，保持了对css的
            // 处理，因为如果css在运行时注入，也能通过file-loader处理
            exclude: [/\.(js|mjs|jsx)$/, /\.html$/, /\.json$/],
            options: {
              name: 'static/media/[name].[hash:8].[ext]',
            },
          },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ],
  },
  plugins: [
    // Generates an `index.html` file with the <script> injected.
    // html模板处理插件
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    // Inlines the webpack runtime script. This script is too small to warrant
    // a network request.
    // 判断是否需要内联runtime
    shouldInlineRuntimeChunk && new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
    // Makes some environment variables available in index.html.
    // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
    // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
    // In production, it will be an empty string unless you specify "homepage"
    // in `package.json`, in which case it will be the pathname of that URL.
    // 对html模板内的变量 例如 %PUBLIC_URL% 替换成实际值
    new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
    // This gives some necessary context to module not found errors, such as
    // the requesting resource.
    new ModuleNotFoundPlugin(paths.appPath),
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
    // It is absolutely essential that NODE_ENV was set to production here.
    // Otherwise React will be compiled in the very slow development mode.
    // 在js内部可以使用配置环境数据，参数内则是提供的键值对(value已经序列化)
    new webpack.DefinePlugin(env.stringified),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: 'static/css/[name].[contenthash:8].css',
      chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
    }),
    // Generate a manifest file which contains a mapping of all asset filenames
    // to their corresponding output file so that tools can pick it up without
    // having to parse `index.html`.
    // 生成manifest文件，包含了资源的名称和对应的输出文件
    new ManifestPlugin({
      fileName: 'asset-manifest.json',
      publicPath: publicPath,
    }),
    // Moment.js is an extremely popular library that bundles large locale files
    // by default due to how Webpack interprets its code. This is a practical
    // solution that requires the user to opt into importing specific locales.
    // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
    // You can remove this if you don't use Moment.js:
    // 忽略 moment 的本地化内容（否则moment太臃肿）
    // 参数1 为匹配(test)资源请求路径的正则表达式
    // 参数2 为（可选）匹配(test)资源上下文（目录）的正则表达式。
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    // Generate a service worker script that will precache, and keep up to date,
    // the HTML & assets that are part of the Webpack build.
    new WorkboxWebpackPlugin.GenerateSW({
      clientsClaim: true,
      exclude: [/\.map$/, /asset-manifest\.json$/],
      importWorkboxFrom: 'cdn',
      navigateFallback: publicUrl + '/index.html',
      navigateFallbackBlacklist: [
        // Exclude URLs starting with /_, as they're likely an API call
        new RegExp('^/_'),
        // Exclude URLs containing a dot, as they're likely a resource in
        // public/ and not a SPA route
        new RegExp('/[^/]+\\.[^/]+$'),
      ],
    }),
  ].filter(Boolean),
  // Some libraries import Node modules but don't use them in the browser.
  // Tell Webpack to provide empty mocks for them so importing them works.
  // 提供node的功能
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
