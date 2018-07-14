/* eslint-disable jsx-a11y/anchor-has-content */
import React from "react";
import warning from "warning";
import PropTypes from "prop-types";
import invariant from "invariant";
import createContext from "create-react-context";
import { polyfill } from "react-lifecycles-compat";
import ReactDOM from "react-dom";
import {
  startsWith,
  pick,
  resolve,
  match,
  insertParams,
  validateRedirect
} from "./lib/utils";
import {
  globalHistory,
  navigate,
  createHistory,
  createMemorySource
} from "./lib/history";

////////////////////////////////////////////////////////////////////////////////
// React polyfill
let { unstable_deferredUpdates } = ReactDOM;
if (unstable_deferredUpdates === undefined) {
  unstable_deferredUpdates = fn => fn();
}

// 封装创建context
// 使用defaultValue可以在没有Provider的时候使用Consumer
const createNamedContext = (name, defaultValue) => {
  const Ctx = createContext(defaultValue);
  Ctx.Consumer.displayName = `${name}.Consumer`;
  Ctx.Provider.displayName = `${name}.Provider`;
  return Ctx;
};

////////////////////////////////////////////////////////////////////////////////
// Location Context/Provider
let LocationContext = createNamedContext("Location");

// sets up a listener if there isn't one already so apps don't need to be
// wrapped in some top level provider
// 如果上级已经有Provider（context存在），直接调用children
// 如果上级没有Provider（context不存在），创建一个Provider
let Location = ({ children }) => (
  <LocationContext.Consumer>
    {context =>
      context ? (
        children(context)
      ) : (
        <LocationProvider>{children}</LocationProvider>
      )
    }
  </LocationContext.Consumer>
);

// 定义Provider组件，定义一个context属性，context有location（包含当前url的状态），
// navigate（跳转函数，绑定了自动更新location和每次跳转触发它的返回值promise.then）
// 并且将context作为reactContext的属性
class LocationProvider extends React.Component {
  static propTypes = {
    history: PropTypes.object.isRequired
  };

  // 定义一个location，主要用到window.location.pathname,window.location.search,window.history.state,window.history.state.key
  // 如果不是浏览器平台，则模拟实现
  // 定义一个transitioning()，查询返回值promise是否已经resolve
  // 定义一个_onTransitionComplete()，标志promise已经resolve，并且执行resovle()('会触发返回值的then')
  // 定义一个navigate()，用于跳转(默认使用pushState)，跳转完会自动更新当前location，返回promise
  // 定义一个listen()，用于监听popstate，当任意执行都会触发，返回unlisten
  static defaultProps = {
    history: globalHistory
  };

  state = {
    context: this.getContext(),
    refs: { unlisten: null }
  };

  getContext() {
    let {
      props: {
        history: { navigate, location }
      }
    } = this;
    return { navigate, location };
  }

  // todo 为什么要抛出RedirectRequest
  componentDidCatch(error, info) {
    // error由RedirectRequest构造
    if (isRedirect(error)) {
      let {
        props: {
          history: { navigate }
        }
      } = this;
      // 跳转到对应uri
      navigate(error.uri, { replace: true });
    } else {
      throw error;
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // location发生变化，说明已经完成跳转
    if (prevState.context.location !== this.state.context.location) {
      // 触发navigate的then
      this.props.history._onTransitionComplete();
    }
  }

  // 绑定监听（更新context），低优先
  componentDidMount() {
    let {
      state: { refs },
      props: { history }
    } = this;
    // 绑定每次执行前进后退或者navigate的时候都将更新state为最新的location对象（navigate和前进后退会自动更新location）
    refs.unlisten = history.listen(() => {
      Promise.resolve().then(() => {
        // 以下的事件放到低优先权的处理中（会等其他任务处理完毕，再处理）
        unstable_deferredUpdates(() => {
          // 正在调用willUnmount则以下不会触发
          if (!this.unmounted) {
            this.setState(() => ({ context: this.getContext() }));
          }
        });
      });
    });
  }

  componentWillUnmount() {
    let {
      state: { refs }
    } = this;
    this.unmounted = true;
    // 解除上面的绑定
    refs.unlisten();
  }

  render() {
    let {
      state: { context },
      props: { children }
    } = this;
    return (
      <LocationContext.Provider value={context}>
        {typeof children === "function" ? children(context) : children || null}
      </LocationContext.Provider>
    );
  }
}

////////////////////////////////////////////////////////////////////////////////
// 服务器上Location组件
let ServerLocation = ({ url, children }) => (
  <LocationContext.Provider
    value={{
      location: { pathname: url },
      navigate: () => {
        throw new Error("You can't call navigate on the server.");
      }
    }}
  >
    {children}
  </LocationContext.Provider>
);

////////////////////////////////////////////////////////////////////////////////
// Sets baseuri and basepath for nested routers and links
// basepath是整体的绝对路径
let BaseContext = createNamedContext("Base", { baseuri: "/", basepath: "/" });

////////////////////////////////////////////////////////////////////////////////
// The main event, welcome to the show everybody.
let Router = props => (
  <BaseContext.Consumer>
    {/* 此处baseContext是 { baseuri: "/", basepath: "/" } */}
    {baseContext => (
      // 如果父级没有Provider则创建
      <Location>
        {locationContext => (
          <RouterImpl {...baseContext} {...locationContext} {...props} />
        )}
      </Location>
    )}
  </BaseContext.Consumer>
);

class RouterImpl extends React.PureComponent {
  static defaultProps = {
    primary: true
  };

