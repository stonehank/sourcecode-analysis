## Card组件


整体：
* Card组件
* componentDidMount会检查宽度，调整padding
* 当传入loading时，会渲染loadingBlock，一个loading模板
* 
* 渲染后的排版格式大致如下：
*     ___________________
      |title       extra|
      |tabs|tabs|tabs...| head
      |_________________|
      |______cover______| cover
      |____children_____| children/Meta/Grid
      |                 |
      |action|action|...| action按百分比分配
      |_________________| 

注意：
1. typescript 装饰方法
    ```jsx
    Class XXX{
       @someDecorator()
       someMethod(){
       //doing something 
       }
    }
    someDecorator=()=>(target,key,descriptor)=>{
       //3个参数分别是
       //传入类的（如果是静态成员）构造函数或者（如果是实例成员）类的原型，成员的key，成员的属性描述
       //此处分别是XXX.__proto__,"someDecorator",someDecorator
       // some code...
       return {
        // this here is XXX(Class XXX)
        configurable:true,
        get:()=>{   
           //getter
           }
       }
    }
    ```
    
源码：  
```jsx
import * as React from 'react';
import classNames from 'classnames';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import omit from 'omit.js';
import Grid from './Grid';
import Meta from './Meta';
import Tabs from '../tabs';
import Row from '../row';
import Col from '../col';
import { throttleByAnimationFrameDecorator } from '../_util/throttleByAnimationFrame';
import warning from '../_util/warning';
import { Omit } from '../_util/type';

// Grid 写<Card.Grid>放入children中
// 分格，默认宽度33%
export { CardGridProps } from './Grid';
// Meta 写<Card.Meta> 放入children中
// 可以定义头像，标题，内容
/*
* ______________________
* |avatar| title       |
* |      | //此处BFC   |
* |      | description |
* |______|_____________|
*
*
*/
export { CardMetaProps } from './Meta';

export type CardType = 'inner';

export interface CardTabListType {
  key: string;
  tab: React.ReactNode;
}

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  prefixCls?: string;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  bordered?: boolean;
  bodyStyle?: React.CSSProperties;
  style?: React.CSSProperties;
  loading?: boolean;
  noHovering?: boolean;
  hoverable?: boolean;
  children?: React.ReactNode;
  id?: string;
  className?: string;
  type?: CardType;
  cover?: React.ReactNode;
  actions?: Array<React.ReactNode>;
  tabList?: CardTabListType[];
  onTabChange?: (key: string) => void;
  activeTabKey?: string;
  defaultActiveTabKey?: string;
}

export interface CardState {
  widerPadding: boolean;
}

export default class Card extends React.Component<CardProps, CardState> {
  static Grid: typeof Grid = Grid;
  static Meta: typeof Meta = Meta;

  state = {
    widerPadding: false,
  };

  private resizeEvent: any;
  private updateWiderPaddingCalled: boolean = false;
  private container: HTMLDivElement;
  componentDidMount() {
    //判断宽度是否小于936，并根据判断修改属性
    this.updateWiderPadding();
    // 订阅resize事件，updateWiderPadding在每次resize触发的时候执行
    this.resizeEvent = addEventListener(window, 'resize', this.updateWiderPadding);

    // 当存在noHovering，发出warning
    if ('noHovering' in this.props) {
      warning(
        !this.props.noHovering,
        '`noHovering` of Card is deprecated, you can remove it safely or use `hoverable` instead.',
      );
      warning(!!this.props.noHovering, '`noHovering={false}` of Card is deprecated, use `hoverable` instead.');
    }
  }
  componentWillUnmount() {
    // 解绑事件
    if (this.resizeEvent) {
      this.resizeEvent.remove();
    }
    // 解绑 requestAnimationFrame
    (this.updateWiderPadding as any).cancel();
  }
  // 装饰方法
  // 返回值是一个属性描述对象，其中有updateWiderPadding的getter，绑定了 requestAnimationFrame
  // updateWiderPadding会在resize事件中不断执行，通过装饰方法，绑定了 requestAnimationFrame（更流畅）
  @throttleByAnimationFrameDecorator()
  // 判断 container宽度从而改变 className
  updateWiderPadding() {
    if (!this.container) {
      return;
    }
    // 936 is a magic card width pixel number indicated by designer
    const WIDTH_BOUNDARY_PX = 936;
    // 容器宽度大于等于936 设置 widerPadding,updateWiderPaddingCalled为true
    // setState第二个参数是回调
    if (this.container.offsetWidth >= WIDTH_BOUNDARY_PX && !this.state.widerPadding) {
      this.setState({ widerPadding: true }, () => {
        this.updateWiderPaddingCalled = true; // first render without css transition
      });
    }
    //  容器宽度小于936 设置 widerPadding,updateWiderPaddingCalled为false
    if (this.container.offsetWidth < WIDTH_BOUNDARY_PX && this.state.widerPadding) {
      this.setState({ widerPadding: false }, () => {
        this.updateWiderPaddingCalled = true; // first render without css transition
      });
    }
  }
  //绑定在tabs上，当tab改变时触发
  onTabChange = (key: string) => {
    if (this.props.onTabChange) {
      this.props.onTabChange(key);
    }
  }
  //当前容器的引用
  saveRef = (node: HTMLDivElement) => {
    this.container = node;
  }

  //React.Children准确的获取children，无论是1个还是多个

  isContainGrid() {
    let containGrid;
    React.Children.forEach(this.props.children, (element: JSX.Element) => {
      //如果children里面有Grid组件
      if (element && element.type && element.type === Grid) {
        containGrid = true;
      }
    });
    return containGrid;
  }
  // 将每个action放置到li标签中（平均分配宽度）
  getAction(actions: React.ReactNode[]) {
    if (!actions || !actions.length) {
      return null;
    }
    const actionList = actions.map((action, index) => (
        <li style={{ width: `${100 / actions.length}%` }} key={`action-${index}`}>
          <span>{action}</span>
        </li>
      ),
    );
    return actionList;
  }

  // 兼容noHovering
  // For 2.x compatible
  getCompatibleHoverable() {
    const { noHovering, hoverable } = this.props;
    if ('noHovering' in this.props) {
      return !noHovering || hoverable;
    }
    return !!hoverable;
  }
  render() {
    const {
      prefixCls = 'ant-card', className, extra, bodyStyle = {}, noHovering, hoverable, title, loading,
      bordered = true, type, cover, actions, tabList, children, activeTabKey, defaultActiveTabKey, ...others,
    } = this.props;

    //classNames 可以将以下class变为"xx1 xx2 xx3..."的格式
    //其中值为true，key成立，值为false，key不合并
    const classString = classNames(prefixCls, className, {
      [`${prefixCls}-loading`]: loading,
      [`${prefixCls}-bordered`]: bordered,
      [`${prefixCls}-hoverable`]: this.getCompatibleHoverable(),
      [`${prefixCls}-wider-padding`]: this.state.widerPadding,
      [`${prefixCls}-padding-transition`]: this.updateWiderPaddingCalled,
      // 判断children里是否有Grid组件，从而改变className
      [`${prefixCls}-contain-grid`]: this.isContainGrid(),
      [`${prefixCls}-contain-tabs`]: tabList && tabList.length,
      [`${prefixCls}-type-${type}`]: !!type,
    });

    //bodyStyle默认值是{}
    const loadingBlockStyle = (bodyStyle.padding === 0 || bodyStyle.padding === '0px')
      ? { padding: 24 } : undefined;

    const loadingBlock = (
      <div
        className={`${prefixCls}-loading-content`}
        style={loadingBlockStyle}
      >
        <Row gutter={8}>
          <Col span={22}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={15}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={6}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={18}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={13}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={9}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={4}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={3}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={16}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={6}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
          <Col span={8}>
            <div className={`${prefixCls}-loading-block`} />
          </Col>
        </Row>
      </div>
    );


    const hasActiveTabKey = activeTabKey !== undefined;

    //配置tab组件上的activeKey和defaultActiveKey
    const extraProps = {
      [hasActiveTabKey ? 'activeKey' : 'defaultActiveKey']: hasActiveTabKey
        ? activeTabKey
        : defaultActiveTabKey,
    };

    let head;
    // 添加tabs，具体查看tab
    const tabs = tabList && tabList.length ? (
      <Tabs
        {...extraProps}
        className={`${prefixCls}-head-tabs`}
        size="large"
        onChange={this.onTabChange}
      >
        {tabList.map(item => <Tabs.TabPane tab={item.tab} key={item.key} />)}
      </Tabs>
    ) : null;

    // 如果 head里面有内容
    // 自定义标题 || 右上角操作区域 || 标题标签
    /*___________________
    * |title       extra|
    * |tabs|tabs|tabs...|
    * |_________________|
    *
    * */
    if (title || extra || tabs) {
      head = (
        <div className={`${prefixCls}-head`}>
          <div className={`${prefixCls}-head-wrapper`}>
            {title && <div className={`${prefixCls}-head-title`}>{title}</div>}
            {extra && <div className={`${prefixCls}-extra`}>{extra}</div>}
          </div>
          {tabs}
        </div>
      );
    }
    // 有设置cover(封面)
    const coverDom = cover ? <div className={`${prefixCls}-cover`}>{cover}</div> : null;
    // body就是 this.props.children,需要loading则执行loadingBlock
    const body = (
      <div className={`${prefixCls}-body`} style={bodyStyle}>
        {loading ? loadingBlock : children}
      </div>
    );
    // 是否有传action（卡片操作区），放到底部
    const actionDom = actions && actions.length ?
      /*
      * ul
      *  li action
      *  li action
      *  ...
      */
      <ul className={`${prefixCls}-actions`}>{this.getAction(actions)}</ul> : null;

    // 一些自定义属性，去除了onTabChange
    const divProps = omit(others, [
      'onTabChange',
    ]);
    return (
      <div {...divProps} className={classString} ref={this.saveRef}>
        {head}
        {coverDom}
        {body}
        {actionDom}
      </div>
    );
  }
}

```