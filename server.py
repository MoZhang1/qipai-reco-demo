#!/usr/bin/env python3
import json
import math
import random
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def build_snapshot():
    now = datetime.now()
    wave = math.sin(now.timestamp() / 180)
    exposure = 126_840 + int(wave * 2_200) + random.randint(-700, 700)
    valid_rate = 0.699 + wave * 0.006 + random.uniform(-0.002, 0.002)
    valid_play = int(exposure * valid_rate)
    game_entry = int(exposure * (0.088 + wave * 0.003))
    effective_game = int(game_entry * (0.604 + random.uniform(-0.01, 0.01)))
    base_days = [
        ("周一", 98_400, 64_210, 4_810),
        ("周二", 103_600, 68_740, 5_120),
        ("周三", 108_900, 73_400, 5_480),
        ("周四", 106_200, 72_010, 5_630),
        ("周五", 116_500, 80_120, 6_010),
        ("周六", 121_800, 84_290, 6_420),
        ("今日", exposure, valid_play, effective_game),
    ]
    funnel = [
        ("视频曝光", exposure),
        ("有效播放", valid_play),
        ("导流曝光", int(exposure * 0.258)),
        ("导流点击", int(exposure * 0.131)),
        ("进入游戏", game_entry),
        ("匹配 / 入桌", int(game_entry * 0.748)),
        ("完成有效局", effective_game),
    ]
    events = [
        ("精排", "完成一轮首页推荐", "用户 U1002，候选 486 条，输出 20 条，首位为棋牌泛娱乐短剧。"),
        ("赛马", "UGC_0102 晋级 T2", "有效播放 84%、完播 75%、负反馈 0.8%，满足一级赛马阈值。"),
        ("频控", "延后强导流活动内容", "距上一次游戏入口仅 3 条，未满足最小间隔 5 条。"),
        ("准入", "拦截高风险投稿", "命中未授权和夸大收益表达，进入风险复审池。"),
        ("召回", "低活用户触发泛娱乐召回", "增加牌桌短剧、地域社交和爽点牌局候选，共召回 128 条。"),
    ]
    event_rows = []
    for index, (event_type, title, detail) in enumerate(events):
        minute = max(0, now.minute - index)
        event_rows.append({
            "time": now.replace(minute=minute, second=random.randint(5, 55)).strftime("%H:%M:%S"),
            "type": event_type,
            "title": title,
            "detail": detail,
        })
    return {
        "generatedAt": now.isoformat(),
        "exposure": exposure,
        "validPlay": valid_play,
        "gameEntry": game_entry,
        "effectiveGame": effective_game,
        "validPlayRate": valid_rate,
        "finishRate": 0.586 + random.uniform(-0.004, 0.004),
        "gameReturnRate": effective_game / valid_play,
        "negativeRate": 0.014 + random.uniform(-0.001, 0.001),
        "dailyTrend": [
            {"label": label, "exposure": exp, "validPlay": play, "effectiveGame": game}
            for label, exp, play, game in base_days
        ],
        "funnel": [{"label": label, "value": value} for label, value in funnel],
        "contentMix": [
            {"label": "爽点牌局 / 实战复盘", "value": 31, "color": "#1769aa"},
            {"label": "技巧教学 / 失误避坑", "value": 24, "color": "#287a55"},
            {"label": "棋牌泛娱乐 / 地域社交", "value": 28, "color": "#d68a22"},
            {"label": "活动赛事 / 产品功能", "value": 9, "color": "#6a55a3"},
            {"label": "探索内容", "value": 8, "color": "#84909c"},
        ],
        "alerts": [
            {"level": "高", "title": "活动内容负反馈升高", "detail": "周末冲榜赛连续两小时不感兴趣率超过同类均值 38%，已自动停止保底扩量。"},
            {"level": "中", "title": "新手内容供给不足", "detail": "规则入门池可推荐内容仅 14 条，预计三日后首屏重复率超过警戒线。"},
            {"level": "低", "title": "温州地域内容表现良好", "detail": "温州低活用户次日回访率提升 6.2%，建议增加同类 UGC 冷启动名额。"},
        ],
        "events": event_rows,
    }


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json({"ok": True, "service": "qipai-reco-admin", "time": datetime.now().isoformat()})
        if path == "/api/snapshot":
            return self.send_json(build_snapshot())
        if not (DIST / path.lstrip("/")).exists() and "." not in Path(path).name:
            self.path = "/index.html"
        return super().do_GET()

    def send_json(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[qipai-reco] {self.address_string()} {format % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 4178), DashboardHandler)
    print("牌流推荐后台：http://localhost:4178")
    server.serve_forever()
