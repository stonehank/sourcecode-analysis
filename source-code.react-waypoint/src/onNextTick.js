let timeout;
const timeoutQueue = [];

export default function onNextTick(cb) {
  // 放入队列
  timeoutQueue.push(cb);

  // 如果timeout不存在，setTimeout 0 执行队列，确保任务不冲突
  // 如果timeout存在，说明任务队列已经开始执行
  if (!timeout) {
    timeout = setTimeout(() => {
      timeout = null;

      // Drain the timeoutQueue
      let item;
      // eslint-disable-next-line no-cond-assign
      while (item = timeoutQueue.shift()) {
        item();
      }
    }, 0);
  }

  let isSubscribed = true;

  // 返回一个取消的函数
  return function unsubscribe() {
    if (!isSubscribed) {
      return;
    }

    isSubscribed = false;

    const index = timeoutQueue.indexOf(cb);
    // 当前cb已经执行完毕
    if (index === -1) {
      return;
    }

    // 清除
    timeoutQueue.splice(index, 1);

    // 如果任务队列无任务 并且 计时器还存在
    if (!timeoutQueue.length && timeout) {
      // 清除计时器
      clearTimeout(timeout);
      timeout = null;
    }
  };
}
