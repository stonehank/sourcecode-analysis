/**
 * fullPage 2.5.4
 * https://github.com/alvarotrigo/fullPage.js
 * MIT licensed
 *
 * Copyright (C) 2013 alvarotrigo.com - A project by Alvaro Trigo
 */

(function($) {
    $.fn.fullpage = function(options) {
        // Create some defaults, extending them with any options that were provided
        options = $.extend({
            //navigation
            'menu': false,
            'anchors':[],
            'navigation': false,
            'navigationPosition': 'right',
            'navigationColor': '#000',
            'navigationTooltips': [],
            'slidesNavigation': true,
            'slidesNavPosition': 'bottom',
            'scrollBar': false,

            //scrolling
            'css3': true,
            'scrollingSpeed': 700,
            'autoScrolling': true,
            'easing': 'easeInQuart',
            'easingcss3': 'ease',
            'loopBottom': false,
            'loopTop': false,
            'loopHorizontal': true,
            'continuousVertical': false,
            'normalScrollElements': null,
            'scrollOverflow': false,
            'touchSensitivity': 5,
            'normalScrollElementTouchThreshold': 5,

            //Accessibility
            'keyboardScrolling': true,
            'animateAnchor': true,
            'recordHistory': true,

            //design
            'controlArrows': true,
            'controlArrowColor': '#fff',
            "verticalCentered": true,
            'resize': true,
            'sectionsColor' : [],
            'paddingTop': 0,
            'paddingBottom': 0,
            'fixedElements': null,
            'responsive': 0,

            /**
             * 配置了竖屏的class section 和横屏的class slide
             */
            //Custom selectors
            'sectionSelector': '.section',
            'slideSelector': '.slide',


            //events
            'afterLoad': null,
            'onLeave': null,
            'afterRender': null,
            'afterResize': null,
            'afterReBuild': null,
            'afterSlideLoad': null,
            'onSlideLeave': null
        }, options);

        displayWarnings();

        //easeInQuart animation included in the plugin
        $.extend($.easing,{ easeInQuart: function (x, t, b, c, d) { return c*(t/=d)*t*t*t + b; }});

        //Defines the delay to take place before being able to scroll to the next section
        //BE CAREFUL! Not recommened to change it under 400 for a good behavior in laptops and
        //Apple devices (laptops, mouses...)
        var scrollDelay = 600;

        $.fn.fullpage.setAutoScrolling = function(value, type){
            setVariableState('autoScrolling', value, type);

            var element = $('.fp-section.active');

            if(options.autoScrolling && !options.scrollBar){
                $('html, body').css({
                    'overflow' : 'hidden',
                    'height' : '100%'
                });

                $.fn.fullpage.setRecordHistory(options.recordHistory, 'internal');


                //for IE touch devices
                container.css({
                    '-ms-touch-action': 'none',
                    'touch-action': 'none'
                });

                if(element.length){
                    //moving the container up
                    silentScroll(element.position().top);
                }

            }else{
                $('html, body').css({
                    'overflow' : 'visible',
                    'height' : 'initial'
                });

                $.fn.fullpage.setRecordHistory(false, 'internal');//?

                //for IE touch devices
                container.css({
                    '-ms-touch-action': '',
                    'touch-action': ''
                });


                silentScroll(0);


                //scrolling the page to the section with no animation
                $('html, body').scrollTop(element.position().top);
            }

        };

        /**
         * Defines wheter to record the history for each hash change in the URL.
         */
        $.fn.fullpage.setRecordHistory = function(value, type){
            setVariableState('recordHistory', value, type);
        };

        /**
         * Defines the scrolling speed
         */
        $.fn.fullpage.setScrollingSpeed = function(value, type){
            setVariableState('scrollingSpeed', value, type);
        };

        /**
         * Adds or remove the possiblity of scrolling through sections by using the mouse wheel or the trackpad.
         */
        $.fn.fullpage.setMouseWheelScrolling = function (value){
            if(value){
                addMouseWheelHandler();
            }else{
                removeMouseWheelHandler();
            }
        };

        /**
         * Adds or remove the possiblity of scrolling through sections by using the mouse wheel/trackpad or touch gestures.
         * Optionally a second parameter can be used to specify the direction for which the action will be applied.
         * 设置每个方向是否允许scroll
         * 默认为所有方向true
         * @param directions string containing the direction or directions separated by comma.
         */
        $.fn.fullpage.setAllowScrolling = function (value, directions){
            if(typeof directions != 'undefined'){
                directions = directions.replace(' ', '').split(',');
                $.each(directions, function (index, direction){
                    setIsScrollable(value, direction);
                });
            }
            else if(value){
                $.fn.fullpage.setMouseWheelScrolling(true);
                addTouchHandler();
            }else{
                $.fn.fullpage.setMouseWheelScrolling(false);
                removeTouchHandler();
            }
        };

        /**
         * Adds or remove the possiblity of scrolling through sections by using the keyboard arrow keys
         */
        $.fn.fullpage.setKeyboardScrolling = function (value){
            options.keyboardScrolling = value;
        };
        /**
         * 竖直上移
         * 调用 scrollPage
         */
        $.fn.fullpage.moveSectionUp = function(){
            var prev = $('.fp-section.active').prev('.fp-section');

            /**
             * 如果当前是第一张并且有循环滚动，那么上一张变成最后一张
             */
            //looping to the bottom if there's no more sections above
            if (!prev.length && (options.loopTop || options.continuousVertical)) {
                prev = $('.fp-section').last();
            }

            /**
             * scrollPage函数内会判断 如果当前是第一张并且有循环滚动，那么就对当前的afterAll().get().reverse()
             * 调用移动前回调和移动后回调
             * 改变class
             * 调用 performMovement 进行移动，直接移动至destiny的position的top
             */
            if (prev.length) {
                scrollPage(prev, null, true);
            }
        };

        /**
         * 竖直下移
         * 调用 scrollPage
         */
        $.fn.fullpage.moveSectionDown = function (){
            var next = $('.fp-section.active').next('.fp-section');

            //looping to the top if there's no more sections below
            if(!next.length &&
                (options.loopBottom || options.continuousVertical)){
                next = $('.fp-section').first();
            }

            if(next.length){
                scrollPage(next, null, false);
            }
        };

        /**
         * section是数字（index)或者是锚链接名称 page1 page2
         * slide指当前横向移动方向 为left或者right
         * @param section
         * @param slide
         */
        $.fn.fullpage.moveTo = function (section, slide){
            var destiny = '';

            if(isNaN(section)){
                destiny = $('[data-anchor="'+section+'"]');
            }else{
                destiny = $('.fp-section').eq( (section -1) );
            }

            /**
             * scrollPageAndSlide方法移动到指定section和slide
             * 判断section和slide是index数值还是anchor名称，再调用scrollPage和landscapeScroll
             */
            if (typeof slide !== 'undefined'){
                scrollPageAndSlide(section, slide);
            }else if(destiny.length > 0){
                scrollPage(destiny);
            }
        };

        /**
         * 横向移动（有动画） 并没使用无限的效果
         * 根据当前active位置和参数direction，自动判断是横向移动下一个目标位置
         * 最后实际调用landscapeScroll
         */
        $.fn.fullpage.moveSlideRight = function(){
            moveSlide('next');
        };

        $.fn.fullpage.moveSlideLeft = function(){
            moveSlide('prev');
        };

        /**
         * 真正进行resize 动画调整新的宽高 并且执行回调
         * css调整height，width一直是100%
         * css调整完毕后 调用landscapeScroll和scrollPage对准当前的位置
         * When resizing is finished, we adjust the slides sizes and positions
         */
        $.fn.fullpage.reBuild = function(resizing){
            isResizing = true;

            var windowsWidth = $(window).width();
            windowsHeight = $(window).height();  //updating global var

            //text and images resizing
            //调整字体
            if (options.resize) {
                resizeMe(windowsHeight, windowsWidth);
            }

            $('.fp-section').each(function(){
                /**
                 * 此处保存当前section的实际高度
                 * @type {number}
                 */
                var scrollHeight = windowsHeight - parseInt($(this).css('padding-bottom')) - parseInt($(this).css('padding-top'));

                //adjusting the height of the table-cell for IE and Firefox
                if(options.verticalCentered){
                    $(this).find('.fp-tableCell').css('height', getTableHeight($(this)) + 'px');
                }

                /**
                 * 这里设置了box-sizing为border-box，因此高度是包括padding和border
                 */
                $(this).css('height', windowsHeight + 'px');

                /**
                 * 定义了内容超过屏幕是有scrollbar，在createSlimScrolling里面有检测内容高度，还需要引用 jquery.slimscroll.min.js ，一般不会用到
                 */
                //resizing the scrolling divs
                if(options.scrollOverflow){
                    var slides = $(this).find('.fp-slide');

                    if(slides.length){
                        slides.each(function(){
                            createSlimScrolling($(this));
                        });
                    }else{
                        createSlimScrolling($(this));
                    }
                }

                //adjusting the position fo the FULL WIDTH slides...
                /**
                 * 对准横屏位置（有动画）
                 * 调用landscapeScroll
                 */
                var slides = $(this).find('.fp-slides');
                if (slides.length) {
                    landscapeScroll(slides, slides.find('.fp-slide.active'));
                }
            });

            /**
             * 对准竖屏位置（有动画）
             * 调用scrollPage
             * @type {*|{top, left}}
             */
            //adjusting the position for the current section
            var destinyPos = $('.fp-section.active').position();

            var activeSection = $('.fp-section.active');

            //isn't it the first section?
            if(activeSection.index('.fp-section')){
                scrollPage(activeSection);
            }

            isResizing = false;
            $.isFunction( options.afterResize ) && resizing && options.afterResize.call( this )
            $.isFunction( options.afterReBuild ) && !resizing && options.afterReBuild.call( this );
        }

        //flag to avoid very fast sliding for landscape sliders
        var slideMoving = false;


        var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|Windows Phone|Tizen|Bada)/);
        /**
         * 判断是否电脑模拟移动设备
         * @type {boolean|number}
         */
        var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
        var container = $(this);
        var windowsHeight = $(window).height();
        var isMoving = false;
        var isResizing = false;
        var lastScrolledDestiny;
        var lastScrolledSlide;
        var nav;
        var wrapperSelector = 'fullpage-wrapper';
        var isScrollAllowed = { 'up':true, 'down':true, 'left':true, 'right':true };
        var originals = jQuery.extend(true, {}, options); //deep copy

        $.fn.fullpage.setAllowScrolling(true);

        //if css3 is not supported, it will use jQuery animations
        /**
         * support3d判断方法
         * 创建一个新元素p
         * 添加transform:translate3d(...)
         * 再看是否能获取，通过window.getComputedStyle(el).getProertyValue(pro)
         */
        if(options.css3){
            options.css3 = support3d();
        }

        if($(this).length){
            container.css({
                'height': '100%',
                'position': 'relative'
            });

            //adding a class to recognize the container internally in the code
            container.addClass(wrapperSelector);
        }

        //trying to use fullpage without a selector?
        else{
            showError('error', "Error! Fullpage.js needs to be initialized with a selector. For example: $('#myContainer').fullpage();");
        }

        /**
         * 内部添加竖直移动块section和横屏移动块slide
         * 如果
         */
            //adding internal class names to void problem with common ones
        $(options.sectionSelector).each(function(){
            $(this).addClass('fp-section');
        });
        $(options.slideSelector).each(function(){
            $(this).addClass('fp-slide');
        });

        //creating the navigation dots
        /**
         * 创建nav dots 无事件
         */
        if (options.navigation) {
            addVerticalNavigation();
        }

        /**
         * 配置section
         * 默认ative ， height ， padding ， background-color ， data-anchor
         */
        $('.fp-section').each(function(index){
            var that = $(this);
            var slides = $(this).find('.fp-slide');
            var numSlides = slides.length;

            //if no active section is defined, the 1st one will be the default one
            if(!index && $('.fp-section.active').length === 0) {
                $(this).addClass('active');
            }

            $(this).css('height', windowsHeight + 'px');

            if(options.paddingTop || options.paddingBottom){
                $(this).css('padding', options.paddingTop  + ' 0 ' + options.paddingBottom + ' 0');
            }

            if (typeof options.sectionsColor[index] !==  'undefined') {
                $(this).css('background-color', options.sectionsColor[index]);
            }

            if (typeof options.anchors[index] !== 'undefined') {
                $(this).attr('data-anchor', options.anchors[index]);
            }

            /**
             * 配置slide
             * 创建eles ，配置width ，是否创建箭头
             */
            // if there's any slide
            if (numSlides > 1) {
                var sliderWidth = numSlides * 100;
                var slideWidth = 100 / numSlides;

                slides.wrapAll('<div class="fp-slidesContainer" />');
                slides.parent().wrap('<div class="fp-slides" />');

                $(this).find('.fp-slidesContainer').css('width', sliderWidth + '%');

                if(options.controlArrows){
                    createSlideArrows($(this));
                }

                if(options.slidesNavigation){
                    addSlidesNavigation($(this), numSlides);
                }

                slides.each(function(index) {
                    $(this).css('width', slideWidth + '%');

                    if(options.verticalCentered){
                        addTableClass($(this));
                    }
                });

                var startingSlide = that.find('.fp-slide.active');

                //if the slide won#t be an starting point, the default will be the first one
                if(startingSlide.length == 0){
                    slides.eq(0).addClass('active');
                }

                //is there a starting point for a non-starting section?
                else{
                    silentLandscapeScroll(startingSlide);
                }

            }else{
                if(options.verticalCentered){
                    addTableClass($(this));
                }
            }

        }).promise().done(function(){
            $.fn.fullpage.setAutoScrolling(options.autoScrolling, 'internal');

            //the starting point is a slide?
            var activeSlide = $('.fp-section.active').find('.fp-slide.active');

            //the active section isn't the first one? Is not the first slide of the first section? Then we load that section/slide by default.
            /**
             * 当前section存在activeSlide 并且（ 当前section并不是第一页 或者 当前section是第一页 但是 当前section下的slide并不是第一个slide ）
             * 让初始视角瞬间跳到activeSlide
             * 这里activeSlide是在activeSection下的
             * 所以不必考虑竖向的视角
             */
            if( activeSlide.length &&  ($('.fp-section.active').index('.fp-section') != 0 || ($('.fp-section.active').index('.fp-section') == 0 && activeSlide.index() != 0))){
                silentLandscapeScroll(activeSlide);
            }

            /**
             * position:fixed 的元素添加 需要自己配置css
             */
            //fixed elements need to be moved out of the plugin container due to problems with CSS3.
            if(options.fixedElements && options.css3){
                $(options.fixedElements).appendTo('body');
            }

            /**
             * 添加nav的样式 和当前 nav的active
             */
            //vertical centered of the navigation + first bullet active
            if(options.navigation){
                nav.css('margin-top', '-' + (nav.height()/2) + 'px');
                nav.find('li').eq($('.fp-section.active').index('.fp-section')).find('a').addClass('active');
            }

            /**
             * menu存在 并且 兼容css3 并且 menu元素是在wrapper里面
             * 执行将menu元素拿出wrapper
             * 为了避免使用css3 transform作为动画时 引出position:fixed不能定位的问题
             */
            //moving the menu outside the main container if it is inside (avoid problems with fixed positions when using CSS3 tranforms)
            if(options.menu && options.css3 && $(options.menu).closest('.fullpage-wrapper').length){
                $(options.menu).appendTo('body');
            }

            /**
             * 如果设定了scrollOverflow， 内容超出屏幕时有scrollBar
             * 调用 createSlimScrollingHandler
             */
            if(options.scrollOverflow){
                if(document.readyState === "complete"){
                    createSlimScrollingHandler();
                }
                //after DOM and images are loaded
                $(window).on('load', createSlimScrollingHandler);
            }else{
                //调用 初始化后的回调函数
                $.isFunction( options.afterRender ) && options.afterRender.call( this);
            }

            responsive();

            //getting the anchor link in the URL and deleting the `#`
            var value =  window.location.hash.replace('#', '').split('/');
            var destiny = value[0];

            //console.log( window.location.hash.split('#')[1].split("/")[0],value)
            if(destiny.length){
                var section = $('[data-anchor="'+destiny+'"]');

                if(!options.animateAnchor && section.length){

                    console.log(1)
                    if(options.autoScrolling){
                        //无动画
                        silentScroll(section.position().top);
                    }
                    else{
                        console.log(2)
                        silentScroll(0);
                        setBodyClass(destiny);

                        //scrolling the page to the section with no animation
                        $('html, body').scrollTop(section.position().top);
                    }
                    console.log(3)
                    activateMenuAndNav(destiny, null);

                    $.isFunction( options.afterLoad ) && options.afterLoad.call( this, destiny, (section.index('.fp-section') + 1));

                    //updating the active class
                    section.addClass('active').siblings().removeClass('active');
                }
            }


            $(window).on('load', function() {
                scrollToAnchor();
            });

        });


        /**
         * 创建左右箭头 设置颜色 和 默认是否隐藏第一个
         * 后续判断是否隐藏在 landscapeScroll 函数里面
         * Creates the control arrows for the given section
         */
        function createSlideArrows(section){
            section.find('.fp-slides').after('<div class="fp-controlArrow fp-prev"></div><div class="fp-controlArrow fp-next"></div>');

            /**
             * 默认就是#fff
             */
            if(options.controlArrowColor!='#fff'){
                section.find('.fp-controlArrow.fp-next').css('border-color', 'transparent transparent transparent '+options.controlArrowColor);
                section.find('.fp-controlArrow.fp-prev').css('border-color', 'transparent '+ options.controlArrowColor + ' transparent transparent');
            }

            if(!options.loopHorizontal){
                section.find('.fp-controlArrow.fp-prev').hide();
            }
        }

        /**
         * 添加垂直的nav（小圆圈）
         * 只是添加，并未有事件
         * Creates a vertical navigation bar.
         */
        function addVerticalNavigation(){
            $('body').append('<div id="fp-nav"><ul></ul></div>');
            nav = $('#fp-nav');

            nav.css('color', options.navigationColor);
            nav.addClass(options.navigationPosition);

            /**
             * 判断是否有anchors
             */
            for (var i = 0; i < $('.fp-section').length; i++) {
                var link = '';
                if (options.anchors.length) {
                    link = options.anchors[i];
                }

                var li = '<li><a href="#' + link + '"><span></span></a>';

                // Only add tooltip if needed (defined by user)
                var tooltip = options.navigationTooltips[i];
                if (tooltip != undefined && tooltip != '') {
                    li += '<div class="fp-tooltip ' + options.navigationPosition + '">' + tooltip + '</div>';
                }

                li += '</li>';

                nav.find('ul').append(li);
            }
        }

        /**
         * 如果存在slide 则在每个slide上创建slimScrolling
         * 如果不存在slide 则在每个section上创建 slimScrolling
         * 再执行 初始化后回调
         */
        function createSlimScrollingHandler(){
            $('.fp-section').each(function(){
                var slides = $(this).find('.fp-slide');

                if(slides.length){
                    slides.each(function(){
                        createSlimScrolling($(this));
                    });
                }else{
                    createSlimScrolling($(this));
                }

            });
            $.isFunction( options.afterRender ) && options.afterRender.call( this);
        }

        var scrollId;
        var scrollId2;
        var isScrolling = false;

        //when scrolling...
        $(window).on('scroll', scrollHandler);

        /**
         * 当存在scrollBar或者 options.autoScrolling 为false
         */
        function scrollHandler(){
            if(!options.autoScrolling || options.scrollBar){
                // 当前滚动高度
                var currentScroll = $(window).scrollTop();
                var visibleSectionIndex = 0;
                // 当前页面离第一页顶端的高度
                var initial = Math.abs(currentScroll - $('.fp-section').first().offset().top);

                //taking the section which is showing more content in the viewport
                $('.fp-section').each(function(index){
                    // 获取当前页面到 每一个section顶端的高度
                    var current = Math.abs(currentScroll - $(this).offset().top);

                    // 当页面不是第一页的时候
                    // 递归
                    if(current < initial){
                        visibleSectionIndex = index;
                        initial = current;
                    }
                });

                //currentSection 为当前可视页面
                //geting the last one, the current one on the screen
                var currentSection = $('.fp-section').eq(visibleSectionIndex);
            }

            if(!options.autoScrolling){
                //executing only once the first time we reach the section
                /**
                 * 如果当前页面没有active
                 * 添加active class 和anchor
                 */
                if(!currentSection.hasClass('active')){
                    isScrolling = true;

                    var leavingSection = $('.fp-section.active').index('.fp-section') + 1;
                    var yMovement = getYmovement(currentSection);
                    var anchorLink  = currentSection.data('anchor');
                    var sectionIndex = currentSection.index('.fp-section') + 1;
                    var activeSlide = currentSection.find('.fp-slide.active');

                    if(activeSlide.length){
                        var slideAnchorLink = activeSlide.data('anchor');
                        var slideIndex = activeSlide.index();
                    }

                    currentSection.addClass('active').siblings().removeClass('active');

                    if(!isMoving){
                        $.isFunction( options.onLeave ) && options.onLeave.call( this, leavingSection, sectionIndex, yMovement);

                        $.isFunction( options.afterLoad ) && options.afterLoad.call( this, anchorLink, sectionIndex);
                    }

                    activateMenuAndNav(anchorLink, 0);

                    if(options.anchors.length && !isMoving){
                        //needed to enter in hashChange event when using the menu with anchor links
                        lastScrolledDestiny = anchorLink;

                        setState(slideIndex, slideAnchorLink, anchorLink, sectionIndex);
                    }

                    //small timeout in order to avoid entering in hashChange event when scrolling is not finished yet
                    /**
                     * 隔100ms 确保已经添加好class和anchor 不会在滑动时 执行 hashChangeHandler
                     */
                    clearTimeout(scrollId);
                    scrollId = setTimeout(function(){
                        isScrolling = false;
                    }, 100);
                }
            }

            /**
             * 有scrollBar的时候 停止拉动scrollBar1秒后自动调整位置
             */
            if(options.scrollBar){
                //for the auto adjust of the viewport to fit a whole section
                clearTimeout(scrollId2);
                scrollId2 = setTimeout(function(){
                    if(!isMoving){
                        scrollPage(currentSection);
                    }
                }, 1000);
            }
        }


        /**
         * 找到$('.fp-scrollable')元素
         * $('.fp-scrollable')只有在设置了SlimScrolling
         * 即section或者slide里面内容超过屏幕宽高并有scrollBar时才会被创建
         * Determines whether the active section or slide is scrollable through and scrolling bar
         */
        function isScrollable(activeSection){
            //if there are landscape slides, we check if the scrolling bar is in the current one or not
            if(activeSection.find('.fp-slides').length){
                scrollable= activeSection.find('.fp-slide.active').find('.fp-scrollable');
            }else{
                scrollable = activeSection.find('.fp-scrollable');
            }

            return scrollable;
        }

        /**
         * 通过type确定上还是下
         * 通过 isScrolled 方法确定某个section或者slide的内容超过屏幕时（这里就是 scrollable ），是否到达内容顶点或者内容最低点
         * 只有到达顶点并且type是向上 才可以滚动到上面的section或者左边的slide，返回true
         * 只有到达最低点并且type是向下 才可以滚动到下面的section或者右边的slide，返回true
         * 最后符合条件的调用 scrollSection
         * scrollSection 就是 moveSectionDown 或者 moveSectionUp
         * Determines the way of scrolling up or down:
         * by 'automatically' scrolling a section or by using the default and normal scrolling.
         */
        function scrolling(type, scrollable){
            if (!isScrollAllowed[type]){
                return;
            }

            if(type == 'down'){
                var check = 'bottom';
                var scrollSection = $.fn.fullpage.moveSectionDown;
            }else{
                var check = 'top';
                var scrollSection = $.fn.fullpage.moveSectionUp;
            }

            if(scrollable.length > 0 ){
                //is the scrollbar at the start/end of the scroll?
                if(isScrolled(check, scrollable)){
                    scrollSection();
                }else{
                    return true;
                }
            }else{
                // moved up/down
                scrollSection();
            }
        }


        var touchStartY = 0;
        var touchStartX = 0;
        var touchEndY = 0;
        var touchEndX = 0;


        /* Detecting touch events

         * As we are changing the top property of the page on scrolling, we can not use the traditional way to detect it.
         * This way, the touchstart and the touch moves shows an small difference between them which is the
         * used one to determine the direction.
         */
        function touchMoveHandler(event){
            /**
             * 获得原生event
             * @type {e.originalEvent|{}|*}
             */
            var e = event.originalEvent;

            // additional: if one of the normalScrollElements isn't within options.normalScrollElementTouchThreshold hops up the DOM chain

            /**
             * 如果 无法找到event.target的 normalScrollElement
             * normalScrollElement 是希望能正常滚动 而不是用fullpage方法
             * 是当前触发元素 通过parent() 方法normalScrollElementTouchThreshold 次后能跳转到的的父元素
             */

            if (!checkParentForNormalScrollElement(event.target)) {

                if(options.autoScrolling && !options.scrollBar){

                    //preventing the easing on iOS devices
                    event.preventDefault();
                }

                var activeSection = $('.fp-section.active');
                var scrollable = isScrollable(activeSection);

                if (!isMoving && !slideMoving) { //if theres any #
                    var touchEvents = getEventsPage(e);

                    //更新公用变量 touchEndY | X
                    touchEndY = touchEvents['y'];
                    touchEndX = touchEvents['x'];

                    //if movement in the X axys is greater than in the Y and the currect section has slides...
                    /**
                     * 存在slides
                     * X轴移动的绝对值 大于 Y轴移动的绝对值、
                     * 表示在横向移动
                     */
                    if (activeSection.find('.fp-slides').length && Math.abs(touchStartX - touchEndX) > (Math.abs(touchStartY - touchEndY))) {

                        //is the movement greater than the minimum resistance to scroll?
                        /**
                         * 横向移动的绝对值大于某个临界值
                         * 可以判断为是准备slide
                         * 再判断start和end大小 判断往左还是往右
                         * 调用moveSlideRight（无论 touch 还是 click 还是 键盘 都是调用此方法）
                         */
                        if (Math.abs(touchStartX - touchEndX) > ($(window).width() / 100 * options.touchSensitivity)) {
                            if (touchStartX > touchEndX) {
                                if(isScrollAllowed.right){
                                    $.fn.fullpage.moveSlideRight(); //next
                                }
                            } else {
                                if(isScrollAllowed.left){
                                    $.fn.fullpage.moveSlideLeft(); //prev
                                }
                            }
                        }
                    }

                    /**
                     * autoScrolling必须开
                     * Y轴移动 竖向
                     * 判断上还是下
                     * 调用scrolling（公用方法）
                     */
                    //vertical scrolling (only when autoScrolling is enabled)
                    else if(options.autoScrolling && !options.scrollBar){

                        //is the movement greater than the minimum resistance to scroll?
                        if (Math.abs(touchStartY - touchEndY) > ($(window).height() / 100 * options.touchSensitivity)) {
                            if (touchStartY > touchEndY) {
                                scrolling('down', scrollable);
                            } else if (touchEndY > touchStartY) {
                                scrolling('up', scrollable);
                            }
                        }
                    }
                }
            }

        }

        /**
         * recursive function to loop up the parent nodes to check if one of them exists in options.normalScrollElements
         * Currently works well for iOS - Android might need some testing
         * @param  {Element} el  target element / jquery selector (in subsequent nodes)
         * @param  {int}     hop current hop compared to options.normalScrollElementTouchThreshold
         * @return {boolean} true if there is a match to options.normalScrollElements
         * 向上递归 5（ option.normalScrollElementTouchThreshold ） 次
         * 找到el的父元素是否 options.normalScrollElements
         * 找到为true 否则为false
         */
        function checkParentForNormalScrollElement (el, hop) {
            hop = hop || 0;
            var parent = $(el).parent();

            if (hop < options.normalScrollElementTouchThreshold &&
                parent.is(options.normalScrollElements) ) {
                return true;
            } else if (hop == options.normalScrollElementTouchThreshold) {
                return false;
            } else {
                return checkParentForNormalScrollElement(parent, ++hop);
            }
        }

        function touchStartHandler(event){
            var e = event.originalEvent;
            //获取pageX|Y
            var touchEvents = getEventsPage(e);
            //touchStartY，touchStartX是公用变量
            touchStartY = touchEvents['y'];
            touchStartX = touchEvents['x'];
        }


        /**
         * Detecting mousewheel scrolling
         * 只有在options.autoScrolling为true的时候才会触发
         * http://blogs.sitepointstatic.com/examples/tech/mouse-wheel/index.html
         * http://www.sitepoint.com/html5-javascript-mouse-wheel/
         */
        function MouseWheelHandler(e) {
            if(options.autoScrolling){
                // cross-browser wheel delta
                e = window.event || e;
                //判断滚轮上和下
                var delta = Math.max(-1, Math.min(1,
                    (e.wheelDelta || -e.deltaY || -e.detail)));

                //preventing to scroll the site on mouse wheel when scrollbar is present
                if(options.scrollBar){
                    e.preventDefault ? e.preventDefault() : e.returnValue = false;

                }

                var activeSection = $('.fp-section.active');
                var scrollable = isScrollable(activeSection);

                /**？？？？？？？？？？？？？？？？？？？？？
                 * 此处添加配置项，让鼠标滚轮对屏幕只进行左右滑动
                 * 增加判断条件 if(delta<0){if(options.xxx){xxxxx}}
                 * 左右滑动不能调用scrolling？调用movesSlideLeft或者moveSlideRight
                 */
                if (!isMoving) { //if theres any #
                    //scrolling down?
                    if (delta < 0) {
                        scrolling('down', scrollable);

                        //scrolling up?
                    }else {
                        scrolling('up', scrollable);
                    }
                }

                return false;
            }
        }

        /**
         * 横向移动（有动画） 并没使用无限的效果
         * 根据当前active位置和参数direction，自动判断是横向移动下一个目标位置
         * 最后调用landscapeScroll
         * @param direction
         */
        function moveSlide(direction){
            var activeSection = $('.fp-section.active');
            var slides = activeSection.find('.fp-slides');

            // more than one slide needed and nothing should be sliding
            if (!slides.length || slideMoving) {
                return;
            }

            var currentSlide = slides.find('.fp-slide.active');
            var destiny = null;

            if(direction === 'prev'){
                destiny = currentSlide.prev('.fp-slide');
            }else{
                destiny = currentSlide.next('.fp-slide');
            }

            //isn't there a next slide in the secuence?
            if(!destiny.length){
                //respect loopHorizontal settin
                if (!options.loopHorizontal) return;

                if(direction === 'prev'){
                    destiny = currentSlide.siblings(':last');
                }else{
                    destiny = currentSlide.siblings(':first');
                }
            }

            slideMoving = true;


            landscapeScroll(slides, destiny);
        }

        /**
         * Maintains the active slides in the viewport
         * (Because he `scroll` animation might get lost with some actions, such as when using continuousVertical)
         */
        function keepSlidesPosition(){
            $('.fp-slide.active').each(function(){
                silentLandscapeScroll($(this));
            });
        }

        /**
         * Scrolls the site to the given element and scrolls to the slide if a callback is given.
         */
        function scrollPage(element, callback, isMovementUp){

            var dest = element.position();
            if(typeof dest === "undefined"){ return; } //there's no element to scroll, leaving the function

            //local variables
            var v = {
                element: element,
                callback: callback,
                isMovementUp: isMovementUp,
                dest: dest,
                dtop: dest.top,
                yMovement: getYmovement(element),
                anchorLink: element.data('anchor'),
                sectionIndex: element.index('.fp-section'),
                activeSlide: element.find('.fp-slide.active'),
                activeSection: $('.fp-section.active'),
                leavingSection: $('.fp-section.active').index('.fp-section') + 1,

                //caching the value of isResizing at the momment the function is called
                //because it will be checked later inside a setTimeout and the value might change
                localIsResizing: isResizing
            };

            //quiting when destination scroll is the same as the current one
            if((v.activeSection.is(element) && !isResizing) || (options.scrollBar && $(window).scrollTop() === v.dtop)){ return; }

            if(v.activeSlide.length){
                var slideAnchorLink = v.activeSlide.data('anchor');
                var slideIndex = v.activeSlide.index();
            }

            // If continuousVertical && we need to wrap around
            /**
             * yMovement是判断destiny和当前section位置是应该up还是down
             */
            if (options.autoScrolling && options.continuousVertical && typeof (v.isMovementUp) !== "undefined" &&
                ((!v.isMovementUp && v.yMovement == 'up') || // Intending to scroll down but about to go up or
                (v.isMovementUp && v.yMovement == 'down'))) { // intending to scroll up but about to go down

                v = createInfiniteSections(v);
            }

            element.addClass('active').siblings().removeClass('active');

            //preventing from activating the MouseWheelHandler event
            //more than once if the page is scrolling
            isMoving = true;

            setState(slideIndex, slideAnchorLink, v.anchorLink, v.sectionIndex);

            //callback (onLeave) if the site is not just resizing and readjusting the slides
            $.isFunction(options.onLeave) && !v.localIsResizing && options.onLeave.call(this, v.leavingSection, (v.sectionIndex + 1), v.yMovement);

            performMovement(v);

            //flag to avoid callingn `scrollPage()` twice in case of using anchor links
            lastScrolledDestiny = v.anchorLink;

            //avoid firing it twice (as it does also on scroll)
            if(options.autoScrolling){
                activateMenuAndNav(v.anchorLink, v.sectionIndex)
            }
        }

        /**
         * Performs the movement (by CSS3 or by jQuery)
         */
        function performMovement(v){
            // using CSS3 translate functionality
            if (options.css3 && options.autoScrolling && !options.scrollBar) {

                var translate3d = 'translate3d(0px, -' + v.dtop + 'px, 0px)';
                transformContainer(translate3d, true);

                setTimeout(function () {
                    afterSectionLoads(v);
                }, options.scrollingSpeed);
            }

            // using jQuery animate
            else{
                var scrollSettings = getScrollSettings(v);

                $(scrollSettings.element).animate(
                    scrollSettings.options
                    , options.scrollingSpeed, options.easing).promise().done(function () { //only one single callback in case of animating  `html, body`
                    afterSectionLoads(v);
                });
            }
        }

        /**
         * Gets the scrolling settings depending on the plugin autoScrolling option
         */
        function getScrollSettings(v){
            var scroll = {};

            if(options.autoScrolling && !options.scrollBar){
                scroll.options = { 'top': -v.dtop};
                scroll.element = '.'+wrapperSelector;
            }else{
                scroll.options = { 'scrollTop': v.dtop};
                scroll.element = 'html, body';
            }

            return scroll;
        }

        /**
         * Adds sections before or after the current one to create the infinite effect.
         */
        function createInfiniteSections(v){

            // Scrolling down
            if (!v.isMovementUp) {
                /**
                 * 让从第4页返回第1页效果是往下，4.prevAll.get顺序是3,2,1，再reverse就是1,2,3，整个顺序就是4,1,2,3
                 */
                    // Move all previous sections to after the active section
                $(".fp-section.active").after(v.activeSection.prevAll(".fp-section").get().reverse());
            }
            else { // Scrolling up
                /**
                 * 让从第1页返回第4页效果是往上
                 */
                    // Move all next sections to before the active section
                $(".fp-section.active").before(v.activeSection.nextAll(".fp-section"));
            }
            /**
             * 稳定当前竖屏,0秒内移动到.active的位置
             */
                // Maintain the displayed position (now that we changed the element order)
            silentScroll($('.fp-section.active').position().top);

            // Maintain the active slides visible in the viewport
            /**
             * 稳定当前横屏,0秒内移动到.active的位置
             */
            keepSlidesPosition();

            // save for later the elements that still need to be reordered
            v.wrapAroundElements = v.activeSection;

            /**
             * 重新计算目的地的位置 left和top
             * @type {*|{top, left}}
             */
                // Recalculate animation variables
            v.dest = v.element.position();
            v.dtop = v.dest.top;
            v.yMovement = getYmovement(v.element);

            return v;
        }

        /**
         * Fix section order after continuousVertical changes have been animated
         */
        function continuousVerticalFixSectionOrder (v) {
            // If continuousVertical is in effect (and autoScrolling would also be in effect then),
            // finish moving the elements around so the direct navigation will function more simply
            if (!v.wrapAroundElements || !v.wrapAroundElements.length) {
                return;
            }

            if (v.isMovementUp) {
                $('.fp-section:first').before(v.wrapAroundElements);
            }
            else {
                $('.fp-section:last').after(v.wrapAroundElements);
            }

            silentScroll($('.fp-section.active').position().top);

            // Maintain the active slides visible in the viewport
            keepSlidesPosition();
        };


        /**
         * Actions to do once the section is loaded
         */
        function afterSectionLoads (v){
            continuousVerticalFixSectionOrder(v);
            //callback (afterLoad) if the site is not just resizing and readjusting the slides
            $.isFunction(options.afterLoad) && !v.localIsResizing && options.afterLoad.call(this, v.anchorLink, (v.sectionIndex + 1));

            setTimeout(function () {
                isMoving = false;
                $.isFunction(v.callback) && v.callback.call(this);
            }, scrollDelay);
        }


        /**
         * Scrolls to the anchor in the URL when loading the site
         */
        function scrollToAnchor(){
            //getting the anchor link in the URL and deleting the `#`
            var value =  window.location.hash.replace('#', '').split('/');
            var section = value[0];
            var slide = value[1];

            if(section){  //if theres any #
                scrollPageAndSlide(section, slide);
            }
        }

        //detecting any change on the URL to scroll to the given anchor link
        //(a way to detect back history button as we play with the hashes on the URL)
        $(window).on('hashchange', hashChangeHandler);

        function hashChangeHandler(){
            if(!isScrolling){
                var value =  window.location.hash.replace('#', '').split('/');
                var section = value[0];
                var slide = value[1];

                if(section.length){
                    //when moving to a slide in the first section for the first time (first time to add an anchor to the URL)
                    var isFirstSlideMove =  (typeof lastScrolledDestiny === 'undefined');
                    var isFirstScrollMove = (typeof lastScrolledDestiny === 'undefined' && typeof slide === 'undefined' && !slideMoving);

                    /*in order to call scrollpage() only once for each destination at a time
                     It is called twice for each scroll otherwise, as in case of using anchorlinks `hashChange`
                     event is fired on every scroll too.*/
                    if ((section && section !== lastScrolledDestiny) && !isFirstSlideMove || isFirstScrollMove || (!slideMoving && lastScrolledSlide != slide ))  {
                        scrollPageAndSlide(section, slide);
                    }
                }
            }
        }


        /**
         * Sliding with arrow keys, both, vertical and horizontal
         */
        $(document).keydown(function(e) {
            //Moving the main page with the keyboard arrows if keyboard scrolling is enabled
            if (options.keyboardScrolling && options.autoScrolling) {

                //preventing the scroll with arrow keys
                if(e.which == 40 || e.which == 38){
                    e.preventDefault();
                }

                if(!isMoving){
                    switch (e.which) {
                        //up
                        case 38:
                        case 33:
                            $.fn.fullpage.moveSectionUp();
                            break;

                        //down
                        case 40:
                        case 34:
                            $.fn.fullpage.moveSectionDown();
                            break;

                        //Home
                        case 36:
                            $.fn.fullpage.moveTo(1);
                            break;

                        //End
                        case 35:
                            $.fn.fullpage.moveTo( $('.fp-section').length );
                            break;

                        //left
                        case 37:
                            $.fn.fullpage.moveSlideLeft();
                            break;

                        //right
                        case 39:
                            $.fn.fullpage.moveSlideRight();
                            break;

                        default:
                            return; // exit this handler for other keys
                    }
                }
            }
        });

        /**
         * Scrolls to the section when clicking the navigation bullet
         */
        $(document).on('click touchstart', '#fp-nav a', function(e){
            e.preventDefault();
            var index = $(this).parent().index();
            scrollPage($('.fp-section').eq(index));
        });

        /**
         * Scrolls the slider to the given slide destination for the given section
         */
        $(document).on('click touchstart', '.fp-slidesNav a', function(e){
            e.preventDefault();
            var slides = $(this).closest('.fp-section').find('.fp-slides');
            var destiny = slides.find('.fp-slide').eq($(this).closest('li').index());

            landscapeScroll(slides, destiny);
        });

        if(options.normalScrollElements){
            $(document).on('mouseenter', options.normalScrollElements, function () {
                $.fn.fullpage.setMouseWheelScrolling(false);
            });

            $(document).on('mouseleave', options.normalScrollElements, function(){
                $.fn.fullpage.setMouseWheelScrolling(true);
            });
        }

        /**
         * Scrolling horizontally when clicking on the slider controls.
         */
        $('.fp-section').on('click touchstart', '.fp-controlArrow', function() {
            if ($(this).hasClass('fp-prev')) {
                $.fn.fullpage.moveSlideLeft();
            } else {
                $.fn.fullpage.moveSlideRight();
            }
        });

        /**
         * Scrolls horizontal sliders.
         * 执行移动前回调
         * 改变url或者bodyclass
         * 改变slide的class
         * 判断箭头
         * 执行滑动
         * 执行滑动后回调
         * 改变slideNav的class
         */
        function landscapeScroll(slides, destiny){

            var destinyPos = destiny.position();
            var slidesContainer = slides.find('.fp-slidesContainer').parent();
            var slideIndex = destiny.index();
            var section = slides.closest('.fp-section');
            var sectionIndex = section.index('.fp-section');
            var anchorLink = section.data('anchor');
            var slidesNav = section.find('.fp-slidesNav');
            var slideAnchor = destiny.data('anchor');

            //caching the value of isResizing at the momment the function is called
            //because it will be checked later inside a setTimeout and the value might change
            var localIsResizing = isResizing;

            /**
             * 执行slide前的回调：条件是没有resizing和xMovement不为none
             */
            if(options.onSlideLeave){
                var prevSlideIndex = section.find('.fp-slide.active').index();
                var xMovement = getXmovement(prevSlideIndex, slideIndex);

                //if the site is not just resizing and readjusting the slides
                if(!localIsResizing && xMovement!=='none'){
                    $.isFunction( options.onSlideLeave ) && options.onSlideLeave.call( this, anchorLink, (sectionIndex + 1), prevSlideIndex, xMovement);
                }
            }

            destiny.addClass('active').siblings().removeClass('active');



            if(typeof slideAnchor === 'undefined'){
                slideAnchor = slideIndex;
            }

            /**
             * 判断是否隐藏左右箭头 循环滚动则不隐藏
             */
            if(!options.loopHorizontal && options.controlArrows){
                //hidding it for the fist slide, showing for the rest
                section.find('.fp-controlArrow.fp-prev').toggle(slideIndex!=0);

                //hidding it for the last slide, showing for the rest
                section.find('.fp-controlArrow.fp-next').toggle(!destiny.is(':last-child'));
            }
            /**
             * setState根据是或否有anchor变更url或者body的class
             */
            //only changing the URL if the slides are in the current section (not for resize re-adjusting)
            if(section.hasClass('active')){
                setState(slideIndex, slideAnchor, anchorLink, sectionIndex);
            }


            /**
             * 定义结束后的回调方法
             */
            var afterSlideLoads = function(){
                //if the site is not just resizing and readjusting the slides
                if(!localIsResizing){
                    $.isFunction( options.afterSlideLoad ) && options.afterSlideLoad.call( this, anchorLink, (sectionIndex + 1), slideAnchor, slideIndex);
                }
                //letting them slide again
                slideMoving = false;
            };

            /**
             * 正式执行slide（含执行后的回调）
             */
            if(options.css3){
                var translate3d = 'translate3d(-' + destinyPos.left + 'px, 0px, 0px)';

                addAnimation(slides.find('.fp-slidesContainer'), options.scrollingSpeed>0).css(getTransforms(translate3d));

                setTimeout(function(){
                    afterSlideLoads();
                }, options.scrollingSpeed, options.easing);
            }else{
                slidesContainer.animate({
                    scrollLeft : destinyPos.left
                }, options.scrollingSpeed, options.easing, function() {

                    afterSlideLoads();
                });
            }

            slidesNav.find('.active').removeClass('active');
            slidesNav.find('li').eq(slideIndex).find('a').addClass('active');
        }

        //when resizing the site, we adjust the heights of the sections, slimScroll...
        $(window).resize(resizeHandler);

        var previousHeight = windowsHeight;
        var resizeId;

        /**
         * 判断是否移动设备，是否能够进行resize，最后会调用reBuild
         */
        function resizeHandler(){
            /**
             * options.responsive为一个数值，指当屏幕小于这个数值时，屏幕滚动为正常滚动
             */
                //checking if it needs to get responsive
            responsive();

            /**
             * 通过useragent判断是否移动设备
             */
            // rebuild immediately on touch devices
            if (isTouchDevice) {

                //if the keyboard is visible
                /**
                 * 如果有键盘弹出 则不进行rebuild；document.activeElement是指获取当前聚焦的元素
                 */
                if ($(document.activeElement).attr('type') !== 'text') {
                    var currentHeight = $(window).height();
                    /**
                     * 每次变动大小要超过上一次的高度的20%
                     */
                    //making sure the change in the viewport size is enough to force a rebuild. (20 % of the window to avoid problems when hidding scroll bars)
                    if( Math.abs(currentHeight - previousHeight) > (20 * Math.max(previousHeight, currentHeight) / 100) ){
                        $.fn.fullpage.reBuild(true);
                        previousHeight = currentHeight;
                    }
                }
            }else{
                //in order to call the functions only when the resize is finished
                //http://stackoverflow.com/questions/4298612/jquery-how-to-call-resize-event-only-once-its-finished-resizing
                clearTimeout(resizeId);

                /**
                 * 不是移动设备，500ms后进行rebuild
                 * @type {number|NodeJS.Timer}
                 */
                resizeId = setTimeout(function(){
                    $.fn.fullpage.reBuild(true);
                }, 500);
            }
        }

        /**
         * Checks if the site needs to get responsive and disables autoScrolling if so.
         * A class `fp-responsive` is added to the plugin's container in case the user wants to use it for his own responsive CSS.
         * 如果屏幕宽度<options.responsive，那么就取消scroll的效果，关闭nav
         */
        function responsive(){
            if(options.responsive){
                var isResponsive = container.hasClass('fp-responsive');
                if ($(window).width() < options.responsive ){
                    if(!isResponsive){
                        $.fn.fullpage.setAutoScrolling(false, 'internal');
                        $('#fp-nav').hide();
                        container.addClass('fp-responsive');
                    }
                }else if(isResponsive){
                    $.fn.fullpage.setAutoScrolling(originals.autoScrolling, 'internal');
                    $('#fp-nav').show();
                    container.removeClass('fp-responsive');
                }
            }
        }

        /**
         * Adds transition animations for the given element
         */
        function addAnimation(element){
            var transition = 'all ' + options.scrollingSpeed + 'ms ' + options.easingcss3;

            element.removeClass('fp-notransition');
            return element.css({
                '-webkit-transition': transition,
                'transition': transition
            });
        }

        /**
         * Remove transition animations for the given element
         */
        function removeAnimation(element){
            return element.addClass('fp-notransition');
        }

        /**
         * Resizing of the font size depending on the window size as well as some of the images on the site.
         * 调整字体大小
         */
        function resizeMe(displayHeight, displayWidth) {
            //Standard dimensions, for which the body font size is correct
            var preferredHeight = 825;
            var preferredWidth = 900;

            if (displayHeight < preferredHeight || displayWidth < preferredWidth) {
                var heightPercentage = (displayHeight * 100) / preferredHeight;
                var widthPercentage = (displayWidth * 100) / preferredWidth;
                var percentage = Math.min(heightPercentage, widthPercentage);
                var newFontSize = percentage.toFixed(2);

                $("body").css("font-size", newFontSize + '%');
            } else {
                $("body").css("font-size", '100%');
            }
        }

        /**
         * Activating the website navigation dots according to the given slide name.
         */
        function activateNavDots(name, sectionIndex){
            if(options.navigation){
                $('#fp-nav').find('.active').removeClass('active');
                if(name){
                    $('#fp-nav').find('a[href="#' + name + '"]').addClass('active');
                }else{
                    $('#fp-nav').find('li').eq(sectionIndex).find('a').addClass('active');
                }
            }
        }

        /**
         * Activating the website main menu elements according to the given slide name.
         */
        function activateMenuElement(name){
            if(options.menu){
                $(options.menu).find('.active').removeClass('active');
                $(options.menu).find('[data-menuanchor="'+name+'"]').addClass('active');
            }
        }

        function activateMenuAndNav(anchor, index){
            activateMenuElement(anchor);
            activateNavDots(anchor, index);
        }

        /**
         * Return a boolean depending on whether the scrollable element is at the end or at the start of the scrolling
         * depending on the given type.
         */
        function isScrolled(type, scrollable){
            if(type === 'top'){
                return !scrollable.scrollTop();
            }else if(type === 'bottom'){
                return scrollable.scrollTop() + 1 + scrollable.innerHeight() >= scrollable[0].scrollHeight;
            }
        }

        /**
         * Retuns `up` or `down` depending on the scrolling movement to reach its destination
         * from the current section.
         */
        function getYmovement(destiny){
            var fromIndex = $('.fp-section.active').index('.fp-section');
            var toIndex = destiny.index('.fp-section');
            if( fromIndex == toIndex){
                return 'none'
            }
            if(fromIndex > toIndex){
                return 'up';
            }
            return 'down';
        }

        /**
         * Retuns `right` or `left` depending on the scrolling movement to reach its destination
         * from the current slide.
         */
        function getXmovement(fromIndex, toIndex){
            if( fromIndex == toIndex){
                return 'none'
            }
            if(fromIndex > toIndex){
                return 'left';
            }
            return 'right';
        }


        function createSlimScrolling(element){
            /**
             * 12年的opera
             */
                //needed to make `scrollHeight` work under Opera 12
            element.css('overflow', 'hidden');

            /**
             * 获取最近的父元素或者本身 section
             */
            //in case element is a slide
            var section = element.closest('.fp-section');
            var scrollable = element.find('.fp-scrollable');

            //if there was scroll, the contentHeight will be the one in the scrollable section
            if(scrollable.length){
                var contentHeight = scrollable.get(0).scrollHeight;
            }else{
                var contentHeight = element.get(0).scrollHeight;
                if(options.verticalCentered){
                    contentHeight = element.find('.fp-tableCell').get(0).scrollHeight;
                }
            }

            var scrollHeight = windowsHeight - parseInt(section.css('padding-bottom')) - parseInt(section.css('padding-top'));

            //needs scroll?
            if ( contentHeight > scrollHeight) {
                //was there already an scroll ? Updating it
                if(scrollable.length){
                    scrollable.css('height', scrollHeight + 'px').parent().css('height', scrollHeight + 'px');
                }
                //creating the scrolling
                else{
                    if(options.verticalCentered){
                        element.find('.fp-tableCell').wrapInner('<div class="fp-scrollable" />');
                    }else{
                        element.wrapInner('<div class="fp-scrollable" />');
                    }

                    /**
                     * slimScroll 方法需要引用另外一个js
                     */
                    element.find('.fp-scrollable').slimScroll({
                        allowPageScroll: true,
                        height: scrollHeight + 'px',
                        size: '10px',
                        alwaysVisible: true
                    });
                }
            }

            //removing the scrolling when it is not necessary anymore
            else{
                removeSlimScroll(element);
            }

            //undo
            element.css('overflow', '');
        }

        function removeSlimScroll(element){
            element.find('.fp-scrollable').children().first().unwrap().unwrap();
            element.find('.slimScrollBar').remove();
            element.find('.slimScrollRail').remove();
        }

        /**
         * table高度就是 windowHeight - paddingTop - paddingBottom
         * @param element
         */
        function addTableClass(element){
            element.addClass('fp-table').wrapInner('<div class="fp-tableCell" style="height:' + getTableHeight(element) + 'px;" />');
        }

        function getTableHeight(element){
            var sectionHeight = windowsHeight;

            if(options.paddingTop || options.paddingBottom){
                var section = element;
                if(!section.hasClass('fp-section')){
                    section = element.closest('.fp-section');
                }

                var paddings = parseInt(section.css('padding-top')) + parseInt(section.css('padding-bottom'));
                sectionHeight = (windowsHeight - paddings);
            }

            return sectionHeight;
        }

        /**
         * Adds a css3 transform property to the container class with or without animation depending on the animated param.
         */
        function transformContainer(translate3d, animated){
            if(animated){
                addAnimation(container);
            }else{
                removeAnimation(container);
            }

            container.css(getTransforms(translate3d));

            //syncronously removing the class after the animation has been applied.
            setTimeout(function(){
                container.removeClass('fp-notransition');
            },10)
        }


        /**
         * 判断数轴section的destiny是index还是anchor名称，横轴的在后面scrollSlider里面判断，这里参数slide只是传递
         * Scrolls to the given section and slide
         */
        function scrollPageAndSlide(destiny, slide){
            if (typeof slide === 'undefined') {
                slide = 0;
            }

            if(isNaN(destiny)){
                var section = $('[data-anchor="'+destiny+'"]');
            }else{
                var section = $('.fp-section').eq( (destiny -1) );
            }

            /**
             * lastScrolledDestiny移动后的目标点，每次移动后都会更新
             * destiny!==lastScrolledDestiny就是指数值section目标不是当前位置
             */

            //we need to scroll to the section and then to the slide
            if (destiny !== lastScrolledDestiny && !section.hasClass('active')){
                /**
                 * 竖直移动调用scrollPage后回调移动横轴
                 * 横轴移动会调用landscapeScroll
                 */
                scrollPage(section, function(){
                    scrollSlider(section, slide)
                });
            }
            //if we were already in the section
            else{
                /**
                 * 如果目标是当前，只移动横轴
                 */
                scrollSlider(section, slide);
            }
        }

        /**
         * scrollSlider 判断目标点的slide是index还是anchor名称，调用landscapeScroll
         * Scrolls the slider to the given slide destination for the given section
         */
        function scrollSlider(section, slide){
            /**
             *
             */
            if(typeof slide != 'undefined'){
                var slides = section.find('.fp-slides');
                var destiny =  slides.find('[data-anchor="'+slide+'"]');

                if(!destiny.length){
                    destiny = slides.find('.fp-slide').eq(slide);
                }

                if(destiny.length){
                    landscapeScroll(slides, destiny);
                }
            }
        }

        /**
         * 创建横屏nav dots
         * 配置默认样式
         * ul的margin-left 为宽度的一半（居中效果）
         * 第一个dot为active
         * Creates a landscape navigation bar with dots for horizontal sliders.
         */
        function addSlidesNavigation(section, numSlides){
            section.append('<div class="fp-slidesNav"><ul></ul></div>');
            var nav = section.find('.fp-slidesNav');

            //top or bottom
            nav.addClass(options.slidesNavPosition);

            for(var i=0; i< numSlides; i++){
                nav.find('ul').append('<li><a href="#"><span></span></a></li>');
            }

            //centering it
            nav.css('margin-left', '-' + (nav.width()/2) + 'px');

            nav.find('li').first().find('a').addClass('active');
        }

        /**
         * Sets the state of the website depending on the active section/slide.
         * It changes the URL hash when needed and updates the body class.
         * 此方法就是判断并且设置有anchor的url或者body的class
         */
        function setState(slideIndex, slideAnchor, anchorLink, sectionIndex){
            var sectionHash = '';

            if(options.anchors.length){

                //isn't it the first slide?
                if(slideIndex){
                    if(typeof anchorLink !== 'undefined'){
                        sectionHash = anchorLink;
                    }

                    //slide without anchor link? We take the index instead.
                    if(typeof slideAnchor === 'undefined'){
                        slideAnchor = slideIndex;
                    }

                    lastScrolledSlide = slideAnchor;
                    setUrlHash(sectionHash + '/' + slideAnchor);

                    //first slide won't have slide anchor, just the section one
                }else if(typeof slideIndex !== 'undefined'){
                    lastScrolledSlide = slideAnchor;
                    setUrlHash(anchorLink);
                }

                //section without slides
                else{
                    setUrlHash(anchorLink);
                }

                setBodyClass(location.hash);
            }
            else if(typeof slideIndex !== 'undefined'){
                setBodyClass(sectionIndex + '-' + slideIndex);
            }
            else{
                setBodyClass(String(sectionIndex));
            }
        }

        /**
         * Sets the URL hash.
         */
        function setUrlHash(url){
            if(options.recordHistory){
                location.hash = url;
            }else{
                //Mobile Chrome doesn't work the normal way, so... lets use HTML5 for phones :)
                if(isTouchDevice || isTouch){
                    history.replaceState(undefined, undefined, "#" + url)
                }else{
                    var baseUrl = window.location.href.split('#')[0];
                    window.location.replace( baseUrl + '#' + url );
                }
            }
        }

        /**
         * Sets a class for the body of the page depending on the active section / slide
         */
        function setBodyClass(text){
            //changing slash for dash to make it a valid CSS style
            text = text.replace('/', '-').replace('#','');

            //removing previous anchor classes
            $("body")[0].className = $("body")[0].className.replace(/\b\s?fp-viewing-[^\s]+\b/g, '');

            //adding the current anchor
            $("body").addClass("fp-viewing-" + text);
        }

        /**
         * Checks for translate3d support
         * 创建一个p元素 加上css transform:translate3d(1px,1px,1px)
         * 再进行取值测试
         * window.getComputedStyle(p元素).getPropertyValue(transform属性)
         * @return boolean
         * http://stackoverflow.com/questions/5661671/detecting-transform-translate3d-support
         */
        function support3d() {
            var el = document.createElement('p'),
                has3d,
                transforms = {
                    'webkitTransform':'-webkit-transform',
                    'OTransform':'-o-transform',
                    'msTransform':'-ms-transform',
                    'MozTransform':'-moz-transform',
                    'transform':'transform'
                };

            // Add it to the body to get the computed style.
            document.body.insertBefore(el, null);

            for (var t in transforms) {
                if (el.style[t] !== undefined) {
                    el.style[t] = "translate3d(1px,1px,1px)";
                    has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]);
                }
            }

            document.body.removeChild(el);

            return (has3d !== undefined && has3d.length > 0 && has3d !== "none");
        }



        /**
         * Removes the auto scrolling action fired by the mouse wheel and trackpad.
         * After this function is called, the mousewheel and trackpad movements won't scroll through sections.
         */
        function removeMouseWheelHandler(){
            if (document.addEventListener) {
                document.removeEventListener('mousewheel', MouseWheelHandler, false); //IE9, Chrome, Safari, Oper
                document.removeEventListener('wheel', MouseWheelHandler, false); //Firefox
            } else {
                document.detachEvent("onmousewheel", MouseWheelHandler); //IE 6/7/8
            }
        }


        /**
         * Adds the auto scrolling action for the mouse wheel and trackpad.
         * After this function is called, the mousewheel and trackpad movements will scroll through sections
         */
        function addMouseWheelHandler(){
            if (document.addEventListener) {
                document.addEventListener("mousewheel", MouseWheelHandler, false); //IE9, Chrome, Safari, Oper
                document.addEventListener("wheel", MouseWheelHandler, false); //Firefox
            } else {
                document.attachEvent("onmousewheel", MouseWheelHandler); //IE 6/7/8
            }
        }


        /**
         * touch 的事件不支持IE 因此用pointerEvent作为备选
         * Adds the possibility to auto scroll through sections on touch devices.
         */
        function addTouchHandler(){
            if(isTouchDevice || isTouch){
                //Microsoft pointers
                MSPointer = getMSPointer();

                //每当触发touchstart事件 则计算pageX|pageY 并更新公用变量 touchStartX | Y
                $(document).off('touchstart ' +  MSPointer.down).on('touchstart ' + MSPointer.down, touchStartHandler);
                $(document).off('touchmove ' + MSPointer.move).on('touchmove ' + MSPointer.move, touchMoveHandler);
            }
        }

        /**
         * Removes the auto scrolling for touch devices.
         */
        function removeTouchHandler(){
            if(isTouchDevice || isTouch){
                //Microsoft pointers
                MSPointer = getMSPointer();

                $(document).off('touchstart ' + MSPointer.down);
                $(document).off('touchmove ' + MSPointer.move);
            }
        }


        /**
         * IE10 pointerdown 事件需要前缀MS
         * Returns and object with Microsoft pointers (for IE<11 and for IE >= 11)
         * http://msdn.microsoft.com/en-us/library/ie/dn304886(v=vs.85).aspx
         */
        function getMSPointer(){
            var pointer;

            //IE >= 11 & rest of browsers
            if(window.PointerEvent){
                pointer = { down: "pointerdown", move: "pointermove"};
            }

            //IE < 11
            else{
                pointer = { down: "MSPointerDown", move: "MSPointerMove"};
            }

            return pointer;
        }
        /**
         * Gets the pageX and pageY properties depending on the browser.
         * https://github.com/alvarotrigo/fullPage.js/issues/194#issuecomment-34069854
         */
        function getEventsPage(e){
            var events = new Array();

            /**
             * touchEvent 的pageX|Y 放在originalEvent——touches[0]——pageX|Y
             * pointerEvent 的pageX|Y 放在originalEvent——pageX|Y
             */
            events['y'] = (typeof e.pageY !== 'undefined' && (e.pageY || e.pageX) ? e.pageY : e.touches[0].pageY);
            events['x'] = (typeof e.pageX !== 'undefined' && (e.pageY || e.pageX) ? e.pageX : e.touches[0].pageX);

            return events;
        }

        /**
         * 瞬间跳到activeSlide（无动画）
         * @param activeSlide
         */
        function silentLandscapeScroll(activeSlide){
            $.fn.fullpage.setScrollingSpeed (0, 'internal');
            landscapeScroll(activeSlide.closest('.fp-slides'), activeSlide);
            $.fn.fullpage.setScrollingSpeed(originals.scrollingSpeed, 'internal');
        }

        /**
         * 有滚动栏就用scrollTop，支持css3就用translate，其他则用top定位
         * 无动画
         * @param top
         */
        function silentScroll(top){
            if(options.scrollBar){
                container.scrollTop(top);
            }
            else if (options.css3) {
                var translate3d = 'translate3d(0px, -' + top + 'px, 0px)';
                transformContainer(translate3d, false);
            }
            else {
                container.css("top", -top);
            }
        }

        function getTransforms(translate3d){
            return {
                '-webkit-transform': translate3d,
                '-moz-transform': translate3d,
                '-ms-transform':translate3d,
                'transform': translate3d
            };
        }

        function setIsScrollable(value, direction){
            switch (direction){
                case 'up': isScrollAllowed.up = value; break;
                case 'down': isScrollAllowed.down = value; break;
                case 'left': isScrollAllowed.left = value; break;
                case 'right': isScrollAllowed.right = value; break;
                case 'all': $.fn.fullpage.setAllowScrolling(value);
            }
        }


        /*
         * Destroys fullpage.js plugin events and optinally its html markup and styles
         */
        $.fn.fullpage.destroy = function(all){
            $.fn.fullpage.setAutoScrolling(false, 'internal');
            $.fn.fullpage.setAllowScrolling(false);
            $.fn.fullpage.setKeyboardScrolling(false);


            $(window)
                .off('scroll', scrollHandler)
                .off('hashchange', hashChangeHandler)
                .off('resize', resizeHandler);

            $(document)
                .off('click', '#fp-nav a')
                .off('mouseenter', '#fp-nav li')
                .off('mouseleave', '#fp-nav li')
                .off('click', '.fp-slidesNav a')
                .off('mouseover', options.normalScrollElements)
                .off('mouseout', options.normalScrollElements);

            $('.fp-section')
                .off('click', '.fp-controlArrow');

            //lets make a mess!
            if(all){
                destroyStructure();
            }
        };

        /*
         * Removes inline styles added by fullpage.js
         */
        function destroyStructure(){
            //reseting the `top` or `translate` properties to 0
            silentScroll(0);

            $('#fp-nav, .fp-slidesNav, .fp-controlArrow').remove();

            //removing inline styles
            $('.fp-section').css( {
                'height': '',
                'background-color' : '',
                'padding': ''
            });

            $('.fp-slide').css( {
                'width': ''
            });

            container.css({
                'height': '',
                'position': '',
                '-ms-touch-action': '',
                'touch-action': ''
            });

            //removing added classes
            $('.fp-section, .fp-slide').each(function(){
                removeSlimScroll($(this));
                $(this).removeClass('fp-table active');
            });

            removeAnimation(container);
            removeAnimation(container.find('.fp-easing'));

            //Unwrapping content
            container.find('.fp-tableCell, .fp-slidesContainer, .fp-slides').each(function(){
                //unwrap not being use in case there's no child element inside and its just text
                $(this).replaceWith(this.childNodes);
            });

            //scrolling the page to the top with no animation
            $('html, body').scrollTop(0);
        }

        /*
         * Sets the state for a variable with multiple states (original, and temporal)
         * Some variables such as `autoScrolling` or `recordHistory` might change automatically its state when using `responsive` or `autoScrolling:false`.
         * This function is used to keep track of both states, the original and the temporal one.
         * If type is not 'internal', then we assume the user is globally changing the variable.
         */
        function setVariableState(variable, value, type){
            options[variable] = value;
            if(type !== 'internal'){
                originals[variable] = value;
            }
        }

        /**
         * Displays warnings
         */
        function displayWarnings(){
            // Disable mutually exclusive settings
            if (options.continuousVertical &&
                (options.loopTop || options.loopBottom)) {
                options.continuousVertical = false;
                showError('warn', "Option `loopTop/loopBottom` is mutually exclusive with `continuousVertical`; `continuousVertical` disabled");
            }
            if(options.continuousVertical && options.scrollBar){
                options.continuousVertical = false;
                showError('warn', "Option `scrollBar` is mutually exclusive with `continuousVertical`; `continuousVertical` disabled");
            }

            //anchors can not have the same value as any element ID or NAME
            $.each(options.anchors, function(index, name){
                if($('#' + name).length || $('[name="'+name+'"]').length ){
                    showError('error', "data-anchor tags can not have the same value as any `id` element on the site (or `name` element for IE).");
                }
            });
        }

        function showError(type, text){
            console && console[type] && console[type]('fullPage: ' + text);
        }
    };
})(jQuery);
