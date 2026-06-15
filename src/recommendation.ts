import type {
  RankedVideo,
  Scene,
  ScoreBreakdown,
  StrategyConfig,
  UserProfile,
  Video,
} from "./types";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const includesAny = (source: string[], target: string[]) => source.some((item) => target.includes(item));
const scoreMatch = (source: string[], target: string[], partial = 0.5) =>
  includesAny(source, target) ? 1 : source.length && target.length ? partial : 0;

function gameMatch(video: Video, user: UserProfile) {
  const recent = user.recentGames.includes(video.game) ? 1 : user.recentGames.length && video.gameCluster === "扑克" ? 0.6 : 0;
  const history = user.historyGames.includes(video.game) ? 1 : user.historyGames.length && video.gameCluster === "扑克" ? 0.5 : 0;
  const lost = user.lostGames.includes(video.game) ? 1 : user.lostGames.length && video.gameCluster === "扑克" ? 0.5 : 0;
  const gameplay = scoreMatch(video.gameplay, user.gameplay);
  const sameCluster = [...user.recentGames, ...user.historyGames, ...user.lostGames].length ? 0.5 : 0.3;
  return clamp(0.45 * recent + 0.25 * history + 0.15 * lost + 0.1 * gameplay + 0.05 * sameCluster);
}

function regionMatch(video: Video, user: UserProfile) {
  const exact = video.region.includes(user.region) ? 1 : video.region.includes("浙江") && ["温州", "杭州"].includes(user.region) ? 0.6 : 0;
  const gameplayRegion = video.primaryType === "地域社交" && exact > 0 ? 1 : exact * 0.6;
  const ipRegion = exact;
  const localCulture = video.keywords.some((tag) => ["方言解说", "朋友局", "老玩家"].includes(tag)) ? exact : 0.2;
  return clamp(0.4 * exact + 0.35 * gameplayRegion + 0.15 * ipRegion + 0.1 * localCulture);
}

function userStageMatch(video: Video, user: UserProfile) {
  const stages = ["新增", "活跃", "低活", "沉默", "回流"];
  const direct = video.targetStages.includes(user.stage) ? 1 : video.targetStages.some((stage) => Math.abs(stages.indexOf(stage) - stages.indexOf(user.stage)) === 1) ? 0.5 : 0;
  const activeState = video.targetStages.includes(user.stage) ? 1 : 0;
  const skillIndex = ["新手", "进阶", "高手"];
  const skillDistance = Math.min(...video.targetSkills.map((skill) => Math.abs(skillIndex.indexOf(skill) - skillIndex.indexOf(user.skill))));
  const skill = skillDistance === 0 ? 1 : skillDistance === 1 ? 0.5 : 0;
  const interest = video.targetInterests.some((interest) => interest.includes(video.game) || interest === "棋牌用户" || interest === "地方棋牌用户") ? 1 : 0.4;
  return clamp(0.45 * direct + 0.25 * activeState + 0.2 * skill + 0.1 * interest);
}

function sceneMatch(video: Video, user: UserProfile, scene: Scene) {
  const distribution = video.scenes.includes(scene) ? 1 : 0.35;
  const durationRanges: Record<Scene, [number, number]> = {
    首页推荐流: [15, 90],
    大厅停留: [15, 60],
    匹配等待: [10, 35],
    局后结算: [15, 70],
    退出前: [15, 45],
    Push落地: [15, 90],
    游戏详情页: [20, 120],
  };
  const [min, max] = durationRanges[scene];
  const durationFit = video.duration >= min && video.duration <= max ? 1 : video.duration <= max * 1.5 ? 0.5 : 0.2;
  const userIntent =
    scene === "局后结算" && ["实战复盘", "失误避坑", "爽点牌局"].includes(video.primaryType) ? 1 :
    scene === "退出前" && ["棋牌泛娱乐", "地域社交"].includes(video.primaryType) ? 1 :
    scene === "匹配等待" && video.duration <= 35 ? 1 :
    video.scenes.includes(scene) ? 0.8 : 0.4;
  const guideOpportunity = video.strongGuide && !user.guideCooldown ? 0.9 : 0.5;
  return clamp(0.4 * distribution + 0.25 * durationFit + 0.2 * userIntent + 0.15 * guideOpportunity);
}

