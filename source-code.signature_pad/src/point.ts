// Interface for point data structure used e.g. in SignaturePad#fromData method
export interface IBasicPoint {
  x: number;
  y: number;
  time: number;
}

// 建立点的对象
export class Point implements IBasicPoint {
  public time: number;

  constructor(public x: number, public y: number, time?: number) {
    this.time = time || Date.now();
  }

  // 计算当前点到 start 的直线距离
  public distanceTo(start: IBasicPoint): number {
    return Math.sqrt(
      Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2),
    );
  }

  // 判断两个点对象是否完全相同
  public equals(other: IBasicPoint): boolean {
    return this.x === other.x && this.y === other.y && this.time === other.time;
  }

  // 计算从 start 点到当前点的速度 v=△s/△t
  public velocityFrom(start: IBasicPoint): number {
    return this.time !== start.time
      ? this.distanceTo(start) / (this.time - start.time)
      : 0;
  }
}
