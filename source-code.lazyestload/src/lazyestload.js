! function() {

    // debounced scroll event

    function _scroll(a, b) {
        // 去抖
        // 绑定scroll为停止scroll200ms后执行，返回执行函数a
        return window.addEventListener("scroll", function() {
            clearTimeout(b);
            b = setTimeout(a, 200);
        }), a;
    }

    // main function wrapper

    function lazyestload() {

        // all the images with class lazyestload

        var images = document.querySelectorAll("img.lazyestload");
        var i = images.length;

        // loop de loop

        while (i--) {
            var wH = window.innerHeight;
            var boundingRect = images[i].getBoundingClientRect();
            var offset = 100;
            var yPositionTop = boundingRect.top - wH;
            var yPositionBottom = boundingRect.bottom;

            // if the top of the image is within 100px from the bottom of the viewport
            // and if the bottom of the image is within 100px from the top of the viewport
            // basically if the image is in the viewport, with a bit of buffer

            // 到图片顶部的距离小于 offset，并且图片底部到窗口顶部的距离大于offset，就认为是在视口内
            if (yPositionTop <= offset && yPositionBottom >= -offset) {

                // replace the src with the data-src      

                // 调用自定义属性中的src
                if (images[i].getAttribute("data-src")) {
                    images[i].src = images[i].getAttribute("data-src");
                }

                // replace the srcset with the data-srcset  

                // 替换srcset，响应式图片
                if (images[i].getAttribute("data-srcset")) {
                    images[i].srcset = images[i].getAttribute("data-srcset");
                }

                // replace the source srcset's with the data-srcset's

              // 处理 picktur标签内部的source标签的 srcset 属性
                if (images[i].parentElement.tagName === "PICTURE") {
                    var sources = images[i].parentElement.querySelectorAll("source");
                    var j = sources.length;
                    while (j--) {
                        sources[j].srcset = sources[j].getAttribute("data-srcset");
                    }
                }

                // wait until the new image is loaded

                images[i].addEventListener('load', function() {
                    this.classList.remove("lazyestload");
                });

            }
        }
    }

    // run on debounced scroll event and once on load

    // 初始执行_scroll 并且执行它的返回值，也就是lazyestload
    _scroll(function() {
        lazyestload();
    })();
}();