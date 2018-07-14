/*
 * 此处说 的VDOM对象，指hyperapp的visual-dom
 * 格式为：
 * {
 *   nodeName: 'div',
 *   attributes: {key:5},
 *   children: [{
 *                nodeName: 'div',
 *                attributes: {},
 *                children:['子元素']
 *               },
 *              '父元素'
 *              ]
 *  }
 */

// 解析参数为 VDOM对象
export function h(name, attributes) {
  // 存放子元素(单个或者数组)的栈
  var rest = []
  // 解析rest后，存放子元素（单个并且符合一定条件）
  var children = []
  var length = arguments.length

  // push第二个之后的参数
  while (length-- > 2) rest.push(arguments[length])

  // 不断解析rest每一个值，最终符合条件的添加到children里
  while (rest.length) {
    // 第三个参数->第四个参数...第N个参数
    var node = rest.pop()
    // 参数是数组（说明子元素是多个元素）
    if (node && node.pop) {
      // ***此处条件是 length--为true，就执行
      for (length = node.length; length--; ) {
        // 依次遍历添加进rest
        rest.push(node[length])
      }
      // 非数组的情况 不是null，不是undefined，不是true，不是false
    } else if (node != null && node !== true && node !== false) {
      children.push(node)
    }
  }

  // 如果name是函数，后面的参数就是name函数的参数
  // 如果name不是函数，返回一个增加key属性的 VDOM对象
  return typeof name === "function"
    ? name(attributes || {}, children)
    : {
      nodeName: name,
      attributes: attributes || {},
      children: children,
      key: attributes && attributes.key
    }
}

