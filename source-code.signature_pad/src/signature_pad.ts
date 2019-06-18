/**
 * The main idea and some parts of the code (e.g. drawing variable width Bézier curve) are taken from:
 * http://corner.squareup.com/2012/07/smoother-signatures.html
 *
 * Implementation of interpolation using cubic Bézier curves is taken from:
 * http://www.benknowscode.com/2012/09/path-interpolation-using-cubic-bezier_9742.html
 *
 * Algorithm for approximated length of a Bézier curve is taken from:
 * http://www.lemoda.net/maths/bezier-length/index.html
 */

import { Bezier } from './bezier';
import { IBasicPoint, Point } from './point';
import { throttle } from './throttle';

declare global {
  // tslint:disable-next-line:interface-name
  interface Window {
    PointerEvent: typeof PointerEvent;
  }
}

export interface IOptions {
  // 点的大小(不是线条)
  dotSize?: number | (() => number);
  // 最粗的线条宽度
  minWidth?: number;
  // 最细的线条宽度
  maxWidth?: number;
  // 最小间隔距离(这个距离用贝塞尔曲线填充)
  minDistance?: number;
  // 背景色
  backgroundColor?: string;
  // 笔颜色
  penColor?: string;
  // 节流的间隔
  throttle?: number;
  // 当前画笔速度的计算率，默认0.7，意思就是 当前速度=当前实际速度*0.7+上一次速度*0.3
  velocityFilterWeight?: number;
  // 初始回调
  onBegin?: (event: MouseEvent | Touch) => void;
  // 结束回调
  onEnd?: (event: MouseEvent | Touch) => void;
}

export interface IPointGroup {
  color: string;
  points: IBasicPoint[];
}

export default class SignaturePad {
  // Public stuff
  public dotSize: number | (() => number);
  public minWidth: number;
  public maxWidth: number;
  public minDistance: number;
  public backgroundColor: string;
  public penColor: string;
  public throttle: number;
  public velocityFilterWeight: number;
  public onBegin?: (event: MouseEvent | Touch) => void;
  public onEnd?: (event: MouseEvent | Touch) => void;

  // Private stuff
  /* tslint:disable: variable-name */
  private _ctx: CanvasRenderingContext2D;
  private _mouseButtonDown: boolean;
  private _isEmpty: boolean;
  private _lastPoints: Point[]; // Stores up to 4 most recent points; used to generate a new curve
  private _data: IPointGroup[]; // Stores all points in groups (one group per line or dot)
  private _lastVelocity: number;
  private _lastWidth: number;
  private _strokeMoveUpdate: (event: MouseEvent | Touch) => void;
  /* tslint:enable: variable-name */

  constructor(
    private canvas: HTMLCanvasElement,
    private options: IOptions = {},
  ) {
    // 定义默认值
    this.velocityFilterWeight = options.velocityFilterWeight || 0.7;
    this.minWidth = options.minWidth || 0.5;
    this.maxWidth = options.maxWidth || 2.5;
    this.throttle = ('throttle' in options ? options.throttle : 16) as number; // in milisecondss
    this.minDistance = ('minDistance' in options
      ? options.minDistance
      : 5) as number; // in pixels

    if (this.throttle) {
      this._strokeMoveUpdate = throttle(
        SignaturePad.prototype._strokeUpdate,
        this.throttle,
      );
    } else {
      this._strokeMoveUpdate = SignaturePad.prototype._strokeUpdate;
    }

    this.dotSize =
      options.dotSize ||
      function dotSize(this: SignaturePad) {
        return (this.minWidth + this.maxWidth) / 2;
      };
    this.penColor = options.penColor || 'black';
    this.backgroundColor = options.backgroundColor || 'rgba(0,0,0,0)';
    this.onBegin = options.onBegin;
    this.onEnd = options.onEnd;

    this._ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    // 初始化先归零
    this.clear();

    // Enable mouse and touch event handlers
    // 注册事件，包括down,move,up，优先使用PointerEvent
    this.on();
  }

  public clear(): void {
    const ctx = this._ctx;
    const canvas = this.canvas;

    // Clear canvas using background color
    ctx.fillStyle = this.backgroundColor;
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 填充画布背景色
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 这个画布上所有点的数据，内部是一个个的点集(点集也就是一笔画中的所有点的位置和颜色)
    this._data = [];
    // 重置线条属性(每次开始新线条时执行)
    this._reset();
    this._isEmpty = true;
  }

