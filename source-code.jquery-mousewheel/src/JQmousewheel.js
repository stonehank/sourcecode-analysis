g/*!
 * jQuery Mousewheel 3.1.13
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 */

/**
 * 配置当前运行环境
 */
(function (factory) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS style for Browserify
        module.exports = factory;
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
    /**
     * wheel:最新的标准 应该替换掉mousewheel 支持chrome和FF 不支持 IE
     * mousewheel:chrome IE 7-11 不支持FF
     * DOMMouseScroll:FireFox
     * MozMousePixelScroll：FF 异步触发滚轮事件?
    */
    var toFix  = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'],

        /**
         * toBind在标准现代浏览器['wheel']
         * 其他 ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll']
         * @type {string[]}
         */
        toBind = ( 'onwheel' in document || document.documentMode >= 9 ) ?
            ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
        slice  = Array.prototype.slice,
        nullLowestDeltaTimeout, lowestDelta;

    /**
     * 配置 $.event.fixHooks 这个对象
     * 因为jQ 1.11.1 没有定义wheel 为mouseHooks事件 因此需要手动定义
     * 使其对应 toFix 中的每一项(包括只有wheel时） 的自定义事件属性都是 $.event.mouseHooks
     * $.event.mouseHooks 的配置内容在JQ 源码上 配置有2个属性 props 和 filter
     * props 定义了要统一的属性
     * filter 定义了方法（即兼容的方法）
     * 这么做就能后面在添加 toFix 里面的事件时
     * 达到统一 toFix 里面所有事件的 event属性
     * 也能做到 event 完全兼容
     * 因为此时的 event 的属性都是通过 filter 做了兼容处理
     */
    if ( $.event.fixHooks ) {
        for ( var i = toFix.length; i; ) {
            $.event.fixHooks[ toFix[--i] ] = $.event.mouseHooks;
        }
    }


    /**
     * 自定义mousewheel事件
     */
    var special = $.event.special.mousewheel = {
        version: '3.1.12',

        /**
         * 配置 mousewheel 为自定义事件
         */
        setup: function() {
            if ( this.addEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.addEventListener( toBind[--i], handler, false );
                    //this.addEventListener( toBind[--i], handler);
                }
            } else {

                this.onmousewheel = handler;
            }
            // Store the line height and page height for this particular element
            $.data(this, 'mousewheel-line-height', special.getLineHeight(this));
            $.data(this, 'mousewheel-page-height', special.getPageHeight(this));
        },

        /**
         * 拆除
         */
        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.removeEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = null;
            }
            // Clean up the data we added to the element
            $.removeData(this, 'mousewheel-line-height');
            $.removeData(this, 'mousewheel-page-height');
        },

        /**
         * 获取parent的 fontSize，如果没有则为16
         * @param elem
         * @returns {Number|number}
         */
        getLineHeight: function(elem) {
            var $elem = $(elem),
                /**
                 * parent优先是jq的offsetParent(),其次是parent()
                 */
                $parent = $elem['offsetParent' in $.fn ? 'offsetParent' : 'parent']();
            if (!$parent.length) {
                $parent = $('body');
            }
            return parseInt($parent.css('fontSize'), 10) || parseInt($elem.css('fontSize'), 10) || 16;
        },


        /**
         * 获取elem 的height 不算padding和border
         * @param elem
         * @returns {*|jQuery}
         */
        getPageHeight: function(elem) {
            return $(elem).height();
        },

        settings: {
            adjustOldDeltas: true, // see shouldAdjustOldDeltas() below
            normalizeOffset: true  // calls getBoundingClientRect for each event
        }
    };

    $.fn.extend({
        mousewheel: function(fn) {
            return fn ? this.bind('mousewheel', fn) : this.trigger('mousewheel');
        },

        unmousewheel: function(fn) {
            return this.unbind('mousewheel', fn);
        }
    });


    function handler(event) {
        var orgEvent   = event || window.event,
            args       = slice.call(arguments, 1),
            delta      = 0,
            deltaX     = 0,
            deltaY     = 0,
            absDelta   = 0,
            offsetX    = 0,
            offsetY    = 0;

        /**
         * 统一event的属性 读JQ 源码 fix
         * 就是如果 event.type 有 fixHooks 属性 将它和通用属性 合并
         * 属性为 $.event.fixHooks.(event.type).props ，这里即 $.event.fixHooks[toFix每一项].props 共12项
         * 再concat 通用的属性13项 即 $.event.props
         * 总共25项 (不包括deltaX|Y)
         */

        event = $.event.fix(orgEvent);
        event.type = 'mousewheel';

        // Old school scrollwheel delta
        if ( 'detail'      in orgEvent ) { deltaY = orgEvent.detail * -1;      }
        if ( 'wheelDelta'  in orgEvent ) { deltaY = orgEvent.wheelDelta;       }
        if ( 'wheelDeltaY' in orgEvent ) { deltaY = orgEvent.wheelDeltaY;      }
        if ( 'wheelDeltaX' in orgEvent ) { deltaX = orgEvent.wheelDeltaX * -1; }

        /**
         *  Firefox < 17 horizontal scrolling related to DOMMouseScroll event
         */
        if ( 'axis' in orgEvent && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
            deltaX = deltaY * -1;
            deltaY = 0;
        }

        /**
         * 向后兼容 设定delta
         */
        // Set delta to be deltaY or deltaX if deltaY is 0 for backwards compatabilitiy
        delta = deltaY === 0 ? deltaX : deltaY;

        /**
         * 设定wheel事件的 deltaY ，daltaX
         * 如果只有任何一方有值 就赋值给 delta
         */
        // New school wheel delta (wheel event)
        if ( 'deltaY' in orgEvent ) {
            deltaY = orgEvent.deltaY * -1;
            delta  = deltaY;
        }
        if ( 'deltaX' in orgEvent ) {
            deltaX = orgEvent.deltaX;
            if ( deltaY === 0 ) { delta  = deltaX * -1; }
        }


        // No change actually happened, no reason to go any further
        if ( deltaY === 0 && deltaX === 0 ) { return; }

        // Need to convert lines and pages to pixels if we aren't already in pixels
        // There are three delta modes:
        //   * deltaMode 0 is by pixels, nothing to do
        //   * deltaMode 1 is by lines
        //   * deltaMode 2 is by pages
        /**
         * deltaMode是指滚动量 0表示像素 1表示行 2表示页
         * ==1时， $.data(this, 'mousewheel-line-height') 这里获取的是字体高度 以px表示
         * ==2时， $.data(this, 'mousewheel-page-height') 这里获取的时调用的元素的高度 px表示
         * 最后deltaX|Y 都是以px表示
         */
        if ( orgEvent.deltaMode === 1 ) {
            var lineHeight = $.data(this, 'mousewheel-line-height');
            delta  *= lineHeight;
            deltaY *= lineHeight;
            deltaX *= lineHeight;
        } else if ( orgEvent.deltaMode === 2 ) {
            var pageHeight = $.data(this, 'mousewheel-page-height');
            delta  *= pageHeight;
            deltaY *= pageHeight;
            deltaX *= pageHeight;
        }


        // Store lowest absolute delta to normalize the delta values
        absDelta = Math.max( Math.abs(deltaY), Math.abs(deltaX) );

        if ( !lowestDelta || absDelta < lowestDelta ) {
            lowestDelta = absDelta;

            //TODO：用途？
            // Adjust older deltas if necessary
            if ( shouldAdjustOldDeltas(orgEvent, absDelta) ) {
                lowestDelta /= 40;
            }
        }
        //TODO：用途？
        // Adjust older deltas if necessary
        if ( shouldAdjustOldDeltas(orgEvent, absDelta) ) {
            // Divide all the things by 40!
            delta  /= 40;
            deltaX /= 40;
            deltaY /= 40;
        }

        /**
         * 将 delta deltaX deltaY 转换成1或者-1 由此判断方向是上还是下
         */
        // Get a whole, normalized value for the deltas
        delta  = Math[ delta  >= 1 ? 'floor' : 'ceil' ](delta  / lowestDelta);
        deltaX = Math[ deltaX >= 1 ? 'floor' : 'ceil' ](deltaX / lowestDelta);
        deltaY = Math[ deltaY >= 1 ? 'floor' : 'ceil' ](deltaY / lowestDelta);

        /**
         * boundingRect 获取绑定的滚动元素的上边（包括margin和top） 到窗口顶部的距离
         * clientY 获取当前鼠标位置到窗口的距离
         * offsetY 就是鼠标到绑定元素上边的距离
         */
        // Normalise offsetX and offsetY properties
        if ( special.settings.normalizeOffset && this.getBoundingClientRect ) {
            var boundingRect = this.getBoundingClientRect();
            offsetX = event.clientX - boundingRect.left;
            offsetY = event.clientY - boundingRect.top;
        }

        /**
         * 更新event 数据
         * @type {number}
         */
        // Add information to the event object
        event.deltaX = deltaX;
        event.deltaY = deltaY;
        event.deltaFactor = lowestDelta;
        event.offsetX = offsetX;
        event.offsetY = offsetY;
        // Go ahead and set deltaMode to 0 since we converted to pixels
        // Although this is a little odd since we overwrite the deltaX/Y
        // properties with normalized deltas.
        event.deltaMode = 0;

        // Add event and delta to the front of the arguments
        args.unshift(event, delta, deltaX, deltaY);

        /**
         * 200ms后 自动清除 lowestDelta 数据
         * 可以处理多设备类型
         * 例如 chrome 切换desktop和phone模式
         */
        // Clearout lowestDelta after sometime to better
        // handle multiple device types that give different
        // a different lowestDelta
        // Ex: trackpad = 3 and mouse wheel = 120
        if (nullLowestDeltaTimeout) { clearTimeout(nullLowestDeltaTimeout); }
        nullLowestDeltaTimeout = setTimeout(nullLowestDelta, 200);


        /**
         * 执行调用事件时绑定的函数
         * TODO:看JQ源码 不太懂
         */
        return ($.event.dispatch || $.event.handle).apply(this, args);
    }

    function nullLowestDelta() {
        lowestDelta = null;
    }

    //TODO:将120 转换成 120/40 用途是什么
    function shouldAdjustOldDeltas(orgEvent, absDelta) {
        // If this is an older event and the delta is divisable by 120,
        // then we are assuming that the browser is treating this as an
        // older mouse wheel event and that we should divide the deltas
        // by 40 to try and get a more usable deltaFactor.
        // Side note, this actually impacts the reported scroll distance
        // in older browsers and can cause scrolling to be slower than native.
        // Turn this off by setting $.event.special.mousewheel.settings.adjustOldDeltas to false.
        return special.settings.adjustOldDeltas && orgEvent.type === 'mousewheel' && absDelta % 120 === 0;
    }

}));