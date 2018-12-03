import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';

export const render = (rootComponent, domElement) => {
  // 是在Node的jsdom的环境下，并且window.reactSnapshotRender已经创建
  if (navigator.userAgent.match(/Node\.js/i) && window && window.reactSnapshotRender) {
    // 执行服务端渲染，插入innerHTML中
    domElement.innerHTML = ReactDOMServer.renderToString(rootComponent)
    // 改变flag
    window.reactSnapshotRender()
  } else {
    ReactDOM.render(rootComponent, domElement)
  }
}
