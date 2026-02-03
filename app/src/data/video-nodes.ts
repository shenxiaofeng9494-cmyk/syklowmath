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
export const linearFunctionNodes: VideoNode[] = [
  {
    id: "linear-node-0",
    order: 0,
    title: "引入：从实际问题认识一次函数",
    start_time: 0,
    end_time: 265,
    summary: "通过实际问题（如行程问题、话费问题）引入一次函数的概念，让学生理解为什么要学习一次函数。",
    key_concepts: ["函数", "变量关系", "实际问题"],
    node_type: "intro",

    // 必停点：确保学生理解为什么需要一次函数
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "我停一下。一次函数在生活中非常常见，你得先理解它描述的是什么关系。",
        question: "我问你：如果话费是 y 元，通话时长是 x 分钟，月租 10 元，每分钟 0.1 元。y 和 x 是什么关系？回答：正比例 / 不是正比例。",
        expectedAnswers: ["正比例", "不是正比例", "不是"],
      },

      teacherNote: "引入段必停点 - 确保学生理解一次函数的实际意义",
      mistakePattern: "学生可能混淆正比例和一次函数的区别"
    }
  },
  {
    id: "linear-node-1",
    order: 1,
    title: "一次函数的定义",
    start_time: 265,
    end_time: 530,
    summary: "定义一次函数：形如 y = kx + b（k≠0）的函数叫做一次函数。其中 k 是一次项系数，b 是常数项。",
    key_concepts: ["一次函数", "y=kx+b", "k≠0", "一次项系数", "常数项"],
    node_type: "concept",

    // 必停点：k≠0 的条件
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "我必须在这停一下。很多同学在这里会犯一个错误。",
        question: "我问你：y = 0·x + 3，也就是 y = 3，是不是一次函数？回答：是 / 不是。",
        expectedAnswers: ["是", "不是"],
        followUp: "那 y = 2x + 0，也就是 y = 2x，是不是一次函数？回答：是 / 不是。"
      },

      teacherNote: "k≠0 是最关键的条件",
      mistakePattern: "学生会忽略 k≠0 这个条件，误认为 y=3 也是一次函数"
    }
  },
  {
    id: "linear-node-2",
    order: 2,
    title: "正比例函数是特殊的一次函数",
    start_time: 530,
    end_time: 750,
    summary: "当 b=0 时，一次函数 y=kx+b 变成 y=kx，这就是正比例函数。正比例函数是一次函数的特殊情况。",
    key_concepts: ["正比例函数", "y=kx", "b=0", "特殊情况"],
    node_type: "concept",
  },
  {
    id: "linear-node-3",
    order: 3,
    title: "一次函数的图像",
    start_time: 750,
    end_time: 1050,
    summary: "一次函数 y=kx+b 的图像是一条直线。通过描点法画出一次函数的图像，理解为什么只需要两个点就能确定一条直线。",
    key_concepts: ["直线", "描点法", "两点确定直线"],
    node_type: "concept",

    // 必停点：画图方法
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "quick_check",

      intervention: {
        intro: "我问你一个问题。",
        question: "画一次函数的图像，最少需要几个点？回答：1个 / 2个 / 3个。",
        expectedAnswers: ["1个", "2个", "3个", "1", "2", "3"],
      },

      teacherNote: "确保学生理解两点确定直线",
      mistakePattern: "学生可能不理解为什么两个点就够了"
    }
  },
  {
    id: "linear-node-4",
    order: 4,
    title: "k 和 b 的几何意义",
    start_time: 1050,
    end_time: 1350,
    summary: "k 决定直线的倾斜程度（斜率）：k>0 直线上升，k<0 直线下降。b 决定直线与 y 轴的交点（截距）。",
    key_concepts: ["斜率", "截距", "k的正负", "倾斜程度"],
    node_type: "concept",

    // 必停点：k 的符号决定增减性
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "trap_alert",

      intervention: {
        intro: "这是一次函数的核心。如果你搞混了，后面所有关于图像的题你都会错。",
        question: "我说一个，你判断：k > 0 时，直线从左到右是上升还是下降？回答：上升 / 下降。",
        expectedAnswers: ["上升", "下降"],
        followUp: "那 k < 0 呢？回答：上升 / 下降。"
      },

      teacherNote: "k 的符号是判断增减性的关键",
      mistakePattern: "学生会混淆 k 的符号与直线方向的关系"
    }
  },
  {
    id: "linear-node-5",
    order: 5,
    title: "总结：一次函数的性质",
    start_time: 1350,
    end_time: 1593,
    summary: "总结一次函数的定义、图像和性质。强调 k≠0、k 的符号决定增减性、b 的符号决定与 y 轴交点位置。",
    key_concepts: ["一次函数性质", "增减性", "图像特征"],
    node_type: "summary",

    // 必停点：终检
    criticalCheckpoint: {
      enabled: true,
      trigger: "auto",
      interventionType: "final_check",

      intervention: {
        intro: "最后我点你一次名，快速回答。",
        question: "一次函数 y = kx + b 中，k 不能等于什么？回答一个数。",
        expectedAnswers: ["0", "零"],
        followUp: "如果 k > 0，函数是增函数还是减函数？"
      },

      teacherNote: "终检：确认学生掌握核心概念",
      mistakePattern: "快速检验学生是否真的理解了"
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