  render() {
    let {
      location,
      navigate,
      basepath,
      primary,
      children,
      baseuri,
      component = "div",
      ...domProps
    } = this.props;
    // 对每一个chidlren检测（也就是Router的children）
    //返回的数组中包括 由element,default,path(一个绝对path，element有children 加上*)3个属性组成的对象
    let routes = React.Children.map(children, createRoute(basepath));
    let { pathname } = location;
    // 返回匹配的路径 一个对象包括params:匹配的键值对，uri:公共路径，和route对象
    let match = pick(routes, pathname);
    // 能匹配到
    if (match) {
      let {
        params,
        uri,
        route,
        route: { value: element }
      } = match;

      // 重新定义basepath，去除待匹配项的 *
      // remove the /* from the end for child routes relative paths
      basepath = route.default ? basepath : route.path.replace(/\*$/, "");

      // 作为新的属性传递给匹配的element
      let props = {
        // 所有匹配的键值对
        ...params,
        // 匹配路径，不包括匹配的*对应的路径
        uri,
        // location对象
        location,
        // resolve：解析路径合并
        navigate: (to, options) => navigate(resolve(to, uri), options)
      };

      // 对匹配的element进行配置
      // 这里的props属性都传递给了children，即用户自定义的Route Component
      let clone = React.cloneElement(
        element,
        props,
        element.props.children ? (
          // primary为true则会跟踪location的改变
          <Router primary={primary}>{element.props.children}</Router>
        ) : (
          undefined
        )
      );

      // using 'div' for < 16.3 support
      let FocusWrapper = primary ? FocusHandler : component;
      // don't pass any props to 'div'
      let wrapperProps = primary
        ? { uri, location, component, ...domProps }
        : domProps;

      return (
        <BaseContext.Provider value={{ baseuri: uri, basepath }}>
          <FocusWrapper {...wrapperProps}>{clone}</FocusWrapper>
        </BaseContext.Provider>
      );
    } else {
      // Not sure if we want this, would require index routes at every level
      // warning(
      //   false,
      //   `<Router basepath="${basepath}">\n\nNothing matched:\n\t${
      //     location.pathname
      //   }\n\nPaths checked: \n\t${routes
      //     .map(route => route.path)
      //     .join(
      //       "\n\t"
      //     )}\n\nTo get rid of this warning, add a default NotFound component as child of Router:
      //   \n\tlet NotFound = () => <div>Not Found!</div>
      //   \n\t<Router>\n\t  <NotFound default/>\n\t  {/* ... */}\n\t</Router>`
      // );
      return null;
    }
  }
}

// Focus context
let FocusContext = createNamedContext("Focus");

let FocusHandler = ({ uri, location, component, ...domProps }) => (
  // 每次 Provider 值改变，Consumer都会重新渲染，因此这里requestFocus就是父级Provide的 this.requestFocus
  <FocusContext.Consumer>
    {requestFocus => (
      <FocusHandlerImpl
        {...domProps}
        component={component}
        requestFocus={requestFocus}
        uri={uri}
        location={location}
      />
    )}
  </FocusContext.Consumer>
);

// don't focus on initial render
let initialRender = true;
let focusHandlerCount = 0;

class FocusHandlerImpl extends React.Component {
  state = {};

