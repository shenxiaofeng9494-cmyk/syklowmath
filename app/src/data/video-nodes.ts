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

// Demo video nodes: 一次函数 (总时长 26分33秒 = 1593秒)
// 9 个节点，平均约 3 分钟一个检查点，覆盖一次函数完整知识体系
export const linearFunctionNodes: VideoNode[] = [
  {
    id: "linear-node-0",
    order: 0,
    title: "引入：从实际问题认识一次函数",
    start_time: 0,
    end_time: 180,
    summary: "通过实际问题（如行程问题、话费问题）引入一次函数的概念，让学生理解一次函数描述的是均匀变化的关系。",
    key_concepts: ["函数", "变量关系", "均匀变化", "实际问题建模"],
    node_type: "intro",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "我停一下。你得先搞清楚一次函数描述的是什么样的变化。",
        question: "小明每分钟走 80 米，走了 x 分钟，路程 y 米。月租 10 元、每分钟 0.1 元的话费也是 y 和 x 的关系。这两个关系有什么共同点？回答：都是均匀变化 / 没有共同点。",
        expectedAnswers: ["都是均匀变化", "均匀变化", "都是"],
      },

      teacherNote: "引入段 - 建立一次函数 = 均匀变化的直觉",
      mistakePattern: "学生只是觉得一次函数是个公式，不理解它对应什么现实关系"
    }
  },
  {
    id: "linear-node-1",
    order: 1,
    title: "一次函数的定义：y = kx + b",
    start_time: 180,
    end_time: 360,
    summary: "定义一次函数：形如 y = kx + b（k≠0）的函数叫做一次函数。k 是一次项系数，b 是常数项。重点强调 k≠0 这个条件。",
    key_concepts: ["一次函数定义", "y=kx+b", "k≠0", "一次项系数", "常数项"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "我必须在这停一下。这个地方很多同学会栽。",
        question: "y = 0 乘以 x + 3，也就是 y = 3，是不是一次函数？回答：是 / 不是。",
        expectedAnswers: ["是", "不是"],
        followUp: "为什么？因为 k 等于多少？它违反了什么条件？"
      },

      teacherNote: "k≠0 是最关键的条件，必须单独停",
      mistakePattern: "学生看到 y=kx+b 的形式就直接套，忽略 k≠0"
    }
  },
  {
    id: "linear-node-2",
    order: 2,
    title: "正比例函数与一次函数的关系",
    start_time: 360,
    end_time: 530,
    summary: "正比例函数 y=kx 是一次函数 y=kx+b 中 b=0 的特殊情况。所有正比例函数都是一次函数，但一次函数不一定是正比例函数。",
    key_concepts: ["正比例函数", "b=0", "特殊与一般", "包含关系"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "这个地方考试经常出判断题，你必须分清楚。",
        question: "y = 3x 是正比例函数，它是不是一次函数？回答：是 / 不是。",
        expectedAnswers: ["是", "不是"],
        followUp: "反过来：y = 3x + 1 是一次函数，它是不是正比例函数？回答：是 / 不是。"
      },

      teacherNote: "正比例函数 ⊂ 一次函数，包含关系必须搞清",
      mistakePattern: "学生分不清谁包含谁，或者认为一次函数和正比例函数是完全不同的东西"
    }
  },
  {
    id: "linear-node-3",
    order: 3,
    title: "一次函数的图像：描点法",
    start_time: 530,
    end_time: 730,
    summary: "一次函数 y=kx+b 的图像是一条直线。用描点法画图：列表取值、描点、连线。画直线只需要两个点。",
    key_concepts: ["直线", "描点法", "列表取值", "两点确定直线"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "我问你一个关键问题。",
        question: "一次函数的图像是什么形状？回答：直线 / 曲线。",
        expectedAnswers: ["直线", "曲线"],
        followUp: "那画这条直线，最少需要描几个点？"
      },

      teacherNote: "图像是直线 + 两点确定，这是画图的基础",
      mistakePattern: "学生可能多描很多点，不理解直线的性质"
    }
  },
  {
    id: "linear-node-4",
    order: 4,
    title: "画图实操：选点技巧",
    start_time: 730,
    end_time: 900,
    summary: "画一次函数图像时，通常选取 x=0 和 y=0 两个特殊点（即与 y 轴和 x 轴的交点），这样计算最简便。通过实例练习画图。",
    key_concepts: ["与y轴交点", "与x轴交点", "特殊点", "画图步骤"],
    node_type: "example",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "你来试一个。",
        question: "画 y = 2x + 4 的图像。令 x = 0，y 等于多少？回答一个数。",
        expectedAnswers: ["4", "四"],
        followUp: "再令 y = 0，x 等于多少？"
      },

      teacherNote: "让学生实际算一次，比只听讲记得牢",
      mistakePattern: "学生会算错令 y=0 时的 x 值，或者不知道要令 y=0"
    }
  },
  {
    id: "linear-node-5",
    order: 5,
    title: "k 的几何意义：斜率与增减性",
    start_time: 900,
    end_time: 1100,
    summary: "k 决定直线的倾斜方向和程度：k>0 时直线从左到右上升（y 随 x 增大而增大），k<0 时下降。|k| 越大，直线越陡。",
    key_concepts: ["斜率", "增减性", "k>0上升", "k<0下降", "|k|与陡度"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "这是一次函数最核心的东西。搞混了后面全错。",
        question: "k 大于 0 时，直线从左到右是上升还是下降？回答：上升 / 下降。",
        expectedAnswers: ["上升", "下降"],
        followUp: "y = 2x + 1 和 y = 5x + 1，哪条直线更陡？回答：y=2x+1 / y=5x+1。"
      },

      teacherNote: "k 的符号 → 方向，|k| → 陡度，两个都要测",
      mistakePattern: "学生记住了 k>0 上升但不理解为什么，|k| 和陡度的关系更容易混"
    }
  },
  {
    id: "linear-node-6",
    order: 6,
    title: "b 的几何意义：截距",
    start_time: 1100,
    end_time: 1270,
    summary: "b 是直线与 y 轴交点的纵坐标，叫做截距。b>0 交点在 x 轴上方，b<0 在下方，b=0 过原点（退化为正比例函数）。",
    key_concepts: ["截距", "y轴交点", "b的正负", "b=0过原点"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "截距这个概念很多同学会搞错。",
        question: "y = -3x + 5 这条直线和 y 轴交在哪个点？回答坐标。",
        expectedAnswers: ["0,5", "(0,5)", "零五", "0 5", "零逗号五"],
        followUp: "如果 b = 0，直线一定过哪个点？"
      },

      teacherNote: "截距 ≠ 距离，很多学生搞混",
      mistakePattern: "学生以为截距是直线到原点的距离，或者分不清在 y 轴上方还是下方"
    }
  },
  {
    id: "linear-node-7",
    order: 7,
    title: "一次函数图像经过的象限",
    start_time: 1270,
    end_time: 1430,
    summary: "根据 k 和 b 的正负号组合，可以判断一次函数图像经过哪些象限。k>0,b>0 经过一二三象限；k>0,b<0 经过一三四象限；k<0,b>0 经过一二四象限；k<0,b<0 经过二三四象限。",
    key_concepts: ["象限分布", "k和b的符号", "图像位置判断"],
    node_type: "concept",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "这个地方考试必考。你得会从 k 和 b 的符号判断图像过哪几个象限。",
        question: "y = -x + 2，k 是负的，b 是正的。这条直线不经过哪个象限？回答：第一 / 第二 / 第三 / 第四。",
        expectedAnswers: ["第三", "三", "第三象限"],
        followUp: "那如果 k 和 b 都是负的，比如 y = -x - 1，不经过第几象限？"
      },

      teacherNote: "象限判断是中考选择题高频考点",
      mistakePattern: "学生死记四种情况但不理解为什么，换个问法就不会了"
    }
  },
  {
    id: "linear-node-8",
    order: 8,
    title: "总结：一次函数知识体系",
    start_time: 1430,
    end_time: 1593,
    summary: "总结一次函数的完整知识体系：定义(y=kx+b, k≠0)、与正比例函数的关系(b=0)、图像(直线)、k的意义(方向和陡度)、b的意义(截距)、象限分布。",
    key_concepts: ["一次函数性质", "增减性", "图像特征", "知识体系"],
    node_type: "summary",

    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "final_check",

      intervention: {
        intro: "最后我连问你三个，快速回答，不用解释。",
        question: "第一：一次函数 y=kx+b 中，k 不能等于什么？",
        expectedAnswers: ["0", "零"],
        followUp: "第二：k 大于 0，函数是增函数还是减函数？第三：b 等于 0 时，它就变成了什么函数？"
      },

      teacherNote: "终检三连问：k≠0、增减性、正比例函数关系",
      mistakePattern: "快速检验学生是否真正掌握了三个核心知识点"
    }
  },
];

// Get nodes by video ID
export function getFallbackNodes(videoId: string): VideoNode[] {
  if (videoId === "demo") {
    return demoVideoNodes;
  }
  if (videoId === "linear-function") {
    return linearFunctionNodes;
  }
  return [];
}

// Get node by time
export function getFallbackNodeByTime(videoId: string, time: number): VideoNode | null {
  const nodes = getFallbackNodes(videoId);
  return nodes.find(n => time >= n.start_time && time < n.end_time) || null;
}
