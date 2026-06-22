import "./styles.css";
import { defaultConfig, scenes, users, videos as seedVideos } from "./data";
import { runRecommendation } from "./recommendation";
import type { RankedVideo, Scene, StrategyConfig, UserProfile, Video } from "./types";

type View = "overview" | "strategy" | "run" | "content" | "pipeline" | "config" | "formula";

interface DashboardSnapshot {
  generatedAt: string;
  exposure: number;
  validPlay: number;
  gameEntry: number;
  effectiveGame: number;
  validPlayRate: number;
  finishRate: number;
  gameReturnRate: number;
  negativeRate: number;
  dailyTrend: Array<{ label: string; exposure: number; validPlay: number; effectiveGame: number }>;
  funnel: Array<{ label: string; value: number }>;
  contentMix: Array<{ label: string; value: number; color: string }>;
  alerts: Array<{ level: "高" | "中" | "低"; title: string; detail: string }>;
  events: Array<{ time: string; type: string; title: string; detail: string }>;
}

const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) throw new Error("App root not found");
const app: HTMLDivElement = appElement;

const state = {
  view: "overview" as View,
  userId: users[1].id,
  scene: "首页推荐流" as Scene,
  config: structuredClone(defaultConfig) as StrategyConfig,
  videos: structuredClone(seedVideos) as Video[],
  selected: null as RankedVideo | null,
  contentQuery: "",
  contentType: "全部",
  contentStatus: "全部",
  runAt: new Date(),
  snapshot: null as DashboardSnapshot | null,
};

const pct = (value: number) => `${Math.round(value * 100)}%`;
const score = (value: number) => Math.round(value * 100);
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
const currentUser = () => users.find((user) => user.id === state.userId) ?? users[0];
const run = () => runRecommendation(state.videos, currentUser(), state.scene, state.config);

function sparkline(values: number[]) {
  const width = 210;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势图"><polyline points="${points}" /></svg>`;
}

function navItem(view: View, label: string, mark: string) {
  return `<button class="nav-item ${state.view === view ? "active" : ""}" data-view="${view}">
    <span class="nav-mark">${mark}</span><span>${label}</span>
  </button>`;
}

