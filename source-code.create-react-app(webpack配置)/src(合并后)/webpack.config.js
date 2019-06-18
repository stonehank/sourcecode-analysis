// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end
'use strict';

const fs = require('fs');
const isWsl = require('is-wsl');
const path = require('path');
const webpack = require('webpack');
const resolve = require('resolve');
const PnpWebpackPlugin = require('pnp-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const paths = require('./paths');
const modules = require('./modules');
const getClientEnvironment = require('./env');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const ForkTsCheckerWebpackPlugin = require('react-dev-utils/ForkTsCheckerWebpackPlugin');
const typescriptFormatter = require('react-dev-utils/typescriptFormatter');
// @remove-on-eject-begin
const getCacheIdentifier = require('react-dev-utils/getCacheIdentifier');
// @remove-on-eject-end
const postcssNormalize = require('postcss-normalize');

// Source maps are resource heavy and can cause out of memory issue for large source files.
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';
// Some apps do not need the benefits of saving a web request, so not inlining the chunk
// makes for a smoother build process.
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

// Check if TypeScript is setup
const useTypeScript = fs.existsSync(paths.appTsConfig);

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = function(webpackEnv) {
  const isEnvDevelopment = webpackEnv === 'development';
  const isEnvProduction = webpackEnv === 'production';

  // Webpack uses `publicPath` to determine where the app is being served from.
  // It requires a trailing slash, or the file assets will get an incorrect path.
  // In development, we always serve from the root. This makes config easier.
  const publicPath = isEnvProduction
    ? paths.servedPath
    : isEnvDevelopment && '/';
  // Some apps do not use client-side routing with pushState.
  // For these, "homepage" can be set to "." to enable relative asset paths.
  const shouldUseRelativeAssetPaths = publicPath === './';

  // `publicUrl` is just like `publicPath`, but we will provide it to our app
  // as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
  // Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
  const publicUrl = isEnvProduction
    ? publicPath.slice(0, -1)
    : isEnvDevelopment && '';
  // Get environment variables to inject into our app.
  const env = getClientEnvironment(publicUrl);

  // 通用的 style-loader和css-loader，后面还会根据sass和css-module分类
  // common function to get style loaders
  const getStyleLoaders = (cssOptions, preProcessor) => {
    const loaders = [
      isEnvDevelopment && require.resolve('style-loader'),
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        options: shouldUseRelativeAssetPaths ? { publicPath: '../../' } : {},
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
                // 给flexbox添加前缀，只在最终版本？和ie10中添加
                flexbox: 'no-2009',
              },
              // stage从0到4，0功能最全(实验性)，4最稳定
              stage: 3,
            }),
            // Adds PostCSS Normalize as the reset css with default options,
            // so that it honors browserslist config in package.json
            // which in turn let's users customize the target behavior as per their needs.
            // 使用postcssNormalize可以针对你的browserslist使用normalize.css
            postcssNormalize(),
          ],
          sourceMap: isEnvProduction && shouldUseSourceMap,
        },
      },
      // 去除false值包括'',null,undefined等
    ].filter(Boolean);
    // 如果需要额外的css预处理，添加到loader末尾(也就是先执行)，例如sass-loader
    if (preProcessor) {
      loaders.push({
        loader: require.resolve(preProcessor),
        options: {
          sourceMap: isEnvProduction && shouldUseSourceMap,
        },
      });
    }
    return loaders;
  };

  return {
    mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
    // Stop compilation early in production
    // 生产模式下，在第一个错误出现时抛出失败结果，而不是容忍它
    bail: isEnvProduction,
    // 生产模式下，判断是否使用source-map，文件过大使用source-map有可能出现崩溃
    // 开发模式下，使用 `cheap-module-source-map`
    // 这里讨论了开发模式为什么不用eval-source-map
    // 1. 断点显示问题
    // 2. 速度问题
    // 每个模式区别可看：https://webpack.docschina.org/configuration/devtool/#%E7%89%B9%E5%AE%9A%E5%9C%BA%E6%99%AF
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : isEnvDevelopment && 'cheap-module-source-map',
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    entry: [
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
      // 开发模式下配置热更新
      // 这一段的意思是热更新默认使用
      // require.resolve('react-dev-utils/webpackHotDevClient'),
      // 但也可以选择更好体验(例如错误显示)的
      // require.resolve('webpack-dev-server/client') + '?/',
      // require.resolve('webpack/hot/dev-server'),
      isEnvDevelopment &&
      require.resolve('react-dev-utils/webpackHotDevClient'),
      // Finally, this is your app's code:
      // 生产模式下，只会读取app的Index.js
      paths.appIndexJs,
      // We include the app code last so that if there is a runtime error during
      // initialization, it doesn't blow up the WebpackDevServer client, and
      // changing JS code would still trigger a refresh.
    ].filter(Boolean),
    output: {
      // The build folder.
      // 生产模式下输出位置为使用根目录的build
      path: isEnvProduction ? paths.appBuild : undefined,
      // Add /* filename */ comments to generated require()s in the output.
      // 开发模式下，在生成代码时，引入相关的模块、导出、请求等有帮助的路径信息。
      pathinfo: isEnvDevelopment,
      // There will be one main bundle, and one file per asynchronous chunk.
      // In development, it does not produce real files.
      // 生成的名称
      // 在开发模式，此处不会生成实际代码，因为dev模式是交给webpackDevServer执行，生成的代码在内存中
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : isEnvDevelopment && 'static/js/bundle.js',
      // TODO: remove this when upgrading to webpack 5
      futureEmitAssets: true,
      // There are also additional JS chunk files if you use code splitting.
      // 使用代码分割后的名称
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      // We inferred the "public path" (such as / or /my-project) from homepage.
      // We use "/" in development.
      publicPath: publicPath,
      // Point sourcemap entries to original disk location (format as URL on Windows)
      // 在生产模式下：
      // 设置source-map的路径为返回资源相对于src的路径，例如src为：D:/project/src，资源为：D:/project/src/index.js 就返回index.js
      // 如果资源为：D:/project/node_modules/xxx/a.js  ，返回 ../node_modules/xxx/a.js
      // 在开发模式下：
      // 路径为原始磁盘位置
      // 最后将 \\ 替换成 / ，兼容windows
      devtoolModuleFilenameTemplate: isEnvProduction
        ? info =>
          path
            .relative(paths.appSrc, info.absoluteResourcePath)
            .replace(/\\/g, '/')
        : isEnvDevelopment &&
        (info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),
    },
    optimization: {
      minimize: isEnvProduction,
      // 只有生产模式会执行以下配置
      minimizer: [
        // This is only used in production mode
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
              // 如果设置为6，则会将es5的代码转换为es6并且压缩
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
            mangle: {
              // 解决safari关于循环中使用let的报错bug
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
          // Disabled on WSL (Windows Subsystem for Linux) due to an issue with Terser
          // https://github.com/webpack-contrib/terser-webpack-plugin/issues/21
          // 使用多进程执行提升速度
          // isWsl 为 true 表示当前是Linux下的windows子系统
          parallel: !isWsl,
          // Enable file caching
          // 使用缓存
          cache: true,
          sourceMap: shouldUseSourceMap,
        }),
        // This is only used in production mode
        // 压缩css
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            // 使用safe-postcss，一个对css更安全的转换
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
      // Keep the runtime chunk separated to enable long term caching
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
      // 遇到 module 默认去node_modules找
      modules: ['node_modules', paths.appNodeModules].concat(
        // 这里`modules.additionalModulePaths`的作用是当模块在`node_modules`找不到后，该去哪里找。
        // 你可以给CRA定义个`baseURL`，这个`baseURL`可以是`node_modules`(默认值)和`src`，那么接着就会去src找；
        // 如果没有定义`baseURL`，那么会分析NODE_PATH路径。
        // NODE_PATH是一个高级功能
        // 在env.js中NODE_PATH默认设置为''，需要自己去定义
        // path.delimiter是平台指定的路径分隔符 window为 `;`(分号)
        // 这里是对 process.env.NODE_PATH 分割，然后对路径查找当前`modules`
        modules.additionalModulePaths || []
      ),
      // These are the reasonable defaults supported by the Node ecosystem.
      // We also include JSX as a common component filename extension to support
      // some tools, although we do not recommend using it, see:
      // https://github.com/facebook/create-react-app/issues/290
      // `web` extension prefixes have been added for better support
      // for React Native Web.
      // 解析的后缀名
      // 可以在path.js内查看，目前有：
      //   'web.mjs',
      //   'mjs',
      //   'web.js',
      //   'js',
      //   'web.ts',
      //   'ts',
      //   'web.tsx',
      //   'tsx',
      //   'json',
      //   'web.jsx',
      //   'jsx',
      extensions: paths.moduleFileExtensions
        .map(ext => `.${ext}`)
        .filter(ext => useTypeScript || !ext.includes('ts')),
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
      // 例如：const {notExist} from './app.js'
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
          test: /\.(js|mjs|jsx|ts|tsx)$/,
          // loaders按照 pre,inline,normal,post顺序执行,不写就是normal
          // 因此此处这个`pre`会优先解析
          enforce: 'pre',
          use: [
            {
              options: {
                // 指定一个控制台打印错误的格式
                formatter: require.resolve('react-dev-utils/eslintFormatter'),
                // 指向eslint实例的路径
                eslintPath: require.resolve('eslint'),
                // @remove-on-eject-begin
                // baseConfig的配置就是默认的`.eslintrc.*`的配置，但会被`.eslintrc.*`覆盖
                baseConfig: {
                  extends: [require.resolve('eslint-config-react-app')],
                },
                // 不允许使用`.eslintignore`，`ignorePath`，`ignorePattern`
                ignore: false,
                // 不允许使用.eslintrc，在`eject`结束时删除此条
                useEslintrc: false,
                // @remove-on-eject-end
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
            // "url" loader works like "file" loader except that it embeds assets
            // smaller than specified limit in bytes as data URLs to avoid requests.
            // A missing `test` is equivalent to a match.
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: require.resolve('url-loader'),
              options: {
                // 超过这个大小就跳过，会使用file-loader，此处单位是bytes
                // 相反，小于这个大小就会转换为base64格式
                limit: 10000,
                // 定义路径和名称
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
            // Process application JS with Babel.
            // The preset includes JSX, Flow, TypeScript, and some ESnext features.
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: paths.appSrc,
              loader: require.resolve('babel-loader'),
              options: {
                // 使用解析的预置，这里使用 babel-preset-react-app目录下的配置
                customize: require.resolve(
                  'babel-preset-react-app/webpack-overrides'
                ),
                // @remove-on-eject-begin
                // 不允许使用`.babelrc`，在eject开始时删除此条
                babelrc: false,
                configFile: false,
                presets: [require.resolve('babel-preset-react-app')],
                // Make sure we have a unique cache identifier, erring on the
                // side of caution.
                // We remove this when the user ejects because the default
                // is sane and uses Babel options. Instead of options, we use
                // the react-scripts and babel-preset-react-app versions.
                // 一个有当前环境，当前packages(这里就是第二个数组参数)名称组成的字符串，一旦字符串不同，强制缓存失效
                // 在eject结束时会删除这条
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-app',
                    'react-dev-utils',
                    'react-scripts',
                  ]
                ),
                // @remove-on-eject-end
                plugins: [
                  [
                    require.resolve('babel-plugin-named-asset-import'),
                    {
                      loaderMap: {
                        svg: {
                          ReactComponent: '@svgr/webpack?-svgo,+ref![path]',
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
                // 生产模式下，会执行GZIP压缩，但消耗更多时间
                cacheCompression: isEnvProduction,
                // 生产模式下，使用紧凑模式
                compact: isEnvProduction,
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
                cacheCompression: isEnvProduction,
                // @remove-on-eject-begin
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-app',
                    'react-dev-utils',
                    'react-scripts',
                  ]
                ),
                // @remove-on-eject-end
                // If an error happens in a package, it's possible to be
                // because it was compiled. Thus, we don't want the browser
                // debugger to show the original code. Instead, the code
                // being evaluated would be much more helpful.
                sourceMaps: false,
              },
            },
            // "postcss" loader applies autoprefixer to our CSS.
            // "css" loader resolves paths in CSS and adds assets as dependencies.
            // "style" loader turns CSS into JS modules that inject <style> tags.
            // In production, we use MiniCSSExtractPlugin to extract that CSS
            // to a file, but in development "style" loader enables hot editing
            // of CSS.
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
                // 生产模式检查是否使用sourceMap
                sourceMap: isEnvProduction && shouldUseSourceMap,
              }),
              // Don't consider CSS imports dead code even if the
              // containing package claims to have no side effects.
              // Remove this when webpack adds a warning or an error for this.
              // See https://github.com/webpack/webpack/issues/6571
              // 告诉webpack是否存在副作用
              // 具体说明参考 https://github.com/stonehank/blogs/blob/master/2018%E5%B9%B4/10%E6%9C%88/18-10-25-%E8%AE%B0%E5%BD%95CRA%E7%9A%84webpack%E9%85%8D%E7%BD%AE%E6%9B%BE%E7%BB%8F%E7%9A%84issue-4.md
              sideEffects: true,
            },
            // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
            // using the extension .module.css
            {
              // 匹配 css 和 css-module
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction && shouldUseSourceMap,
                // 启用css-module规范
                modules: true,
                getLocalIdent: getCSSModuleLocalIdent,
              }),
            },
            // Opt-in support for SASS (using .scss or .sass extensions).
            // By default we support SASS Modules with the
            // extensions .module.scss or .module.sass
            {
              // 匹配sass，但不匹配 sass-module
              test: sassRegex,
              exclude: sassModuleRegex,
              use: getStyleLoaders(
                {
                  // 此处loader数量为2 是 postcss-loader和sass-loader
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap,
                },
                // 这个参数是预加载loader（最先加载）
                'sass-loader'
              ),
              // Don't consider CSS imports dead code even if the
              // containing package claims to have no side effects.
              // Remove this when webpack adds a warning or an error for this.
              // See https://github.com/webpack/webpack/issues/6571
              sideEffects: true,
            },
            // Adds support for CSS Modules, but using SASS
            // using the extension .module.scss or .module.sass
            {
              // 匹配sass-module
              test: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap,
                  modules: true,
                  getLocalIdent: getCSSModuleLocalIdent,
                },
                'sass-loader'
              ),
            },
            // "file" loader makes sure those assets get served by WebpackDevServer.
            // When you `import` an asset, you get its (virtual) filename.
            // In production, they would get copied to the `build` folder.
            // This loader doesn't use a "test" so it will catch all modules
            // that fall through the other loaders.
            {
              loader: require.resolve('file-loader'),
              // Exclude `js` files to keep "css" loader working as it injects
              // its runtime that would otherwise be processed through "file" loader.
              // Also exclude `html` and `json` extensions so they get processed
              // by webpacks internal loaders.
              // 不包括js和html，json 其中html和json是通过webpack的内部loader处理，保持了对css的
              // 处理，因为如果css在运行时注入，也能通过file-loader处理
              exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
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
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            template: paths.appHtml,
          },
          isEnvProduction
            ? {
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
            }
            : undefined
        )
      ),
      // Inlines the webpack runtime script. This script is too small to warrant
      // a network request.
      // 判断是否需要内联runtime
      isEnvProduction &&
      shouldInlineRuntimeChunk &&
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
      // Makes some environment variables available in index.html.
      // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
      // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
      // In production, it will be an empty string unless you specify "homepage"
      // in `package.json`, in which case it will be the pathname of that URL.
      // In development, this will be an empty string.
      // 对html模板内的变量 例如 %PUBLIC_URL% 替换成实际值
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
      // This gives some necessary context to module not found errors, such as
      // the requesting resource.
      // 对于module无法找到时，提示一个存在必要的上下文的报错和修正方式
      new ModuleNotFoundPlugin(paths.appPath),
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
      // It is absolutely essential that NODE_ENV is set to production
      // during a production build.
      // Otherwise React will be compiled in the very slow development mode.
      // 在js内部可以使用配置环境数据，参数内则是提供的键值对(value已经序列化)
      new webpack.DefinePlugin(env.stringified),
      // This is necessary to emit hot updates (currently CSS only):
      // 开发模式下，启动模块热替换(hot module replacement)，目前只对css有效，即无刷新更新数据
      isEnvDevelopment && new webpack.HotModuleReplacementPlugin(),
      // Watcher doesn't work well if you mistype casing in a path so we use
      // a plugin that prints an error when you attempt to do this.
      // See https://github.com/facebook/create-react-app/issues/240
      // 开发模式下强制要求引入模块的大小写要匹配(watcher能进行良好工作的条件)，在问题240中由于大小写不匹配导致watcher工作异常
      // 这里watcher指热更新的watcher组件
      isEnvDevelopment && new CaseSensitivePathsPlugin(),
      // If you require a missing module and then `npm install` it, you still have
      // to restart the development server for Webpack to discover it. This plugin
      // makes the discovery automatic so you don't have to restart.
      // See https://github.com/facebook/create-react-app/issues/186
      // 开发模式下，对于新增的module，无须重新启动服务，会自动查找
      isEnvDevelopment &&
      new WatchMissingNodeModulesPlugin(paths.appNodeModules),
      // 独立打包css
      isEnvProduction &&
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
        generate: (seed, files) => {
          const manifestFiles = files.reduce(function(manifest, file) {
            manifest[file.name] = file.path;
            return manifest;
          }, seed);

          return {
            files: manifestFiles,
          };
        },
      }),
      // Moment.js is an extremely popular library that bundles large locale files
      // by default due to how Webpack interprets its code. This is a practical
      // solution that requires the user to opt into importing specific locales.
      // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
      // You can remove this if you don't use Moment.js:
      // 忽略 moment 的本地化内容（否则moment太臃肿）
      // 参数1 为匹配资源请求路径的正则表达式
      // 参数2 为（可选）匹配资源上下文（目录）的正则表达式。
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      // Generate a service worker script that will precache, and keep up to date,
      // the HTML & assets that are part of the Webpack build.
      isEnvProduction &&
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
      // TypeScript type checking
      useTypeScript &&
      new ForkTsCheckerWebpackPlugin({
        typescript: resolve.sync('typescript', {
          basedir: paths.appNodeModules,
        }),
        async: isEnvDevelopment,
        useTypescriptIncrementalApi: true,
        checkSyntacticErrors: true,
        resolveModuleNameModule: process.versions.pnp
          ? `${__dirname}/pnpTs.js`
          : undefined,
        resolveTypeReferenceDirectiveModule: process.versions.pnp
          ? `${__dirname}/pnpTs.js`
          : undefined,
        tsconfig: paths.appTsConfig,
        reportFiles: [
          '**',
          '!**/__tests__/**',
          '!**/?(*.)(spec|test).*',
          '!**/src/setupProxy.*',
          '!**/src/setupTests.*',
        ],
        watch: paths.appSrc,
        silent: true,
        // The formatter is invoked directly in WebpackDevServerUtils during development
        formatter: isEnvProduction ? typescriptFormatter : undefined,
      }),
    ].filter(Boolean),
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      module: 'empty',
      dgram: 'empty',
      dns: 'mock',
      fs: 'empty',
      http2: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    // Turn off performance processing because we utilize
    // our own hints via the FileSizeReporter
    // 这里使用了FileSizeReporter 就不需要使用performance
    performance: false,
  };
};