function recentPerformance(video: Video) {
  const baseline = {
    valid: 0.68,
    finish: 0.55,
    interaction: 0.12,
    gameReturn: 0.11,
    negative: 0.025,
  };
  const m = video.metrics;
  return clamp(
    0.25 * clamp(m.validPlayRate / baseline.valid) +
    0.2 * clamp(m.finishRate / baseline.finish) +
    0.15 * clamp(m.interactionRate / baseline.interaction) +
    0.25 * clamp(m.gameReturnRate / baseline.gameReturn) +
    0.15 * clamp(1 - m.negativeRate / baseline.negative),
  );
}

function businessGoalMatch(video: Video, user: UserProfile) {
  const userGoal =
    user.stage === "新增" ? "拉新" :
    user.stage === "活跃" ? "留存" :
    user.stage === "低活" ? "促活" :
    user.stage === "沉默" ? "召回" : "转化";
  const goal = video.businessGoal === userGoal ? 1 : ["促活", "留存", "召回"].includes(video.businessGoal) ? 0.65 : 0.35;
  const contentGoal = video.action === "优先分发" ? 0.9 : video.action === "常规分发" ? 0.7 : 0.3;
  const activity = video.primaryType === "活动赛事" ? 0.9 : 0.5;
  const entry = video.strongGuide ? 0.9 : 0.6;
  return clamp(0.35 * goal + 0.25 * contentGoal + 0.2 * activity + 0.2 * entry);
}

function exploration(video: Video, user: UserProfile) {
  const newContent = video.metrics.exposure < 500 ? 1 : video.ageHours < 24 ? 0.7 : 0.2;
  const newAuthor = video.authorCredit < 0.75 ? 0.8 : 0.3;
  const newTopic = includesAny(video.topics, user.preferredTopics) ? 0.25 : 0.8;
  const similarFeedback = video.metrics.validPlayRate > 0.72 ? 0.8 : 0.45;
  const diversityNeed = user.preferredTypes.includes(video.primaryType) ? 0.35 : 0.75;
  return clamp(0.3 * newContent + 0.25 * newAuthor + 0.2 * newTopic + 0.15 * similarFeedback + 0.1 * diversityNeed);
}

function penalties(video: Video, user: UserProfile) {
  const fastSkip = user.fastSkippedTypes.includes(video.primaryType) ? 0.75 : 0;
  const notInterested = user.fastSkippedTypes.includes(video.primaryType) ? 0.35 : 0;
  const report = clamp(video.metrics.reportRate / 0.01);
  const sameTypeNegative = fastSkip * 0.6;
  const negativePenalty = clamp(0.4 * fastSkip + 0.3 * notInterested + 0.2 * report + 0.1 * sameTypeNegative);

  const sameAuthor = user.recentAuthors.includes(video.author) ? 0.7 : 0;
  const fatiguePenalty = clamp(0.25 * sameAuthor + 0.15 * (user.preferredTypes.includes(video.primaryType) ? 0.1 : 0));

  const copyrightRisk = video.copyrightRisk === "高" ? 1 : video.copyrightRisk === "中" ? 0.5 : 0;
  const complianceRisk = video.keywords.some((item) => ["稳赚", "收益承诺"].includes(item)) ? 1 : 0;
  const lowQualityRisk = clamp(1 - video.quality);
  const complaintRisk = clamp(video.metrics.reportRate / 0.005);
  const riskPenalty = clamp(0.35 * copyrightRisk + 0.25 * complianceRisk + 0.2 * lowQualityRisk + 0.2 * complaintRisk);
  return { negativePenalty, fatiguePenalty, riskPenalty };
}

function recallSources(video: Video, user: UserProfile, scene: Scene) {
  const sources: string[] = [];
  if ([...user.recentGames, ...user.historyGames, ...user.lostGames].includes(video.game)) sources.push("游戏关联召回");
  if (video.targetStages.includes(user.stage)) sources.push("人群阶段召回");
  if (video.scenes.includes(scene)) sources.push("场景召回");
  if (includesAny(video.topics, user.preferredTopics) || includesAny(video.emotions, user.preferredEmotions)) sources.push("标签相似召回");
  if (video.primaryType === "棋牌泛娱乐" && ["低活", "沉默", "回流"].includes(user.stage)) sources.push("棋牌泛娱乐召回");
  if (video.metrics.validPlayRate > 0.72 || video.metrics.gameReturnRate > 0.13) sources.push("分桶热门召回");
  if (video.metrics.exposure < 500 || video.racePool === "T1") sources.push("探索召回");
  return sources;
}

