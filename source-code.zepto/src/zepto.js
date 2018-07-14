/* Zepto v1.2.0 - zepto event ajax form ie - zeptojs.com/license */
(function(global, factory) {
    if (typeof define === 'function' && define.amd)
        define(function() { return factory(global) })
    else
        factory(global)
}(this, function(window) {
    var Zepto = (function() {
        var undefined, key, $, classList, emptyArray = [], concat = emptyArray.concat, filter = emptyArray.filter, slice = emptyArray.slice,
            document = window.document,
            elementDisplay = {}, classCache = {},
            cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
            //匹配html标签 <div> $1 为div
            // 可以匹配<!doctype html>和注释<!--> 但 $1 就是 !
            fragmentRE = /^\s*<(\w+|!)[^>]*>/,
            //匹配是否单独的tag标签，里面没有嵌套 <div />
            //此处 ?: 表示括号内容不被捕获，不能反向引用  \1则是引用第一个括号的内容 (\w+)
            singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
            //匹配一个单独的闭合标签
            tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
            rootNodeRE = /^(?:body|html)$/i,
            capitalRE = /([A-Z])/g,

            //这些方法可以在 zepto 对象上直接使用
            //例如 $("div").val()  $("div").height()
            // special attributes that should be get/set via method calls
            methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

            adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
            table = document.createElement('table'),
            tableRow = document.createElement('tr'),
            containers = {
                'tr': document.createElement('tbody'),
                'tbody': table, 'thead': table, 'tfoot': table,
                'td': tableRow, 'th': tableRow,
                '*': document.createElement('div')
            },
            readyRE = /complete|loaded|interactive/,
            simpleSelectorRE = /^[\w-]*$/,
            class2type = {},
            toString = class2type.toString,
            zepto = {},
            camelize, uniq,
            tempParent = document.createElement('div'),
            propMap = {
                'tabindex': 'tabIndex',
                'readonly': 'readOnly',
                'for': 'htmlFor',
                'class': 'className',
                'maxlength': 'maxLength',
                'cellspacing': 'cellSpacing',
                'cellpadding': 'cellPadding',
                'rowspan': 'rowSpan',
                'colspan': 'colSpan',
                'usemap': 'useMap',
                'frameborder': 'frameBorder',
                'contenteditable': 'contentEditable'
            },
            isArray = Array.isArray ||
                function(object){ return object instanceof Array }

        /**
         * 必须有1个参数 或者 ele是元素
         * 返回正数和0表示不存在
         * 返回负数表示存在
         * 返回 boolean 或者 number（0表示不存在）
         */
        zepto.matches = function(element, selector) {
            if (!selector || !element || element.nodeType !== 1) return false;

            /**
             * matchesSelector的兼容性写法 因为本身兼容性很差
             * 当参数是css选择符并且与元素之间匹配则返回true
             */
            var matchesSelector = element.matches || element.webkitMatchesSelector ||
                element.mozMatchesSelector || element.oMatchesSelector ||
                element.matchesSelector;

            /**
             * 返回boolean
             */
            if (matchesSelector) return matchesSelector.call(element, selector);

            // fall back to performing a selector:
            var match, parent = element.parentNode, temp = !parent;
            /**
             * 如果ele 不存在父元素 就创建一个新div，并且把ele放入
             */
            if (temp) (parent = tempParent).appendChild(element);

            /**
             * 此处要注意如果 ele无父元素 并且 selector 为"div div"
             * 最后会通过 querySelectorAll 来选择
             * 会遍历包括父元素自身
             * ~-1===0 ~0===-1 ~1===-2 ~2===-3......
             */
            match = ~zepto.qsa(parent, selector).indexOf(element);

            temp && tempParent.removeChild(element)
            return match
        }


        /**
         * 通过 Obj.pro.toString 获取对象类型 返回 小写值 如："array" "object"
         * 此处 class2type 不是空对象 里面是 toString 获得的字符串  {"[object Array]":"array"}
         * 如果 class2type 里面没有 例如 HTMLDivElement 那就设置成 object
         * @param obj
         * @returns {*}
         */
        function type(obj) {
            return obj == null ? String(obj) :
            class2type[toString.call(obj)] || "object"
        }


        function isFunction(value) { return type(value) == "function" }
        function isWindow(obj)     { return obj != null && obj == obj.window }
        function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
        function isObject(obj)     { return type(obj) == "object" }
        //判断是否朴素对象
        function isPlainObject(obj) {
            return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
        }

        /**
         * 判断是否类数组 1、obj存在有length 2、不是func 3、不是window 4、条件3选1
         * type是array or length为0 or length大于0 并且 length-1 in obj
         * 如果length为false 就肯定不是
         * 注意：function也有length 为形参的个数 后面需要排除function
         * type为 obj 类型
         * ？？obj={} obj.length=0; 返回true
         */
        function likeArray(obj) {
            var length = !!obj && 'length' in obj && obj.length,
                type = $.type(obj)

            /**
             * type不是func obj不是window
             *
             *
             */
            return 'function' != type && !isWindow(obj) && (
                    'array' == type || length === 0 ||
                    (typeof length == 'number' && length > 0 && (length - 1) in obj)
                )
        }


        /**
         * 删除数组中的 undefined和null
         */
        function compact(array) { return filter.call(array, function(item){ return item != null }) }

        /**
         * 利用apply  只能拉平1次
         */
        function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }

        /**
         * 对"xxx-xxx" 进行驼峰写法 "xxxXxx"
         */
        camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) };
        /**
         * 对驼峰的逆向写法 xxxXxx to xxx-xxx
         */
        function dasherize(str) {
                //将 :: 替换成
            return str.replace(/::/g, '/')
                //将 aBcDDefGG 替换成 aBcD_DefGG
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                //将 aBc1De2g33H4iJ 替换成 a_Bc1_De2g33_H4i_J
                .replace(/([a-z\d])([A-Z])/g, '$1_$2')
                //将 _ 替换成 -
                .replace(/_/g, '-')
                //全部小写
                .toLowerCase()
        }

        //数组去重复 indexOf方法
        uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

        //classCache 存在name则获取 不存在则添加 value为
        function classRE(name) {
            return name in classCache ?
                // 正则输出就是 /(^|\s)name(\s|$)/
                //表示name两边有空白或者没有
                // 这里classCache 就是{name:/(^|\s)name(\s|$)/}
                classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
        }

        //确定是否可以给value添加px name反驼峰并且排除掉是cssNumber里的key就可以
        function maybeAddPx(name, value) {
            return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
        }

        /**
         * 参数是一个元素tag 先查看之前是否有记录
         * 可以预先设置好默认display 遇到有的tagName就会选择对应的display 如下
         *  elementDisplay = {SPAN:"inline",LI:"inline-block"}
         * 如果没有 则新创建这个tag 获取display
         * 如果display为none 就默认为true
         * 再添加进记录——elementDisplay
         * 返回这个参数的display
         */
        function defaultDisplay(nodeName) {
            var element, display
            if (!elementDisplay[nodeName]) {
                element = document.createElement(nodeName)
                document.body.appendChild(element)
                // getComputedStyle 第二个参数可以设置伪类 非必须
                display = getComputedStyle(element, '').getPropertyValue("display")
                element.parentNode.removeChild(element)
                display == "none" && (display = "block")
                elementDisplay[nodeName] = display
            }
            return elementDisplay[nodeName]
        }

        /**
         * 通过 'children' in element判断
         * true 返回element.children  纯数组
         * false 通过自定义的map 返回 nodeType==1 的子元素
         * 返回 纯数组
         * @param element
         * @returns {Array.<T>}
         */
        function children(element) {
            return 'children' in element ?
                slice.call(element.children) :
                $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
        }



        ///**
        // * Zepto 的自定义获取元素的集合 类数组
        // * prototype 上的方法也就是 $.fn 上的方法
        // * 定义了 length 和 selector
        // */
        //function Z(dom, selector) {
        //    var i, len = dom ? dom.length : 0
        //    for (i = 0; i < len; i++) this[i] = dom[i]
        //    this.length = len
        //    this.selector = selector || ''
        //}




        // `$.zepto.fragment` takes a html string and an optional tag name
        // to generate DOM nodes from the given html string.
        // The generated DOM nodes are returned as an array.
        // This function can be overridden in plugins for example to make
        // it compatible with browsers that don't support the DOM fully.
        /**
         * html 是需要进行css配置的标签 字符串
         * name 如果为设定 就是html的tag值 最终 name 就是 html 的父元素标签 除非html是表格 否则 name都是div
         * 因为 div 不能用innerHTML 添加表格内的标签
         * properties 为  key value 是标签上的 属性 不是css属性
         * 此方法作用就是 对参数html 进行css配置（properties），并且返回
         * 返回z对象 或者纯数组
         */
        zepto.fragment = function(html, name, properties) {
            var dom, nodes, container
            //TODO 可否看成html是字符串？
            // A special case optimization for a single tag
            // 如果html是单独标签（无嵌套）创建一个此标签赋值给dom
            // TODO 此处为什么用$()包裹
            if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))
            //dom不存在
            if (!dom) {
                //html存在replace方法
                //匹配一个单独的闭合标签 <div/> 结尾必须是/> 替换成<div></div>
                if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")

                if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
                //上面获取的name设定为 不是表格就是div key为* value为 document.createElement('div')
                if (!(name in containers)) name = '*'
                // 非表格情况 container 为  document.createElement('div') 即新的空div
                container = containers[name]
                // 里面嵌入 html 元素
                // 这里如果html是 "<div><ul>" container.childNodes不会出现ul
                // 如果通过slice.call 转成数组 就会出现ul
                container.innerHTML = '' + html
                /**
                 * each 是自定义方法 返回值就是第一个参数值 注意是否有在cb内有修改
                 * 再把dom里面每一个child标签删除
                 * dom这里就是 slice.call(container.childNodes) 里面存放 container的子元素
                 */
                dom = $.each(slice.call(container.childNodes), function(){
                    container.removeChild(this)
                })
            }
            /**
             * 判断 properties 是否朴素元素
             * 将 properties 配置到 dom的每一个元素上
             */
            if (isPlainObject(properties)) {
                //将 dom 由数组 变成 zepto对象的 类数组 赋值给nodes
                nodes = $(dom)
                $.each(properties, function(key, value) {
                    // 如果 properties 的 key 属于 methodAttributes 就是一些定义好的 属性方法
                    if (methodAttributes.indexOf(key) > -1) nodes[key](value)
                    //如果 不属于，就调用 自定义 attr方法 直接添加到标签上 如id class
                    else nodes.attr(key, value)
                })
            }

            // 返回一个z对象 或者一个 纯数组
            return dom
        }

        // `$.zepto.Z` swaps out the prototype of the given `dom` array
        // of nodes with `$.fn` and thus supplying all the Zepto functions
        // to the array. This method can be overridden in plugins.
        //zepto.Z = function(dom, selector) {
        //    return new Z(dom, selector)
        //}

        // `$.zepto.Z` swaps out the prototype of the given `dom` array
        // of nodes with `$.fn` and thus supplying all the Zepto functions
        // to the array. Note that `__proto__` is not supported on Internet
        // Explorer. This method can be overriden in plugins.
        /**
         * 新的写法 那么230+行的 Z 构造函数就没用了
         * @param dom
         * @param selector
         * @returns {*|Array}
         * @constructor
         */
        zepto.Z = function(dom, selector) {
            dom = dom || []
            dom.__proto__ = $.fn
            dom.selector = selector || ''
            return dom
        }





        // `$.zepto.isZ` should return `true` if the given object is a Zepto
        // collection. This method can be overridden in plugins.
        zepto.isZ = function(object) {
            return object instanceof zepto.Z
        }

        // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
        // takes a CSS selector and an optional context (and handles various
        // special cases).
        // This method can be overridden in plugins.
        /**
         * 如果是数组 只能包裹 不会通过qsa获取
         * @param selector
         * @param context
         * @returns {*}
         */
        zepto.init = function(selector, context) {
            var dom
            // If nothing given, return an empty Zepto collection
            if (!selector) return zepto.Z()
            // Optimize for string selectors
            /**
             * 【是字符串】
             */
            else if (typeof selector == 'string') {
                //去两头空格
                selector = selector.trim()
                // If it's a html fragment, create nodes from it
                // Note: In both Chrome 21 and Firefox 15, DOM error 12
                // is thrown if the fragment doesn't begin with <
                /*
                *是标签 通过fragment 创建
                *此时context如果是朴素对象 会创建属性到标签上
                */
                if (selector[0] == '<' && fragmentRE.test(selector))
                    dom = zepto.fragment(selector, RegExp.$1, context), selector = null
                // If there's a context, create a collection on that context first, and select
                // nodes from there
                // context有值 被认为是在context中寻找selector
                else if (context !== undefined) return $(context).find(selector)
                // If it's a CSS selector, use it to select nodes.
                // 其他 就通过 querySelectorAll 在document上寻找
                else dom = zepto.qsa(document, selector)
            }
            // If a function is given, call it when the DOM is ready
            /**
             * 【是函数】 等到页面结构加载完毕执行 $(function(){})
             */
            else if (isFunction(selector)) return $(document).ready(selector)
            // If a Zepto collection is given, just return it
            /**
             * 【zepto对象】 直接返回
             */
            else if (zepto.isZ(selector)) return selector
            /**
             * 【其他】
             */
            else {
                // normalize array if an array of nodes is given
                /**
                 * 【是数组】 去null和undefined 赋值给dom
                 */
                if (isArray(selector)) dom = compact(selector)
                // Wrap DOM nodes.
                /**
                 * 【是obj】
                 * 数组包裹 赋值给dom
                 */
                else if (isObject(selector))
                    dom = [selector], selector = null
                // If it's a html fragment, create nodes from it
                /**
                 * 【HTML片段】 例如 selector 为 document.creatElement("div")
                 * 和string里面标签调用同一个方法
                 */
                else if (fragmentRE.test(selector))
                    dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
                // If there's a context, create a collection on that context first, and select
                // nodes from there
                /**
                 * 【context存在】 从context里面寻找selector
                 */
                else if (context !== undefined) return $(context).find(selector)
                // And last but no least, if it's a CSS selector, use it to select nodes.
                /**
                 * 【其他】 调用qsa方法
                 */
                else dom = zepto.qsa(document, selector)
            }
            // create a new Zepto collection from the nodes found
            return zepto.Z(dom, selector)
        }

        // `$` will be the base `Zepto` object. When calling this
        // function just call `$.zepto.init, which makes the implementation
        // details of selecting nodes and creating Zepto collections
        // patchable in plugins.
        $ = function(selector, context){
            return zepto.init(selector, context)
        }

        /**
         * 遍历 source 如果value有朴素对象 target对应的key不是朴素对象 就把target[key]赋值为空对象
         * 然后 在for in 内部递归
         * 当找value 不是朴素对象也不是数组时 开始复制对应的value target[key] = source[key]
         * 然后最后一层复制完毕 就会跳到上一层 一直到跳到第一层
         */
        function extend(target, source, deep) {
            for (key in source)
                if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                    if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                        target[key] = {}
                    if (isArray(source[key]) && !isArray(target[key]))
                        target[key] = []
                    extend(target[key], source[key], deep)
                }
                else if (source[key] !== undefined) target[key] = source[key]
        }

        // Copy all but undefined properties from one or more
        // objects to the `target` object.
        /**
         * args为除了第一个参数的其他参数
         * @param target
         * @returns {*}
         */
        $.extend = function(target){
            var deep, args = slice.call(arguments, 1)
            //如果 target 是boolean
            if (typeof target == 'boolean') {
                deep = target
                // args 的第一个 改变args
                target = args.shift()
            }
            // 原始target如果是boolean 参数是 (target(目标对象),arg(args中每一个数据),deep(boolean))
            // 原始target如果不是boolean 参数是(target(目标对象),arg(args中每一个数据),deep(undefined))
            args.forEach(function(arg){ extend(target, arg, deep) })
            return target
        };

        /**
         * 返回 原生DOM 或者 纯数组（里面是原生DOM）
         */
        // `$.zepto.qsa` is Zepto's CSS selector implementation which
        // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
        // This method can be overridden in plugins.
        zepto.qsa = function(element, selector){
            var found,
                //判断是否ID
                maybeID = selector[0] == '#',
                //判断是否class
                maybeClass = !maybeID && selector[0] == '.',
                //提取名称
                nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
                /**
                 * /^[\w-]*$/ 匹配字母 数字 下划线 横线 最少0个{0,}
                 * 即可以""，但不能" "
                 */
                isSimple = simpleSelectorRE.test(nameOnly);

            /**
             * 注意，最后返回的一定是个真正的数组，而不是类数组！
             */
            //判断是否id 是否有 getElementById 方法 是否简单写法
            return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
                //如果是 但found不存在，说明名称错误 返回[]
                ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
                //如果不是 继续判断
                //ele是否元素 是否 document 是否 documentFragment
                //全都不是 返回[] ，任意一项是 继续判断
                (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
                    // Array.prototype.slice.call(...)
                    //是否简单名称 不是ID 是否有 getElementsByClassName 方法
                    slice.call(
                        isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
                            //全部为true 是否class 是则 element.getElementsByClassName 否则   element.getElementsByTagName
                            maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
                                element.getElementsByTagName(selector) : // Or a tag
                            /**
                             * 非全部为true 使用 querySelectorAll
                             * 到此处的例如：多个名称，如："div div"，中文字符名称，documentFragment
                             * 使用 querySelectorAll 会和getElementBy 方法不同
                             * querySelectorAll非实时
                             * 遇到多个名称要注意 有可能会遍历本身
                             */
                            element.querySelectorAll(selector) // Or it's not simple, and we need to query all
                    )
        }
        /**
         * 进行筛选 不存在selector就直接返回$(nodes) 减少 filter 使用率
         */
        function filtered(nodes, selector) {
            return selector == null ? $(nodes) : $(nodes).filter(selector)
        }


        /**
         * 重写 contains
         * IE 没有contains 则用 parentNode 递归
         * 返回布尔值
         * @type {Function}
         */
        $.contains = document.documentElement.contains ?
            function(parent, node) {
                // 当node.contains(node)的时候，也返回true 因此要判断parent!==node
                return parent !== node && parent.contains(node)
            } :
            function(parent, node) {
                // 遍历node的parentNode 直到 node===parent
                while (node && (node = node.parentNode))
                    if (node === parent) return true
                return false
            }

        function funcArg(context, arg, idx, payload) {
            return isFunction(arg) ? arg.call(context, idx, payload) : arg
        }

        function setAttribute(node, name, value) {
            value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
        }

        // access className property while respecting SVGAnimatedString
        /**
         * IE和Android  NO SUPPORT baseVal
         * 优先使用svg
         * 1个参数 className就是有原生 ele.className 返回字符串 多个class 用空格隔开
         */
        function className(node, value){
            var klass = node.className || '',
                svg   = klass && klass.baseVal !== undefined

            if (value === undefined) return svg ? klass.baseVal : klass
            svg ? (klass.baseVal = value) : (node.className = value)
        }

        //解析 如下
        // "true"  => true
        // "false" => false
        // "null"  => null
        // "42"    => 42
        // "42.5"  => 42.5
        // "08"    => "08"
        // JSON    => parse if valid
        // JSON string => JSON
        // array string => array
        // String  => self
        function deserializeValue(value) {
            try {
                return value ?
                    // true ?
                value == "true" ||
                  // false ?
                ( value == "false" ? false :
                    // null ?
                    value == "null" ? null :
                        // number ?
                        +value + "" == value ? +value :
                            // 以[或者{ 开头 使用 $.parseJSON 相当于原生JSON.parse
                            /^[\[\{]/.test(value) ? $.parseJSON(value) :
                                value )
                    : value
            } catch(e) {
                return value
            }
        }

        $.type = type
        $.isFunction = isFunction
        $.isWindow = isWindow
        $.isArray = isArray
        $.isPlainObject = isPlainObject

        $.isEmptyObject = function(obj) {
            var name
            for (name in obj) return false
            return true
        }

        //是否可以转换成数字
        $.isNumeric = function(val) {
            var num = Number(val), type = typeof val
            return val != null && type != 'boolean' &&
                (type != 'string' || val.length) &&
                !isNaN(num) && isFinite(num) || false
        }

        $.inArray = function(elem, array, i){
            return emptyArray.indexOf.call(array, elem, i)
        }

        $.camelCase = camelize
        $.trim = function(str) {
            return str == null ? "" : String.prototype.trim.call(str)
        }

        // plugin compatibility
        $.uuid = 0
        $.support = { }
        $.expr = { }
        $.noop = function() {}


        /**
         * 与ES6的不同
         * 删去了null 和 undefined
         * 对象也可以使用
         * 返回 纯数组
         */
        $.map = function(elements, callback){
            var value, values = [], i, key
            if (likeArray(elements))
                for (i = 0; i < elements.length; i++) {
                    value = callback(elements[i], i)
                    //增加了判断 如果返回结果为null或者undefined 则不会添加进结果
                    //ES6则 null和undefined也会添加进结果
                    if (value != null) values.push(value)
                }
            else
            //如果不是类数组，例如是obj{a:1,b:2}
            //通过for in 将value和key放入callback
                for (key in elements) {
                    value = callback(elements[key], key)
                    if (value != null) values.push(value)
                }
            return flatten(values)
        }

        /**
         * 类数组和对象 分开遍历
         * 如果elements[i]有值 则callback 第三个参数为false 无值则为 true
         * 返回elements
         */
        $.each = function(elements, callback){
            var i, key
            if (likeArray(elements)) {
                for (i = 0; i < elements.length; i++)
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
            } else {
                for (key in elements)
                    if (callback.call(elements[key], key, elements[key]) === false) return elements
            }

            return elements
        }

        $.grep = function(elements, callback){
            return filter.call(elements, callback)
        }


        if (window.JSON) $.parseJSON = JSON.parse

        /**
         * 填充class2type
         * 这里没写的都认为是object
         */
        // Populate the class2type map
        $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
            class2type[ "[object " + name + "]" ] = name.toLowerCase()
        })


        // Define methods that will be available on all
        // Zepto collections
        $.fn = {
            constructor: zepto.Z,
            length: 0,

            // Because a collection acts like an array
            // copy over these useful array functions.
            forEach: emptyArray.forEach,
            reduce: emptyArray.reduce,
            push: emptyArray.push,
            sort: emptyArray.sort,
            splice: emptyArray.splice,
            indexOf: emptyArray.indexOf,
            /**
             * 跟原生的不同在于
             * 【先判断每一项arguments】
             * 如果是Z对象（类数组） 会先用toArray转换成数组
             * 如果不是Z对象 直接返回他本身
             * 【再判断this 即调用者】
             * 如果是Z对象 用 toArray转换
             * 如果不是 直接返回他本身
             * 再将调用者和arguments用contact
             * 返回 纯数组
             */
            concat: function(){
                var i, value, args = []
                for (i = 0; i < arguments.length; i++) {
                    value = arguments[i]
                    /**
                     * value 是每一项参数
                     * value 是否 zepto.Z 对象
                     * 如果是 就可以使用$.fn里面的方法
                     * toArray() 就是 get()方法的无参数版本
                     * 未设定参数时是slice复制，设定参数就是获取第几个
                     * 这里如果 value instanceof Z对象 slice复制
                     * 否则 直接返回 value
                     */
                    args[i] = zepto.isZ(value) ? value.toArray() : value
                }
                /**
                 * 原生[].concat方法 主体进行判断 参数是args
                 * 判断this 是否Z 对象 是 返回slice复制
                 * 否 返回本身
                 */
                return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
            },

            // `map` and `slice` in the jQuery API work differently
            // from their array counterparts
            // 返回类数组
            map: function(fn){
                return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
            },
            slice: function(){
                return $(slice.apply(this, arguments))
            },

            ready: function(callback){
                // need to check if document.body exists for IE as that browser reports
                // document ready when it hasn't yet created the body element
                if (readyRE.test(document.readyState) && document.body) callback($)
                else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
                return this
            },
            get: function(idx){
                return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
            },
            toArray: function(){ return this.get() },
            size: function(){
                return this.length
            },
            remove: function(){
                return this.each(function(){
                    if (this.parentNode != null)
                        this.parentNode.removeChild(this)
                })
            },
            /**
             * every 每一项都为true 整体才true
             * 因此 如果调用时这么写
             * ele.each(function(i,e){e.innerHTML="";return false;})
             * 只会 执行ele的第一项 然后就退出 each ； 因为 every的callback为false会停止执行
             * 返回this（类数组）；即原调用项一致（即使它在each里被改变）
             * @param callback
             * @returns {Zepto}
             */
            each: function(callback){
                emptyArray.every.call(this, function(el, idx){
                    return callback.call(el, idx, el) !== false
                })
                // 链式调用
                return this
            },
            /**
             * ES6 filter 参数必须是函数
             * 这里可以是函数或者ele
             * selector是 func 通过 not 2次执行  筛选出符合func执行为true的每一个调用元素
             * selector 不是func 包括数组 都通过matches执行 筛选出能通过selector选择到的每一个调用元素
             * matches 就是原生的 matches 或者 querySelectorAll
             * 其实filter没有自己的功能
             * 返回类数组
             */
            filter: function(selector){
                // true 返回 this的each的Z类数组
                // false 返回  空的Z类数组
                if (isFunction(selector)) return this.not(this.not(selector))
                return $(filter.call(this, function(element){
                    // 在this 上 再次执行filter，回调return zepto.matches(this,selector)
                    // 其实就是 通过 matches 来判断了
                    // matches 匹配this 上面有没有selector  返回0或者false 不存在 负数或者true 存在
                    return zepto.matches(element, selector)
                }))
            },
            add: function(selector,context){
                return $(uniq(this.concat($(selector,context))))
            },
            is: function(selector){
                return this.length > 0 && zepto.matches(this[0], selector)
            },
            /**
             * this 不被 selector 包含 或者 selector为false时
             * this 会被添加进 Z对象类数组
             * selector是func 直接执行
             * selector是string 传给 filter ， filter 再传给 matches
             * selector是array selector.item必须是函数（内部方法）？
             * 返回 类数组
             */
            not: function(selector){
                var nodes=[]
                /**
                 * selector 是函数 并且 有call方法
                 * this 是 $.fn 也就是调用not函数的 Z对象
                 */
                if (isFunction(selector) && selector.call !== undefined)
                    this.each(function(idx){
                        //selector返回false 放进nodes
                        if (!selector.call(this,idx)) nodes.push(this)
                    })
                else {
                    /**
                     * selector 不是函数
                     * 是string 调用 filter  赋值给excludes （filter会继续传给matches）所以string最终再matches里执行
                     * 是函数组成的类数组 变成真数组 赋值给excludes
                     * 是其他 就变成 Z对象 赋值给excludes
                     */
                        //string
                    var excludes = typeof selector == 'string' ? this.filter(selector) :
                        //selector.item 应该是内部使用
                        (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
                    this.forEach(function(el){
                        //element
                        if (excludes.indexOf(el) < 0) nodes.push(el)
                    })
                }
                return $(nodes)
            },
            has: function(selector){
                return this.filter(function(){
                    return isObject(selector) ?
                        $.contains(this, selector) :
                        $(this).find(selector).size()
                })
            },
            eq: function(idx){
                return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
            },
            first: function(){
                var el = this[0]
                return el && !isObject(el) ? el : $(el)
            },
            last: function(){
                var el = this[this.length - 1]
                return el && !isObject(el) ? el : $(el)
            },
            /**
             * $(ele).find
             */
            find: function(selector){
                var result, $this = this
                // 【不存在selector】
                if (!selector) result = $()
                // 【typeof selector 是 object】
                else if (typeof selector == 'object')
                    result = $(selector).filter(function(){
                        var node = this
                        // some方法 任意一个true 整个都为true
                        return emptyArray.some.call($this, function(parent){
                            // parent是$this，也就是调用find的ele
                            // node是 this 就是selector上面的每一项
                            return $.contains(parent, node)
                        })
                    })
                // 以下selector确定存在 并且是基本数据
                // 【调用的ele如果length只有1】 触发qsa
                else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
                // 【调用的ele的len>1】 map方法触发qsa
                else result = this.map(function(){ return zepto.qsa(this, selector) })
                return result
            },

            /**
             * context为自定义父元素临界点 如果node的祖先元素递归时 node===context 则停止
             * selector 为基本类型时 用 matches 判断能否通过 selector 来选择到 node，
             * selector 为引用类型时 用$(selector) 直接获取元素 再从这些元素中 判断是否包含node
             * true则加入数组nodes，false则递归到node的父元素继续判断
             * 此处node为调用closest的每一个元素
             */
            closest: function(selector, context){
                var nodes = [], collection = typeof selector == 'object' && $(selector)
                this.each(function(_, node){
                    while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector))){
                        node = node !== context && !isDocument(node) && node.parentNode
                    }
                    if (node && nodes.indexOf(node) < 0) nodes.push(node)
                })
                return $(nodes)
            },

            /**
             * 这里通过不断递归 node=node.parentNode;
             * if内语句为true 添加node到ancestors 继续递归
             * if内语句为false 返回undefined $.map 方法会将undefined和null 删除 因此nodes.length就减少了
             * @param selector
             * @returns {*}
             */
            parents: function(selector){
                var ancestors = [], nodes = this
                while (nodes.length > 0)
                    nodes = $.map(nodes, function(node){
                        if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
                            ancestors.push(node)
                            return node
                        }
                    })
                // selector 存在 则返回 能通过selector 选择到的ancestors；不存在 则直接返回 ancestors
                return filtered(ancestors, selector)
            },
            /**
             * pluck 就是获取 this[参数] 返回 纯数组
             * uniq 去重复
             * 再通过 filter 筛选
             * 返回类数组
             */
            parent: function(selector){
                return filtered(uniq(this.pluck('parentNode')), selector)
            },
            /**
             * children(this) 返回纯数组
             * this.map 返回 children类数组
             * 再通过filter 返回 类数组
             */
            children: function(selector){
                return filtered(this.map(function(){ return children(this) }), selector)
            },
            /**
             * 获取 每一个调用元素的childNodes
             * contentDocument 返回框架frame 的文档
             * @returns {*}
             */
            contents: function() {
                return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
            },
            /**
             * 返回除了本身的兄弟元素
             * 返回 类数组
             * @param selector
             * @returns {*}
             */
            siblings: function(selector){
                return filtered(this.map(function(i, el){
                    return filter.call(children(el.parentNode), function(child){ return child!==el })
                }), selector)
            },
            /**
             * 将调用eles 的每一项 innerHTML 设为空
             * 返回 调用的eles（未修改时的状态）
             */
            empty: function(){
                return this.each(function(){ this.innerHTML = '' })
            },
            // `pluck` is borrowed from Prototype.js
            /**
             * 获取每一个this 上的property
             * 返回 纯数组
             */
            pluck: function(property){
                return $.map(this, function(el){ return el[property] })
            },
            /**
             * 如果未设置elementDisplay 样式表里设置的display：none经过show()后 都是display:block
             * 返回 this
             */
            show: function(){
                return this.each(function(){
                    // 如果设置了内联
                    this.style.display == "none" && (this.style.display = '')
                    // 如果是样式表里面设置
                    if (getComputedStyle(this, '').getPropertyValue("display") == "none")
                        this.style.display = defaultDisplay(this.nodeName)
                })
            },
            /**
             * 将 newContent 加到this之前
             * 然后 remove this
             * 返回 this
             * @param newContent
             * @returns {*}
             */
            replaceWith: function(newContent){
                return this.before(newContent).remove()
            },
            /**
             * 每一个this 外层加上 structure
             * structure 为func 在每一个this上执行
             * 每一项this调用 wrapAll方法 通过clone判断 structure是否删除
             * 返回this
             */
            wrap: function(structure){
                var func = isFunction(structure),_this=this;
                // structure 不为函数
                if (this[0] && !func)
                // dom 为原生dom 第一个structure
                    var dom   = $(structure).get(0),
                        // 当dom有parentNode（是文档内部元素）或者 调用的元素>1
                        // clone 标记 dom会进行深度克隆，因此dom不会被删除
                        clone = dom.parentNode || this.length > 1

                return this.each(function(index){
                    //下面这句自己添加 当执行到最后一个this，删除原来的dom
                    //clone =  index!==_this.length-1
                    $(this).wrapAll(
                        func ? structure.call(this, index) :
                            clone ? dom.cloneNode(true) : dom
                    )
                })
            },
            /**
             * 第一个this元素.before($(structure))
             * 如果structure有children structure为第一个children 直到最里层
             * $(structure).append(this)
             * 返回this
             */
            wrapAll: function(structure){
                console.log(structure)
                if (this[0]) {
                    $(this[0]).before(structure = $(structure))
                    var children
                    // drill down to the inmost element
                    while ((children = structure.children()).length) structure = children.first()
                    $(structure).append(this)
                }
                return this
            },
            /**
             * 如果this.length>1 调用此方法只能最后一个this 生效 并未使用循环
             * 如果 this 有子元素，就是 $(this.子元素).wrapAll(structure)
             * 返回this
             * @param structure
             * @returns {*|Zepto}
             */
            wrapInner: function(structure){
                var func = isFunction(structure)
                return this.each(function(index){
                    var self = $(this), contents = self.contents(),
                        dom  = func ? structure.call(this, index) : structure
                    contents.length ? contents.wrapAll(dom) : self.append(dom)
                })
            },
            /**
             * 删除this的父元素
             * 返回 this
             * @returns {Zepto}
             */
            unwrap: function(){
                this.parent().each(function(){
                    $(this).replaceWith($(this).children())
                })
                return this
            },
            /**
             * 深拷贝
             * 返回 this
             * @returns {*}
             */
            clone: function(){
                return this.map(function(){ return this.cloneNode(true) })
            },

            hide: function(){
                return this.css("display", "none")
            },

            toggle: function(setting){
                return this.each(function(){
                    var el = $(this)
                        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
                })
            },
            // ele.previousElementSibling 获取前一个兄弟元素节点
            // ele.nextElementSibling 获取后一个兄弟元素节点
            prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
            next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },

            html: function(html){
                // 存在arguments
                return 0 in arguments ?
                    this.each(function(idx){
                        var originHtml = this.innerHTML
                        /**
                         * funcArg
                         * 如果html 是func 执行 html.call()
                         * 如果html 不是func 返回html
                         */
                        $(this).empty().append( funcArg(this, html, idx, originHtml) )
                    }) :
                    // 是否存在this
                    (0 in this ? this[0].innerHTML : null)
            },

            /**
             * 获取 text节点 用的是原生的 textContent
             * @param text
             * @returns {*|Zepto}
             */
            text: function(text){
                return 0 in arguments ?
                    this.each(function(idx){
                        var newText = funcArg(this, text, idx, this.textContent)
                        this.textContent = newText == null ? '' : ''+newText
                    }) :
                    // pluck 返回纯数组 join 将数组转为字符串
                    (0 in this ? this.pluck('textContent').join("") : null)
            },

            attr: function(name, value){
                var result
                return (typeof name == 'string' && !(1 in arguments)) ?
                    // 只有name并且是字符串的情况 获取
                    (0 in this && this[0].nodeType == 1 && (result = this[0].getAttribute(name)) != null ? result : undefined) :
                    // 2个参数或者name不是字符串的情况 设置
                    this.each(function(idx){
                        if (this.nodeType !== 1) return
                        // attr({})
                        if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
                        // attr("",function(){})
                        else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                    })
            },
            /**
             * name 为字符串 多个就用空格隔开
             * @param name
             * @returns {*|Zepto}
             */
            removeAttr: function(name){
                return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
                    // setAttribute 自定义 当只有1个参数 其实就是removeAttribute
                    setAttribute(this, attribute)
                }, this)})
            },
            /**
             * 1个参数 查询 this 的name属性
             * 2个参数 设置 每一个this的 name属性
             * @param name
             * @param value
             * @returns {*|Zepto}
             */
            prop: function(name, value){
                name = propMap[name] || name
                return (1 in arguments) ?
                    this.each(function(idx){
                        this[name] = funcArg(this, value, idx, this[name])
                    }) :
                    (this[0] && this[0][name])
            },
            // 删除属性
            removeProp: function(name){
                name = propMap[name] || name
                return this.each(function(){ delete this[name] })
            },

            /**
             * 1参数 获取 data-{name}
             * 2参数 设置 data-{name} 的值
             * @param name
             * @param value
             * @returns {undefined}
             */
            data: function(name, value){
                var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

                var data = (1 in arguments) ?
                    this.attr(attrName, value) :
                    this.attr(attrName)

                return data !== null ? deserializeValue(data) : undefined
            },
            /**
             * 0参数 查询value
             * 1参数 设置value
             * @param value
             * @returns {*}
             */
            val: function(value){
                if (0 in arguments) {
                    // 设置
                    if (value == null) value = ""
                    return this.each(function(idx){
                        this.value = funcArg(this, value, idx, this.value)
                    })
                } else {
                    // 查询
                    return this[0] && (this[0].multiple ?
                            $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
                            this[0].value)
                }
            },

            offset: function(coordinates){
                // 有参数
                if (coordinates) return this.each(function(index){
                    var $this = $(this),
                        /**
                         * 参数coordinates为 function
                         * 第一个参数是 index 第二个参数是 $(this).offset()
                         * 参数coordinates不为function 必须有top和left 返回coordinates
                         * 设置top和left 距离屏幕的高度
                         */
                        coords = funcArg(this, coordinates, index, $this.offset()),
                        // 获取最近有定位的元素
                        // 用参数设定的top-父元素的top
                        parentOffset = $this.offsetParent().offset(),
                        props = {
                            top:  coords.top  - parentOffset.top,
                            left: coords.left - parentOffset.left
                        }
                    // 给当前元素增加定位
                    if ($this.css('position') == 'static') props['position'] = 'relative'
                    // 设置css
                    $this.css(props)
                })
                // 无参数时
                if (!this.length) return null
                // 不是document 并且 不在document里面
                if (document.documentElement !== this[0] && !$.contains(document.documentElement, this[0]))
                    return {top: 0, left: 0}
                var obj = this[0].getBoundingClientRect()
                // obj.left 为this上边到窗口顶端的距离（margin+top）
                // pageXoffset
                return {
                    left: obj.left + window.pageXOffset,
                    top: obj.top + window.pageYOffset,
                    width: Math.round(obj.width),
                    height: Math.round(obj.height)
                }
            },
            css: function(property, value){
                // 【参数小于2】 获取
                if (arguments.length < 2) {
                    // 只返回第一个this的值
                    var element = this[0]
                    // property 是string
                    if (typeof property == 'string') {
                        if (!element) return
                        // 先获取 内联 再获取 computedStyle
                        return element.style[camelize(property)] || getComputedStyle(element, '').getPropertyValue(property)
                        // property 是array
                    } else if (isArray(property)) {
                        if (!element) return
                        var props = {}
                        var computedStyle = getComputedStyle(element, '')
                        // 对每一个 property 进行获取 返回结果为 键值对
                        $.each(property, function(_, prop){
                            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
                        })
                        return props
                    }
                }

                var css = ''
                // 【参数有2个】
                // property 是string
                if (type(property) == 'string') {
                    // value 为false 但不是0
                    // 删除 property （removeProperty）
                    if (!value && value !== 0)
                        this.each(function(){ this.style.removeProperty(dasherize(property)) })
                    else
                    // dasherize：驼峰的逆向写法
                    // maybeAddPx：确定是否要加 px
                        css = dasherize(property) + ":" + maybeAddPx(property, value)
                } else {
                    for (key in property)
                    // 遍历 property
                    // 如果 property值为false 并且不为0 执行删除
                        if (!property[key] && property[key] !== 0)
                            this.each(function(){ this.style.removeProperty(dasherize(key)) })
                        else
                        // 添加
                            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
                }
                // 将css（string） 放入style.cssText
                return this.each(function(){ this.style.cssText += ';' + css })
            },
            /**
             * 有参数 参数在 this中的位置
             * 无参数 this第一个在兄弟元素中的位置
             * @param element
             * @returns {number}
             */
            index: function(element){
                return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
            },
            // 用some方法 只有任意一个为true，整体就是true
            hasClass: function(name){
                if (!name) return false
                return emptyArray.some.call(this, function(el){
                    return this.test(className(el))
                }, classRE(name))
            },
            
            addClass: function(name){
                // 无参数 返回
                if (!name) return this
                return this.each(function(idx){
                    // 无className 属性 返回
                    if (!('className' in this)) return
                    classList = []
                    // newName 就是 name 或者name()
                    var cls = className(this), newName = funcArg(this, name, idx, cls)
                    // 通过空位符分割为array
                    newName.split(/\s+/g).forEach(function(klass){
                        if (!$(this).hasClass(klass)) classList.push(klass)
                    }, this)
                    // 判断是否存在classList 和 原来是否有className 来 添加
                    classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
                })
            },

            removeClass: function(name){
                return this.each(function(idx){
                    // 无className属性 返回
                    if (!('className' in this)) return
                    // 无参数 清空class
                    if (name === undefined) return className(this, '')
                    // className 就是有原生 ele.className 返回字符串 多个class 用空格隔开
                    classList = className(this)
                    funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
                        // 将classList 中有name的替换成 空格
                        classList = classList.replace(classRE(klass), " ")
                    })
                    // 执行重新配置 classList
                    className(this, classList.trim())
                })
            },

            toggleClass: function(name, when){
                if (!name) return this
                return this.each(function(idx){
                    var $this = $(this), names = funcArg(this, name, idx, className(this))
                    names.split(/\s+/g).forEach(function(klass){
                        (when === undefined ? !$this.hasClass(klass) : when) ?
                            $this.addClass(klass) : $this.removeClass(klass)
                    })
                })
            },

            scrollTop: function(value){
                if (!this.length) return
                var hasScrollTop = 'scrollTop' in this[0]
                // 相当 if (value === undefined) {return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset}
                if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
                return this.each(hasScrollTop ?
                    // 2种方法
                    // scrollTop=value;
                    // scrollTo(X平移的位置,value)
                    function(){ this.scrollTop = value } :
                    function(){ this.scrollTo(this.scrollX, value) })
            },
            scrollLeft: function(value){
                if (!this.length) return
                var hasScrollLeft = 'scrollLeft' in this[0]
                if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
                return this.each(hasScrollLeft ?
                    function(){ this.scrollLeft = value } :
                    function(){ this.scrollTo(value, this.scrollY) })
            },

            /**
             * 从this的margin（包括margin）开始到parent的 border底边（不包括border和margin）
             * @returns {{top: number, left: number}}
             */
            position: function() {
                if (!this.length) return

                var elem = this[0],
                // Get *real* offsetParent
                    offsetParent = this.offsetParent(),
                // Get correct offsets
                    offset       = this.offset(),
                    parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

                // Subtract element margins
                // note: when an element has margin: auto the offsetLeft and marginLeft
                // are the same in Safari causing offset.left to incorrectly be 0
                offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
                offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

                // Add offsetParent borders
                parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
                parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

                // Subtract the two offsets
                return {
                    top:  offset.top  - parentOffset.top,
                    left: offset.left - parentOffset.left
                }
            },
            // 找offsetParent 没有则返回
            offsetParent: function() {
                return this.map(function(){
                    var parent = this.offsetParent || document.body
                    // 递归查找
                    // TODO 作用？
                    while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
                        parent = parent.offsetParent
                    return parent
                })
            }
        }

        // for now
        $.fn.detach = $.fn.remove

            // Generate the `width` and `height` functions
        ;['width', 'height'].forEach(function(dimension){
            var dimensionProperty =
                // 第一个字母大写 为后面驼峰写法做准备
                dimension.replace(/./, function(m){ return m[0].toUpperCase() })

            $.fn[dimension] = function(value){
                var offset, el = this[0]
                /**
                 * 无参数 获取（以width为例）
                 * isWindow 直接获取innerWidth(只能用于window对象)
                 * isDocument 直接获取scrollWidth（实际内容宽度 没超过屏幕则为屏幕宽度）
                 * 其他 offset().width (也就是getBoundingRect()的width 与 offsetWidth大部分情况下一致 除了在transform的scale下)
                 */
                if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
                    isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
                    (offset = this.offset()) && offset[dimension]
                // 有参数 通过css()赋值
                else return this.each(function(idx){
                    el = $(this)
                    el.css(dimension, funcArg(this, value, idx, el[dimension]()))
                })
            }
        })

        // 执行fun()
        // 参数是node 以及 node的childNodes 只要存在 一直遍历下去
        function traverseNode(node, fun) {
            fun(node)
            for (var i = 0, len = node.childNodes.length; i < len; i++)
                traverseNode(node.childNodes[i], fun)
        }

        // Generate the `after`, `prepend`, `before`, `append`,
        // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
        adjacencyOperators.forEach(function(operator, operatorIndex) {
            var inside = operatorIndex % 2 //=> prepend, append

            $.fn[operator] = function(){
                /**
                 * nodes 返回值
                 * arg 为数组 返回纯数组
                 * arg 为object 返回arg
                 * 其他 返回 zepto.fragment(arg) (可能是纯数组 可能是类数组)
                 */
                // arguments上map
                // arg则分别为arguments[0],arguments[1]...
                var argType, nodes = $.map(arguments, function(arg) {
                        var arr = []
                        argType = type(arg)
                    //【调用operator的参数是数组】
                        if (argType == "array") {
                            arg.forEach(function(el) {
                                // 如果el是HTML元素 直接加到arr里面
                                if (el.nodeType !== undefined) return arr.push(el)
                                // 如果el是Z对象 通过el.get() 转换成纯数组 再调用原生concat方法
                                else if ($.zepto.isZ(el)) return arr = arr.concat(el.get())
                                // 如果既不是HTML元素 也不是Z对象 那应该是字符串或者标签"<div></div>"
                                // 将标签转换成Z对象
                                arr = arr.concat(zepto.fragment(el))
                            })
                            // 返回纯数组
                            return arr
                        }
                    // 不是数组的情况
                    // 上面type(arg) dom也会被认为是object
                    // 是object 直接返回 否则（string）通过fragment创建
                        return argType == "object" || arg == null ?
                            arg : zepto.fragment(arg)
                    }),

                    parent, copyByClone = this.length > 1
                // nodes为空
                if (nodes.length < 1) return this

                // 返回this
                return this.each(function(_, target){
                    //配置 prepend 和append 时候 parent=target.parentNode
                    parent = inside ? target : target.parentNode

                    /**
                     * target 为每一个调用者
                     * node 为每一个参数
                     * after:  target.parentNode.insertBefore(node, target.nextSibling)
                     * prepend:           target.insertBefore(node, target.firstChild)
                     * before: target.parentNode.insertBefore(node, target)
                     * append:            target.insertBefore(node, null) （此处第二参数为null时 则在结尾插入）
                     */
                    // convert all methods to a "before" operation
                    target = operatorIndex == 0 ? target.nextSibling :
                        operatorIndex == 1 ? target.firstChild :
                            operatorIndex == 2 ? target :
                                null
                    // 布尔值
                    var parentInDocument = $.contains(document.documentElement, parent)

                    /**
                     * 如果是
                     */
                    // nodes是对参数的处理结果
                    // cloneNode 复制子节点和属性
                    nodes.forEach(function(node){
                        // 如果调用者的length>1 这里用深拷贝的数据 因此原DOM就不会被删除
                        if (copyByClone) node = node.cloneNode(true)
                        // parent不存在 删除node
                        else if (!parent) return $(node).remove()
                        parent.insertBefore(node, target)
                        // 如果node及node的子元素和孙元素 是script标签 利用eval 执行他
                        if (parentInDocument) traverseNode(node, function(el){
                            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
                                (!el.type || el.type === 'text/javascript') && !el.src){
                                var target = el.ownerDocument ? el.ownerDocument.defaultView : window
                                target['eval'].call(target, el.innerHTML)
                            }
                        })
                    })
                })
            }

            /**
             * html 是第一个参数
             * this 是调用元素
             * insertAfter:     $(html).after(this)
             * prependTo:       $(html).prepend(this)
             * insertBefore:    $(html).before(this)
             * appendTo:        $(html).append(this)
             * @param html
             * @returns {*}
             */
            // after    => insertAfter
            // prepend  => prependTo
            // before   => insertBefore
            // append   => appendTo
            $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
                $(html)[operator](this)
                return this
            }
        })

        //zepto.Z.prototype = Z.prototype = $.fn
        /**
         * 因为不存在 Z 构造函数了
         */
        zepto.Z.prototype = $.fn

        // Export internal API functions in the `$.zepto` namespace
        zepto.uniq = uniq
        zepto.deserializeValue = deserializeValue
        $.zepto = zepto

        return $
    })()

    window.Zepto = Zepto
    window.$ === undefined && (window.$ = Zepto)

    ;(function($){
        var _zid = 1, undefined,
            slice = Array.prototype.slice,
            isFunction = $.isFunction,
            isString = function(obj){ return typeof obj == 'string' },
            handlers = {},
            specialEvents={},
            focusinSupported = 'onfocusin' in window,
            focus = { focus: 'focusin', blur: 'focusout' },
            hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

        specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

        // 对调用元素进行编号
        function zid(element) {
            return element._zid || (element._zid = _zid++)
        }

        function findHandlers(element, event, fn, selector) {
            event = parse(event)
            if (event.ns) var matcher = matcherFor(event.ns)
            return (handlers[zid(element)] || []).filter(function(handler) {
                return handler
                    && (!event.e  || handler.e == event.e)
                    && (!event.ns || matcher.test(handler.ns))
                    && (!fn       || zid(handler.fn) === zid(fn))
                    && (!selector || handler.sel == selector)
            })
        }

        /**
         * 对事件进行parse
         * 一般为{e:"click",ns:''}
         * @param event
         * @returns {{e: *, ns: string}}
         */
        function parse(event) {
            var parts = ('' + event).split('.')
            return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
        }
        function matcherFor(ns) {
            return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
        }

        function eventCapture(handler, captureSetting) {
            return handler.del &&
                (!focusinSupported && (handler.e in focus)) ||
                !!captureSetting
        }

        function realEvent(type) {
            return hover[type] || (focusinSupported && focus[type]) || type
        }

        function add(element, events, fn, data, selector, delegator, capture){
            var id = zid(element), set = (handlers[id] || (handlers[id] = []))
            events.split(/\s/).forEach(function(event){
                if (event == 'ready') return $(document).ready(fn)
                var handler   = parse(event)
                handler.fn    = fn
                handler.sel   = selector
                // emulate mouseenter, mouseleave
                if (handler.e in hover) fn = function(e){
                    // 只有mouseover 和mouseout 事件才有
                    // relatedTarget 指事件触发相关的元素
                    // 例如 mouseover 移入目标元素之前的元素就是 relatedTarget
                    var related = e.relatedTarget
                    // 不存在 related 或者 related不是元素本身也不是他的子元素
                    // 即如果related是调用元素的父元素
                    // 间接实现mouseenter 和mouseleave
                    if (!related || (related !== this && !$.contains(this, related)))
                        return handler.fn.apply(this, arguments)
                }
                handler.del   = delegator
                var callback  = delegator || fn
                // 执行callback
                // 遇到 isImmediatePropagationStopped 就不会执行
                handler.proxy = function(e){
                    e = compatible(e)
                    if (e.isImmediatePropagationStopped()) return
                    e.data = data
                    var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
                    if (result === false) e.preventDefault(), e.stopPropagation()
                    return result
                }
                handler.i = set.length
                set.push(handler)
                if ('addEventListener' in element)
                    element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        }
        function remove(element, events, fn, selector, capture){
            var id = zid(element)
                ;(events || '').split(/\s/).forEach(function(event){
                findHandlers(element, event, fn, selector).forEach(function(handler){
                    delete handlers[id][handler.i]
                    if ('removeEventListener' in element)
                        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
                })
            })
        }

        $.event = { add: add, remove: remove }

        $.proxy = function(fn, context) {
            var args = (2 in arguments) && slice.call(arguments, 2)
            if (isFunction(fn)) {
                var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
                proxyFn._zid = zid(fn)
                return proxyFn
            } else if (isString(context)) {
                if (args) {
                    args.unshift(fn[context], fn)
                    return $.proxy.apply(null, args)
                } else {
                    return $.proxy(fn[context], fn)
                }
            } else {
                throw new TypeError("expected function")
            }
        }

        $.fn.bind = function(event, data, callback){
            return this.on(event, data, callback)
        }
        $.fn.unbind = function(event, callback){
            return this.off(event, callback)
        }
        $.fn.one = function(event, selector, data, callback){
            return this.on(event, selector, data, callback, 1)
        }

        var returnTrue = function(){return true},
            returnFalse = function(){return false},
            ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
            eventMethods = {
                preventDefault: 'isDefaultPrevented',
                stopImmediatePropagation: 'isImmediatePropagationStopped',
                stopPropagation: 'isPropagationStopped'
            }

        /**
         * event 是zepto的事件对象，添加了几个属性
         * source是原生事件对象
         * 返回 zepto新的事件对象
         * @param event
         * @param source
         * @returns {*}
         */
        function compatible(event, source) {
            if (source || !event.isDefaultPrevented) {
                source || (source = event)

                $.each(eventMethods, function(name, predicate) {
                    /**
                     * 为了添加 this[predicate] = returnTrue 到原来的 preventDefault 方法中
                     * 这里默认 event[predicate] = returnFalse
                     * 一旦 执行了 event[name] 也就是 event.preventDefault() 对应的 event[predicate]就设置为 returnTrue
                     */
                    var sourceMethod = source[name]
                    event[name] = function(){
                        this[predicate] = returnTrue
                        return sourceMethod && sourceMethod.apply(source, arguments)
                    }
                    event[predicate] = returnFalse
                })

                event.timeStamp || (event.timeStamp = Date.now())

                /**
                 * 判断事件 是否存在
                 * 1、source.defaultPrevented（适用于现代浏览器）
                 * 2、source.returnValue（适用于IE 9以下）
                 * 3、source.getPreventDefault(适用于旧版本FF)
                 * 任意一个成立 event.isDefaultPrevented = returnTrue
                 *
                 * 这里的判断是为了 兼容多种方法打到preventDefault的效果
                 */
                if (source.defaultPrevented !== undefined ? source.defaultPrevented :
                        'returnValue' in source ? source.returnValue === false :
                        source.getPreventDefault && source.getPreventDefault())
                    event.isDefaultPrevented = returnTrue
            }
            return event
        }

        function createProxy(event) {
            var key, proxy = { originalEvent: event }
            for (key in event)
                if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

            return compatible(proxy, event)
        }

        $.fn.delegate = function(selector, event, callback){
            return this.on(event, selector, callback)
        }
        $.fn.undelegate = function(selector, event, callback){
            return this.off(event, selector, callback)
        }

        $.fn.live = function(event, callback){
            $(document.body).delegate(this.selector, event, callback)
            return this
        }
        $.fn.die = function(event, callback){
            $(document.body).undelegate(this.selector, event, callback)
            return this
        }

        $.fn.on = function(event, selector, data, callback, one){
            var autoRemove, delegator, $this = this
            // event不是string
            // 在每一个event上执行on
            if (event && !isString(event)) {
                $.each(event, function(type, fn){
                    $this.on(type, selector, data, fn, one)
                })
                return $this
            }

            // 如果selector 不是string  callback 不为false 也不是func
            // on("event",function(){}) 或者 on("event",[]|{},function(){})
            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = data, data = selector, selector = undefined
            if (callback === undefined || data === false)
                callback = data, data = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function(_, element){
                // 如果 使用 ele.one(...) one就存在
                // TODO
                if (one) autoRemove = function(e){
                    remove(element, e.type, callback)
                    return callback.apply(this, arguments)
                }
                // selector 存在 说明使用委托
                // todo
                if (selector) delegator = function(e){
                    var evt, match = $(e.target).closest(selector, element).get(0)
                    if (match && match !== element) {
                        evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
                        return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
                    }
                }

                add(element, event, callback, data, selector, delegator || autoRemove)
            })
        }
        $.fn.off = function(event, selector, callback){
            var $this = this
            if (event && !isString(event)) {
                $.each(event, function(type, fn){
                    $this.off(type, selector, fn)
                })
                return $this
            }

            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = selector, selector = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function(){
                remove(this, event, callback, selector)
            })
        }

        $.fn.trigger = function(event, args){
            event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
            event._args = args
            return this.each(function(){
                // handle focus(), blur() by calling them directly
                if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
                // items in the collection might not be DOM elements
                else if ('dispatchEvent' in this) this.dispatchEvent(event)
                else $(this).triggerHandler(event, args)
            })
        }

        // triggers event handlers on current element just as if an event occurred,
        // doesn't trigger an actual event, doesn't bubble
        $.fn.triggerHandler = function(event, args){
            var e, result
            this.each(function(i, element){
                e = createProxy(isString(event) ? $.Event(event) : event)
                e._args = args
                e.target = element
                $.each(findHandlers(element, event.type || event), function(i, handler){
                    result = handler.proxy(e)
                    if (e.isImmediatePropagationStopped()) return false
                })
            })
            return result
        }

            // shortcut methods for `.bind(event, fn)` for each event type
        ;('focusin focusout focus blur load resize scroll unload click dblclick '+
        'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
        'change select keydown keypress keyup error').split(' ').forEach(function(event) {
            $.fn[event] = function(callback) {
                return (0 in arguments) ?
                    this.bind(event, callback) :
                    this.trigger(event)
            }
        })

        $.Event = function(type, props) {
            if (!isString(type)) props = type, type = props.type
            var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
            if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
            event.initEvent(type, bubbles, true)
            return compatible(event)
        }

    })(Zepto)

    ;(function($){
        var jsonpID = +new Date(),
            document = window.document,
            key,
            name,
            rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            scriptTypeRE = /^(?:text|application)\/javascript/i,
            xmlTypeRE = /^(?:text|application)\/xml/i,
            jsonType = 'application/json',
            htmlType = 'text/html',
            blankRE = /^\s*$/,
            originAnchor = document.createElement('a')

        originAnchor.href = window.location.href

        // trigger a custom event and return false if it was cancelled
        function triggerAndReturn(context, eventName, data) {
            var event = $.Event(eventName)
            $(context).trigger(event, data)
            return !event.isDefaultPrevented()
        }

        // trigger an Ajax "global" event
        function triggerGlobal(settings, context, eventName, data) {
            if (settings.global) return triggerAndReturn(context || document, eventName, data)
        }

        // Number of active Ajax requests
        $.active = 0

        function ajaxStart(settings) {
            if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
        }
        function ajaxStop(settings) {
            if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
        }

        // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
        function ajaxBeforeSend(xhr, settings) {
            var context = settings.context
            if (settings.beforeSend.call(context, xhr, settings) === false ||
                triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
                return false

            triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
        }
        function ajaxSuccess(data, xhr, settings, deferred) {
            var context = settings.context, status = 'success'
            settings.success.call(context, data, status, xhr)
            if (deferred) deferred.resolveWith(context, [data, status, xhr])
            triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
            ajaxComplete(status, xhr, settings)
        }
        // type: "timeout", "error", "abort", "parsererror"
        function ajaxError(error, type, xhr, settings, deferred) {
            var context = settings.context
            settings.error.call(context, xhr, type, error)
            if (deferred) deferred.rejectWith(context, [xhr, type, error])
            triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
            ajaxComplete(type, xhr, settings)
        }
        // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
        function ajaxComplete(status, xhr, settings) {
            var context = settings.context
            settings.complete.call(context, xhr, status)
            triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
            ajaxStop(settings)
        }

        function ajaxDataFilter(data, type, settings) {
            if (settings.dataFilter == empty) return data
            var context = settings.context
            return settings.dataFilter.call(context, data, type)
        }

        // Empty function, used as default callback
        function empty() {}

        $.ajaxJSONP = function(options, deferred){
            if (!('type' in options)) return $.ajax(options)

            var _callbackName = options.jsonpCallback,
                callbackName = ($.isFunction(_callbackName) ?
                        _callbackName() : _callbackName) || ('Zepto' + (jsonpID++)),
                script = document.createElement('script'),
                originalCallback = window[callbackName],
                responseData,
                abort = function(errorType) {
                    $(script).triggerHandler('error', errorType || 'abort')
                },
                xhr = { abort: abort }, abortTimeout

            if (deferred) deferred.promise(xhr)

            $(script).on('load error', function(e, errorType){
                clearTimeout(abortTimeout)
                $(script).off().remove()

                if (e.type == 'error' || !responseData) {
                    ajaxError(null, errorType || 'error', xhr, options, deferred)
                } else {
                    ajaxSuccess(responseData[0], xhr, options, deferred)
                }

                window[callbackName] = originalCallback
                if (responseData && $.isFunction(originalCallback))
                    originalCallback(responseData[0])

                originalCallback = responseData = undefined
            })

            if (ajaxBeforeSend(xhr, options) === false) {
                abort('abort')
                return xhr
            }

            window[callbackName] = function(){
                responseData = arguments
            }

            script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
            document.head.appendChild(script)

            if (options.timeout > 0) abortTimeout = setTimeout(function(){
                abort('timeout')
            }, options.timeout)

            return xhr
        }

        $.ajaxSettings = {
            // Default type of request
            type: 'GET',
            // Callback that is executed before request
            beforeSend: empty,
            // Callback that is executed if the request succeeds
            success: empty,
            // Callback that is executed the the server drops error
            error: empty,
            // Callback that is executed on request complete (both: error and success)
            complete: empty,
            // The context for the callbacks
            context: null,
            // Whether to trigger "global" Ajax events
            global: true,
            // Transport
            xhr: function () {
                return new window.XMLHttpRequest()
            },
            // MIME types mapping
            // IIS returns Javascript as "application/x-javascript"
            accepts: {
                script: 'text/javascript, application/javascript, application/x-javascript',
                json:   jsonType,
                xml:    'application/xml, text/xml',
                html:   htmlType,
                text:   'text/plain'
            },
            // Whether the request is to another domain
            crossDomain: false,
            // Default timeout
            timeout: 0,
            // Whether data should be serialized to string
            processData: true,
            // Whether the browser should be allowed to cache GET responses
            cache: true,
            //Used to handle the raw response data of XMLHttpRequest.
            //This is a pre-filtering function to sanitize the response.
            //The sanitized response should be returned
            dataFilter: empty
        }

        function mimeToDataType(mime) {
            if (mime) mime = mime.split(';', 2)[0]
            return mime && ( mime == htmlType ? 'html' :
                    mime == jsonType ? 'json' :
                        scriptTypeRE.test(mime) ? 'script' :
                        xmlTypeRE.test(mime) && 'xml' ) || 'text'
        }

        function appendQuery(url, query) {
            if (query == '') return url
            return (url + '&' + query).replace(/[&?]{1,2}/, '?')
        }

        // serialize payload and append it to the URL for GET requests
        function serializeData(options) {
            if (options.processData && options.data && $.type(options.data) != "string")
                options.data = $.param(options.data, options.traditional)
            if (options.data && (!options.type || options.type.toUpperCase() == 'GET' || 'jsonp' == options.dataType))
                options.url = appendQuery(options.url, options.data), options.data = undefined
        }

        $.ajax = function(options){
            var settings = $.extend({}, options || {}),
                deferred = $.Deferred && $.Deferred(),
                urlAnchor, hashIndex
            for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

            ajaxStart(settings)

            if (!settings.crossDomain) {
                urlAnchor = document.createElement('a')
                urlAnchor.href = settings.url
                // cleans up URL for .href (IE only), see https://github.com/madrobby/zepto/pull/1049
                urlAnchor.href = urlAnchor.href
                settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
            }

            if (!settings.url) settings.url = window.location.toString()
            if ((hashIndex = settings.url.indexOf('#')) > -1) settings.url = settings.url.slice(0, hashIndex)
            serializeData(settings)

            var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url)
            if (hasPlaceholder) dataType = 'jsonp'

            if (settings.cache === false || (
                    (!options || options.cache !== true) &&
                    ('script' == dataType || 'jsonp' == dataType)
                ))
                settings.url = appendQuery(settings.url, '_=' + Date.now())

            if ('jsonp' == dataType) {
                if (!hasPlaceholder)
                    settings.url = appendQuery(settings.url,
                        settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
                return $.ajaxJSONP(settings, deferred)
            }

            var mime = settings.accepts[dataType],
                headers = { },
                setHeader = function(name, value) { headers[name.toLowerCase()] = [name, value] },
                protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
                xhr = settings.xhr(),
                nativeSetHeader = xhr.setRequestHeader,
                abortTimeout

            if (deferred) deferred.promise(xhr)

            if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
            setHeader('Accept', mime || '*/*')
            if (mime = settings.mimeType || mime) {
                if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
                xhr.overrideMimeType && xhr.overrideMimeType(mime)
            }
            if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
                setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

            if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
            xhr.setRequestHeader = setHeader

            xhr.onreadystatechange = function(){
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = empty
                    clearTimeout(abortTimeout)
                    var result, error = false
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
                        dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))

                        if (xhr.responseType == 'arraybuffer' || xhr.responseType == 'blob')
                            result = xhr.response
                        else {
                            result = xhr.responseText

                            try {
                                // http://perfectionkills.com/global-eval-what-are-the-options/
                                // sanitize response accordingly if data filter callback provided
                                result = ajaxDataFilter(result, dataType, settings)
                                if (dataType == 'script')    (1,eval)(result)
                                else if (dataType == 'xml')  result = xhr.responseXML
                                else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
                            } catch (e) { error = e }

                            if (error) return ajaxError(error, 'parsererror', xhr, settings, deferred)
                        }

                        ajaxSuccess(result, xhr, settings, deferred)
                    } else {
                        ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
                    }
                }
            }

            if (ajaxBeforeSend(xhr, settings) === false) {
                xhr.abort()
                ajaxError(null, 'abort', xhr, settings, deferred)
                return xhr
            }

            var async = 'async' in settings ? settings.async : true
            xhr.open(settings.type, settings.url, async, settings.username, settings.password)

            if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

            for (name in headers) nativeSetHeader.apply(xhr, headers[name])

            if (settings.timeout > 0) abortTimeout = setTimeout(function(){
                xhr.onreadystatechange = empty
                xhr.abort()
                ajaxError(null, 'timeout', xhr, settings, deferred)
            }, settings.timeout)

            // avoid sending empty string (#319)
            xhr.send(settings.data ? settings.data : null)
            return xhr
        }

        // handle optional data/success arguments
        function parseArguments(url, data, success, dataType) {
            if ($.isFunction(data)) dataType = success, success = data, data = undefined
            if (!$.isFunction(success)) dataType = success, success = undefined
            return {
                url: url
                , data: data
                , success: success
                , dataType: dataType
            }
        }

        $.get = function(/* url, data, success, dataType */){
            return $.ajax(parseArguments.apply(null, arguments))
        }

        $.post = function(/* url, data, success, dataType */){
            var options = parseArguments.apply(null, arguments)
            options.type = 'POST'
            return $.ajax(options)
        }

        $.getJSON = function(/* url, data, success */){
            var options = parseArguments.apply(null, arguments)
            options.dataType = 'json'
            return $.ajax(options)
        }

        $.fn.load = function(url, data, success){
            if (!this.length) return this
            var self = this, parts = url.split(/\s/), selector,
                options = parseArguments(url, data, success),
                callback = options.success
            if (parts.length > 1) options.url = parts[0], selector = parts[1]
            options.success = function(response){
                self.html(selector ?
                    $('<div>').html(response.replace(rscript, "")).find(selector)
                    : response)
                callback && callback.apply(self, arguments)
            }
            $.ajax(options)
            return this
        }

        var escape = encodeURIComponent

        function serialize(params, obj, traditional, scope){
            var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
            $.each(obj, function(key, value) {
                type = $.type(value)
                if (scope) key = traditional ? scope :
                scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
                // handle data in serializeArray() format
                if (!scope && array) params.add(value.name, value.value)
                // recurse into nested objects
                else if (type == "array" || (!traditional && type == "object"))
                    serialize(params, value, traditional, key)
                else params.add(key, value)
            })
        }

        $.param = function(obj, traditional){
            var params = []
            params.add = function(key, value) {
                if ($.isFunction(value)) value = value()
                if (value == null) value = ""
                this.push(escape(key) + '=' + escape(value))
            }
            serialize(params, obj, traditional)
            return params.join('&').replace(/%20/g, '+')
        }
    })(Zepto)

    ;(function($){
        $.fn.serializeArray = function() {
            var name, type, result = [],
                add = function(value) {
                    if (value.forEach) return value.forEach(add)
                    result.push({ name: name, value: value })
                }
            if (this[0]) $.each(this[0].elements, function(_, field){
                type = field.type, name = field.name
                if (name && field.nodeName.toLowerCase() != 'fieldset' &&
                    !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
                    ((type != 'radio' && type != 'checkbox') || field.checked))
                    add($(field).val())
            })
            return result
        }

        $.fn.serialize = function(){
            var result = []
            this.serializeArray().forEach(function(elm){
                result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
            })
            return result.join('&')
        }

        $.fn.submit = function(callback) {
            if (0 in arguments) this.bind('submit', callback)
            else if (this.length) {
                var event = $.Event('submit')
                this.eq(0).trigger(event)
                if (!event.isDefaultPrevented()) this.get(0).submit()
            }
            return this
        }

    })(Zepto)

    ;(function(){
        // getComputedStyle shouldn't freak out when called
        // without a valid element as argument
        try {
            getComputedStyle(undefined)
        } catch(e) {
            var nativeGetComputedStyle = getComputedStyle
            window.getComputedStyle = function(element, pseudoElement){
                try {
                    return nativeGetComputedStyle(element, pseudoElement)
                } catch(e) {
                    return null
                }
            }
        }
    })()
    return Zepto
}))