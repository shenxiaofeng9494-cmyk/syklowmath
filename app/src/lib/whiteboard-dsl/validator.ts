/**
 * DSL Validator
 *
 * JSON Schema 校验
 */

// 命令名称列表
const VALID_COMMANDS = [
  "DrawCoordinatePlane",
  "PlotFunction",
  "ConstructTriangle",
  "ConstructCircle",
  "DrawAngle",
  "DrawLineSegment",
  "CreateFlowchart",
  "CreateMindmap",
  "ShowCorrectWrong",
  "AddLabel",
  "AddArrow",
] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证 DSL 脚本
 */
export function validateDSL(script: unknown): ValidationResult {
  const errors: string[] = [];

  // 基本结构检查
  if (!script || typeof script !== "object") {
    return { valid: false, errors: ["Script must be an object"] };
  }

  const s = script as Record<string, unknown>;

  if (!Array.isArray(s.commands)) {
    return { valid: false, errors: ["Script must have a 'commands' array"] };
  }

  // 验证每个命令
  s.commands.forEach((cmd, index) => {
    const cmdErrors = validateCommand(cmd, index);
    errors.push(...cmdErrors);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证单个命令
 */
function validateCommand(cmd: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Command[${index}]`;

  if (!cmd || typeof cmd !== "object") {
    return [`${prefix}: Must be an object`];
  }

  const c = cmd as Record<string, unknown>;

  // 检查命令名称
  if (typeof c.command !== "string") {
    errors.push(`${prefix}: Missing 'command' field`);
  } else if (!VALID_COMMANDS.includes(c.command as typeof VALID_COMMANDS[number])) {
    errors.push(`${prefix}: Unknown command '${c.command}'`);
  }

  // 检查参数
  if (!c.params || typeof c.params !== "object") {
    errors.push(`${prefix}: Missing 'params' object`);
  } else {
    // 根据命令类型验证参数
    const paramErrors = validateParams(c.command as string, c.params, prefix);
    errors.push(...paramErrors);
  }

  return errors;
}

/**
 * 验证命令参数
 */
function validateParams(
  command: string,
  params: unknown,
  prefix: string
): string[] {
  const errors: string[] = [];
  const p = params as Record<string, unknown>;

  switch (command) {
    case "DrawCoordinatePlane":
      if (!isRange(p.xRange)) {
        errors.push(`${prefix}: xRange must be [number, number]`);
      }
      if (!isRange(p.yRange)) {
        errors.push(`${prefix}: yRange must be [number, number]`);
      }
      break;

    case "PlotFunction":
      if (typeof p.expression !== "string") {
        errors.push(`${prefix}: expression must be a string`);
      }
      break;

    case "ConstructTriangle":
      if (!p.vertices || typeof p.vertices !== "object") {
        errors.push(`${prefix}: vertices must be an object with A, B, C points`);
      } else {
        const v = p.vertices as Record<string, unknown>;
        if (!isPoint(v.A)) errors.push(`${prefix}: vertices.A must be a point`);
        if (!isPoint(v.B)) errors.push(`${prefix}: vertices.B must be a point`);
        if (!isPoint(v.C)) errors.push(`${prefix}: vertices.C must be a point`);
      }
      break;

    case "ConstructCircle":
      if (!isPoint(p.center)) {
        errors.push(`${prefix}: center must be a point`);
      }
      if (typeof p.radius !== "number" || p.radius <= 0) {
        errors.push(`${prefix}: radius must be a positive number`);
      }
      break;

    case "DrawAngle":
      if (!isPoint(p.vertex)) {
        errors.push(`${prefix}: vertex must be a point`);
      }
      if (!isPoint(p.ray1End)) {
        errors.push(`${prefix}: ray1End must be a point`);
      }
      if (!isPoint(p.ray2End)) {
        errors.push(`${prefix}: ray2End must be a point`);
      }
      break;

    case "DrawLineSegment":
      if (!isPoint(p.start)) {
        errors.push(`${prefix}: start must be a point`);
      }
      if (!isPoint(p.end)) {
        errors.push(`${prefix}: end must be a point`);
      }
      break;

    case "CreateFlowchart":
      if (!Array.isArray(p.steps) || p.steps.length === 0) {
        errors.push(`${prefix}: steps must be a non-empty array`);
      }
      break;

    case "CreateMindmap":
      if (typeof p.center !== "string") {
        errors.push(`${prefix}: center must be a string`);
      }
      if (!Array.isArray(p.branches) || p.branches.length === 0) {
        errors.push(`${prefix}: branches must be a non-empty array`);
      }
      break;

    case "ShowCorrectWrong":
      if (typeof p.correct !== "string") {
        errors.push(`${prefix}: correct must be a string`);
      }
      if (typeof p.wrong !== "string") {
        errors.push(`${prefix}: wrong must be a string`);
      }
      break;

    case "AddLabel":
      if (typeof p.text !== "string") {
        errors.push(`${prefix}: text must be a string`);
      }
      if (!isPoint(p.position)) {
        errors.push(`${prefix}: position must be a point`);
      }
      break;

    case "AddArrow":
      if (!isPoint(p.from)) {
        errors.push(`${prefix}: from must be a point`);
      }
      if (!isPoint(p.to)) {
        errors.push(`${prefix}: to must be a point`);
      }
      break;
  }

  return errors;
}

// ============ 类型检查辅助函数 ============

function isPoint(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.x === "number" && typeof p.y === "number";
}

function isRange(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2) return false;
  return typeof value[0] === "number" && typeof value[1] === "number";
}