function scoreVideo(video: Video, user: UserProfile, scene: Scene, config: StrategyConfig): ScoreBreakdown {
  const game = gameMatch(video, user);
  const region = regionMatch(video, user);
  const stage = userStageMatch(video, user);
  const sceneScore = sceneMatch(video, user, scene);
  const contentQuality = video.quality;
  const performance = recentPerformance(video);
  const business = businessGoalMatch(video, user);
  const fresh = clamp(1 - video.ageHours / (video.isUgc ? 48 : 72));
  const explore = exploration(video, user);
  const penalty = penalties(video, user);
  const roughScore = clamp(
    config.rough.gameMatch * game +
    config.rough.userStageMatch * stage +
    config.rough.sceneMatch * sceneScore +
    config.rough.contentQuality * contentQuality +
    config.rough.recentPerformance * performance +
    config.rough.businessGoalMatch * business +
    config.rough.freshness * fresh +
    config.rough.exploration * explore -
    0.12 * penalty.riskPenalty -
    0.08 * penalty.fatiguePenalty -
    0.1 * penalty.negativePenalty,
  );

  const typePreference = user.preferredTypes.includes(video.primaryType) ? 1 : 0.45;
  const topicPreference = scoreMatch(video.topics, user.preferredTopics, 0.35);
  const pValidPlay = clamp(0.4 * user.userValidPlayRate + 0.4 * video.metrics.validPlayRate + 0.2 * (sceneScore * 0.82));
  const pFinish = clamp(0.35 * user.userFinishRate + 0.45 * video.metrics.finishRate + 0.2 * (video.duration <= 45 ? 0.72 : 0.55));
  const pInteraction = clamp(0.3 * user.interactionTendency + 0.4 * video.metrics.interactionRate + 0.2 * video.authorCredit * 0.15 + 0.1 * (scene === "首页推荐流" ? 0.12 : 0.08));
  const guideIntent = ["局后结算", "退出前", "游戏详情页"].includes(scene) ? 0.9 : scene === "大厅停留" ? 0.75 : 0.55;
  const availableEntry = video.strongGuide ? 0.9 : 0.65;
  const pGameReturn = clamp(0.3 * user.gameReturnTendency + 0.35 * video.metrics.gameReturnRate + 0.2 * guideIntent + 0.15 * availableEntry);
  const pLifecycleImprove = clamp(
    ["低活", "沉默", "回流"].includes(user.stage)
      ? 0.45 * video.metrics.nextDayReturnRate + 0.35 * pGameReturn + 0.2 * typePreference
      : 0.5 * pValidPlay + 0.3 * pGameReturn + 0.2 * video.metrics.nextDayReturnRate,
  );
  const skillFit = video.targetSkills.includes(user.skill) ? 1 : video.depth === "浅层" && user.skill === "新手" ? 0.9 : 0.5;
  const matchScore = clamp(0.35 * game + 0.15 * region + 0.2 * stage + 0.1 * skillFit + 0.1 * topicPreference + 0.1 * sceneScore);
  const hardGuidePenalty = video.strongGuide && user.guideCooldown ? 0.8 : video.strongGuide && scene === "首页推荐流" ? 0.15 : 0;
  const feedScore = clamp(
    config.feed.pValidPlay * pValidPlay +
    config.feed.pFinish * pFinish +
    config.feed.pInteraction * pInteraction +
    config.feed.pGameReturn * pGameReturn +
    config.feed.pLifecycleImprove * pLifecycleImprove +
    config.feed.matchScore * matchScore +
    config.feed.freshness * fresh +
    config.feed.operationBoost * video.operationBoost +
    config.feed.exploration * explore -
    config.feed.negativePenalty * penalty.negativePenalty -
    config.feed.fatiguePenalty * penalty.fatiguePenalty -
    config.feed.riskPenalty * penalty.riskPenalty -
    config.feed.hardGuidePenalty * hardGuidePenalty,
  );

  return {
    gameMatch: game,
    regionMatch: region,
    userStageMatch: stage,
    sceneMatch: sceneScore,
    contentQuality,
    recentPerformance: performance,
    businessGoalMatch: business,
    freshness: fresh,
    exploration: explore,
    negativePenalty: penalty.negativePenalty,
    fatiguePenalty: penalty.fatiguePenalty,
    riskPenalty: penalty.riskPenalty,
    roughScore,
    pValidPlay,
    pFinish,
    pInteraction,
    pGameReturn,
    pLifecycleImprove,
    matchScore,
    operationBoost: video.operationBoost,
    hardGuidePenalty,
    feedScore,
  };
}

