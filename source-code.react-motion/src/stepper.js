/* @flow */

// stepper is used a lot. Saves allocation to return the same array wrapper.
// This is fine and danger-free against mutations because the callsite
// immediately destructures it and gets the numbers inside without passing the
// array reference around.
let reusedTuple: [number, number] = [0, 0];
export default function stepper(
  // 每一帧所用秒数
  secondPerFrame: number,
  // 当前位置
  x: number,
  // 当前速度
  v: number,
  // 目标位置
  destX: number,
  // 弹性
  k: number,
  // 阻力
  b: number,
  // 精度(用于停止动画)
  precision: number): [number, number] {
  // Spring stiffness, in kg / s^2

  // for animations, destX is really spring length (spring at rest). initial
  // position is considered as the stretched/compressed position of a spring
  // 计算当前弹性力(离目标越近，弹性越小)
  const Fspring = -k * (x - destX);

  // Damping, in kg / s
  // 计算当前阻力(速度越快，阻力越大)
  const Fdamper = -b * v;

  // usually we put mass here, but for animation purposes, specifying mass is a
  // bit redundant. you could simply adjust k and b accordingly
  // let a = (Fspring + Fdamper) / mass;
  // 当前加速度，忽略质量
  const a = Fspring + Fdamper;

  // 新的速度
  const newV = v + a * secondPerFrame;
  // 新的位置
  const newX = x + newV * secondPerFrame;

  // 停止动画的条件，小于当前精度，则速度为0，位置为目标
  if (Math.abs(newV) < precision && Math.abs(newX - destX) < precision) {
    reusedTuple[0] = destX;
    reusedTuple[1] = 0;
    return reusedTuple;
  }

  // 返回
  reusedTuple[0] = newX;
  reusedTuple[1] = newV;
  return reusedTuple;
}
