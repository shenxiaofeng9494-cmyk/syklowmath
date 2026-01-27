/**
 * Command Registry
 *
 * 命令注册表，统一导出所有命令处理器
 */

export { drawCoordinatePlane, plotFunction } from "./coordinate";
export {
  constructTriangle,
  constructCircle,
  drawAngle,
  drawLineSegment,
} from "./geometry";
export {
  createFlowchart,
  createMindmap,
  showCorrectWrong,
  addLabel,
  addArrow,
} from "./diagrams";
