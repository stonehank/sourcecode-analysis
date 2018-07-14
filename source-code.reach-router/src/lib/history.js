////////////////////////////////////////////////////////////////////////////////
// createHistory(source) - wraps a history source
let getLocation = source => {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial"
  };
};

//
let createHistory = (source, options) => {
  let listeners = [];
  let location = getLocation(source);
  let transitioning = false;
  let resolveTransition = () => {};

  return {
    get location() {
      return location;
    },

    get transitioning() {
      return transitioning;
    },

    _onTransitionComplete() {
      transitioning = false;
      resolveTransition();
    },

    // 添加监听popstate，触发调用listener
    // popstate只在浏览器下前进后退操作触发，搭配pushState使用
    listen(listener) {
      listeners.push(listener);

      let popstateListener = () => {
        // 获取最新值
        location = getLocation(source);
        listener();
      };

      source.addEventListener("popstate", popstateListener);

      // 返回值用于解绑当前listener
      return () => {
        source.removeEventListener("popstate", popstateListener);
        listeners = listeners.filter(fn => fn !== listener);
      };
    },

    navigate(to, { state, replace = false } = {}) {
      // 添加key为当前时间戳
      state = { ...state, key: Date.now() + "" };
      // try...catch iOS Safari limits to 100 pushState calls
      try {
        // transitioning为true说明正在执行navigate
        // 冲突则使用replace替代掉上一次navigate
        if (transitioning || replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        // 报错就使用hash方法
        // replace 替代当前，不增加历史记录
        // assign 增加历史记录
        source.location[replace ? "replace" : "assign"](to);
      }

      // 更新location
      location = getLocation(source);
      transitioning = true;
      // 解绑res，赋值给resolveTransition，当resolveTransition执行时，触发transition.then里面的函数
      let transition = new Promise(res => (resolveTransition = res));
      // 执行所有监听
      listeners.forEach(fn => fn());
      // 返回promise
      return transition;
    }
  };
};

////////////////////////////////////////////////////////////////////////////////
// Stores history entries in memory for testing or other platforms like Native
// 模拟history
let createMemorySource = (initialPathname = "/") => {
  // stack相当于window.location
  // state相当于window.history.state
  let index = 0;
  let stack = [{ pathname: initialPathname, search: "" }];
  let states = [];

  return {
    get location() {
      return stack[index];
    },
    addEventListener(name, fn) {},
    removeEventListener(name, fn) {},
    history: {
      get entries() {
        return stack;
      },
      get index() {
        return index;
      },
      get state() {
        return states[index];
      },
      pushState(state, _, uri) {
        let [pathname, search = ""] = uri.split("?");
        index++;
        stack.push({ pathname, search });
        states.push(state);
      },
      // 修改当前index的stack和state
      replaceState(state, _, uri) {
        let [pathname, search = ""] = uri.split("?");
        stack[index] = { pathname, search };
        states[index] = state;
      }
    }
  };
};

////////////////////////////////////////////////////////////////////////////////
// global history - uses window.history as the source if available, otherwise a
// memory history
let canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

//判断平台
let getSource = () => {
  return canUseDOM ? window : createMemorySource();
};

let globalHistory = createHistory(getSource());
let { navigate } = globalHistory;

////////////////////////////////////////////////////////////////////////////////
export { globalHistory, navigate, createHistory, createMemorySource };