export function app(state, actions, view, container) {
  var map = [].map
  var rootElement = (container && container.children[0]) || null
  // 存在rootElement就 返回rootElement的VDOM对象（数组形式）
  var oldNode = rootElement && recycleElement(rootElement)
  var lifecycle = []
  var skipRender
  var isRecycling = true
  // 单个参数表示克隆，非引用
  var globalState = clone(state)

  // 返回值是一个对象，执行后能解析actions中的高阶函数，并且对actions执行后的result和state对比
  var wiredActions = wireStateToActions([], globalState, clone(actions))

  scheduleRender()

  return wiredActions

  // 遍历出element下所有textNode，并作为children，返回出 VDOM对象 （无key）
  function recycleElement(element) {
    return {
      nodeName: element.nodeName.toLowerCase(),
      attributes: {},
      children: map.call(element.childNodes, function(element) {
        return element.nodeType === 3 // Node.TEXT_NODE
          ? element.nodeValue
          : recycleElement(element)
      })
    }
  }

  // node为function可以接受state和action
  // 最后显示需要渲染的元素
  function resolveNode(node) {
    return typeof node === "function"
      ? resolveNode(node(globalState, wiredActions))
      : node != null
        ? node
        : ""
  }

  function render() {
    // toggle skipRender
    skipRender = !skipRender

    // 解析view，返回需要渲染的node
    var node = resolveNode(view)

    if (container && !skipRender) {

      /**
       * 经过对比并且变换后的DOM集合
       * @type {Text | *}
       */
      // 参数1 自定义container
      // 参数2 container第一个子元素（更新前的DOM）
      // 参数3 rootElement的VDOM对象（更新前的对象）
      // 参数4 经过解析的view，也就是view的最终返回值（更新后的对象）
      rootElement = patch(container, rootElement, oldNode, (oldNode = node))
    }

    isRecycling = false
    // 执行lifecycle
    while (lifecycle.length) lifecycle.pop()()
  }

  function scheduleRender() {
    if (!skipRender) {
      skipRender = true
      setTimeout(render)
    }
  }

  // 返回target和source的并集(source覆盖target)
  function clone(target, source) {
    var out = {}

    for (var i in target) out[i] = target[i]
    for (var i in source) out[i] = source[i]

    return out
  }

  // 如果path为空，返回value
  // path非空，将value赋值给source[path[0]][path[1]]...
  function setPartialState(path, value, source) {
    var target = {}
    if (path.length) {
      target[path[0]] =
        path.length > 1
          ? setPartialState(path.slice(1), value, source[path[0]])
          : value
      return clone(source, target)
    }
    return value
  }

  // 获取path中特定的source
  /*
  * path=["x"],source={x:{a:1},y:2}
  * => {a:1}
  * */
  function getPartialState(path, source) {
    var i = 0
    while (i < path.length) {
      source = source[path[i++]]
    }
    return source
  }


  function wireStateToActions(path, state, actions) {
    for (var key in actions) {
      typeof actions[key] === "function"
        // IIFE 重新定义actions[key]
        ? (function(key, action) {
          actions[key] = function(data) {
            // result为actions[key](data)
            var result = action(data)

            // action是高阶函数
            if (typeof result === "function") {
              // 获取嵌套obj，作为参数1 actions作为参数2
              result = result(getPartialState(path, globalState), actions)
            }

            if (
              result &&
              // result不等于state
              result !== (state = getPartialState(path, globalState)) &&
              // !isPromise
              !result.then
            ) {
              scheduleRender(
                // 根据path返回新的state，具体见 setPartialState
                (globalState = setPartialState(
                  path,
                  // 更新后的全部state
                  clone(state, result),
                  // 未更新的全部state
                  globalState
                ))
              )
            }

            return result
          }
        })(key, actions[key])
        // action上的不是函数，则将key加入path再次执行
        : wireStateToActions(
        path.concat(key),
        (state[key] = clone(state[key])),
        (actions[key] = clone(actions[key]))
        )
    }

    return actions
  }

  function getKey(node) {
    return node ? node.key : null
  }

  function eventListener(event) {
    // 返回当前事件的currentTarget(dom)上所绑定的事件
    return event.currentTarget.events[event.type](event)
  }

  function updateAttribute(element, name, value, oldValue, isSvg) {
    // 对key不进行更新
    if (name === "key") {
    } else if (name === "style") {
      for (var i in clone(oldValue, value)) {
        // style为i对应的值
        var style = value == null || value[i] == null ? "" : value[i]
        // todo ?
        if (i[0] === "-") {
          element[name].setProperty(i, style)
        } else {
          element[name][i] = style
        }
      }
    } else {
      // 事件
      if (name[0] === "o" && name[1] === "n") {
        name = name.slice(2)
        // element.events 为自定义属性，用于存放事件
        if (element.events) {
          // 存在旧事件，保存，后面进行解绑
          if (!oldValue) oldValue = element.events[name]
        } else {
          element.events = {}
        }

        element.events[name] = value

        // 存在新事件
        // 如果存在旧事件，则不需要操作，因为是动态绑定
        if (value) {
          // 不存在旧事件
          if (!oldValue) {
            element.addEventListener(name, eventListener)
          }
          // 不存在新的事件，解绑旧事件
        } else {
          element.removeEventListener(name, eventListener)
        }
        // 非自定义属性
      } else if (name in element && name !== "list" && !isSvg) {
        element[name] = value == null ? "" : value
        // 自定义属性
      } else if (value != null && value !== false) {
        element.setAttribute(name, value)
      }

      // 新属性为null，删除
      if (value == null || value === false) {
        element.removeAttribute(name)
      }
    }
  }

  function createElement(node, isSvg) {
    var element =
      // 是#text
      typeof node === "string" || typeof node === "number"
        ? document.createTextNode(node)
        // svg
        : (isSvg = isSvg || node.nodeName === "svg")
        ? document.createElementNS(
          "http://www.w3.org/2000/svg",
          node.nodeName
        )
        // 其他，创建元素
        : document.createElement(node.nodeName)

    // 添加attribute，添加生命周期函数oncreate
    var attributes = node.attributes
    if (attributes) {
      if (attributes.oncreate) {
        lifecycle.push(function() {
          attributes.oncreate(element)
        })
      }

      // 创建子元素
      for (var i = 0; i < node.children.length; i++) {
        element.appendChild(
          createElement(
            (node.children[i] = resolveNode(node.children[i])),
            isSvg
          )
        )
      }
      // 绑定事件
      for (var name in attributes) {
        updateAttribute(element, name, attributes[name], null, isSvg)
      }
    }

    return element
  }

  function updateElement(element, oldAttributes, attributes, isSvg) {
    // 对
    for (var name in clone(oldAttributes, attributes)) {
      // 如果attribut的值不同
      if (
        attributes[name] !==
        (name === "value" || name === "checked"
          ? element[name]
          : oldAttributes[name])
      ) {
        updateAttribute(
          element,
          name,
          attributes[name],
          oldAttributes[name],
          isSvg
        )
      }
    }

    var cb = isRecycling ? attributes.oncreate : attributes.onupdate
    if (cb) {
      lifecycle.push(function() {
        cb(element, oldAttributes)
      })
    }
  }

  // 遍历执行element下所有子元素的ondestroy
  function removeChildren(element, node) {
    var attributes = node.attributes
    if (attributes) {
      for (var i = 0; i < node.children.length; i++) {
        removeChildren(element.childNodes[i], node.children[i])
      }

      if (attributes.ondestroy) {
        attributes.ondestroy(element)
      }
    }
    return element
  }


  function removeElement(parent, element, node) {
    function done() {
      // 调用所有node上的的ondestroy(参数是element)和删除element
      parent.removeChild(removeChildren(element, node))
    }

    var cb = node.attributes && node.attributes.onremove
    if (cb) {
      cb(element, done)
    } else {
      done()
    }
  }


  function patch(parent, element, oldNode, node, isSvg) {
    // 新旧元素引用一致或者都为null，undefined
    // 直接到最后 return element
    if (node === oldNode) {
      // 元素名不同 或者旧元素不存在
    } else if (oldNode == null || oldNode.nodeName !== node.nodeName) {
      // 创建新元素
      var newElement = createElement(node, isSvg)
      parent.insertBefore(newElement, element)
      // 旧元素存在 则删除它
      if (oldNode != null) {
        // 从parent上删除element并且调用存在的ondestroy
        removeElement(parent, element, oldNode)
      }

      element = newElement
      // todo ?
    } else if (oldNode.nodeName == null) {
      element.nodeValue = node
      // 新旧元素都存在并且类名相同 进行key对比
    } else {
      updateElement(
        element,
        oldNode.attributes,
        node.attributes,
        (isSvg = isSvg || node.nodeName === "svg")
      )

      var oldKeyed = {}
      var newKeyed = {}
      var oldElements = []
      // VDOM对象的children
      var oldChildren = oldNode.children
      var children = node.children

      // 遍历VDOM对象的children
      // 就是container第一个子元素下的所有元素的VDOM对象，类似
      for (var i = 0; i < oldChildren.length; i++) {
        // 获取oldChildren[i]的实际node
        oldElements[i] = element.childNodes[i]
        // 返回oldChildren[i]的key
        var oldKey = getKey(oldChildren[i])
        // 存在key
        if (oldKey != null) {
          // [实际node，VDOM对象]
          oldKeyed[oldKey] = [oldElements[i], oldChildren[i]]
        }
      }

      // i是旧node的指针
      // k是新node的指针
      var i = 0
      var k = 0

      while (k < children.length) {
        // 获取k和i位置的的key值
        var oldKey = getKey(oldChildren[i])
        var newKey = getKey((children[k] = resolveNode(children[k])))

        if (newKeyed[oldKey]) {
          i++
          continue
        }
        // 如果新的第k个key===旧的第i+1个key(可以快速分辨 1,2,3,4 --> 2,3,4,1)
        // i++ 后就是两个key相同
        if (newKey != null && newKey === getKey(oldChildren[i + 1])) {
          // 旧的第i个key不存在
          if (oldKey == null) {
            // 删除第i个
            removeElement(element, oldElements[i], oldChildren[i])
          }
          i++
          continue
        }

        // 新元素无key
        if (newKey == null || isRecycling) {
          // 旧元素无key
          if (oldKey == null) {
            // 继续对他们子元素进行patch
            patch(element, oldElements[i], oldChildren[i], children[k], isSvg)
            k++
          }
          i++
          // 新元素key===旧元素key 或者 新元素key
        } else {
          // 新元素的key在旧元素也存在，获取这个存在的数组[实际节点，VDOM对象]
          var keyedNode = oldKeyed[newKey] || []

          // 两者key相等，深入子元素进行替换
          if (oldKey === newKey) {
            patch(element, keyedNode[0], keyedNode[1], children[k], isSvg)
            i++
            // 如果存在新旧元素共同的节点
          } else if (keyedNode[0]) {
            // 先使用insertBefore移动旧节点，再深入子元素进行对比
            patch(
              element,
              element.insertBefore(keyedNode[0], oldElements[i]),
              keyedNode[1],
              children[k],
              isSvg
            )
            // 新的key存在旧的key不存在，并且旧的key集合内没有新的key
          } else {
            patch(element, oldElements[i], null, children[k], isSvg)
          }

          // 保存检测到的节点
          newKeyed[newKey] = children[k]
          // 对比完毕 k++
          k++
        }
      }
      // i指针未到尾部，查找是否有无key的节点，删除
      while (i < oldChildren.length) {
        if (getKey(oldChildren[i]) == null) {
          removeElement(element, oldElements[i], oldChildren[i])
        }
        i++
      }

      // 判断是否有key在oldKeyed中存在，在newKeyed中不存在，删除
      for (var i in oldKeyed) {
        if (!newKeyed[i]) {
          removeElement(element, oldKeyed[i][0], oldKeyed[i][1])
        }
      }
    }
    return element
  }
}