function guideEntry(video: Video) {
  const entries: Record<string, string> = {
    规则入门: "新手场 / 玩法教学",
    技巧教学: "同款玩法房间",
    实战复盘: "同类房间",
    爽点牌局: "快速开局",
    失误避坑: "低门槛场",
    地域社交: "本地玩法专区",
    棋牌泛娱乐: "同款游戏入口",
    活动赛事: "比赛活动页",
  };
  return entries[video.primaryType] ?? "游戏详情页";
}

function buildExplanation(video: Video, breakdown: ScoreBreakdown, recalls: string[]) {
  const factors = [
    ["游戏兴趣匹配", breakdown.gameMatch],
    ["当前场景适配", breakdown.sceneMatch],
    ["用户阶段匹配", breakdown.userStageMatch],
    ["游戏回流预估", breakdown.pGameReturn],
    ["内容近期表现", breakdown.recentPerformance],
  ] as const;
  const top = [...factors].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const result = top.map(([name, score]) => `${name} ${Math.round(score * 100)}分`);
  if (recalls.includes("探索召回")) result.push(`处于${video.racePool}流量池，保留探索机会`);
  if (breakdown.negativePenalty > 0.2) result.push("用户近期对同类内容有负反馈，已扣分");
  if (breakdown.riskPenalty > 0.1) result.push("内容存在风险信号，已限制分发");
  return result;
}

function rerank(items: RankedVideo[], config: StrategyConfig) {
  const output: RankedVideo[] = [];
  const deferred: RankedVideo[] = [];
  const authorCounts = new Map<string, number>();
  let lastType = "";
  let sameTypeCount = 0;
  let lastStrongGuideIndex = -config.strongGuideInterval;

  for (const item of items) {
    const authorCount = authorCounts.get(item.video.author) ?? 0;
    const nextSameType = item.video.primaryType === lastType ? sameTypeCount + 1 : 1;
    const guideTooClose = item.video.strongGuide && output.length - lastStrongGuideIndex < config.strongGuideInterval;
    if (
      authorCount >= config.maxSameAuthorPerPage ||
      nextSameType > config.maxSameTypeConsecutive ||
      guideTooClose
    ) {
      deferred.push(item);
      continue;
    }
    output.push(item);
    authorCounts.set(item.video.author, authorCount + 1);
    if (item.video.primaryType === lastType) sameTypeCount += 1;
    else {
      lastType = item.video.primaryType;
      sameTypeCount = 1;
    }
    if (item.video.strongGuide) lastStrongGuideIndex = output.length - 1;
  }
  return [...output, ...deferred].map((item, index) => ({ ...item, rank: index + 1 }));
}

export function runRecommendation(
  videos: Video[],
  user: UserProfile,
  scene: Scene,
  config: StrategyConfig,
) {
  const admitted = videos.filter((video) =>
    video.status === "已入库" &&
    video.authorized &&
    video.copyrightRisk !== "高" &&
    video.action !== "不建议使用" &&
    video.quality >= 0.6,
  );
  const recalled = admitted
    .map((video) => ({ video, recalls: recallSources(video, user, scene) }))
    .filter(({ recalls }) => recalls.length > 0);
  const roughRanked = recalled
    .map(({ video, recalls }) => ({ video, recalls, breakdown: scoreVideo(video, user, scene, config) }))
    .sort((a, b) => b.breakdown.roughScore - a.breakdown.roughScore)
    .slice(0, 50);
  const precise = roughRanked
    .map(({ video, recalls, breakdown }, index): RankedVideo => ({
      video,
      recallSources: recalls,
      breakdown,
      rank: index + 1,
      guideEntry: guideEntry(video),
      explanation: buildExplanation(video, breakdown, recalls),
    }))
    .sort((a, b) => b.breakdown.feedScore - a.breakdown.feedScore);
  return {
    admittedCount: admitted.length,
    recalledCount: recalled.length,
    roughCount: roughRanked.length,
    ranked: rerank(precise, config),
    filteredCount: videos.length - admitted.length,
  };
}

export function raceDecision(video: Video) {
  const m = video.metrics;
  const positive = average([
    clamp(m.validPlayRate / 0.7),
    clamp(m.finishRate / 0.58),
    clamp(m.interactionRate / 0.13),
    clamp(m.gameReturnRate / 0.11),
  ]);
  if (m.reportRate > 0.006 || video.copyrightRisk !== "低") return { action: "复审", score: positive };
  if (m.negativeRate > 0.035 || positive < 0.65) return { action: "降权", score: positive };
  if (positive >= 0.92 && m.negativeRate < 0.02) return { action: "晋级", score: positive };
  return { action: "继续测试", score: positive };
}
