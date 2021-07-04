/**
 * Copyright (c) 2010,2011,2012,2013,2014 Morgan Roderick http://roderick.dk
 * License: MIT - http://mrgnrdrck.mit-license.org
 *
 * https://github.com/mroderick/PubSubJS
 */

(function (root, factory){
    'use strict';

    var PubSub = {};
    root.PubSub = PubSub;
    factory(PubSub);
    // CommonJS and Node.js module support
    if (typeof exports === 'object'){
        if (module !== undefined && module.exports) {
            exports = module.exports = PubSub; // Node.js specific `module.exports`
        }
        exports.PubSub = PubSub; // CommonJS module 1.1.1 spec
        module.exports = exports = PubSub; // CommonJS
    }
    // AMD support
    /* eslint-disable no-undef */
    else if (typeof define === 'function' && define.amd){
        define(function() { return PubSub; });
        /* eslint-enable no-undef */
    }

}(( typeof window === 'object' && window ) || this, function (PubSub){
    'use strict';

    var messages = {},
        lastUid = -1,
        ALL_SUBSCRIBING_MSG = '*';

    function hasKeys(obj){
        var key;

        for (key in obj){
            if ( Object.prototype.hasOwnProperty.call(obj, key) ){
                return true;
            }
        }
        return false;
    }

    /**
     * Returns a function that throws the passed exception, for use as argument for setTimeout
     * @alias throwException
     * @function
     * @param { Object } ex An Error object
     */
    function throwException( ex ){
        return function reThrowException(){
            throw ex;
        };
    }

    // 立刻执行当前订阅函数，出错延迟弹出
    function callSubscriberWithDelayedExceptions( subscriber, message, data ){
        try {
            subscriber( message, data );
        } catch( ex ){
            setTimeout( throwException( ex ), 0);
        }
    }

    // 立刻执行当前订阅函数，出错立刻弹出
    function callSubscriberWithImmediateExceptions( subscriber, message, data ){
        subscriber( message, data );
    }

    function deliverMessage( originalMessage, matchedMessage, data, immediateExceptions ){
        // 检测当前message订阅对象
        var subscribers = messages[matchedMessage],
            // 根据参数选择，出错立刻报出或者延迟报出
            callSubscriber = immediateExceptions ? callSubscriberWithImmediateExceptions : callSubscriberWithDelayedExceptions,
            s;

        // 检测不到当前匹配的message，直接返回（等待继续递归检测）
        if ( !Object.prototype.hasOwnProperty.call( messages, matchedMessage ) ) {
            return;
        }


        // 逐个调用所有存在的订阅函数
        // 参数1，当前规则message
        // 参数2，用户传递的数据
        for (s in subscribers){
            if ( Object.prototype.hasOwnProperty.call(subscribers, s)){
                callSubscriber( subscribers[s], originalMessage, data );
            }
        }
    }

    // 执行publish的具体步骤
    function createDeliveryFunction( message, data, immediateExceptions ){
        return function deliverNamespaced(){
            var topic = String( message ),
                position = topic.lastIndexOf( '.' );

            // deliver the message as it is now
            // 尝试调用当前message所匹配的订阅函数
            deliverMessage(message, message, data, immediateExceptions);

            // trim the hierarchy and deliver message to each level
            // 存在并且解析message中的 . 结构
            while( position !== -1 ){
                // 找到当前最后一个 .  并且截取前面的部分，例如 car.driver.name ==> car.driver
                // 继续尝试调用当前所匹配的订阅函数
                topic = topic.substr( 0, position );
                position = topic.lastIndexOf('.');
                deliverMessage( message, topic, data, immediateExceptions );
            }

            // 最后在执行 任意通配符(*) 所匹配的订阅函数
            deliverMessage(message, ALL_SUBSCRIBING_MSG, data, immediateExceptions);
        };
    }

    // 检测当前message下是否存在订阅函数
    // 1. 存在 message 这个关键词
    // 2. 这个关键词下存在函数
    function hasDirectSubscribersFor( message ) {
        var topic = String( message ),
            found = Boolean(Object.prototype.hasOwnProperty.call( messages, topic ) && hasKeys(messages[topic]));

        return found;
    }

    function messageHasSubscribers( message ){
        var topic = String( message ),
            // 检测当前message下是否存在订阅函数 或者 是否存在 通配符 的订阅函数
            found = hasDirectSubscribersFor(topic) || hasDirectSubscribersFor(ALL_SUBSCRIBING_MSG),
            position = topic.lastIndexOf( '.' );

        // 如果没找到， 但是存在 . 层级结构， 继续查找
        while ( !found && position !== -1 ){
            topic = topic.substr( 0, position );
            position = topic.lastIndexOf( '.' );
            found = hasDirectSubscribersFor(topic);
        }

        return found;
    }

    // 发布当前订阅，检测当前message匹配
    /**
     *
     * @param message 匹配值
     * @param data  用户传递数据
     * @param sync  是否立刻执行
     * @param immediateExceptions  出错是否立刻报错
     * @returns {boolean}
     */
    function publish( message, data, sync, immediateExceptions ){
        // 解析symbol
        message = (typeof message === 'symbol') ? message.toString() : message;

        // deliver 是执行publish的具体步骤
        var deliver = createDeliveryFunction( message, data, immediateExceptions ),
            // 当前message是否存在订阅函数，是否存在 . 层级订阅函数，是否存在通配符订阅函数
            hasSubscribers = messageHasSubscribers( message );

        if ( !hasSubscribers ){
            return false;
        }

        // 是否立即同步执行
        if ( sync === true ){
            deliver();
        } else {
            setTimeout( deliver, 0 );
        }
        return true;
    }

    /**
     * Publishes the message, passing the data to it's subscribers
     * @function
     * @alias publish
     * @param { String } message The message to publish
     * @param {} data The data to pass to subscribers
     * @return { Boolean }
     */
    PubSub.publish = function( message, data ){
        return publish( message, data, false, PubSub.immediateExceptions );
    };

    /**
     * Publishes the message synchronously, passing the data to it's subscribers
     * @function
     * @alias publishSync
     * @param { String } message The message to publish
     * @param {} data The data to pass to subscribers
     * @return { Boolean }
     */
    PubSub.publishSync = function( message, data ){
        return publish( message, data, true, PubSub.immediateExceptions );
    };

    /**
     * Subscribes the passed function to the passed message. Every returned token is unique and should be stored if you need to unsubscribe
     * @function
     * @alias subscribe
     * @param { String } message The message to subscribe to
     * @param { Function } func The function to call when a new message is published
     * @return { String }
     */
    PubSub.subscribe = function( message, func ){
        if ( typeof func !== 'function'){
            return false;
        }

        // 转换symbol
        message = (typeof message === 'symbol') ? message.toString() : message;

        // message is not registered yet
        // 检查messages(默认{})是否存在message，不存在则创建
        if ( !Object.prototype.hasOwnProperty.call( messages, message ) ){
            messages[message] = {};
        }

        // forcing token as String, to allow for future expansions without breaking usage
        // and allow for easy use as key names for the 'messages' object
        // 将token和func绑定到当前对象中， 对同一个名字绑定不会冲突
        /*
        * {
        *   Car:{
        *           token1:()=>{},
        *           token2:()=>{},
        *           token3:()=>{}, //当前绑定3， 1,2任然保留
        *       }
        * }
        * */
        var token = 'uid_' + String(++lastUid);
        messages[message][token] = func;

        // return token for unsubscribing
        return token;
    };

    PubSub.subscribeAll = function( func ){
        return PubSub.subscribe(ALL_SUBSCRIBING_MSG, func);
    };

    /**
     * Subscribes the passed function to the passed message once
     * @function
     * @alias subscribeOnce
     * @param { String } message The message to subscribe to
     * @param { Function } func The function to call when a new message is published
     * @return { PubSub }
     */
    // 订阅，并且在执行之前解除订阅
    PubSub.subscribeOnce = function( message, func ){
        var token = PubSub.subscribe( message, function(){
            // before func apply, unsubscribe message
            PubSub.unsubscribe( token );
            func.apply( this, arguments );
        });
        return PubSub;
    };

    /**
     * Clears all subscriptions
     * @function
     * @public
     * @alias clearAllSubscriptions
     */
    PubSub.clearAllSubscriptions = function clearAllSubscriptions(){
        messages = {};
    };

    /**
     * Clear subscriptions by the topic
     * @function
     * @public
     * @alias clearAllSubscriptions
     * @return { int }
     */
    PubSub.clearSubscriptions = function clearSubscriptions(topic){
        var m;
        for (m in messages){
            // 检测当前订阅 key 是否以 topic 开头
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0){
                delete messages[m];
            }
        }
    };

    /**
       Count subscriptions by the topic
     * @function
     * @public
     * @alias countSubscriptions
     * @return { Array }
    */
    /* 一个计数器 */
    // todo: 不太了解具体使用
    PubSub.countSubscriptions = function countSubscriptions(topic){
        var m;
        // eslint-disable-next-line no-unused-vars
        var token;
        var count = 0;
        for (m in messages) {
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
                for (token in messages[m]) {
                    count++;
                }
                break;
            }
        }
        return count;
    };


    /**
       Gets subscriptions by the topic
     * @function
     * @public
     * @alias getSubscriptions
    */
    /* 一个计数器 */
    // todo: 不太了解具体使用
    PubSub.getSubscriptions = function getSubscriptions(topic){
        var m;
        var list = [];
        for (m in messages){
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0){
                list.push(m);
            }
        }
        return list;
    };

    /**
     * Removes subscriptions
     *
     * - When passed a token, removes a specific subscription.
     *
	 * - When passed a function, removes all subscriptions for that function
     *
	 * - When passed a topic, removes all subscriptions for that topic (hierarchy)
     * @function
     * @public
     * @alias subscribeOnce
     * @param { String | Function } value A token, function or topic to unsubscribe from
     * @example // Unsubscribing with a token
     * var token = PubSub.subscribe('mytopic', myFunc);
     * PubSub.unsubscribe(token);
     * @example // Unsubscribing with a function
     * PubSub.unsubscribe(myFunc);
     * @example // Unsubscribing from a topic
     * PubSub.unsubscribe('mytopic');
     */
    PubSub.unsubscribe = function(value){
        // 检测是否存在当前topic对应的订阅函数
        var descendantTopicExists = function(topic) {
                var m;
                for ( m in messages ){
                    if ( Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0 ){
                        // a descendant of the topic exists:
                        return true;
                    }
                }

                return false;
            },
            // 检测value是否topic
            isTopic    = typeof value === 'string' && ( Object.prototype.hasOwnProperty.call(messages, value) || descendantTopicExists(value) ),
            // 如果不是topic， 则判断value是token
            isToken    = !isTopic && typeof value === 'string',
            isFunction = typeof value === 'function',
            result = false,
            m, message, t;

        // 如果是topic，则删除对应topic的订阅对象
        if (isTopic){
            PubSub.clearSubscriptions(value);
            return;
        }

        for ( m in messages ){
            if ( Object.prototype.hasOwnProperty.call( messages, m ) ){
                message = messages[m];
                // 是token，则早到对应的token的订阅函数，删除
                if ( isToken && message[value] ){
                    delete message[value];
                    result = value;
                    // tokens are unique, so we can just stop here
                    break;
                }
                // 传入函数则检测是否有相同的订阅函数
                if (isFunction) {
                    for ( t in message ){
                        if (Object.prototype.hasOwnProperty.call(message, t) && message[t] === value){
                            delete message[t];
                            result = true;
                        }
                    }
                }
            }
        }

        return result;
    };
}));