function shell(content: string) {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-symbol">牌</div>
          <div><strong>牌流</strong><span>推荐策略系统</span></div>
        </div>
        <nav>
          ${navItem("overview", "数据总览", "01")}
          ${navItem("strategy", "落地策略", "02")}
          ${navItem("run", "推荐运行", "03")}
          ${navItem("content", "内容池", "04")}
          ${navItem("pipeline", "全链路流程", "05")}
          ${navItem("config", "策略配置", "06")}
          ${navItem("formula", "计算说明", "07")}
        </nav>
        <div class="sidebar-status">
          <span class="status-dot"></span>
          <div><strong>策略服务正常</strong><small>规则版本 v1.1</small></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">棋牌游戏视频模块</p>
            <h1>${viewTitle()}</h1>
          </div>
          <div class="top-actions">
            <span class="updated">最近计算 ${state.runAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            <button class="button secondary" data-action="reset-demo">重置演示数据</button>
          </div>
        </header>
        ${content}
      </main>
    </div>
    ${state.selected ? detailDrawer(state.selected) : ""}
  `;
  bindEvents();
}

function viewTitle() {
  const titles: Record<View, string> = {
    overview: "推荐后台数据总览",
    strategy: "最低可落地推荐策略",
    run: "推荐运行与解释",
    content: "内容池与准入状态",
    pipeline: "视频入库到分发与 UGC 赛马全链路",
    config: "排序权重与频控配置",
    formula: "粗排与精排字段计算说明",
  };
  return titles[state.view];
}

function render() {
  if (state.view === "overview") shell(overviewView());
  if (state.view === "strategy") shell(strategyView());
  if (state.view === "run") shell(runView());
  if (state.view === "content") shell(contentView());
  if (state.view === "pipeline") shell(pipelineView());
  if (state.view === "config") shell(configView());
  if (state.view === "formula") shell(formulaView());
}

function dataNote(source: string, calculation: string, usage: string) {
  return `<div class="data-note">
    <span><i>数据</i>${source}</span>
    <span><i>口径</i>${calculation}</span>
    <span><i>用途</i>${usage}</span>
  </div>`;
}

function overviewView() {
  const data = state.snapshot ?? fallbackSnapshot();
  const maxTrend = Math.max(...data.dailyTrend.map((item) => item.exposure));
  const maxMix = Math.max(...data.contentMix.map((item) => item.value));
  return `
    <section class="simulation-banner">
      <div><span class="live-dot"></span><strong>模拟数据运行中</strong><p>数据由本地 <code>/api/snapshot</code> 接口生成；正式环境应替换为曝光日志、播放日志、游戏行为日志和内容审核数据。</p></div>
      <button class="button primary" data-action="refresh-snapshot">刷新模拟数据</button>
    </section>
    <section class="kpi-grid overview-kpis">
      ${overviewKpi("今日视频曝光", data.exposure.toLocaleString(), "+12.4%", "较昨日", "#1769aa", "推荐曝光日志", "视频卡片进入可视区域且达到曝光阈值", "判断推荐流量规模")}
      ${overviewKpi("有效播放率", pct(data.validPlayRate), "+3.1%", "较昨日", "#287a55", "播放开始、播放时长日志", "有效播放人数 ÷ 视频曝光人数", "衡量内容是否接住用户")}
      ${overviewKpi("视频后进入游戏", data.gameEntry.toLocaleString(), "+8.7%", "较昨日", "#6a55a3", "导流点击与游戏启动日志", "观看后归因窗口内成功进入游戏的人次", "衡量视频向游戏导流能力")}
      ${overviewKpi("完成有效局", data.effectiveGame.toLocaleString(), "+15.2%", "核心业务结果", "#d05a3a", "对局开始、结算日志", "视频归因用户进入游戏后完成一局有效对局", "推荐策略的核心业务目标")}
    </section>
    <section class="dashboard-grid">
      <div class="panel trend-panel">
        <div class="panel-head"><div><h2>近 7 日推荐效果</h2><p>曝光、有效播放和视频后有效局趋势</p></div><span class="result-badge">更新 ${new Date(data.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></div>
        ${dataNote("按自然日聚合曝光、播放、对局归因日志", "同一用户同一视频按业务规则去重后统计", "观察流量增长是否同步带来有效播放和游戏结果")}
        <div class="legend"><span class="exp">曝光</span><span class="play">有效播放</span><span class="game">有效局</span></div>
        <div class="trend-chart">
          ${data.dailyTrend.map((item) => `<div class="trend-day">
            <div class="trend-bars">
              <i class="exposure" style="height:${Math.max(18, item.exposure / maxTrend * 180)}px"></i>
              <i class="valid-play" style="height:${Math.max(12, item.validPlay / maxTrend * 180)}px"></i>
              <i class="effective-game" style="height:${Math.max(5, item.effectiveGame / maxTrend * 180)}px"></i>
            </div><span>${item.label}</span>
          </div>`).join("")}
        </div>
      </div>
      <div class="panel health-panel">
        <div class="panel-head"><div><h2>策略健康度</h2><p>当前推荐体验与业务约束</p></div></div>
        ${dataNote("匹配、多样性、回流、负反馈四组指标", "各指标归一化后按 30% / 20% / 35% / 15% 加权", "用于判断策略能否继续扩量及定位异常方向")}
        <div class="health-score"><strong>86</strong><span>运行健康</span></div>
        <div class="health-list">
          ${healthRow("内容匹配度", 88, "good")}
          ${healthRow("内容多样性", 82, "good")}
          ${healthRow("游戏回流效率", 79, "watch")}
          ${healthRow("负反馈控制", 92, "good")}
        </div>
      </div>
      <div class="panel funnel-panel">
        <div class="panel-head"><div><h2>视频到游戏转化漏斗</h2><p>核心终点为视频后完成有效局</p></div></div>
        ${dataNote("曝光、播放、导流点击、游戏启动、匹配、结算事件", "每一级转化率 = 本级人数 ÷ 上一级人数", "定位用户从看视频到真正开局的主要流失环节")}
        <div class="funnel-list">
          ${data.funnel.map((item, index) => {
            const width = Math.max(28, item.value / data.funnel[0].value * 100);
            const conversion = index === 0 ? "100%" : pct(item.value / data.funnel[index - 1].value);
            return `<div><span>${item.label}</span><b><i style="width:${width}%"></i></b><strong>${item.value.toLocaleString()}</strong><em>${conversion}</em></div>`;
          }).join("")}
        </div>
      </div>
      <div class="panel mix-panel">
        <div class="panel-head"><div><h2>推荐内容结构</h2><p>首屏与后续瀑布流实际曝光占比</p></div></div>
        ${dataNote("内容标签体系中的一级内容类型 + 曝光日志", "各类型曝光量 ÷ 总曝光量", "检查实战、教学、棋牌泛娱乐等供给是否失衡")}
        <div class="mix-list">
          ${data.contentMix.map((item) => `<div><span>${item.label}</span><b><i style="width:${item.value / maxMix * 100}%;background:${item.color}"></i></b><strong>${item.value}%</strong></div>`).join("")}
        </div>
      </div>
      <div class="panel alert-panel">
        <div class="panel-head"><div><h2>策略预警</h2><p>需要产品、运营或审核关注</p></div><span class="alert-count">${data.alerts.length}</span></div>
        ${dataNote("指标监控、内容库存、赛马和审核系统", "指标连续越过阈值或环比异常时生成预警", "触发降权、停量、补充供给或人工复审")}
        <div class="alert-list">${data.alerts.map((item) => `<article><span class="alert-level level-${item.level}">${item.level}</span><div><strong>${item.title}</strong><p>${item.detail}</p></div></article>`).join("")}</div>
      </div>
      <div class="panel event-panel">
        <div class="panel-head"><div><h2>实时推荐事件</h2><p>模拟推荐服务最近执行记录</p></div><span class="live-label">LIVE</span></div>
        ${dataNote("召回、排序、频控、赛马、准入服务运行日志", "按事件发生时间倒序展示最近记录", "排查某条内容为什么被推荐、延后、晋级或拦截")}
        <div class="event-list">${data.events.map((item) => `<article><time>${item.time}</time><span class="event-type">${item.type}</span><div><strong>${item.title}</strong><p>${item.detail}</p></div></article>`).join("")}</div>
      </div>
    </section>
  `;
}

function strategyStep(index: string, title: string, text: string, output: string) {
  return `<article class="strategy-step">
    <span>${index}</span>
    <strong>${title}</strong>
    <p>${text}</p>
    <em>${output}</em>
  </article>`;
}

function strategyMetric(name: string, field: string, usage: string) {
  return `<div><strong>${name}</strong><code>${field}</code><p>${usage}</p></div>`;
}

function strategyRace(pool: string, quota: string, condition: string, action: string) {
  return `<tr>
    <td><span class="pool ${pool.toLowerCase()}">${pool}</span></td>
    <td>${quota}</td>
    <td>${condition}</td>
    <td>${action}</td>
  </tr>`;
}

function strategyView() {
  return `
    <section class="strategy-hero">
      <div>
        <span>当前能力边界</span>
        <h2>先用“用户圈层 + 视频标签 + 标签权重”完成第一版自动推荐</h2>
        <p>第一版不依赖复杂模型。系统只要能识别用户属于哪个人群、视频有哪些标签、标签在不同人群下的权重，就可以生成可解释的瀑布流排序；UGC 赛马负责控制新内容拿多少流量。</p>
      </div>
      <aside>
        <strong>推荐核心</strong>
        <code>推荐分 = 人群命中分 × 35% + 标签权重分 × 40% + 内容表现分 × 15% + UGC赛马系数 × 10% − 频控/负反馈惩罚</code>
      </aside>
    </section>

    <section class="strategy-flow">
      ${strategyStep("1", "圈用户人群", "按现有用户数据把用户分到固定人群，不先做复杂画像。", "用户分层")}
      ${strategyStep("2", "视频打标签", "每条视频绑定游戏、内容类型、题材、情绪、导流强度、适用人群。", "内容特征")}
      ${strategyStep("3", "标签权重匹配", "读取当前用户人群的标签权重表，计算视频标签与用户人群的匹配分。", "候选排序分")}
      ${strategyStep("4", "UGC 赛马控量", "UGC 不直接大流量分发，先按赛马池等级限制曝光上限。", "流量上限")}
      ${strategyStep("5", "频控后出流", "同游戏、同类型、强导流、同作者逐条检查，输出最终瀑布流。", "推荐列表")}
    </section>

    <section class="strategy-layout">
      <div class="panel">
        <div class="panel-head"><div><h2>第一版必须准备的字段</h2><p>这些字段能支持推荐排序、赛马和后续策略修正</p></div></div>
        <div class="strategy-metrics">
          ${strategyMetric("用户人群", "user_segment", "如低活双扣用户、新手斗地主用户、沉默召回用户、活跃老玩家。")}
          ${strategyMetric("用户游戏", "recent_game / lost_game", "用于判断优先推哪个游戏内容，以及视频后导哪个游戏入口。")}
          ${strategyMetric("视频标签", "game_tag / content_tag / topic_tag", "来自现有标签体系，支持棋牌技巧、牌局爽点、打牌段子、棋牌短剧等垂类泛娱乐。")}
          ${strategyMetric("标签权重", "segment_tag_weight", "不同用户人群下，同一个标签权重不同；这是第一版排序的主参数。")}
          ${strategyMetric("内容表现", "valid_play / finish / negative", "有效播放、完播、负反馈先做最小闭环，不先上复杂预测模型。")}
          ${strategyMetric("游戏转化", "game_click / effective_round", "视频后点击游戏、进入房间、完成有效局，用来修正导流标签和内容权重。")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><div><h2>标签权重怎么进入排序</h2><p>按人群读取权重，不同人群看到不同内容顺序</p></div></div>
        <div class="strategy-formula">
          <b>标签权重分</b>
          <code>Σ(视频命中的标签 × 当前用户人群下该标签权重) / Σ(当前人群可用标签最大权重)</code>
        </div>
        <div class="strategy-example">
          <span>例：低活双扣用户</span>
          <p>双扣 +30，打牌段子 +18，地域朋友局 +15，短剧 +12，规则教学 +4，强活动导流 -8。</p>
          <p>因此这个用户前排优先出现双扣段子、翻盘爽点、地域朋友局，而不是规则教学或强活动广告。</p>
        </div>
      </div>
    </section>

    <section class="panel strategy-race-panel">
      <div class="panel-head"><div><h2>UGC 赛马怎么接入最低版推荐</h2><p>UGC 不是另一个推荐系统，而是推荐前的流量资格和流量上限</p></div><span class="result-badge">必须保留</span></div>
      <div class="formula-table-wrap"><table class="formula-table strategy-race-table">
        <thead><tr><th>赛马池</th><th>曝光上限</th><th>晋级/降级依据</th><th>进入推荐时的动作</th></tr></thead>
        <tbody>
          ${strategyRace("T0", "同桶 200-500 曝光", "审核通过且标签完整；重点看有效播放和负反馈", "只进入探索位，不参与主排序")}
          ${strategyRace("T1", "同桶 1,000-3,000 曝光", "有效播放高于同桶均值，负反馈低于阈值", "参与低权重召回，赛马系数 0.6")}
          ${strategyRace("T2", "同桶 5,000-10,000 曝光", "完播、互动、游戏点击至少两项优于同桶均值", "进入正常候选，赛马系数 0.85")}
          ${strategyRace("T3", "按正常内容分发", "连续多轮稳定，且没有风险信号", "与官方内容同池排序，赛马系数 1.0")}
        </tbody>
      </table></div>
    </section>

    <section class="strategy-guardrails">
      <div><strong>频控第一版</strong><p>同类型最多连续 ${state.config.maxSameTypeConsecutive} 条；同作者每页最多 ${state.config.maxSameAuthorPerPage} 条；强导流内容间隔不少于 ${state.config.strongGuideInterval} 条。</p></div>
      <div><strong>导流第一版</strong><p>只有当视频游戏标签命中用户近期/流失游戏，且强导流未处于冷却期，才展示同款游戏入口。</p></div>
      <div><strong>修正第一版</strong><p>每天按人群维度回看有效播放、完播、负反馈、游戏点击、有效局，调整对应人群的标签权重。</p></div>
    </section>
  `;
}

function overviewKpi(label: string, value: string, change: string, note: string, color: string, source: string, calculation: string, usage: string) {
  return `<article class="overview-kpi" style="--accent:${color}">
    <span>${label}</span><strong>${value}</strong><div><b>${change}</b><em>${note}</em></div>
    <details class="metric-note"><summary>指标说明</summary><p><b>数据：</b>${source}</p><p><b>口径：</b>${calculation}</p><p><b>用途：</b>${usage}</p></details>
  </article>`;
}

function healthRow(label: string, value: number, status: string) {
  return `<div><span>${label}</span><b><i class="${status}" style="width:${value}%"></i></b><strong>${value}</strong></div>`;
}

function fallbackSnapshot(): DashboardSnapshot {
  const exposure = 126840;
  return {
    generatedAt: new Date().toISOString(),
    exposure,
    validPlay: 88652,
    gameEntry: 11246,
    effectiveGame: 6839,
    validPlayRate: 0.699,
    finishRate: 0.586,
    gameReturnRate: 0.077,
    negativeRate: 0.014,
    dailyTrend: [
      { label: "周一", exposure: 98400, validPlay: 64210, effectiveGame: 4810 },
      { label: "周二", exposure: 103600, validPlay: 68740, effectiveGame: 5120 },
      { label: "周三", exposure: 108900, validPlay: 73400, effectiveGame: 5480 },
      { label: "周四", exposure: 106200, validPlay: 72010, effectiveGame: 5630 },
      { label: "周五", exposure: 116500, validPlay: 80120, effectiveGame: 6010 },
      { label: "周六", exposure: 121800, validPlay: 84290, effectiveGame: 6420 },
      { label: "今日", exposure, validPlay: 88652, effectiveGame: 6839 },
    ],
    funnel: [
      { label: "视频曝光", value: exposure },
      { label: "有效播放", value: 88652 },
      { label: "导流曝光", value: 32740 },
      { label: "导流点击", value: 16582 },
      { label: "进入游戏", value: 11246 },
      { label: "匹配 / 入桌", value: 8417 },
      { label: "完成有效局", value: 6839 },
    ],
    contentMix: [
      { label: "爽点牌局 / 实战复盘", value: 31, color: "#1769aa" },
      { label: "技巧教学 / 失误避坑", value: 24, color: "#287a55" },
      { label: "棋牌泛娱乐 / 地域社交", value: 28, color: "#d68a22" },
      { label: "活动赛事 / 产品功能", value: 9, color: "#6a55a3" },
      { label: "探索内容", value: 8, color: "#84909c" },
    ],
    alerts: [
      { level: "高", title: "活动内容负反馈升高", detail: "周末冲榜赛连续两小时不感兴趣率超过同类均值 38%，已自动停止保底扩量。" },
      { level: "中", title: "新手内容供给不足", detail: "规则入门池可推荐内容仅 14 条，预计三日后首屏重复率超过警戒线。" },
      { level: "低", title: "温州地域内容表现良好", detail: "温州低活用户次日回访率提升 6.2%，建议增加同类 UGC 冷启动名额。" },
    ],
    events: [
      { time: "12:06:42", type: "精排", title: "完成一轮首页推荐", detail: "用户 U1002，候选 486 条，输出 20 条，首位为棋牌泛娱乐短剧。" },
      { time: "12:06:31", type: "赛马", title: "UGC_0102 晋级 T2", detail: "有效播放 84%、完播 75%、负反馈 0.8%，满足一级赛马阈值。" },
      { time: "12:06:08", type: "频控", title: "延后强导流活动内容", detail: "距上一次游戏入口仅 3 条，未满足最小间隔 5 条。" },
      { time: "12:05:54", type: "准入", title: "拦截高风险投稿", detail: "命中未授权和夸大收益表达，进入风险复审池。" },
      { time: "12:05:37", type: "召回", title: "低活用户触发泛娱乐召回", detail: "增加牌桌短剧、地域社交和爽点牌局候选，共召回 128 条。" },
    ],
  };
}

function browserSnapshot(): DashboardSnapshot {
  const data = fallbackSnapshot();
  const exposure = data.exposure + Math.round((Math.random() - 0.5) * 4400);
  const validPlayRate = 0.699 + (Math.random() - 0.5) * 0.014;
  const validPlay = Math.round(exposure * validPlayRate);
  const gameEntry = Math.round(exposure * (0.088 + (Math.random() - 0.5) * 0.008));
  const effectiveGame = Math.round(gameEntry * (0.604 + (Math.random() - 0.5) * 0.03));
  const now = new Date();
  return {
    ...data,
    generatedAt: now.toISOString(),
    exposure,
    validPlay,
    validPlayRate,
    gameEntry,
    effectiveGame,
    gameReturnRate: effectiveGame / validPlay,
    finishRate: 0.586 + (Math.random() - 0.5) * 0.01,
    negativeRate: 0.014 + (Math.random() - 0.5) * 0.002,
    dailyTrend: data.dailyTrend.map((item, index) => index === data.dailyTrend.length - 1
      ? { ...item, exposure, validPlay, effectiveGame }
      : item),
    funnel: [
      { label: "视频曝光", value: exposure },
      { label: "有效播放", value: validPlay },
      { label: "导流曝光", value: Math.round(exposure * 0.258) },
      { label: "导流点击", value: Math.round(exposure * 0.131) },
      { label: "进入游戏", value: gameEntry },
      { label: "匹配 / 入桌", value: Math.round(gameEntry * 0.748) },
      { label: "完成有效局", value: effectiveGame },
    ],
    events: data.events.map((event, index) => ({
      ...event,
      time: new Date(now.getTime() - index * 61_000).toLocaleTimeString("zh-CN", { hour12: false }),
    })),
  };
}

async function loadSnapshot() {
  if (location.hostname.endsWith("github.io")) {
    state.snapshot = browserSnapshot();
    if (state.view === "overview") render();
    return;
  }
  try {
    const response = await fetch("/api/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error("snapshot unavailable");
    state.snapshot = await response.json() as DashboardSnapshot;
  } catch {
    state.snapshot = browserSnapshot();
  }
  if (state.view === "overview") render();
}

function runView() {
  const result = run();
  const user = currentUser();
  const ranked = result.ranked;
  const avgReturn = ranked.length ? ranked.slice(0, 6).reduce((sum, item) => sum + item.breakdown.pGameReturn, 0) / Math.min(6, ranked.length) : 0;
  const avgValid = ranked.length ? ranked.slice(0, 6).reduce((sum, item) => sum + item.breakdown.pValidPlay, 0) / Math.min(6, ranked.length) : 0;
  return `
    <section class="control-strip">
      <label>目标用户
        <select id="user-select">${users.map((item) => `<option value="${item.id}" ${item.id === user.id ? "selected" : ""}>${item.name} · ${item.stage}</option>`).join("")}</select>
      </label>
      <label>进入场景
        <select id="scene-select">${scenes.map((item) => `<option value="${item}" ${item === state.scene ? "selected" : ""}>${item}</option>`).join("")}</select>
      </label>
      <button class="button primary" data-action="run-reco">重新计算推荐</button>
      <div class="profile-summary">
        <span>${user.region}</span><span>${user.skill}</span><span>${user.recentGames[0] ?? user.historyGames[0]}偏好</span>
      </div>
    </section>
    ${dataNote("用户画像、近期游戏行为、视频行为和当前入口场景", "切换用户或场景后重新执行准入、召回、粗排、精排与重排", "模拟不同用户在不同位置看到的推荐结果")}

    ${userRankingContext(user, result.ranked)}

    <section class="kpi-grid">
      ${kpi("准入内容", `${result.admittedCount}`, `过滤 ${result.filteredCount} 条风险或待审内容`, [9, 9, 10, 10, 10, result.admittedCount], "内容状态、授权、版权风险、质量分", "通过硬性准入规则的视频数")}
      ${kpi("召回候选", `${result.recalledCount}`, "7 路召回合并去重", [5, 7, 6, 8, 7, result.recalledCount], "用户兴趣、游戏、地域、阶段、热门、运营、探索召回", "各路候选按 videoId 合并去重")}
      ${kpi("首屏有效播放预估", pct(avgValid), "前 6 条平均概率", [0.59, 0.62, 0.66, 0.64, 0.69, avgValid], "模型预测 pValidPlay", "排序前 6 条预测概率的算术平均")}
      ${kpi("游戏回流预估", pct(avgReturn), "以完成有效局为结果", [0.11, 0.13, 0.14, 0.12, 0.15, avgReturn], "模型预测 pGameReturn", "排序前 6 条视频后完成有效局概率的平均")}
    </section>

    <section class="workspace-grid">
      <div class="panel ranking-panel">
        <div class="panel-head">
          <div><h2>瀑布流排序结果</h2><p>已执行准入、召回、粗排、精排与体验重排</p></div>
          <span class="result-badge">${ranked.length} 条结果</span>
        </div>
        ${dataNote("每条内容的标签、历史表现、用户匹配和模型预测值", "精排分 = 正向目标加权和 - 负反馈 / 疲劳 / 风险 / 强导流惩罚", "决定瀑布流最终顺序；点击任意内容可查看完整拆分")}
        <div class="ranking-list">
          ${ranked.map(recommendationRow).join("")}
        </div>
      </div>
      <aside class="panel side-insight">
        <div class="panel-head"><div><h2>本次策略摘要</h2><p>影响排序的主要因素</p></div></div>
        ${dataNote("当前用户画像与本次排序 Top 结果", "统计首屏内容类型和候选命中的召回通道", "检查结果是否符合用户阶段目标和多样性约束")}
        ${strategySummary(user, ranked)}
      </aside>
    </section>
  `;
}

function chipList(items: string[], empty = "无") {
  return items.length ? items.map((item) => `<i>${item}</i>`).join("") : `<i>${empty}</i>`;
}

function userStageGoal(user: UserProfile) {
  if (user.stage === "新增") return "先让用户看懂玩法并完成首局";
  if (user.stage === "低活") return "用轻松内容重新接住用户，再逐步导回游戏";
  if (user.stage === "沉默") return "降低回归门槛，优先用地域和熟人局内容召回";
  if (user.stage === "回流") return "承接回流兴趣，尽快促成稳定开局";
  return "保持游戏兴趣，补充技巧和爽点内容提高留存";
}

function userRankingContext(user: UserProfile, ranked: RankedVideo[]) {
  const top = ranked[0];
  const topText = top
    ? `因此首位优先给到「${top.video.title}」：它同时命中${top.recallSources.slice(0, 2).join("、")}，精排分 ${score(top.breakdown.feedScore)}，游戏回流预估 ${pct(top.breakdown.pGameReturn)}。`
    : "当前没有可推荐内容。";
  return `
    <section class="ranking-context">
      <div class="panel user-profile-card">
        <div class="panel-head"><div><h2>当前用户画像</h2><p>这个用户决定了下面瀑布流为什么这样排</p></div><span class="result-badge">${user.id}</span></div>
        <div class="profile-grid">
          <div><span>用户阶段</span><strong>${user.stage}</strong><p>${userStageGoal(user)}</p></div>
          <div><span>地区 / 水平</span><strong>${user.region} · ${user.skill}</strong><p>地域内容、玩法深度和讲解难度都会受影响。</p></div>
          <div><span>近期玩的游戏</span><strong>${user.recentGames.join("、") || "暂无"}</strong><p>近期游戏会强影响游戏匹配和召回。</p></div>
          <div><span>流失/历史游戏</span><strong>${[...user.lostGames, ...user.historyGames].slice(0, 3).join("、") || "暂无"}</strong><p>用于召回以前玩过但最近没打开的游戏。</p></div>
        </div>
        <div class="profile-tags">
          <div><b>内容偏好</b><span>${chipList(user.preferredTypes)}</span></div>
          <div><b>主题偏好</b><span>${chipList(user.preferredTopics)}</span></div>
          <div><b>情绪偏好</b><span>${chipList(user.preferredEmotions)}</span></div>
          <div><b>近期负反馈</b><span>${chipList(user.fastSkippedTypes, "暂无明显负反馈")}</span></div>
        </div>
      </div>
      <div class="panel ranking-logic-card">
        <div class="panel-head"><div><h2>这次瀑布流怎么排</h2><p>按当前用户和当前场景实时计算</p></div></div>
        <div class="logic-flow">
          <div><span>1</span><strong>先过滤</strong><p>只保留已入库、已授权、低版权风险、质量达标内容。</p></div>
          <div><span>2</span><strong>再召回</strong><p>按游戏、阶段、场景、标签、泛娱乐、热门和探索召回。</p></div>
          <div><span>3</span><strong>粗排</strong><p>先看匹配、质量、近期表现和业务目标，筛出精排候选。</p></div>
          <div><span>4</span><strong>精排</strong><p>重点计算有效播放、完播、互动、游戏回流和生命周期提升。</p></div>
          <div><span>5</span><strong>重排</strong><p>最后做同类型、同作者、强导流间隔控制。</p></div>
        </div>
        <div class="logic-conclusion"><strong>当前排序结论</strong><p>${topText}</p></div>
      </div>
    </section>
  `;
}

function kpi(label: string, value: string, note: string, values: number[], source: string, calculation: string) {
  return `<article class="kpi"><div><span>${label}</span><strong>${value}</strong><small>${note}</small><p class="kpi-definition"><b>数据</b>${source}<br><b>口径</b>${calculation}</p></div>${sparkline(values)}</article>`;
}

function contributionPill(label: string, value: number) {
  return `<span><b>${label}</b><em>${score(value)}</em></span>`;
}

function rankingReason(item: RankedVideo) {
  const v = item.video;
  const b = item.breakdown;
  const user = currentUser();
  const reasons: string[] = [];
  if ([...user.recentGames, ...user.historyGames, ...user.lostGames].includes(v.game)) reasons.push(`用户玩过/流失过${v.game}`);
  if (user.preferredTypes.includes(v.primaryType)) reasons.push(`内容类型命中偏好「${v.primaryType}」`);
  if (v.targetStages.includes(user.stage)) reasons.push(`适合${user.stage}用户`);
  if (v.region.includes(user.region) || v.region.includes("浙江")) reasons.push(`地域与${user.region}相关`);
  if (v.scenes.includes(state.scene)) reasons.push(`可投放到${state.scene}`);
  if (item.recallSources.includes("棋牌泛娱乐召回")) reasons.push("低活/沉默用户触发棋牌泛娱乐承接");
  if (b.negativePenalty > 0.2) reasons.push("但用户对同类内容有负反馈，已扣分");
  if (v.strongGuide && !user.guideCooldown) reasons.push("视频可承接到游戏入口");
  return reasons.length ? reasons.slice(0, 4).join("；") : "主要由有效播放、完播和游戏回流预测分推动";
}

function recommendationRow(item: RankedVideo) {
  const v = item.video;
  const riskClass = item.breakdown.riskPenalty > 0.15 ? "risk" : "";
  return `
    <button class="ranking-row ${riskClass}" data-video-id="${v.id}">
      <span class="rank">${String(item.rank).padStart(2, "0")}</span>
      <img src="${assetUrl(v.thumbnail)}" alt="${v.title}缩略图" />
      <span class="content-main">
        <span class="title-line"><strong>${v.title}</strong><em class="pool ${v.racePool.toLowerCase()}">${v.racePool}</em></span>
        <span class="meta">${v.game} · ${v.primaryType} · ${v.duration}秒 · ${v.author}</span>
        <span class="chips">${item.recallSources.slice(0, 3).map((source) => `<i>${source.replace("召回", "")}</i>`).join("")}</span>
      </span>
      <span class="score-cell"><small>粗排分</small><strong>${score(item.breakdown.roughScore)}</strong></span>
      <span class="score-cell primary-score"><small>精排分</small><strong>${score(item.breakdown.feedScore)}</strong></span>
      <span class="return-cell"><small>回流概率</small><strong>${pct(item.breakdown.pGameReturn)}</strong><em>${item.guideEntry}</em></span>
      <span class="row-arrow">›</span>
      <span class="rank-explain">
        <span class="why-line"><b>为什么排第 ${item.rank}：</b>${rankingReason(item)}</span>
        <span class="contribution-pills">
          ${contributionPill("游戏匹配", item.breakdown.gameMatch)}
          ${contributionPill("阶段匹配", item.breakdown.userStageMatch)}
          ${contributionPill("场景匹配", item.breakdown.sceneMatch)}
          ${contributionPill("有效播放", item.breakdown.pValidPlay)}
          ${contributionPill("游戏回流", item.breakdown.pGameReturn)}
          ${item.breakdown.negativePenalty > 0 ? contributionPill("负反馈扣分", item.breakdown.negativePenalty) : ""}
        </span>
      </span>
    </button>
  `;
}

function strategySummary(user: UserProfile, ranked: RankedVideo[]) {
  const topTypes = [...new Set(ranked.slice(0, 6).map((item) => item.video.primaryType))];
  const sourceCounts = new Map<string, number>();
  ranked.forEach((item) => item.recallSources.forEach((source) => sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)));
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `
    <div class="focus-block">
      <span class="block-label">用户策略目标</span>
      <strong>${user.stage === "沉默" ? "召回开局" : user.stage === "低活" ? "内容承接 + 促活" : user.stage === "新增" ? "快速上手 + 首局" : "留存与稳定开局"}</strong>
      <p>${user.name}当前偏好${user.preferredTypes.slice(0, 2).join("、")}，主要游戏为${[...user.recentGames, ...user.historyGames].slice(0, 2).join("、") || "暂无"}。</p>
    </div>
    <div class="summary-section">
      <h3>首屏内容结构</h3>
      ${topTypes.map((type, index) => `<div class="bar-row"><span>${type}</span><b><i style="width:${Math.max(28, 82 - index * 11)}%"></i></b></div>`).join("")}
    </div>
    <div class="summary-section">
      <h3>主要召回通道</h3>
      ${sources.map(([source, count]) => `<div class="source-row"><span>${source}</span><strong>${count}</strong></div>`).join("")}
    </div>
    <div class="rule-note">
      <strong>体验重排已生效</strong>
      <p>同类型连续不超过 ${state.config.maxSameTypeConsecutive} 条，同作者每页不超过 ${state.config.maxSameAuthorPerPage} 条，强导流间隔至少 ${state.config.strongGuideInterval} 条。</p>
    </div>
  `;
}

function contentView() {
  const types = ["全部", ...new Set(state.videos.map((video) => video.primaryType))];
  const filtered = state.videos.filter((video) =>
    (state.contentType === "全部" || video.primaryType === state.contentType) &&
    (state.contentStatus === "全部" || video.status === state.contentStatus) &&
    (!state.contentQuery || [video.title, video.author, video.game, ...video.topics, ...video.keywords].join(" ").includes(state.contentQuery)),
  );
  return `
    <section class="filter-bar">
      <label class="search-label">搜索内容<input id="content-query" value="${state.contentQuery}" placeholder="标题、作者、主题或关键词" /></label>
      <label>内容类型<select id="content-type">${types.map((type) => `<option ${type === state.contentType ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>入库状态<select id="content-status">${["全部", "已入库", "待审核", "已下架"].map((status) => `<option ${status === state.contentStatus ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      <span class="filter-count">${filtered.length} / ${state.videos.length}</span>
    </section>
    ${dataNote("内容标签表、作者资料、授权审核和历史效果数据", "搜索和筛选仅改变后台查看范围，不直接修改线上分发", "定位某类内容的供给量、标签质量和准入状态")}
    <section class="panel">
      <div class="panel-head"><div><h2>视频内容池</h2><p>字段来自现有视频标签体系，准入状态直接影响是否进入推荐候选</p></div></div>
      ${dataNote("标签结构取一级/二级内容类型、主题和情绪；表现取曝光后行为", "可分发 = 已入库 + 已授权 + 非高版权风险 + 质量分不低于 60", "只有可分发内容能进入召回；赛马池决定 UGC 可获得的流量上限")}
      <div class="column-guide"><span><b>标签结构</b>用于匹配用户兴趣和内容多样性</span><span><b>目标人群 / 场景</b>用于场景召回和阶段匹配</span><span><b>表现</b>用于近期表现分和赛马判断</span><span><b>准入</b>是推荐前的硬过滤条件</span></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>内容</th><th>标签结构</th><th>目标人群 / 场景</th><th>表现</th><th>准入</th><th>赛马池</th></tr></thead>
          <tbody>${filtered.map(contentRow).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function contentRow(video: Video) {
  const admitted = video.status === "已入库" && video.authorized && video.copyrightRisk !== "高" && video.quality >= 0.6;
  return `<tr>
    <td><div class="table-content"><img src="${assetUrl(video.thumbnail)}" alt="" /><div><strong>${video.title}</strong><small>${video.id} · ${video.author}</small></div></div></td>
    <td><strong>${video.primaryType} / ${video.secondaryType}</strong><small>${video.topics.slice(0, 2).join(" · ")}<br>${video.emotions.slice(0, 3).join(" · ")}</small></td>
    <td><strong>${video.targetStages.join(" / ")}</strong><small>${video.scenes.slice(0, 2).join(" · ")}</small></td>
    <td><strong>有效播放 ${pct(video.metrics.validPlayRate)}</strong><small>完播 ${pct(video.metrics.finishRate)} · 回流 ${pct(video.metrics.gameReturnRate)}</small></td>
    <td><span class="status ${admitted ? "ok" : "blocked"}">${admitted ? "可分发" : "已拦截"}</span><small>${video.copyrightRisk}风险 · 质量 ${score(video.quality)}</small></td>
    <td><span class="pool ${video.racePool.toLowerCase()}">${video.racePool}</span></td>
  </tr>`;
}

function flowCard(step: string, title: string, text: string, tags: string[]) {
  return `<article class="flow-card">
    <span>${step}</span>
    <strong>${title}</strong>
    <p>${text}</p>
    <div>${tags.map((tag) => `<i>${tag}</i>`).join("")}</div>
  </article>`;
}

function raceStep(pool: string, title: string, text: string, result: string) {
  return `<article class="race-step-card">
    <span>${pool}</span>
    <strong>${title}</strong>
    <p>${text}</p>
    <em>${result}</em>
  </article>`;
}

function pipelineView() {
  return `
    <section class="pipeline-hero">
      <div>
        <h2>视频分发主链路：内容先入池，UGC 先赛马，最后按用户画像生成瀑布流</h2>
        <p>看这页只需要顺着箭头走：左边是内容怎么进来，中间是怎么变成候选，右边是怎么分发给目标用户，下面是 UGC 用真实数据不断晋级或降权。</p>
      </div>
      <div class="pipeline-legend">
        <span><i class="ingest"></i>主链路</span>
        <span><i class="race"></i>UGC 分支</span>
        <span><i class="rank"></i>推荐排序</span>
        <span><i class="feedback"></i>数据回流</span>
      </div>
    </section>
    ${dataNote("视频素材、投稿单、授权、内容标签、用户画像、曝光播放、游戏行为和负反馈日志", "先硬准入，再召回排序，再按目标用户真实结果更新内容池和赛马池", "让内容分发服务于棋牌游戏用户承接和回流，而不是只按静态标签权重推送")}

    <section class="visual-flow">
      <div class="flow-source official">
        <strong>官方 / 达人内容</strong>
        <span>运营素材、达人授权、赛事活动、教学复盘</span>
        <em>审核通过后直接进入内容池</em>
      </div>
      <div class="flow-source ugc">
        <strong>UGC 玩家投稿</strong>
        <span>打牌段子、牌桌短剧、朋友局实拍、玩家复盘</span>
        <em>审核通过后先进入 T0 赛马</em>
      </div>
      <div class="flow-gate">准入审核<br><small>版权 / 合规 / 质量 / 标签完整</small></div>
      <div class="flow-pool">内容池<br><small>可召回视频集合</small></div>
      <div class="flow-rank">推荐计算<br><small>召回 → 粗排 → 精排 → 重排</small></div>
      <div class="flow-users">
        <strong>目标用户瀑布流</strong>
        <span>低活双扣用户</span>
        <span>新手双扣用户</span>
        <span>活跃老玩家</span>
        <span>沉默召回用户</span>
      </div>
      <div class="flow-feedback">行为回流<br><small>曝光 / 播放 / 负反馈 / 进游戏 / 有效局</small></div>
    </section>

    <section class="panel main-flow-panel">
      <div class="panel-head"><div><h2>主流程怎么跑</h2><p>从视频进来，到某个用户刷到它</p></div><span class="result-badge">主链路</span></div>
      <div class="big-flow">
        ${flowCard("1", "内容进入", "官方/达人内容和 UGC 都先形成内容记录，UGC 默认待审核。", ["视频文件", "标题封面", "授权"])}
        ${flowCard("2", "准入审核", "不过审的内容不进推荐；通过后补齐游戏、玩法、类型、情绪、目标人群标签。", ["版权", "合规", "质量分"])}
        ${flowCard("3", "内容池", "官方/达人内容直接可召回；UGC 必须先获得赛马池资格。", ["已入库", "可召回", "赛马池"])}
        ${flowCard("4", "用户请求", "用户打开视频流时，系统读取他玩的游戏、地区、阶段、偏好和负反馈。", ["近期游戏", "用户阶段", "偏好"])}
        ${flowCard("5", "排序输出", "召回候选后计算粗排、精排和频控，输出这个用户的瀑布流顺序。", ["召回", "粗排", "精排"])}
      </div>
    </section>

    <section class="ugc-race-diagram">
      <div class="panel">
        <div class="panel-head"><div><h2>UGC 赛马分支</h2><p>新投稿不是直接大量推荐，而是从小流量开始拿真实表现换流量</p></div><span class="result-badge">UGC 分支</span></div>
        <div class="race-track">
          ${raceStep("T0", "小样本试投", "同游戏、同类型、同地域分桶，先给最小曝光。", "差：复审/降权")}
          ${raceStep("T1", "冷启动扩样", "达到基础有效播放和完播阈值，扩大样本。", "一般：继续测试")}
          ${raceStep("T2/T3", "同桶赛马", "和同桶均值比较有效播放、互动、回流、负反馈。", "好：进入更多召回")}
          ${raceStep("T4", "稳定推荐", "连续多轮稳定后进入正常推荐候选，仍受衰退监控。", "稳定：长期供给")}
        </div>
      </div>
    </section>

    <section class="pipeline-example">
      <div class="example-user">
        <span>目标用户例子</span>
        <strong>三日未开局用户 · 浙江 · 双扣</strong>
        <p>近期玩过双扣，已经三天没开局；偏好棋牌泛娱乐、爽点牌局、地域社交；不爱看规则入门和活动广告。</p>
      </div>
      <div class="example-arrow">所以</div>
      <div class="example-feed">
        <div><b>1</b><strong>牌桌短剧 / 打牌段子</strong><span>轻内容先接住低活用户</span></div>
        <div><b>2</b><strong>双扣极限翻盘</strong><span>命中玩过的游戏和爽点偏好</span></div>
        <div><b>3</b><strong>温州朋友局</strong><span>地域和熟人局共鸣</span></div>
        <div><b>4</b><strong>同款游戏入口</strong><span>观看后导回双扣开局</span></div>
      </div>
      <div class="example-feedback">
        <strong>看完后的数据回流</strong>
        <p>有效播放、完播、点击游戏入口、完成有效局、负反馈会同时更新用户画像、内容表现和 UGC 赛马池。</p>
      </div>
    </section>

    <section class="pipeline-output">
      <div class="panel">
        <div class="panel-head"><div><h2>最终系统输出</h2><p>每一轮推荐结束后都会产出两个结果</p></div></div>
        <div class="target-flow">
          <div><strong>给用户</strong><p>一页有顺序的瀑布流，以及每条视频对应的游戏入口。</p></div>
          <div><strong>给内容</strong><p>曝光、有效播放、完播、互动、负反馈、游戏回流等表现分。</p></div>
          <div><strong>给 UGC</strong><p>晋级、继续测试、降权、复审四类赛马动作。</p></div>
          <div><strong>给策略</strong><p>下一轮排序权重、召回池、频控和运营扶持的调整依据。</p></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>赛马动作输出</h2><p>UGC 每一轮赛马后的系统动作</p></div></div>
        <div class="race-action-flow">
          <div><span class="decision 晋级">晋级</span><p>扩大流量池，进入更多召回通道。</p></div>
          <div><span class="decision 继续测试">继续测试</span><p>样本不足或接近均值，保留当前池。</p></div>
          <div><span class="decision 降权">降权</span><p>减少曝光，等待新证据或运营复核。</p></div>
          <div><span class="decision 复审">复审</span><p>风险优先，停止扩量并进入人工审核。</p></div>
        </div>
      </div>
    </section>
  `;
}

const weightLabels: Record<string, string> = {
  gameMatch: "游戏匹配",
  userStageMatch: "用户阶段匹配",
  sceneMatch: "场景匹配",
  contentQuality: "内容质量",
  recentPerformance: "近期表现",
  businessGoalMatch: "业务目标匹配",
  freshness: "新鲜度",
  exploration: "探索价值",
  pValidPlay: "有效播放概率",
  pFinish: "完播概率",
  pInteraction: "互动概率",
  pGameReturn: "游戏回流概率",
  pLifecycleImprove: "生命周期提升",
  matchScore: "综合匹配",
  operationBoost: "运营加权",
  negativePenalty: "负反馈惩罚",
  fatiguePenalty: "疲劳惩罚",
  riskPenalty: "风险惩罚",
  hardGuidePenalty: "强导流惩罚",
};

function configView() {
  return `
    <section class="config-layout">
      <div class="panel">
        <div class="panel-head"><div><h2>粗排权重</h2><p>决定哪些召回候选进入精排</p></div><button class="button secondary small" data-action="reset-weights">恢复默认</button></div>
        ${dataNote("内容标签匹配、内容质量、历史表现、新鲜度和探索标记", "粗排分 = 各特征归一化值 × 对应权重后求和", "从大规模召回候选中低成本筛出精排集合")}
        <div class="sliders">${Object.entries(state.config.rough).map(([key, value]) => slider("rough", key, value)).join("")}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>精排权重</h2><p>正向目标和惩罚项共同决定最终顺序</p></div></div>
        ${dataNote("播放、完播、互动、回流、生命周期模型预测及风险特征", "精排分 = 正向概率与匹配分加权 - 各类惩罚项", "平衡用户观看体验与回到棋牌游戏并完成对局的业务目标")}
        <div class="sliders">${Object.entries(state.config.feed).map(([key, value]) => slider("feed", key, value)).join("")}</div>
      </div>
      <div class="panel frequency-panel">
        <div class="panel-head"><div><h2>探索与频控</h2><p>保护内容多样性并控制强导流体验</p></div></div>
        ${dataNote("最终排序队列中的内容类型、作者、探索标记和导流强度", "精排完成后按比例插入探索内容，并逐条检查连续次数与最小间隔", "避免内容同质化、作者霸屏和频繁强导流造成反感")}
        <div class="number-grid">
          ${numberSetting("explorationRatio", "探索流量比例", state.config.explorationRatio * 100, "%", 0, 30)}
          ${numberSetting("maxSameTypeConsecutive", "同类型最多连续", state.config.maxSameTypeConsecutive, "条", 1, 6)}
          ${numberSetting("maxSameAuthorPerPage", "同作者每页最多", state.config.maxSameAuthorPerPage, "条", 1, 5)}
          ${numberSetting("strongGuideInterval", "强导流最小间隔", state.config.strongGuideInterval, "条", 2, 10)}
        </div>
      </div>
      <div class="panel config-preview">
        <div class="panel-head"><div><h2>配置影响预览</h2><p>当前用户：${currentUser().name} · ${state.scene}</p></div><button class="button primary small" data-action="go-run">查看排序结果</button></div>
        ${dataNote("当前页面全部权重与频控参数", "参数变化后立即重新计算当前用户的前 5 条结果", "上线前观察权重调整是否改变目标内容和回流预估")}
        ${configPreview()}
      </div>
    </section>
  `;
}

function slider(group: "rough" | "feed", key: string, value: number) {
  const isPenalty = key.toLowerCase().includes("penalty");
  return `<label class="slider-row">
    <span><strong>${weightLabels[key] ?? key}</strong><small>${isPenalty ? "从最终分扣除" : group === "rough" ? "粗排正向权重" : "精排正向权重"}</small></span>
    <input type="range" min="0" max="40" step="1" value="${Math.round(value * 100)}" data-weight-group="${group}" data-weight-key="${key}" />
    <output>${Math.round(value * 100)}%</output>
  </label>`;
}

function numberSetting(key: string, label: string, value: number, unit: string, min: number, max: number) {
  return `<label class="number-setting"><span>${label}</span><div><input type="number" min="${min}" max="${max}" value="${value}" data-config-key="${key}" /><em>${unit}</em></div></label>`;
}

function configPreview() {
  const ranked = run().ranked.slice(0, 5);
  return `<div class="preview-list">${ranked.map((item) => `<div><span>${item.rank}</span><img src="${assetUrl(item.video.thumbnail)}" alt="" /><p><strong>${item.video.title}</strong><small>${item.video.primaryType} · 回流 ${pct(item.breakdown.pGameReturn)}</small></p><b>${score(item.breakdown.feedScore)}</b></div>`).join("")}</div>`;
}

interface FormulaField {
  name: string;
  code: string;
  source: string;
  formula: string;
  usage: string;
}

const roughFormulaFields: FormulaField[] = [
  { name: "游戏匹配", code: "gameMatch", source: "用户近期/历史/流失游戏、玩法标签、视频所属游戏", formula: "45%×近期游戏 + 25%×历史游戏 + 15%×流失游戏 + 10%×玩法交集 + 5%×同品类", usage: "识别用户最可能重新进入的游戏" },
  { name: "用户阶段匹配", code: "userStageMatch", source: "用户新增/活跃/低活/沉默/回流阶段、水平、内容目标人群", formula: "45%×阶段接近度 + 25%×阶段直匹 + 20%×水平匹配 + 10%×兴趣匹配", usage: "让不同生命周期用户看到不同承接内容" },
  { name: "场景匹配", code: "sceneMatch", source: "入口场景、视频时长、内容类型、强导流标记", formula: "40%×场景可投 + 25%×时长适配 + 20%×场景意图 + 15%×导流机会", usage: "匹配首页、等待、局后、退出前等使用情境" },
  { name: "内容质量", code: "contentQuality", source: "审核或质量模型输出的 video.quality", formula: "直接使用质量分，范围 0-1；低于 0.6 在准入阶段拦截", usage: "控制低质内容进入排序" },
  { name: "近期表现", code: "recentPerformance", source: "有效播放、完播、互动、游戏回流、负反馈", formula: "25%×有效播放/68% + 20%×完播/55% + 15%×互动/12% + 25%×回流/11% + 15%×(1-负反馈/2.5%)", usage: "用同类基线衡量内容近期竞争力" },
  { name: "业务目标匹配", code: "businessGoalMatch", source: "用户阶段目标、内容业务目标、运营动作、活动与导流属性", formula: "35%×目标匹配 + 25%×分发动作 + 20%×活动属性 + 20%×入口能力", usage: "对齐拉新、促活、留存、召回和转化目标" },
  { name: "新鲜度", code: "freshness", source: "内容发布至今小时数 ageHours、是否 UGC", formula: "max(0, 1-ageHours/48)；非 UGC 分母使用 72 小时", usage: "给新内容合理曝光，同时随时间自然衰减" },
  { name: "探索价值", code: "exploration", source: "曝光量、发布时间、作者信用、主题、同类反馈、类型偏好", formula: "30%×新内容 + 25%×新作者 + 20%×新主题 + 15%×相似反馈 + 10%×多样性需求", usage: "发现新内容和用户潜在兴趣" },
];

const feedFormulaFields: FormulaField[] = [
  { name: "有效播放概率", code: "pValidPlay", source: "用户有效播放率、视频有效播放率、场景匹配分", formula: "40%×用户有效播放率 + 40%×视频有效播放率 + 20%×(场景匹配×82%)", usage: "预测视频能否接住用户" },
  { name: "完播概率", code: "pFinish", source: "用户完播率、视频完播率、视频时长", formula: "35%×用户完播率 + 45%×视频完播率 + 20%×时长先验（≤45秒为72%，否则55%）", usage: "预测用户是否看完" },
  { name: "互动概率", code: "pInteraction", source: "用户互动倾向、视频互动率、作者信用、入口场景", formula: "30%×用户互动倾向 + 40%×视频互动率 + 20%×作者信用×15% + 10%×场景先验", usage: "预测点赞、评论、分享等行为" },
  { name: "游戏回流概率", code: "pGameReturn", source: "用户回流倾向、视频历史回流率、场景导流意图、入口能力", formula: "30%×用户回流倾向 + 35%×视频回流率 + 20%×场景意图 + 15%×可用入口", usage: "预测观看后进入游戏并完成有效局" },
  { name: "生命周期提升", code: "pLifecycleImprove", source: "用户阶段、次日回访率、游戏回流概率、内容偏好", formula: "低活/沉默/回流：45%×次日回访 + 35%×游戏回流 + 20%×类型偏好；其他阶段使用播放、回流、次日回访", usage: "避免只优化单次点击，兼顾后续活跃" },
  { name: "综合匹配", code: "matchScore", source: "游戏、地域、阶段、水平、主题、场景匹配", formula: "35%×游戏 + 15%×地域 + 20%×阶段 + 10%×水平 + 10%×主题 + 10%×场景", usage: "汇总用户与内容的整体适配程度" },
  { name: "运营加权", code: "operationBoost", source: "运营配置 video.operationBoost", formula: "运营配置值直接进入精排，建议限定 0-0.1 并设置有效期", usage: "支持活动、赛事和重点供给的可控扶持" },
  { name: "负反馈惩罚", code: "negativePenalty", source: "快速划走、不感兴趣、举报、同类型负反馈", formula: "40%×快划 + 30%×不感兴趣 + 20%×举报归一值 + 10%×同类型负反馈", usage: "降低用户明确不喜欢的内容" },
  { name: "疲劳惩罚", code: "fatiguePenalty", source: "近期已看作者、重复内容类型", formula: "25%×同作者重复 + 15%×类型疲劳信号", usage: "避免重复作者和内容同质化" },
  { name: "风险惩罚", code: "riskPenalty", source: "版权、合规词、低质量、举报率", formula: "35%×版权风险 + 25%×合规风险 + 20%×低质量 + 20%×投诉风险", usage: "在硬拦截之外继续限制边缘风险内容" },
  { name: "强导流惩罚", code: "hardGuidePenalty", source: "强导流标记、用户导流冷却、当前场景", formula: "强导流且处于冷却期=0.8；首页强导流=0.15；否则=0", usage: "避免连续催促用户进入游戏" },
];

function formulaTable(fields: FormulaField[], group: "rough" | "feed") {
  return `<div class="formula-table-wrap"><table class="formula-table">
    <thead><tr><th>字段</th><th>原始数据</th><th>字段计算公式</th><th>进入总分的方式</th><th>策略作用</th></tr></thead>
    <tbody>${fields.map((field) => {
      const weight = state.config[group][field.code as keyof StrategyConfig[typeof group]] as number;
      const penalty = field.code.toLowerCase().includes("penalty");
      return `<tr>
        <td><strong>${field.name}</strong><code>${field.code}</code></td>
        <td>${field.source}</td>
        <td><span class="formula-text">${field.formula}</span></td>
        <td><b class="${penalty ? "minus" : "plus"}">${penalty ? "−" : "+"} ${Math.round(weight * 100)}% × 字段值</b></td>
        <td>${field.usage}</td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function contributionRow(label: string, value: number, weight: number, negative = false) {
  const contribution = value * weight;
  return `<div class="contribution-row">
    <span>${label}</span><code>${score(value)} × ${Math.round(weight * 100)}%</code>
    <b class="${negative ? "minus" : "plus"}">${negative ? "−" : "+"}${(contribution * 100).toFixed(2)}</b>
  </div>`;
}

function formulaView() {
  const result = run();
  const example = result.ranked[0];
  const b = example.breakdown;
  const roughPositive: Array<[string, number, number]> = [
    ["游戏匹配", b.gameMatch, state.config.rough.gameMatch],
    ["用户阶段匹配", b.userStageMatch, state.config.rough.userStageMatch],
    ["场景匹配", b.sceneMatch, state.config.rough.sceneMatch],
    ["内容质量", b.contentQuality, state.config.rough.contentQuality],
    ["近期表现", b.recentPerformance, state.config.rough.recentPerformance],
    ["业务目标匹配", b.businessGoalMatch, state.config.rough.businessGoalMatch],
    ["新鲜度", b.freshness, state.config.rough.freshness],
    ["探索价值", b.exploration, state.config.rough.exploration],
  ];
  const roughPenalty: Array<[string, number, number]> = [
    ["风险惩罚", b.riskPenalty, 0.12],
    ["疲劳惩罚", b.fatiguePenalty, 0.08],
    ["负反馈惩罚", b.negativePenalty, 0.1],
  ];
  const feedPositive: Array<[string, number, number]> = [
    ["有效播放概率", b.pValidPlay, state.config.feed.pValidPlay],
    ["完播概率", b.pFinish, state.config.feed.pFinish],
    ["互动概率", b.pInteraction, state.config.feed.pInteraction],
    ["游戏回流概率", b.pGameReturn, state.config.feed.pGameReturn],
    ["生命周期提升", b.pLifecycleImprove, state.config.feed.pLifecycleImprove],
    ["综合匹配", b.matchScore, state.config.feed.matchScore],
    ["新鲜度", b.freshness, state.config.feed.freshness],
    ["运营加权", b.operationBoost, state.config.feed.operationBoost],
    ["探索价值", b.exploration, state.config.feed.exploration],
  ];
  const feedPenalty: Array<[string, number, number]> = [
    ["负反馈惩罚", b.negativePenalty, state.config.feed.negativePenalty],
    ["疲劳惩罚", b.fatiguePenalty, state.config.feed.fatiguePenalty],
    ["风险惩罚", b.riskPenalty, state.config.feed.riskPenalty],
    ["强导流惩罚", b.hardGuidePenalty, state.config.feed.hardGuidePenalty],
  ];
  return `
    <section class="formula-intro">
      <div><strong>统一计算范围</strong><p>所有字段先归一化到 0-1，总分计算后再限制在 0-1；后台展示时乘以 100 转为分数。</p></div>
      <div><strong>当前演示对象</strong><p>${currentUser().name} · ${state.scene} · 示例视频《${example.video.title}》</p></div>
      <div><strong>计算顺序</strong><p>准入 → 7 路召回 → 粗排 Top 50 → 精排 → 多样性与频控重排。</p></div>
    </section>

    <section class="panel formula-section">
      <div class="panel-head"><div><h2>粗排字段计算</h2><p>先用低成本特征筛选候选，当前默认正向权重之和为 100%</p></div><span class="formula-stage">ROUGH RANK</span></div>
      <div class="total-formula"><b>粗排分</b><code>clamp(Σ 正向字段值 × 配置权重 − 12%×风险 − 8%×疲劳 − 10%×负反馈, 0, 1)</code></div>
      ${formulaTable(roughFormulaFields, "rough")}
    </section>

    <section class="panel formula-section">
      <div class="panel-head"><div><h2>精排字段计算</h2><p>使用行为概率、多目标价值和惩罚项决定最终排序</p></div><span class="formula-stage feed">FINE RANK</span></div>
      <div class="total-formula"><b>精排分</b><code>clamp(Σ 正向目标值 × 配置权重 − Σ 惩罚值 × 惩罚权重, 0, 1)</code></div>
      ${formulaTable(feedFormulaFields, "feed")}
    </section>

    <section class="calculation-example">
      <div class="panel">
        <div class="panel-head"><div><h2>粗排真实代入示例</h2><p>${example.video.id} 当前粗排展示分 ${score(b.roughScore)}</p></div></div>
        <div class="contribution-list">
          ${roughPositive.map(([label, value, weight]) => contributionRow(label, value, weight)).join("")}
          ${roughPenalty.map(([label, value, weight]) => contributionRow(label, value, weight, true)).join("")}
        </div>
        <div class="calculation-total"><span>限制到 0-100 后</span><strong>${score(b.roughScore)} 分</strong></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>精排真实代入示例</h2><p>${example.video.id} 当前精排展示分 ${score(b.feedScore)}</p></div></div>
        <div class="contribution-list">
          ${feedPositive.map(([label, value, weight]) => contributionRow(label, value, weight)).join("")}
          ${feedPenalty.map(([label, value, weight]) => contributionRow(label, value, weight, true)).join("")}
        </div>
        <div class="calculation-total"><span>限制到 0-100 后</span><strong>${score(b.feedScore)} 分</strong></div>
      </div>
    </section>

    <section class="panel rerank-explain">
      <div class="panel-head"><div><h2>精排之后为什么名次还会变化</h2><p>最终展示顺序不是简单按精排分从高到低</p></div></div>
      <div class="rerank-flow">
        <div><span>1</span><strong>精排降序</strong><p>先按 feedScore 从高到低排列。</p></div>
        <div><span>2</span><strong>同类型频控</strong><p>同类型最多连续 ${state.config.maxSameTypeConsecutive} 条。</p></div>
        <div><span>3</span><strong>同作者频控</strong><p>同作者每页最多 ${state.config.maxSameAuthorPerPage} 条。</p></div>
        <div><span>4</span><strong>强导流频控</strong><p>两个强导流内容至少间隔 ${state.config.strongGuideInterval} 条。</p></div>
        <div><span>5</span><strong>延后而非删除</strong><p>命中频控的内容进入延后队列，排到正常内容之后。</p></div>
      </div>
    </section>
  `;
}

function detailDrawer(item: RankedVideo) {
  const b = item.breakdown;
  const factors: Array<[string, number]> = [
    ["游戏匹配分", b.gameMatch],
    ["地域匹配分", b.regionMatch],
    ["用户阶段匹配分", b.userStageMatch],
    ["场景匹配分", b.sceneMatch],
    ["内容质量分", b.contentQuality],
    ["近期表现分", b.recentPerformance],
    ["游戏回流概率", b.pGameReturn],
    ["生命周期提升概率", b.pLifecycleImprove],
  ];
  return `<div class="drawer-backdrop" data-action="close-drawer"></div>
    <aside class="drawer">
      <button class="drawer-close" data-action="close-drawer" aria-label="关闭">×</button>
      <img class="drawer-cover" src="${assetUrl(item.video.thumbnail)}" alt="${item.video.title}" />
      <span class="drawer-rank">当前第 ${item.rank} 位</span>
      <h2>${item.video.title}</h2>
      <p class="drawer-meta">${item.video.id} · ${item.video.author} · ${item.video.primaryType} / ${item.video.secondaryType}</p>
      <div class="drawer-score"><div><small>粗排分</small><strong>${score(b.roughScore)}</strong></div><div><small>精排分</small><strong>${score(b.feedScore)}</strong></div><div><small>游戏回流</small><strong>${pct(b.pGameReturn)}</strong></div></div>
      <section><h3>进入候选的原因</h3><p class="section-help">数据来自本条视频命中的召回通道；用于解释它为什么有资格参与排序。</p><div class="chips large">${item.recallSources.map((source) => `<i>${source}</i>`).join("")}</div></section>
      <section><h3>排序解释</h3><p class="section-help">由高贡献匹配项、效果预测和业务规则自动生成，帮助运营理解当前名次。</p><ul class="explain-list">${item.explanation.map((text) => `<li>${text}</li>`).join("")}</ul></section>
      <section><h3>核心分值拆解</h3><p class="section-help">各字段均归一化到 0-100；乘以策略配置中的权重后进入粗排或精排公式。</p><div class="factor-list">${factors.map(([name, value]) => `<div><span>${name}</span><b><i style="width:${score(value)}%"></i></b><strong>${score(value)}</strong></div>`).join("")}</div></section>
      <section class="penalty-section"><h3>惩罚与导流</h3><p class="section-help">惩罚项从精排正向得分中扣除；导流入口由用户阶段、视频业务目标和频控共同决定。</p><div class="penalty-grid"><span>负反馈惩罚 <b>${score(b.negativePenalty)}</b></span><span>疲劳惩罚 <b>${score(b.fatiguePenalty)}</b></span><span>风险惩罚 <b>${score(b.riskPenalty)}</b></span><span>推荐入口 <b>${item.guideEntry}</b></span></div></section>
    </aside>`;
}

function bindEvents() {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((element) => element.addEventListener("click", () => {
    state.view = element.dataset.view as View;
    state.selected = null;
    render();
  }));
  document.querySelector<HTMLSelectElement>("#user-select")?.addEventListener("change", (event) => {
    state.userId = (event.target as HTMLSelectElement).value;
    state.runAt = new Date();
    render();
  });
  document.querySelector<HTMLSelectElement>("#scene-select")?.addEventListener("change", (event) => {
    state.scene = (event.target as HTMLSelectElement).value as Scene;
    state.runAt = new Date();
    render();
  });
  document.querySelectorAll<HTMLElement>("[data-video-id]").forEach((element) => element.addEventListener("click", () => {
    state.selected = run().ranked.find((item) => item.video.id === element.dataset.videoId) ?? null;
    render();
  }));
  document.querySelector<HTMLInputElement>("#content-query")?.addEventListener("input", (event) => {
    state.contentQuery = (event.target as HTMLInputElement).value;
    render();
    const field = document.querySelector<HTMLInputElement>("#content-query");
    field?.focus();
    field?.setSelectionRange(state.contentQuery.length, state.contentQuery.length);
  });
  document.querySelector<HTMLSelectElement>("#content-type")?.addEventListener("change", (event) => {
    state.contentType = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector<HTMLSelectElement>("#content-status")?.addEventListener("change", (event) => {
    state.contentStatus = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelectorAll<HTMLInputElement>("[data-weight-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const group = input.dataset.weightGroup as "rough" | "feed";
      const key = input.dataset.weightKey as keyof StrategyConfig[typeof group];
      (state.config[group][key] as number) = Number(input.value) / 100;
      input.nextElementSibling!.textContent = `${input.value}%`;
    });
    input.addEventListener("change", () => render());
  });
  document.querySelectorAll<HTMLInputElement>("[data-config-key]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.configKey as keyof StrategyConfig;
    const raw = Number(input.value);
    (state.config[key] as number) = key === "explorationRatio" ? raw / 100 : raw;
    render();
  }));
  document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => element.addEventListener("click", () => handleAction(element.dataset.action ?? "")));
}

function handleAction(action: string) {
  if (action === "close-drawer") state.selected = null;
  if (action === "run-reco") state.runAt = new Date();
  if (action === "reset-demo") {
    state.videos = structuredClone(seedVideos);
    state.config = structuredClone(defaultConfig);
    state.selected = null;
  }
  if (action === "reset-weights") state.config = structuredClone(defaultConfig);
  if (action === "go-run") state.view = "run";
  if (action === "refresh-snapshot") {
    void loadSnapshot();
    return;
  }
  render();
}

render();
void loadSnapshot();
