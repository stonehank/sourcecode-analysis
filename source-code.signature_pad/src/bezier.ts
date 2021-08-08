import { IBasicPoint, Point } from './point';

export class Bezier {
  public static fromPoints(
    points: Point[],
    widths: { start: number; end: number },
  ): Bezier {
    // 计算point[1]和point[2]之间的控制点
    const c2 = this.calculateControlPoints(points[0], points[1], points[2]).c2;
    // 计算point[1]和point[2]之间的控制点
    const c3 = this.calculateControlPoints(points[1], points[2], points[3]).c1;

    // 返回一个 Bezier对象
    return new Bezier(points[1], c2, c3, points[2], widths.start, widths.end);
  }

  private static calculateControlPoints(
    s1: IBasicPoint,
    s2: IBasicPoint,
    s3: IBasicPoint,
  ): {
    c1: IBasicPoint;
    c2: IBasicPoint;
  } {
    // 点1和点2的x差值
    const dx1 = s1.x - s2.x;
    // 点1和点2的y差值
    const dy1 = s1.y - s2.y;
    // 点2和点3的x差值
    const dx2 = s2.x - s3.x;
    // 点2和点3的y差值
    const dy2 = s2.y - s3.y;

    // m1为 点1和点2的中点
    const m1 = { x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0 };
    // m2为 点2和点3的中点
    const m2 = { x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0 };

    // l1为点1到点2的距离
    const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    // l2为点2到点3的距离
    const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // dxm为两个中点的x差值
    const dxm = m1.x - m2.x;
    // dym为两个中点的y差值
    const dym = m1.y - m2.y;

    // k为点2到点3的距离比例
    const k = l2 / (l1 + l2);
    const cm = { x: m2.x + dxm * k, y: m2.y + dym * k };

    const tx = s2.x - cm.x;
    const ty = s2.y - cm.y;

    return {
      c1: new Point(m1.x + tx, m1.y + ty),
      c2: new Point(m2.x + tx, m2.y + ty),
    };
  }

  constructor(
    public startPoint: Point,
    public control2: IBasicPoint,
    public control1: IBasicPoint,
    public endPoint: Point,
    public startWidth: number,
    public endWidth: number,
  ) {}

  // 根据贝塞尔曲线算法算出从this.startPoint 到 this.endPoint 中间需要多少个点
  // Returns approximated length. Code taken from https://www.lemoda.net/maths/bezier-length/index.html.
  public length(): number {
    const steps = 10;
    let length = 0;
    let px;
    let py;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const cx = this.point(
        t,
        this.startPoint.x,
        this.control1.x,
        this.control2.x,
        this.endPoint.x,
      );
      const cy = this.point(
        t,
        this.startPoint.y,
        this.control1.y,
        this.control2.y,
        this.endPoint.y,
      );

      if (i > 0) {
        const xdiff = cx - (px as number);
        const ydiff = cy - (py as number);

        length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
      }

      px = cx;
      py = cy;
    }

    return length;
  }

  // Calculate parametric value of x or y given t and the four point coordinates of a cubic bezier curve.
  private point(
    t: number,
    start: number,
    c1: number,
    c2: number,
    end: number,
  ): number {
    // prettier-ignore
    return (       start * (1.0 - t) * (1.0 - t)  * (1.0 - t))
         + (3.0 *  c1    * (1.0 - t) * (1.0 - t)  * t)
         + (3.0 *  c2    * (1.0 - t) * t          * t)
         + (       end   * t         * t          * t);
  }
}