  static getDerivedStateFromProps(nextProps, prevState) {
    // 判断是否初始化
    let initial = prevState.uri == null;
    if (initial) {
      // 更新state和shouldFocus标志
      return {
        shouldFocus: true,
        ...nextProps
      };
    } else {
      // uri发生改变（*匹配的改变不触发，动态(:)改变会触发）
      let myURIChanged = nextProps.uri !== prevState.uri;

      // 查看pathname
      let navigatedUpToMe =
        // 查看pathname有改变
        prevState.location.pathname !== nextProps.location.pathname &&
        // 没有*匹配
        nextProps.location.pathname === nextProps.uri;
      return {
        // * 匹配（uri会与父级uri相同） 或者 相同uri和相同pathname 为false
        shouldFocus: myURIChanged || navigatedUpToMe,
        ...nextProps
      };
    }
  }

  componentDidMount() {
    focusHandlerCount++;
    // 初次执行只是改变初始化标志
    this.focus();
  }

  componentWillUnmount() {
    focusHandlerCount--;
    if (focusHandlerCount === 0) {
      initialRender = true;
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // location有变化
    if (prevProps.location !== this.props.location && this.state.shouldFocus) {
      this.focus();
    }
  }

  // 执行条件是 this.state.shouldFocus为true
  focus() {
    if (process.env.NODE_ENV === "test") {
      // getting cannot read property focus of null in the tests
      // and that bit of global `initialRender` state causes problems
      // should probably figure it out!
      return;
    }

    let { requestFocus } = this.props;

    // 初始化（第一次渲染）的时候并没有requestFocus
    if (requestFocus) {
      requestFocus(this.node);
    } else {
      if (initialRender) {
        initialRender = false;
      } else {
        this.node.focus();
      }
    }
  }

  requestFocus = node => {
    // 注意，此处的this是静态绑定，也就是通过context传过来时的this，也就是父级FocusHandlerImpl的this
    // 而当子级的uri变化时，父级的uri是不变的（因为在同一个父级下），因此父级的shouldFocus是false，触发子级dom的focus
    // 如果父级不同，例如从父级a的子级a1, 直接跳转到父级b的子级b1，那么父级uri不同，父级的shouldFocus为true，不触发子级dom的focus，
    // 而父级的父级的uri是不变的，因此会触发父级(b)dom的focus
    if (!this.state.shouldFocus) {
      node.focus();
    }
  };

  render() {
    let {
      children,
      style,
      requestFocus,
      role = "group",
      component: Comp = "div",
      uri,
      location,
      ...domProps
    } = this.props;
    return (
      <Comp
        style={{ outline: "none", ...style }}
        tabIndex="-1"
        role={role}
        ref={n => (this.node = n)}
        {...domProps}
      >
        <FocusContext.Provider value={this.requestFocus}>
          {this.props.children}
        </FocusContext.Provider>
      </Comp>
    );
  }
}

polyfill(FocusHandlerImpl);

let k = () => {};

////////////////////////////////////////////////////////////////////////////////
let { forwardRef } = React;
if (typeof forwardRef === "undefined") {
  forwardRef = C => C;
}

// forwardRef 当在Link组件上使用ref 会获取到 <a>标签
// Link放在Router内部 则参数(basepath, baseuri)是动态的，否则是静态的'/'
// innerRef 一个 forwardRef的 profill实现
let Link = forwardRef(({ innerRef, ...props }, ref) => (
  <BaseContext.Consumer>
    {({ basepath, baseuri }) => (
      <Location>
        {({ location, navigate }) => {
          let { to, state, replace, getProps = k, ...anchorProps } = props;
          // 需要跳转的路径
          let href = resolve(to, baseuri);
          // 判断是否是当前激活的link
          // 例如 href为 a/b ， pathname为 a/b/c，想要高亮这个Link 就要使用 isPartiallyCurrent
          let isCurrent = location.pathname === href;
          let isPartiallyCurrent = startsWith(location.pathname, href);

          return (
            <a
              {/* forwardRef 的作用位置 */}
              ref={ref || innerRef}
              aria-current={isCurrent ? "page" : undefined}
              {...anchorProps}
              // 根据这4个参数 自定义函数，可返回props ，例如通过判断isCurrent返回 className:{...}或者 null
              {...getProps({ isCurrent, isPartiallyCurrent, href, location })}
              href={href}
              onClick={event => {
                // 如果有自定义click，执行
                if (anchorProps.onClick) anchorProps.onClick(event);
                // 符合跳转条件
                if (shouldNavigate(event)) {
                  // 阻止a跳转，执行navigate
                  event.preventDefault();
                  // state作为pushState的state
                  navigate(href, { state, replace });
                }
              }}
            />
          );
        }}
      </Location>
    )}
  </BaseContext.Consumer>
));

////////////////////////////////////////////////////////////////////////////////
function RedirectRequest(uri) {
  this.uri = uri;
}

let isRedirect = o => o instanceof RedirectRequest;

let redirectTo = to => {
  throw new RedirectRequest(to);
};

class RedirectImpl extends React.Component {
  // Support React < 16 with this hook
  componentDidMount() {
    let {
      // 这里props就包括了匹配动态路径的键值对 例如 ：{"*" : "a/b/c"}
      props: { navigate, to, from, replace = true, state, noThrow, ...props }
    } = this;
    Promise.resolve().then(() => {
      // 将 props 匹配打到的动态路径套入 to 里面
      navigate(insertParams(to, props), { replace, state });
    });
  }

