整体：
* 获取默认滚动条宽度，如果之前已经获取过了，并且参数fresh为false，则从缓存调取


```js
let cached;

export default function getScrollBarSize(fresh) {
  // 如果参数为true 则不使用cache，重新计算
  if (fresh || cached === undefined) {
    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.height = '200px';

    const outer = document.createElement('div');
    const outerStyle = outer.style;

    outerStyle.position = 'absolute';
    outerStyle.top = 0;
    outerStyle.left = 0;
    // 不会成为鼠标事件的目标
    outerStyle.pointerEvents = 'none';
    outerStyle.visibility = 'hidden';
    outerStyle.width = '200px';
    outerStyle.height = '150px';
    // 初始无滚动条
    outerStyle.overflow = 'hidden';

    outer.appendChild(inner);

    document.body.appendChild(outer);

    // 无滚动条下inner宽度
    const widthContained = inner.offsetWidth;
    // 设置滚动条
    outer.style.overflow = 'scroll';
    // 有滚动条下 inner宽度
    let widthScroll = inner.offsetWidth;

    // todo 特殊情况 offsetWidth两者相等？
    if (widthContained === widthScroll) {
      // 如果 inner.offsetWidth 算出相等，则用outer的clientWidth
      // clientWidth===offsetWidth-边框-滚动轴宽度
      widthScroll = outer.clientWidth;
    }

    document.body.removeChild(outer);
    // 保存滚动条宽度为cache
    cached = widthContained - widthScroll;
  }
  return cached;
}

```