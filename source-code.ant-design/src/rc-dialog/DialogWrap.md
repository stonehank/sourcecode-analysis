## rc-dialogWrap


未对非React16以下的处理做注释

整体：
* DialogWrap是外部引用'rc-dialog'的默认export文件
* 定义了container，用```Portal```包裹了子元素```Dialog```
 [Protal](../rc-util/Portal.md)是一个传送门方法

* 进入[Dialog](./Dialog.md)

```tsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Dialog from './Dialog';
import ContainerRender from 'rc-util/lib/ContainerRender';
import Portal from 'rc-util/lib/Portal';
import IDialogPropTypes from './IDialogPropTypes';


// 通过createPortal方法判定是否16以上

const IS_REACT_16 = 'createPortal' in ReactDOM;


class DialogWrap extends React.Component<IDialogPropTypes, any> {
  static defaultProps  = {
    visible: false,
  };

  _component: React.ReactElement<any>;

  renderComponent: (props: any) => void;

  removeContainer: () => void;

  shouldComponentUpdate({ visible }: { visible: boolean }) {
    return !!(this.props.visible || visible);
  }

  componentWillUnmount() {
    if (IS_REACT_16) {
      return;
    }
    if (this.props.visible) {
      this.renderComponent({
        afterClose: this.removeContainer,
        onClose() {
        },
        visible: false,
      });
    } else {
      this.removeContainer();
    }
  }

  saveDialog = (node: any) => {
    this._component = node;
 }

 // 渲染Dialog
  getComponent = (extra = {}) => {
    return (
      <Dialog
        ref={this.saveDialog}
        {...this.props}
        {...extra}
        key="dialog"
      />
    );
  }
  //https://github.com/ant-design/ant-design/issues/10656
  // fix issue #10656
  /*
  * Custom container should not be return, because in the Portal component, it will remove the
  * return container element here, if the custom container is the only child of it's component,
  * like issue #10656, It will has a conflict with removeChild method in react-dom.
  * So here should add a child (div element) to custom container.
  * */
  // 此处getContainer：
  // 如果有自定义container，创建一个div作为自定义container的子元素并且返回
  // 如果没有自定义container，创建一个div作为body的子元素并且返回
  // 不能直接返回自定义container，否则遇到issue的情况会和react-dom的removeChild方法冲突
  getContainer = () => {
    const container = document.createElement('div');
    if (this.props.getContainer) {
      this.props.getContainer().appendChild(container);
    } else {
      document.body.appendChild(container);
    }
    return container;
  }

  render() {
    const { visible } = this.props;

    let portal: any = null;

    if (!IS_REACT_16) {
      return (
        <ContainerRender
          parent={this}
          visible={visible}
          autoDestroy={false}
          getComponent={this.getComponent}
          getContainer={this.getContainer}
        >
          {({ renderComponent, removeContainer }: { renderComponent: any, removeContainer: any }) => {
            this.renderComponent = renderComponent;
            this.removeContainer = removeContainer;
            return null;
          }}
        </ContainerRender>
      );
    }

    // 可见 或者 this._component被定义（就是窗口已经存在，准备关闭，不在这里直接关闭，而是通过内部用动画关闭）
    if (visible || this._component) {
      portal = (
        <Portal getContainer={this.getContainer}>
          {this.getComponent()}
        </Portal>
      );
    }

    return portal;
  }
}

export default DialogWrap;


```