  public fromDataURL(
    dataUrl: string,
    options: { ratio?: number; width?: number; height?: number } = {},
    callback?: (error?: ErrorEvent) => void,
  ): void {
    const image = new Image();
    const ratio = options.ratio || window.devicePixelRatio || 1;
    const width = options.width || this.canvas.width / ratio;
    const height = options.height || this.canvas.height / ratio;
    // 重置线条属性(每次开始新线条时执行)
    this._reset();

    image.onload = () => {
      this._ctx.drawImage(image, 0, 0, width, height);
      if (callback) {
        callback();
      }
    };
    image.onerror = (error) => {
      if (callback) {
        callback(error);
      }
    };
    image.src = dataUrl;

    this._isEmpty = false;
  }

  public toDataURL(type = 'image/png', encoderOptions?: number) {
    switch (type) {
      case 'image/svg+xml':
        return this._toSVG();
      default:
        return this.canvas.toDataURL(type, encoderOptions);
    }
  }

  // 注册事件
  public on(): void {
    // 对canvas元素禁止默认的触屏滑动
    // Disable panning/zooming when touching canvas element
    this.canvas.style.touchAction = 'none';
    this.canvas.style.msTouchAction = 'none';

    // window.PointerEvent指存在触点的事件状态
    if (window.PointerEvent) {
      // 注册触点事件
      this._handlePointerEvents();
    } else {
      // 注册鼠标事件
      this._handleMouseEvents();
      // 注册touch事件
      if ('ontouchstart' in window) {
        this._handleTouchEvents();
      }
    }
  }

  // 注销事件
  public off(): void {
    // Enable panning/zooming when touching canvas element
    this.canvas.style.touchAction = 'auto';
    this.canvas.style.msTouchAction = 'auto';

    this.canvas.removeEventListener('pointerdown', this._handleMouseDown);
    this.canvas.removeEventListener('pointermove', this._handleMouseMove);
    document.removeEventListener('pointerup', this._handleMouseUp);

    this.canvas.removeEventListener('mousedown', this._handleMouseDown);
    this.canvas.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);

