import fs from "fs";
import path from "path";

// Guide 元数据接口
export interface GuideMetadata {
  name: string;
  description: string;
}

// Guide 完整信息接口
export interface Guide {
  metadata: GuideMetadata;
  content: string;
  directory: string;
}

// Tool Guides 目录路径
const GUIDES_DIR = path.join(process.cwd(), "src/tool-guides");

/**
 * 解析 GUIDE.md 文件的 YAML frontmatter
 */
function parseFrontmatter(content: string): {
  metadata: GuideMetadata;
  body: string;
} {
  // Handle both LF (\n) and CRLF (\r\n) line endings
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error("Invalid GUIDE.md format: missing YAML frontmatter");
  }

  const [, yamlContent, body] = match;

  // 简单解析 YAML（name 和 description）
  const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
  const descMatch = yamlContent.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descMatch) {
    throw new Error(
      "Invalid GUIDE.md format: missing name or description in frontmatter"
    );
  }

  return {
    metadata: {
      name: nameMatch[1].trim(),
      description: descMatch[1].trim(),
    },
    body: body.trim(),
  };
}

/**
 * 获取所有可用 Guides 的元数据清单
 */
export function getAllGuidesMetadata(): GuideMetadata[] {
  const guides: GuideMetadata[] = [];

  if (!fs.existsSync(GUIDES_DIR)) {
    console.warn(`Tool guides directory not found: ${GUIDES_DIR}`);
    return guides;
  }

  const entries = fs.readdirSync(GUIDES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const guidePath = path.join(GUIDES_DIR, entry.name, "GUIDE.md");

      if (fs.existsSync(guidePath)) {
        try {
          const content = fs.readFileSync(guidePath, "utf-8");
          const { metadata } = parseFrontmatter(content);
          guides.push(metadata);
        } catch (error) {
          console.error(`Failed to parse guide ${entry.name}:`, error);
        }
      }
    }
  }

  return guides;
}

/**
 * 加载指定 Guide 的完整内容
 * @param guideName Guide 名称（目录名或 metadata.name）
 */
export function loadGuide(guideName: string): Guide | null {
  // 尝试直接匹配目录名
  let guideDir = path.join(GUIDES_DIR, guideName);
  let guidePath = path.join(guideDir, "GUIDE.md");

  // 如果目录不存在，遍历查找匹配的 metadata.name
  if (!fs.existsSync(guidePath)) {
    const entries = fs.readdirSync(GUIDES_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const testPath = path.join(GUIDES_DIR, entry.name, "GUIDE.md");
        if (fs.existsSync(testPath)) {
          try {
            const content = fs.readFileSync(testPath, "utf-8");
            const { metadata } = parseFrontmatter(content);
            if (
              metadata.name === guideName ||
              metadata.name.includes(guideName)
            ) {
              guideDir = path.join(GUIDES_DIR, entry.name);
              guidePath = testPath;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  if (!fs.existsSync(guidePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(guidePath, "utf-8");
    const { metadata, body } = parseFrontmatter(content);

    return {
      metadata,
      content: body,
      directory: guideDir,
    };
  } catch (error) {
    console.error(`Failed to load guide ${guideName}:`, error);
    return null;
  }
}

/**
 * 获取所有 Guides 的完整内容（用于前端本地加载）
 * 返回一个 name -> content 的映射
 */
export function getAllGuidesContent(): Record<string, string> {
  const result: Record<string, string> = {};

  if (!fs.existsSync(GUIDES_DIR)) {
    return result;
  }

  const entries = fs.readdirSync(GUIDES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const guidePath = path.join(GUIDES_DIR, entry.name, "GUIDE.md");

      if (fs.existsSync(guidePath)) {
        try {
          const content = fs.readFileSync(guidePath, "utf-8");
          const { metadata, body } = parseFrontmatter(content);
          result[metadata.name] = body;
        } catch (error) {
          console.error(`Failed to load guide ${entry.name}:`, error);
        }
      }
    }
  }

  return result;
}

/**
 * 生成 Guides 索引摘要，用于 system prompt
 */
export function generateGuidesIndex(): string {
  const guides = getAllGuidesMetadata();

  if (guides.length === 0) {
    return "";
  }

  const index = guides.map((g) => `- **${g.name}**: ${g.description}`).join("\n");

  return `## 工具使用指南

需要某个工具的详细用法时，调用 load_tool_guide 加载：

${index}

调用方式：\`load_tool_guide(guide_name="指南名称")\``;
}
