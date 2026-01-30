// Fallback video nodes data (when Supabase is not configured)

export interface CriticalCheckpoint {
  enabled: boolean;
  trigger: "auto" | "silence_timeout";  // 自动触发（节点结束时） or 沉默超时
  silenceThreshold?: number;  // 沉默多久触发（秒），仅用于 silence_timeout
  interventionType: "quick_check" | "trap_alert" | "final_check";

  // 介入话术
  intervention: {
    intro: string;  // 开场白："我必须在这停一下..."
    question: string;  // 点名提问："x² + x = 0 是一元二次方程。对不对？"
    expectedAnswers: string[];  // 预期答案：["是", "不是", "对", "不对"]
    followUp?: string;  // 追问（可选）："我再换一个：x + 1 = 0 是不是？"
  };

  // 老师经验标注
  teacherNote: string;  // "这是最高频错误源"
  mistakePattern: string;  // "学生会误以为只要有x²就行"
}

export interface VideoNode {
  id: string;
  order: number;
  title: string;
  start_time: number;
  end_time: number;
  summary: string;
  key_concepts: string[];
  node_type: string;

  // 新增：必停点配置
  criticalCheckpoint?: CriticalCheckpoint;
}

// Demo video nodes: 一元二次方程的定义
export const demoVideoNodes: VideoNode[] = [
  {
    id: "demo-node-0",
    order: 0,
    title: "引入：为什么要学一元二次方程",
    start_time: 0,
    end_time: 60,
    summary: "讲解一次方程的局限性，引出二次方程的必要性。通过实际问题 x(x+3)=18 说明一次方程无法解决某些问题。",
    key_concepts: ["一次方程", "二次方程", "方程的次数", "一次方程的局限性"],
    node_type: "intro",

    // ⭐ 必停点 Case 1：动机段
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",  // 节点结束时自动触发
      interventionType: "quick_check",

      intervention: {
        intro: "我停一下。你现在如果只是觉得\"二次方程更厉害\"，后面你会不知道它到底解决了什么问题。",
        question: "我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。",
        expectedAnswers: ["能", "不能"],
      },

      teacherNote: "动机段必停点 - 确保学生理解为什么需要二次方程",
      mistakePattern: "学生可能只是觉得二次方程\"更厉害\"，但不理解它解决了什么实际问题"
    }
  },
  {
    id: "demo-node-1",
    order: 1,
    title: "什么是整式方程",
    start_time: 60,
    end_time: 120,
    summary: "介绍整式方程的概念，方程两边都是整式，没有分母中含有未知数的情况。",
    key_concepts: ["整式方程", "方程", "未知数"],
    node_type: "concept",
  },
  {
    id: "demo-node-2",
    order: 2,
    title: "一元二次方程的定义",
    start_time: 120,
    end_time: 210,
    summary: "定义一元二次方程：只含有一个未知数，并且未知数的最高次数是2的整式方程。标准形式：ax²+bx+c=0（a≠0）。",
    key_concepts: ["一元二次方程", "二次项", "一次项", "常数项", "二次项系数"],
    node_type: "concept",

    // ⭐ 必停点 Case 2：最高次数陷阱
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",  // 节点结束时自动触发
      interventionType: "trap_alert",

      intervention: {
        intro: "我必须在这停一下。这里如果你理解错，后面你会把很多方程全都分错类。",
        question: "我说一个式子，你只回答对或不对：x² + x = 0 是一元二次方程。对不对？",
        expectedAnswers: ["对", "不对", "是", "不是"],
        followUp: "我再换一个：x + 1 = 0 是不是一元二次方程？回答：是 / 不是。"
      },

      teacherNote: "最高频错误源",
      mistakePattern: "学生会误以为只要有x²就行，不理解最高次数的含义"
    }
  },
  {
    id: "demo-node-3",
    order: 3,
    title: "判断一元二次方程",
    start_time: 210,
    end_time: 300,
    summary: "通过例题学习如何判断一个方程是否为一元二次方程，重点是化简后的形式和二次项系数不为0。",
    key_concepts: ["化简", "判断方程类型", "二次项系数不为0"],
    node_type: "example",

    // ⭐ 必停点 Case 3：化简后再判断
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "我必须在这停一下。因为这是最容易被题目骗的地方。",
        question: "我说一句，你告诉我结论：两边化简后如果没有x²，它还是不是一元二次方程？回答：是 / 不是。",
        expectedAnswers: ["是", "不是"],
      },

      teacherNote: "学生会被题目外表骗",
      mistakePattern: "学生会被方程的外表骗，而且非常自信地错"
    }
  },
  {
    id: "demo-node-4",
    order: 4,
    title: "常见错误和注意事项",
    start_time: 300,
    end_time: 367,
    summary: "总结判断一元二次方程时的常见错误，强调必须化简到最简形式，注意二次项系数a≠0的条件。",
    key_concepts: ["常见错误", "化简", "a≠0"],
    node_type: "summary",

    // ⭐ 必停点：收尾终检
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "final_check",

      intervention: {
        intro: "我最后点你一次名。你不用解释，只回答。",
        question: "判断一元二次方程需要满足三个条件。第一个：只有一个未知数？回答：是 / 不是。",
        expectedAnswers: ["是", "不是"],
        followUp: "第二个：最高次数是2？第三个：是不是整式？分别回答。"
      },

      teacherNote: "终检：是否可以放你走",
      mistakePattern: "老师用快速判断确认学生真的懂了"
    }
  },
];

// Get nodes by video ID
export function getFallbackNodes(videoId: string): VideoNode[] {
  if (videoId === "demo") {
    return demoVideoNodes;
  }
  return [];
}

// Get node by time
export function getFallbackNodeByTime(videoId: string, time: number): VideoNode | null {
  const nodes = getFallbackNodes(videoId);
  return nodes.find(n => time >= n.start_time && time < n.end_time) || null;
}
