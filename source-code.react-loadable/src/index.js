"use strict";
const React = require("react");
const PropTypes = require("prop-types");

const ALL_INITIALIZERS = [];
const READY_INITIALIZERS = [];

function isWebpackReady(getModuleIds) {
  // __webpack_modules__是一个存储了所有模块的对象
  if (typeof __webpack_modules__ !== "object") {
    return false;
  }

  // 检查是否每一个模块存在
  return getModuleIds().every(moduleId => {
    return (
      typeof moduleId !== "undefined" &&
      typeof __webpack_modules__[moduleId] !== "undefined"
    );
  });
}

// 针对单个延迟加载
// 参数是import('...')格式，返回值是一个thenable
function load(loader) {
  // promise保存了延迟加载组件执行的返回值(thenable)
  let promise = loader();
  // 状态数据
  let state = {
    loading: true,
    loaded: null,
    error: null
  };
  // state.promise是一个Promise的处理返回值
  // 此处根据promise的返回值，更新状态数据
  state.promise = promise
    .then(loaded => {
      state.loading = false;
      state.loaded = loaded;
      return loaded;
    })
    .catch(err => {
      state.loading = false;
      state.error = err;
      throw err;
    });

  // state是一个obj，保存了状态和延迟加载组件执行的返回值
  return state;
}

// 多个延迟加载
function loadMap(obj) {
  let state = {
    loading: false,
    loaded: {},
    error: null
  };

  let promises = [];

  // 因为遍历并且执行load执行(单个执行)，遇到错误会抛出，因此要try...catch
  try {
    Object.keys(obj).forEach(key => {
      let result = load(obj[key]);

      // 第一次判断，目的是改变loading状态
      // 如果某延迟组件加载完毕
      if (!result.loading) {
        // 对应的loaded为true
        // 整体的loading不变
        state.loaded[key] = result.loaded;
        // 任意一个延迟组件有err，整体为err
        state.error = result.error;
      } else {
        // 有任意一个延迟组件还在加载，则整体的loading为true
        state.loading = true;
      }

      // 处理结果(Promise对象)放进数组
      promises.push(result.promise);

      // 后续then，目的是处理已经加载完毕的组件
      result.promise
        .then(res => {
          state.loaded[key] = res;
        })
        .catch(err => {
          state.error = err;
        });
    });
    // 捕捉load的错误
  } catch (err) {
    state.error = err;
  }

  // 当所有组件加载完毕(每个组件可能成功，也可能失败)
  // 整体的loading为false
  // 有错误则抛出，否则返回state
  state.promise = Promise.all(promises)
    .then(res => {
      state.loading = false;
      return res;
    })
    .catch(err => {
      state.loading = false;
      throw err;
    });

  return state;
}

// 兼容babel编译后的组件
function resolve(obj) {
  return obj && obj.__esModule ? obj.default : obj;
}

// 默认的render函数——创建组件
function render(loaded, props) {
  return React.createElement(resolve(loaded), props);
}

