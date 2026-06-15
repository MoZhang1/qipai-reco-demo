export type UserStage = "新增" | "活跃" | "低活" | "沉默" | "回流";
export type SkillLevel = "新手" | "进阶" | "高手";
export type Scene = "首页推荐流" | "大厅停留" | "匹配等待" | "局后结算" | "退出前" | "Push落地" | "游戏详情页";
export type RacePool = "T0" | "T1" | "T2" | "T3" | "T4";

export interface VideoMetrics {
  exposure: number;
  validPlayRate: number;
  finishRate: number;
  interactionRate: number;
  negativeRate: number;
  reportRate: number;
  gameReturnRate: number;
  nextDayReturnRate: number;
}

export interface Video {
  id: string;
  title: string;
  author: string;
  authorType: "官方" | "达人" | "玩家" | "内部账号";
  source: "自有录屏" | "玩家投稿" | "达人授权" | "官方素材" | "AI生成";
  authorized: boolean;
  copyrightRisk: "低" | "中" | "高";
  status: "已入库" | "待审核" | "已下架";
  game: string;
  gameCluster: "扑克" | "麻将" | "地方棋牌";
  gameplay: string[];
  region: string[];
  duration: number;
  orientation: "竖屏" | "横屏";
  primaryType: string;
  secondaryType: string;
  format: string;
  depth: "浅层" | "中层" | "深层";
  topics: string[];
  keywords: string[];
  highlights: string[];
  emotions: string[];
  targetStages: UserStage[];
  targetSkills: SkillLevel[];
  targetRegions: string[];
  targetInterests: string[];
  scenes: Scene[];
  businessGoal: "拉新" | "促活" | "留存" | "召回" | "转化" | "品牌";
  action: "优先分发" | "常规分发" | "仅入库备用" | "不建议使用";
  priority: "S" | "A" | "B" | "C";
  quality: number;
  ageHours: number;
  isUgc: boolean;
  racePool: RacePool;
  authorCredit: number;
  operationBoost: number;
  strongGuide: boolean;
  thumbnail: string;
  metrics: VideoMetrics;
}

export interface UserProfile {
  id: string;
  name: string;
  stage: UserStage;
  skill: SkillLevel;
  region: string;
  recentGames: string[];
  historyGames: string[];
  lostGames: string[];
  gameplay: string[];
  preferredTypes: string[];
  preferredTopics: string[];
  preferredEmotions: string[];
  fastSkippedTypes: string[];
  recentAuthors: string[];
  userValidPlayRate: number;
  userFinishRate: number;
  interactionTendency: number;
  gameReturnTendency: number;
  recentLearningIntent: number;
  guideCooldown: boolean;
}

export interface RoughWeights {
  gameMatch: number;
  userStageMatch: number;
  sceneMatch: number;
  contentQuality: number;
  recentPerformance: number;
  businessGoalMatch: number;
  freshness: number;
  exploration: number;
}

export interface FeedWeights {
  pValidPlay: number;
  pFinish: number;
  pInteraction: number;
  pGameReturn: number;
  pLifecycleImprove: number;
  matchScore: number;
  freshness: number;
  operationBoost: number;
  exploration: number;
  negativePenalty: number;
  fatiguePenalty: number;
  riskPenalty: number;
  hardGuidePenalty: number;
}

export interface StrategyConfig {
  rough: RoughWeights;
  feed: FeedWeights;
  explorationRatio: number;
  maxSameTypeConsecutive: number;
  maxSameAuthorPerPage: number;
  strongGuideInterval: number;
}

export interface ScoreBreakdown {
  gameMatch: number;
  regionMatch: number;
  userStageMatch: number;
  sceneMatch: number;
  contentQuality: number;
  recentPerformance: number;
  businessGoalMatch: number;
  freshness: number;
  exploration: number;
  negativePenalty: number;
  fatiguePenalty: number;
  riskPenalty: number;
  roughScore: number;
  pValidPlay: number;
  pFinish: number;
  pInteraction: number;
  pGameReturn: number;
  pLifecycleImprove: number;
  matchScore: number;
  operationBoost: number;
  hardGuidePenalty: number;
  feedScore: number;
}

export interface RankedVideo {
  video: Video;
  recallSources: string[];
  breakdown: ScoreBreakdown;
  rank: number;
  guideEntry: string;
  explanation: string[];
}