  render() {
    let {
      props: { navigate, to, from, replace, state, noThrow, ...props }
    } = this;
    if (!noThrow) redirectTo(insertParams(to, props));
    return null;
  }
}

let Redirect = props => (
  // Location可以接受Router的context
  <Location>
    {locationContext => <RedirectImpl {...locationContext} {...props} />}
  </Location>
);

Redirect.propTypes = {
  from: PropTypes.string,
  to: PropTypes.string.isRequired
};

////////////////////////////////////////////////////////////////////////////////
let Match = ({ path, children }) => (
  <BaseContext.Consumer>
    {({ baseuri }) => (
      <Location>
        {({ navigate, location }) => {
          // 解析path
          let resolvedPath = resolve(path, baseuri);
          // 对path进行匹配
          let result = match(resolvedPath, location.pathname);
          return children({
            navigate,
            location,
            // result存在说明能匹配到对应的path
            match: result
              ? {
                  ...result.params,
                  uri: result.uri,
                  path
                }
              : null
          });
        }}
      </Location>
    )}
  </BaseContext.Consumer>
);

////////////////////////////////////////////////////////////////////////////////
// Junk
// 去掉路径头尾的 '/'
let stripSlashes = str => str.replace(/(^\/+|\/+$)/g, "");

// element是Router的每一个children
let createRoute = basepath => element => {
  // 参数1为false，抛出参数2
  invariant(
    // 有path
    // 有default
    // 是Redirect组件
    element.props.path || element.props.default || element.type === Redirect,
    `<Router>: Children of <Router> must have a \`path\` or \`default\` prop, or be a \`<Redirect>\`. None found on element type \`${
      element.type
    }\``
  );

  invariant(
    // 不是Redirect组件
    // 是Redirect组件 并且 有from和to
    !(element.type === Redirect && (!element.props.from || !element.props.to)),
    `<Redirect from="${element.props.from} to="${
      element.props.to
    }"/> requires both "from" and "to" props when inside a <Router>.`
  );

  invariant(
    // 不是Redirect组件
    // 是Redirect组件 并且 动态路径一致
    !(
      element.type === Redirect &&
      !validateRedirect(element.props.from, element.props.to)
    ),
    `<Redirect from="${element.props.from} to="${
      element.props.to
    }"/> has mismatched dynamic segments, ensure both paths have the exact same dynamic segments.`
  );
  // 如果有default，直接返回（一般用于无法匹配 404）
  if (element.props.default) {
    return { value: element, default: true };
  }
  // 相对path
  let elementPath =
    element.type === Redirect ? element.props.from : element.props.path;
  // 绝对path
  let path =
    elementPath === "/"
      ? basepath
      : `${stripSlashes(basepath)}/${stripSlashes(elementPath)}`;

  return {
    value: element,
    default: element.props.default,
    // 一个绝对path element有children 加上*
    path: element.props.children ? `${stripSlashes(path)}/*` : path
  };
};

let shouldNavigate = event =>
  // 未被阻止默认事件
  !event.defaultPrevented &&
  // 左击
  event.button === 0 &&
  // 没有附带修正按钮
  !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

////////////////////////////////////////////////////////////////////////
export {
  Link,
  Location,
  LocationProvider,
  Match,
  Redirect,
  Router,
  ServerLocation,
  createHistory,
  createMemorySource,
  isRedirect,
  navigate,
  redirectTo
};