    this.canvas.removeEventListener('touchstart', this._handleTouchStart);
    this.canvas.removeEventListener('touchmove', this._handleTouchMove);
    this.canvas.removeEventListener('touchend', this._handleTouchEnd);
  }

  public isEmpty(): boolean {
    return this._isEmpty;
  }

  // 传入自定义数据并且画出，传入的数据pointGroups格式与this._data一致
  public fromData(pointGroups: IPointGroup[]): void {
    this.clear();
    this._fromData(
      pointGroups,
      ({ color, curve }) => this._drawCurve({ color, curve }),
      ({ color, point }) => this._drawDot({ color, point }),
    );

    this._data = pointGroups;
  }

  public toData(): IPointGroup[] {
    return this._data;
  }

  // Event handlers
  private _handleMouseDown = (event: MouseEvent): void => {
    // 如果是鼠标检查是否点击左键
    if (event.which === 1) {
      // 更新状态
      this._mouseButtonDown = true;
      this._strokeBegin(event);
    }
  };

  private _handleMouseMove = (event: MouseEvent): void => {
    if (this._mouseButtonDown) {
      // _strokeMoveUpdate就是通过throttle配置后的 _strokeUpdate
      // _strokeUpdate 用于判断当前点是否需要画出和是否需要画出曲线并且执行canvas
      this._strokeMoveUpdate(event);
    }
  };

  private _handleMouseUp = (event: MouseEvent): void => {
    if (event.which === 1 && this._mouseButtonDown) {
      // 改变状态
      this._mouseButtonDown = false;
      // 再画出当前点，并且执行onEnd回调
      this._strokeEnd(event);
    }
  };

  // 逻辑与 _handleMouseDown 一致
  private _handleTouchStart = (event: TouchEvent): void => {
    // Prevent scrolling.
    event.preventDefault();
    // 只存在一个触点
    if (event.targetTouches.length === 1) {
      // 获取当前这个触点对应的事件
      const touch = event.changedTouches[0];
      this._strokeBegin(touch);
    }
  };

  // 逻辑与 _handleMouseMove 一致
  private _handleTouchMove = (event: TouchEvent): void => {
    // Prevent scrolling.
    event.preventDefault();

    const touch = event.targetTouches[0];
    this._strokeMoveUpdate(touch);
  };

  private _handleTouchEnd = (event: TouchEvent): void => {
    // todo 这里只有在canvas元素上touchEnd才会终止笔画 ?
    const wasCanvasTouched = event.target === this.canvas;
    if (wasCanvasTouched) {
      event.preventDefault();

      const touch = event.changedTouches[0];
      this._strokeEnd(touch);
    }
  };

  // Private methods
  private _strokeBegin(event: MouseEvent | Touch): void {
    const newPointGroup = {
      color: this.penColor,
      points: [],
    };

    // 处理回调
    if (typeof this.onBegin === 'function') {
      this.onBegin(event);
    }

    // 添加当前这一条线的点集到总数据中
    this._data.push(newPointGroup);
    // 重置线条属性(每次开始新线条时执行)
    this._reset();
    // 判断当前点是否需要画出和是否需要画出曲线并且执行canvas
    this._strokeUpdate(event);
  }

  // 判断当前点是否需要画出和是否需要画出曲线并且执行canvas
  private _strokeUpdate(event: MouseEvent | Touch): void {
    // 获取当前触点的位置
    const x = event.clientX;
    const y = event.clientY;

    // 创建点
    const point = this._createPoint(x, y);
    // 调出最后一个点集
    const lastPointGroup = this._data[this._data.length - 1];
    // 获取最后一个点集的点的数组
    const lastPoints = lastPointGroup.points;
    // 如果存在上一个点，获取上一个点
    const lastPoint =
      lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
    // 判断上一个点到当前点是否太近(也就是小于配置的最小间隔距离)
    const isLastPointTooClose = lastPoint
      ? point.distanceTo(lastPoint) <= this.minDistance
      : false;
    // 调出点集的颜色
    const color = lastPointGroup.color;

    // Skip this point if it's too close to the previous one
    // 存在上一个点但是太近，跳过，其余的执行
    if (!lastPoint || !(lastPoint && isLastPointTooClose)) {
      // 向上一次的点数组中添加当前点，并且生成一个新的贝塞尔曲线实例
      // 包括4个点 （初始点，2个控制点，结束点）
      // 初始宽度，最终宽度
      const curve = this._addPoint(point);

      // 如果不存在lastPoint，即当前点是第一个点
      if (!lastPoint) {
        // 画一个点
        this._drawDot({ color, point });
      // 如果存在lastPoint 并且能形成一个贝塞尔曲线实例(3个点以上)
      } else if (curve) {
        // 画出参数中curve实例中两点之间的曲线
        this._drawCurve({ color, curve });
      }
      // 添加到当前笔画的点数组
      lastPoints.push({
        time: point.time,
        x: point.x,
        y: point.y,
      });
    }
  }

  private _strokeEnd(event: MouseEvent | Touch): void {
    // 判断当前点是否需要画出和是否需要画出曲线并且执行canvas
    this._strokeUpdate(event);

    if (typeof this.onEnd === 'function') {
      this.onEnd(event);
    }
  }

  private _handlePointerEvents(): void {
    this._mouseButtonDown = false;
    // 分别注册 pointerdown, pointermove, pointerup 事件
    this.canvas.addEventListener('pointerdown', this._handleMouseDown);
    this.canvas.addEventListener('pointermove', this._handleMouseMove);
    document.addEventListener('pointerup', this._handleMouseUp);
  }

  private _handleMouseEvents(): void {
    this._mouseButtonDown = false;

    this.canvas.addEventListener('mousedown', this._handleMouseDown);
    this.canvas.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }

  private _handleTouchEvents(): void {
    this.canvas.addEventListener('touchstart', this._handleTouchStart);
    this.canvas.addEventListener('touchmove', this._handleTouchMove);
    this.canvas.addEventListener('touchend', this._handleTouchEnd);
  }

  // 重置线条属性(每次开始新线条时执行)
  // Called when a new line is started
  private _reset(): void {
    this._lastPoints = [];
    this._lastVelocity = 0;
    this._lastWidth = (this.minWidth + this.maxWidth) / 2;
    this._ctx.fillStyle = this.penColor;
  }

  private _createPoint(x: number, y: number): Point {
    // 获取canvas画布距离视口的参数，为了计算出当前点的位置距离canvas画布的位置
    const rect = this.canvas.getBoundingClientRect();

    // 返回一个点对象
    return new Point(x - rect.left, y - rect.top, new Date().getTime());
  }

  // 向上一次的点数组中添加当前点，并且生成一个新的贝塞尔曲线实例
  // Add point to _lastPoints array and generate a new curve if there are enough points (i.e. 3)
  private _addPoint(point: Point): Bezier | null {
    const { _lastPoints } = this;

    _lastPoints.push(point);
    // 如果点数组中至少有3个点
    if (_lastPoints.length > 2) {
      // To reduce the initial lag make it work with 3 points
      // by copying the first point to the beginning.
      // 如果点数组中刚好3个点，复制一次第一个点，为了计算前面一次IDE曲线
      // 例如*1  *2   *3， 复制后为  *1  *1   *2   *3
      // 计算的曲线为 *1 --- *2 这一部分
      if (_lastPoints.length === 3) {
        _lastPoints.unshift(_lastPoints[0]);
      }

      // _points array will always have 4 points here.
      // 计算当前曲线的线条宽度
      const widths = this._calculateCurveWidths(_lastPoints[1], _lastPoints[2]);
      // 贝塞尔曲线算法
      // curve是一个贝塞尔曲线实例
      // 包括4个点 （初始点，2个控制点，结束点）
      // 初始宽度，最终宽度
      const curve = Bezier.fromPoints(_lastPoints, widths);

      // 删除数组首个，保证每次都是4个点
      // Remove the first element from the list, so that there are no more than 4 points at any time.
      _lastPoints.shift();

      return curve;
    }

    return null;
  }

  // 计算当前曲线的线条宽度
  private _calculateCurveWidths(
    startPoint: Point,
    endPoint: Point,
  ): { start: number; end: number } {
    // 通过配置的velocityFilterWeight 计算速度
    const velocity =
      this.velocityFilterWeight * endPoint.velocityFrom(startPoint) +
      (1 - this.velocityFilterWeight) * this._lastVelocity;

    // 通过速度计算出当前线条粗细
    const newWidth = this._strokeWidth(velocity);

    // 返回上一次的宽度和这一次的宽度
    const widths = {
      end: newWidth,
      start: this._lastWidth,
    };

    // 更新
    this._lastVelocity = velocity;
    this._lastWidth = newWidth;

    return widths;
  }

  // 通过速度计算出当前线条粗细
  private _strokeWidth(velocity: number): number {
    return Math.max(this.maxWidth / (velocity + 1), this.minWidth);
  }

  // 画一个点的方法
  private _drawCurveSegment(x: number, y: number, width: number): void {
    const ctx = this._ctx;

    ctx.moveTo(x, y);
    ctx.arc(x, y, width, 0, 2 * Math.PI, false);
    this._isEmpty = false;
  }

  // 画出参数中curve实例中两点之间的曲线
  private _drawCurve({ color, curve }: { color: string; curve: Bezier }): void {
    const ctx = this._ctx;
    // 宽度的差距
    const widthDelta = curve.endWidth - curve.startWidth;
    // '2' is just an arbitrary number here. If only length is used, then
    // there are gaps between curve segments :/
    // drawSteps是对于这个curve内的两点需要画点从而形成一条线的次数
    // 这里是比起早起版本的一个改进，这里 2 比较随意的一个值，当然效果看起来很不错
    // 如果这里只是使用curve.length()，那么其实还是会有间隔，导致线条看起来不流畅
    const drawSteps = Math.floor(curve.length()) * 2;

    ctx.beginPath();
    ctx.fillStyle = color;

    // 计算出每一次画点的位置和点的大小
    for (let i = 0; i < drawSteps; i += 1) {
      // Calculate the Bezier (x, y) coordinate for this step.
      const t = i / drawSteps;
      const tt = t * t;
      const ttt = tt * t;
      const u = 1 - t;
      const uu = u * u;
      const uuu = uu * u;

      let x = uuu * curve.startPoint.x;
      x += 3 * uu * t * curve.control1.x;
      x += 3 * u * tt * curve.control2.x;
      x += ttt * curve.endPoint.x;

      let y = uuu * curve.startPoint.y;
      y += 3 * uu * t * curve.control1.y;
      y += 3 * u * tt * curve.control2.y;
      y += ttt * curve.endPoint.y;

      const width = Math.min(curve.startWidth + ttt * widthDelta, this.maxWidth);
      this._drawCurveSegment(x, y, width);
    }

    ctx.closePath();
    ctx.fill();
  }

  // 画点的方法
  private _drawDot({
    color,
    point,
  }: {
    color: string;
    point: IBasicPoint;
  }): void {
    const ctx = this._ctx;
    const width =
      typeof this.dotSize === 'function' ? this.dotSize() : this.dotSize;

    ctx.beginPath();
    // 这里曲线都是通过每一个点画出来，_drawCurveSegment就是画出其中一个点
    this._drawCurveSegment(point.x, point.y, width);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // 对传入的数据处理并且画出，传入的数据pointGroups格式与this._data一致
  private _fromData(
    pointGroups: IPointGroup[],
    drawCurve: SignaturePad['_drawCurve'],
    drawDot: SignaturePad['_drawDot'],
  ): void {
    for (const group of pointGroups) {
      const { color, points } = group;
      // 有多个点，画线
      if (points.length > 1) {
        for (let j = 0; j < points.length; j += 1) {
          const basicPoint = points[j];
          const point = new Point(basicPoint.x, basicPoint.y, basicPoint.time);

          // All points in the group have the same color, so it's enough to set
          // penColor just at the beginning.
          this.penColor = color;
          // 第一个点，作为一笔画的开端，先归零
          if (j === 0) {
            this._reset();
          }

          // 处理后续的点
          const curve = this._addPoint(point);

          if (curve) {
            drawCurve({ color, curve });
          }
        }
      } else {
        // 只存在一个点，画点
        this._reset();

        drawDot({
          color,
          point: points[0],
        });
      }
    }
  }

  // 转换为SVG
  private _toSVG(): string {
    const pointGroups = this._data;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const minX = 0;
    const minY = 0;
    const maxX = this.canvas.width / ratio;
    const maxY = this.canvas.height / ratio;
    // 创建元素，设置宽高
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('width', this.canvas.width.toString());
    svg.setAttribute('height', this.canvas.height.toString());

    // 对当前 this._data 处理，通过自定义的 drawCurve 和 drawDot 为SVG方法
    this._fromData(
      pointGroups,

      ({ color, curve }: { color: string; curve: Bezier }) => {
        const path = document.createElement('path');

        // Need to check curve for NaN values, these pop up when drawing
        // lines on the canvas that are not continuous. E.g. Sharp corners
        // or stopping mid-stroke and than continuing without lifting mouse.
        /* eslint-disable no-restricted-globals */
        if (
          !isNaN(curve.control1.x) &&
          !isNaN(curve.control1.y) &&
          !isNaN(curve.control2.x) &&
          !isNaN(curve.control2.y)
        ) {
          const attr =
            `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(
              3,
            )} ` +
            `C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ` +
            `${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ` +
            `${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;
          path.setAttribute('d', attr);
          path.setAttribute('stroke-width', (curve.endWidth * 2.25).toFixed(3));
          path.setAttribute('stroke', color);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-linecap', 'round');

          svg.appendChild(path);
        }
        /* eslint-enable no-restricted-globals */
      },

      ({ color, point }: { color: string; point: IBasicPoint }) => {
        const circle = document.createElement('circle');
        const dotSize =
          typeof this.dotSize === 'function' ? this.dotSize() : this.dotSize;
        circle.setAttribute('r', dotSize.toString());
        circle.setAttribute('cx', point.x.toString());
        circle.setAttribute('cy', point.y.toString());
        circle.setAttribute('fill', color);

        svg.appendChild(circle);
      },
    );

    const prefix = 'data:image/svg+xml;base64,';
    const header =
      '<svg' +
      ' xmlns="http://www.w3.org/2000/svg"' +
      ' xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ` viewBox="${minX} ${minY} ${maxX} ${maxY}"` +
      ` width="${maxX}"` +
      ` height="${maxY}"` +
      '>';
    let body = svg.innerHTML;

    // IE hack for missing innerHTML property on SVGElement
    if (body === undefined) {
      const dummy = document.createElement('dummy');
      const nodes = svg.childNodes;
      dummy.innerHTML = '';

      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < nodes.length; i += 1) {
        dummy.appendChild(nodes[i].cloneNode(true));
      }

      body = dummy.innerHTML;
    }

    const footer = '</svg>';
    const data = header + body + footer;

    return prefix + btoa(data);
  }
}
