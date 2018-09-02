! function() {

    // wrapper, so we can call the function on both load and scroll events

    function lazyload() {

        // all the images with class lazyload
        // 获取class为lazyload的img
        var images = document.querySelectorAll("img.lazyload");
        var i = images.length;

        // remove the event listener if there are no images with the class lazyload

        // 如果无class为lazyload，清除监听
        !i && window.removeEventListener("scroll", lazyload);

        // loop de loop
        // 遍历images
        while (i--) {
            var wH = window.innerHeight;
            // 触发加载的距离
            var offset = 100;
            // 到达这个元素的距离
            var yPosition = images[i].getBoundingClientRect().top - wH;

            // if the top of the image is within 100px from the bottom of the viewport
            // 到达图片顶部距离小于 offset，认为在视口内
            if (yPosition <= offset) {
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

                    // remove the class lazyload
                    // 图片加载完毕，删除lazyload的classname
                    this.classList.remove("lazyload");
                });

            }
        }
    }

    // run on load

    lazyload();

    // run on scroll event
    // 添加scroll监听
    window.addEventListener("scroll", lazyload);
}();