function createLoadableComponent(loadFn, options) {
  if (!options.loading) {
    throw new Error("react-loadable requires a `loading` component");
  }

  let opts = Object.assign(
    {
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
      // 函数，执行后会获取当前延迟加载模块
      // 这里用途是判断模块是否已经可用，作用于preLoadReady上
      webpack: null,
      // 函数，执行后会获取当前import的路径，作为moduleId
      // 这里用途是通过getBundles将moduleId转换成bundles
      modules: null
    },
    options
  );

  let res = null;

  function init() {
    if (!res) {
      // 这里opts.loader就是组件的延迟加载函数，例如：()=>import(./xxx)
      res = loadFn(opts.loader);
    }
    // 返回延迟加载的component
    return res.promise;
  }

  ALL_INITIALIZERS.push(init);

  // opts.webpack是一个能获取所有module的ID的函数
  if (typeof opts.webpack === "function") {
    READY_INITIALIZERS.push(() => {
      // 模块存在，执行并且返回init()
      if (isWebpackReady(opts.webpack)) {
        return init();
      }
    });
  }

  return class LoadableComponent extends React.Component {
    constructor(props) {
      super(props);
      init();

      this.state = {
        error: res.error,
        pastDelay: false,
        timedOut: false,
        // 是否在执行loading
        loading: res.loading,
        // 延迟加载的component
        loaded: res.loaded
      };
    }

    // 如果父组件有传递上下文，这里会收到，此处父组件指Capture
    static contextTypes = {
      loadable: PropTypes.shape({
        report: PropTypes.func.isRequired
      })
    };

    // 预加载
    static preload() {
      return init();
    }

    // 载入组件时，根据options加载和更新
    componentWillMount() {
      this._mounted = true;
      this._loadModule();
    }

    _loadModule() {
      // 如果父组件（Capture）上下文属性存在 并且 提供了modules属性(数组)
      // 这里modules保存了所有导入的模块路径
      if (this.context.loadable && Array.isArray(opts.modules)) {
        // 遍历并且对每一个执行report
        opts.modules.forEach(moduleName => {
          this.context.loadable.report(moduleName);
        });
      }
      // 延迟加载结束
      if (!res.loading) {
        return;
      }

      // 默认200ms后更新pastDelay
      // 有时组件加载非常快(<200ms)，这时加载中的样式就会一闪而过
      // 因此可以选择默认隔200ms后才开始渲染loading(避免样式闪动)，这样做是因为能让用户感觉更快
      // https://github.com/jamiebuilds/react-loadable#avoiding-flash-of-loading-component
      if (typeof opts.delay === "number") {
        if (opts.delay === 0) {
          this.setState({ pastDelay: true });
        } else {
          this._delay = setTimeout(() => {
            this.setState({ pastDelay: true });
          }, opts.delay);
        }
      }

      // 判断是否需要更新timeout(用于超时处理)
      if (typeof opts.timeout === "number") {
        this._timeout = setTimeout(() => {
          this.setState({ timedOut: true });
        }, opts.timeout);
      }

      let update = () => {
        // 当组件未载入或者已经卸载，则返回
        if (!this._mounted) {
          return;
        }

        this.setState({
          error: res.error,
          loaded: res.loaded,
          loading: res.loading
        });

        this._clearTimeouts();
      };

      // 延迟加载的component的promise
      res.promise
        .then(() => {
          // 加载完毕后，执行update，更新相关状态数据
          update();
        })
        .catch(err => {
          update();
        });
    }

    componentWillUnmount() {
      // 卸载组件时清除计时器
      this._mounted = false;
      this._clearTimeouts();
    }

    _clearTimeouts() {
      clearTimeout(this._delay);
      clearTimeout(this._timeout);
    }

    // retry先初始化状态
    retry = () => {
      this.setState({ error: null, loading: true, timedOut: false });
      // 内部其实就是init()再_loadModule(根据opts更新状态)
      res = loadFn(opts.loader);
      this._loadModule();
    };

    render() {
      // loading中或者error
      if (this.state.loading || this.state.error) {
        // 创建loading组件，第二个参数为props，用于loading渲染的条件
        return React.createElement(opts.loading, {
          isLoading: this.state.loading,
          pastDelay: this.state.pastDelay,
          timedOut: this.state.timedOut,
          error: this.state.error,
          retry: this.retry
        });
      } else if (this.state.loaded) {
        // 组件已经加载完毕，渲染延迟加载的组件
        return opts.render(this.state.loaded, this.props);
      } else {
        return null;
      }
    }
  };
}

function Loadable(opts) {
  return createLoadableComponent(load, opts);
}

// 多个延迟组件必须提供render属性，因为render要对每一个延迟加载组件的作用进行处理
function LoadableMap(opts) {
  if (typeof opts.render !== "function") {
    throw new Error("LoadableMap requires a `render(loaded, props)` function");
  }

  return createLoadableComponent(loadMap, opts);
}

Loadable.Map = LoadableMap;

class Capture extends React.Component {
  static propTypes = {
    report: PropTypes.func.isRequired
  };

  // 定义传递给子组件的上下文
  static childContextTypes = {
    loadable: PropTypes.shape({
      report: PropTypes.func.isRequired
    }).isRequired
  };

  // 传递的上下文内容
  getChildContext() {
    return {
      loadable: {
        report: this.props.report
      }
    };
  }

  // 渲染唯一的子元素
  render() {
    return React.Children.only(this.props.children);
  }
}

Loadable.Capture = Capture;

function flushInitializers(initializers) {
  let promises = [];

  // 逐个调用init
  while (initializers.length) {
    let init = initializers.pop();
    promises.push(init());
  }

  // 全部完成后，再次检查
  return Promise.all(promises).then(() => {
    if (initializers.length) {
      return flushInitializers(initializers);
    }
  });
}

// 全部预加载
Loadable.preloadAll = () => {
  return new Promise((resolve, reject) => {
    flushInitializers(ALL_INITIALIZERS).then(resolve, reject);
  });
};

// 通过opts.webpack检测模块存在 则执行init
Loadable.preloadReady = () => {
  return new Promise((resolve, reject) => {
    // We always will resolve, errors should be handled within loading UIs.
    // 这里用的是promise.all 即使err也会执行resolve
    flushInitializers(READY_INITIALIZERS).then(resolve, resolve);
  });
};

module.exports = Loadable;
