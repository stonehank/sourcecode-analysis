import invariant from "invariant";

////////////////////////////////////////////////////////////////////////////////
// startsWith(string, search) - Check if `string` starts with `search`
// ('abcdef','abc') --> true
let startsWith = (string, search) => {
  return string.substr(0, search.length) === search;
};

////////////////////////////////////////////////////////////////////////////////
// pick(routes, uri)
//
// Ranks and picks the best route to match. Each segment gets the highest
// amount of points, then the type of segment gets an additional amount of
// points where
//
//     static > dynamic > splat > root
//
// This way we don't have to worry about the order of our routes, let the
// computers do it.
//
// A route looks like this
//
//     { path, default, value }
//
// And a returned match looks like:
//
//     { route, params, uri }
//
// I know, I should use TypeScript not comments for these types.
// 参数1 routes是每一个Router的children的绝对路径path对象的数组
// 参数2 uri是当前的pathname
let pick = (routes, uri) => {
  let match;
  let default_;

  let [uriPathname] = uri.split("?");
  // 通过 / 分割pathname路径（匹配项）
  let uriSegments = segmentize(uriPathname);
  // 判断匹配项是否根路径
  let isRootUri = uriSegments[0] === "";
  // 对routes 进行按优先权大->小排序
  let ranked = rankRoutes(routes);
  // 静态遍历ranked
  for (let i = 0, l = ranked.length; i < l; i++) {
    let missed = false;
    let route = ranked[i].route;

    // default直接跳过
    if (route.default) {
      default_ = {
        route,
        params: {},
        uri
      };
      continue;
    }
    // 通过 / 分割route.path路径（待匹配）
    let routeSegments = segmentize(route.path);
    // 保存能匹配的路径和匹配值
    let params = {};
    let max = Math.max(uriSegments.length, routeSegments.length);
    let index = 0;

    // 对每一个路径片段遍历
    for (; index < max; index++) {
      let routeSegment = routeSegments[index];
      let uriSegment = uriSegments[index];
      // 查看是否 *
      let isSplat = routeSegment === "*";
      if (isSplat) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/*
        // 如果是* 直接将剩余的匹配给route就好了
        // 然后保存到params中 {"*":"documents/work"}
        params["*"] = uriSegments
          // 剩余的路径(不需要再匹配了)
          .slice(index)
          // 解码
          .map(decodeURIComponent)
          // 合并成路径
          .join("/");
        // 跳出
        break;
      }
      // 不是 *
      // 匹配的路径不存在（说明匹配的路径比待匹配的路径短）
      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        // 跳出
        break;
      }
      // 是否动态路径
      let dynamicMatch = paramRe.exec(routeSegment);
      // 待匹配项是动态路径，匹配项不是根路径
      if (dynamicMatch && !isRootUri) {
        // 动态路径的动态名称不能是保留字段 (path ,uri)，否则报错
        let matchIsNotReserved = reservedNames.indexOf(dynamicMatch[1]) === -1;
        invariant(
          matchIsNotReserved,
          `<Router> dynamic segment "${
            dynamicMatch[1]
          }" is a reserved name. Please use a different name in path "${
            route.path
          }".`
        );
        // 解码当前匹配路径段，并且保存
        let value = decodeURIComponent(uriSegment);
        // 匹配项： artical
        // 待匹配项： :section
        // {"section":"artical"}
        params[dynamicMatch[1]] = value;
        // 不等的情况就miss
      } else if (routeSegment !== uriSegment) {
        // Current segments don't match, not dynamic, not splat, so no match
        // uri:   /users/123/settings
        // route: /users/:id/profile
        missed = true;
        break;
      }
    }
    // 全部遍历完毕，查看如果有匹配的
    if (!missed) {
      match = {
        route,
        // 确定匹配的键值对
        params,

        // 匹配项：doc/artical/1
        // 待匹配项：doc/*
        // uri: "/doc"

        // 匹配项：doc/artical/1
        // 待匹配项：doc/:section/:id
        // uri: "/doc/artical/1
        uri: "/" + uriSegments.slice(0, index).join("/")
      };
      break;
    }
  }

  return match || default_ || null;
};

////////////////////////////////////////////////////////////////////////////////
// match(path, uri) - Matches just one path to a uri, also lol
let match = (path, uri) => pick([{ path }], uri);

////////////////////////////////////////////////////////////////////////////////
// resolve(to, basepath)
//
// Resolves URIs as though every path is a directory, no files.  Relative URIs
// in the browser can feel awkward because not only can you be "in a directory"
// you can be "at a file", too. For example
//
//     browserSpecResolve('foo', '/bar/') => /bar/foo
//     browserSpecResolve('foo', '/bar') => /foo
//
// But on the command line of a file system, it's not as complicated, you can't
// `cd` from a file, only directories.  This way, links have to know less about
// their current path. To go deeper you can do this:
//
//     <Link to="deeper"/>
//     // instead of
//     <Link to=`{${props.uri}/deeper}`/>
//
// Just like `cd`, if you want to go deeper from the command line, you do this:
//
//     cd deeper
//     # not
//     cd $(pwd)/deeper
//
// By treating every path as a directory, linking to relative paths should
// require less contextual information and (fingers crossed) be more intuitive.
// 用于将每一层的相对path合并，如果在Route Component中要到相对根目录，应该 to="./" 而不是 to="/",
// 此处判断/ 开头会直接返回
let resolve = (to, base) => {
  // /foo/bar, /baz/qux => /foo/bar
  // to是以 / 开头 直接返回to
  if (startsWith(to, "/")) {
    return to;
  }

  let [toPathname, toQuery] = to.split("?");
  let [basePathname] = base.split("?");

  let toSegments = segmentize(toPathname);
  let baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  // to空或者只有search，返回 base，
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  // profile?x=5, / => /profile?x=5
  // 不是以 . 开头
  if (!startsWith(toSegments[0], ".")) {
    // 合并
    let pathname = baseSegments.concat(toSegments).join("/");
    // 根路径不需要再加 /
    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./         /users/123  =>  /users/123
  // ../        /users/123  =>  /users
  // ../..      /users/123  =>  /
  // ../../one  /a/b/c/d    =>  /a/b/one
  // .././one   /a/b/c/d    =>  /a/b/c/one
  // 先合并
  let allSegments = baseSegments.concat(toSegments);
  // 用来保存新的路径（栈）
  let segments = [];
  for (let i = 0, l = allSegments.length; i < l; i++) {
    let segment = allSegments[i];
    // 遇到.. pop（删除最后一个push的）
    if (segment === "..") segments.pop();
    // 遇到. 不管，其他 push
    else if (segment !== ".") segments.push(segment);
  }
  // 合并添加search
  return addQuery("/" + segments.join("/"), toQuery);
};

////////////////////////////////////////////////////////////////////////////////
// insertParams(path, params)
// 将params匹配打到的动态路径套入path里面
let insertParams = (path, params) => {
  // 用 / 分割路径
  let segments = segmentize(path);
  return (
    "/" +
    segments
      .map(segment => {
        // 判断是否动态路径片段
        let match = paramRe.exec(segment);
        // 返回动态路径 对应的匹配的真实路径，保存在参数params，例如：{"*":"a/b/c"}
        return match ? params[match[1]] : segment;
      })
      .join("/")
  );
};

// 判断动态路径是否一致
let validateRedirect = (from, to) => {
  // 判断是否动态路径 例如 path='/menu/:section'
  let filter = segment => isDynamic(segment);
  // 通过 / 分割路径
  let fromString = segmentize(from)
    // 筛选出动态路径
    .filter(filter)
    // 这里排序是为了对比to和from是否相同
    .sort()
    .join("/");
  let toString = segmentize(to)
    .filter(filter)
    .sort()
    .join("/");
  return fromString === toString;
};

////////////////////////////////////////////////////////////////////////////////
// Junk
// 正则判断是否 :some
let paramRe = /^:(.+)/;

let SEGMENT_POINTS = 4;
let STATIC_POINTS = 3;
let DYNAMIC_POINTS = 2;
let SPLAT_PENALTY = 1;
let ROOT_POINTS = 1;

let isRootSegment = segment => segment === "";
let isDynamic = segment => paramRe.test(segment);
let isSplat = segment => segment === "*";

/**
 * 打分目的是对匹配优先权按分值从大到小进行排序
 * @param route
 * @param index
 * @returns {{route: *, score: number, index: *}}
 */
// 对path进行加分，如果有default则为0
// 每一个路径 初始分4分
// 根路径 +1
// 动态路径 +2
// 任意路径* -5
// 其他 +3
// 参数1 route是一个对象
// 参数2 是索引
// 例如：
// a/b/* --> 4+3 + 4+3 -(4+1) = 9
// a/:b -->4+3 + 4+2 = 13
let rankRoute = (route, index) => {
  let score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;
        if (isRootSegment(segment)) score += ROOT_POINTS;
        else if (isDynamic(segment)) score += DYNAMIC_POINTS;
        else if (isSplat(segment)) score -= SEGMENT_POINTS + SPLAT_PENALTY;
        else score += STATIC_POINTS;
        return score;
      }, 0);
  return { route, score, index };
};

// 对routes 进行按优先权大->小排序
let rankRoutes = routes =>
  routes
    // 进行评分，返回对象中多了score属性
    .map(rankRoute)
    // 按score排序 （从大到小），相同的按索引值 （从小到大）
    .sort(
      (a, b) =>
        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
    );

// 根据'/'分割网址
let segmentize = uri =>
  uri
    // strip starting/ending slashes
    .replace(/(^\/+|\/+$)/g, "")
    .split("/");

let addQuery = (pathname, query) => pathname + (query ? `?${query}` : "");

let reservedNames = ["uri", "path"];

////////////////////////////////////////////////////////////////////////////////
export { startsWith, pick, match, resolve, insertParams, validateRedirect };
