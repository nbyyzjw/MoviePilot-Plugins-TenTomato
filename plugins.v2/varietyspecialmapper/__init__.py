import copy
import json
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.chain.tmdb import TmdbChain
from app.core.event import eventmanager, Event
from app.db.transferhistory_oper import TransferHistoryOper
from app.log import logger
from app.plugins import _PluginBase
from app.schemas import FileItem, NotificationType
from app.schemas.types import EventType


class VarietySpecialMapper(_PluginBase):
    plugin_name = "综艺特别篇纠偏"
    plugin_desc = "在整理入库后，自动把综艺彩蛋、纯享、陪看、夜聊等内容改到 TMDB 特别篇（S0）对应集数。"
    plugin_icon = "movie.jpg"
    plugin_version = "0.3.0"
    plugin_author = "二狗"
    author_url = "https://github.com/nbyyzjw/MoviePilot-Plugins-TenTomato"
    plugin_config_prefix = "varietyspecialmapper_"
    plugin_order = 16
    auth_level = 1

    _enabled = False
    _notify = False
    _specials_folder = "Specials"
    _rules: List[Dict[str, Any]] = []
    _common_types: Dict[str, Dict[str, List[str]]] = {}
    _tmdb_mapping_cache: Dict[str, Dict[str, Dict[int, int]]] = {}

    TYPE_ORDER = ["pilot", "pure", "watch", "chat", "punish", "party", "bonus"]
    UI_SCHEMA_VERSION = "interactive_v1"

    COMMON_TYPES_TEMPLATE: Dict[str, Dict[str, List[str]]] = {
        "pilot": {
            "source_keywords": ["先导", "先导片", "抢先看", "开放日", "集结篇"],
            "tmdb_keywords": ["先导", "先导片", "开放日", "集结篇"],
        },
        "pure": {
            "source_keywords": ["纯享", "纯享版", ".Pure."],
            "tmdb_keywords": ["纯享", "纯享版"],
        },
        "watch": {
            "source_keywords": ["陪看", ".Watch.", "专门陪你看"],
            "tmdb_keywords": ["陪看", "专门陪你看"],
        },
        "chat": {
            "source_keywords": ["夜聊", ".Chat.", "聊天局", "唠嗑"],
            "tmdb_keywords": ["夜聊", "聊天", "唠嗑"],
        },
        "punish": {
            "source_keywords": ["惩罚室", ".Punish.", "不好笑惩罚室"],
            "tmdb_keywords": ["惩罚室", "不好笑惩罚室"],
        },
        "party": {
            "source_keywords": ["聚会", "派对", ".Party.", "狼人杀", "游戏时间", "课间游戏"],
            "tmdb_keywords": ["聚会", "派对", "游戏时间", "狼人杀"],
        },
        "bonus": {
            "source_keywords": ["超前彩蛋", "彩蛋", ".Bonus.", "加更", "企划", "特别企划", "花絮", "特辑", "高光", "回顾", "团建"],
            "tmdb_keywords": ["超前彩蛋", "彩蛋", "加更", "企划", "特别企划", "花絮", "特辑", "高光", "回顾", "团建"],
        },
    }

    @classmethod
    def _default_common_types(cls) -> Dict[str, Dict[str, List[str]]]:
        return copy.deepcopy(cls.COMMON_TYPES_TEMPLATE)

    @staticmethod
    def _default_rules_data() -> List[Dict[str, Any]]:
        return [
            {
                "name": "喜人奇妙夜",
                "tmdbid": 257161,
                "match_titles": ["喜人奇妙夜", "Amazing Night", "Amazing.Night"],
                "main_season": 1,
                "specials_season": 0,
                "specials_folder": "Specials",
                "seasons": [
                    {
                        "source_season": 1,
                        "types": {
                            "pilot": {
                                "source_keywords": ["先导", "S01E00"],
                                "tmdb_keywords": ["先导", "超前集结"],
                            },
                            "pure": {
                                "source_keywords": ["纯享", ".Pure."],
                                "tmdb_keywords": ["纯享"],
                            },
                            "watch": {
                                "source_keywords": ["陪看", ".Watch."],
                                "tmdb_keywords": ["陪看"],
                            },
                            "chat": {
                                "source_keywords": ["夜聊", ".Chat."],
                                "tmdb_keywords": ["夜聊"],
                            },
                            "punish": {
                                "source_keywords": ["惩罚室", ".Punish."],
                                "tmdb_keywords": ["惩罚室", "不好笑惩罚室"],
                            },
                            "party": {
                                "source_keywords": ["聚会", "派对", ".Party."],
                                "tmdb_keywords": ["聚会", "派对"],
                            },
                            "bonus": {
                                "source_keywords": ["彩蛋", ".Bonus."],
                                "tmdb_keywords": ["特辑"],
                            },
                        },
                        "manual_matches": [],
                    }
                ],
            }
        ]

    def init_plugin(self, config: dict = None):
        config = config or {}
        self._enabled = bool(config.get("enabled", False))
        self._notify = bool(config.get("notify", False))
        self._specials_folder = (config.get("specials_folder") or "Specials").strip() or "Specials"

        common_types, rules, needs_persist = self._load_structured_state(config)
        self._common_types = common_types
        self._rules = rules
        self._tmdb_mapping_cache = {}

        if needs_persist:
            self._save_structured_config()

    def get_state(self) -> bool:
        return self._enabled

    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        return []

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        model = self._build_form_model()
        type_keys = self._get_all_type_keys(self._common_types, self._rules)
        show_panels = [self._build_rule_panel(rule_index, rule, type_keys) for rule_index, rule in enumerate(self._rules)]

        return [
            {
                "component": "VForm",
                "content": [
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "model": "enabled",
                                            "label": "启用插件",
                                        },
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "model": "notify",
                                            "label": "发送纠偏通知",
                                        },
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VTextField",
                                        "props": {
                                            "model": "specials_folder",
                                            "label": "默认特别篇目录名",
                                            "placeholder": "Specials",
                                        },
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12},
                                "content": [
                                    {
                                        "component": "VAlert",
                                        "props": {
                                            "type": "info",
                                            "variant": "tonal",
                                            "title": "交互式规则管理",
                                            "text": "不再需要直接改 JSON。现在按 通用关键词库 -> 节目 -> 季 -> 类型 的树状折叠结构管理。关键词建议每行一个，保存配置后立即生效。新增或删除节目/季时，勾选对应开关再点保存。",
                                        },
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "component": "VExpansionPanels",
                        "props": {"multiple": True, "popout": True},
                        "content": [
                            {
                                "component": "VExpansionPanel",
                                "content": [
                                    {
                                        "component": "VExpansionPanelTitle",
                                        "text": "通用关键词库",
                                    },
                                    {
                                        "component": "VExpansionPanelText",
                                        "content": [
                                            {
                                                "component": "VExpansionPanels",
                                                "props": {"multiple": True, "popout": True},
                                                "content": [
                                                    self._build_type_panel(
                                                        title=self._type_label(type_key),
                                                        source_model=f"common_type_{type_key}_source_keywords_text",
                                                        tmdb_model=f"common_type_{type_key}_tmdb_keywords_text",
                                                    )
                                                    for type_key in type_keys
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                "component": "VExpansionPanel",
                                "content": [
                                    {
                                        "component": "VExpansionPanelTitle",
                                        "text": f"节目规则（{len(self._rules)}）",
                                    },
                                    {
                                        "component": "VExpansionPanelText",
                                        "content": [
                                            {
                                                "component": "VExpansionPanels",
                                                "props": {"multiple": True, "popout": True},
                                                "content": show_panels
                                                + [self._build_new_rule_panel()],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }
        ], model

    def get_page(self) -> List[dict]:
        history = self.get_data("history") or []
        history = history[:10]
        content = [
            {
                "component": "VAlert",
                "props": {
                    "type": "info",
                    "variant": "tonal",
                    "title": "最近纠偏记录",
                    "text": "这里只展示最近 10 条记录，便于排查规则是否命中。",
                },
            }
        ]
        if not history:
            content.append(
                {
                    "component": "VCard",
                    "props": {"class": "mt-3"},
                    "content": [
                        {
                            "component": "VCardText",
                            "text": "还没有纠偏记录。",
                        }
                    ],
                }
            )
            return content

        for item in history:
            content.append(
                {
                    "component": "VCard",
                    "props": {"class": "mt-3"},
                    "content": [
                        {"component": "VCardTitle", "text": item.get("show") or "未知节目"},
                        {"component": "VCardText", "text": f"类型: {item.get('kind')}"},
                        {"component": "VCardText", "text": f"原路径: {item.get('old_path')}"},
                        {"component": "VCardText", "text": f"新路径: {item.get('new_path')}"},
                        {
                            "component": "VCardText",
                            "text": f"目标集: S{int(item.get('target_season', 0)):02d}E{int(item.get('target_episode', 0)):02d}",
                        },
                    ],
                }
            )
        return content

    def stop_service(self):
        pass

    @eventmanager.register([
        EventType.TransferComplete,
        EventType.SubtitleTransferComplete,
        EventType.AudioTransferComplete,
    ])
    def remap_variety_specials(self, event: Event):
        if not self._enabled or not event:
            return

        event_data = event.event_data or {}
        transferinfo = event_data.get("transferinfo")
        if not transferinfo or not getattr(transferinfo, "success", False):
            return

        target_item = getattr(transferinfo, "target_item", None)
        target_diritem = getattr(transferinfo, "target_diritem", None)
        mediainfo = event_data.get("mediainfo")
        meta = event_data.get("meta")
        fileitem = event_data.get("fileitem")

        source_path = Path(getattr(fileitem, "path", "") or "") if fileitem else None
        source_name = getattr(fileitem, "name", None) or (source_path.name if source_path else "")

        if not target_item or not target_diritem or not mediainfo:
            return
        media_type = getattr(mediainfo, "type", None)
        if getattr(media_type, "name", None) == "MOVIE" or getattr(media_type, "value", None) == "电影":
            return
        if target_item.storage != "local":
            logger.info("综艺特别篇纠偏插件当前仅处理本地存储")
            return

        file_path = Path(target_item.path)
        rule = self._match_rule(mediainfo=mediainfo, file_path=file_path, source_name=source_name)
        if not rule:
            return

        source_season = self._extract_source_season(source_name or file_path.name, meta, rule)
        source_kind, override_index, override_target_episode = self._detect_source_kind(
            source_name or file_path.name,
            rule,
            source_season,
        )
        if not source_kind:
            return

        issue_index = override_index if override_index is not None else self._extract_source_index(
            source_name or file_path.name,
            meta,
            source_kind,
        )
        if issue_index is None and override_target_episode is None:
            logger.info(f"{file_path.name} 未提取到期数，跳过纠偏")
            return

        target_episode = override_target_episode
        specials_season = int(rule.get("specials_season", 0))
        if target_episode is None:
            target_episode = self._resolve_target_episode(
                rule=rule,
                kind=source_kind,
                issue_index=issue_index,
                source_season=source_season,
            )
        if not target_episode:
            logger.info(f"{file_path.name} 未匹配到 TMDB 特别篇目标集数，跳过纠偏")
            return

        specials_folder_name = rule.get("specials_folder") or self._specials_folder or "Specials"
        show_root = Path(target_diritem.path)
        specials_dir = show_root / specials_folder_name
        specials_dir.mkdir(parents=True, exist_ok=True)

        new_name = self._build_new_name(file_path.name, specials_season, int(target_episode))
        new_path = specials_dir / new_name
        if new_path == file_path:
            return
        if new_path.exists():
            logger.warning(f"目标文件已存在，跳过纠偏：{new_path}")
            return

        shutil.move(str(file_path), str(new_path))
        self._move_metadata_sidecars(file_path, new_path)
        logger.info(f"综艺特别篇纠偏成功：{file_path} -> {new_path}")

        self._update_transferinfo_paths(transferinfo, old_path=file_path, new_path=new_path)
        self._update_transfer_history(
            event_data=event_data,
            old_path=file_path,
            new_path=new_path,
            target_season=specials_season,
            target_episode=int(target_episode),
        )
        self._append_history(
            {
                "show": getattr(mediainfo, "title", None) or getattr(mediainfo, "name", None) or rule.get("name"),
                "kind": source_kind,
                "old_path": str(file_path),
                "new_path": str(new_path),
                "target_season": specials_season,
                "target_episode": int(target_episode),
            }
        )

        if getattr(getattr(event, "event_type", None), "value", None) == EventType.TransferComplete.value:
            self._rescrape_episode(new_path)
            if self._notify:
                self.post_message(
                    mtype=NotificationType.Plugin,
                    title="【综艺特别篇纠偏】",
                    text=f"{new_name}\n已纠偏到 {specials_folder_name}/S{specials_season:02d}E{int(target_episode):02d}",
                )

    def _load_structured_state(self, config: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, List[str]]], List[Dict[str, Any]], bool]:
        needs_persist = False

        if self._looks_like_interactive_form_submit(config):
            common_types, rules = self._parse_interactive_form_config(config)
            return common_types, rules, True

        common_types_raw = config.get("common_types_data")
        if isinstance(common_types_raw, dict):
            common_types = self._normalize_common_types(common_types_raw)
        else:
            common_types = self._normalize_common_types(self._load_json_data(common_types_raw, self._default_common_types()))

        rules_raw = config.get("rules_data")
        if rules_raw:
            rules = self._normalize_rules(self._load_json_data(rules_raw, self._default_rules_data()))
        else:
            legacy_rules_text = config.get("rules_text")
            if legacy_rules_text:
                rules = self._normalize_rules(self._load_json_data(legacy_rules_text, self._default_rules_data()))
                needs_persist = True
            else:
                rules = self._normalize_rules(self._default_rules_data())
                needs_persist = True

        return common_types, rules, needs_persist

    def _save_structured_config(self):
        current = self.get_config() or {}
        desired = {
            "enabled": self._enabled,
            "notify": self._notify,
            "specials_folder": self._specials_folder,
            "ui_schema_version": self.UI_SCHEMA_VERSION,
            "common_types_data": json.dumps(self._common_types, ensure_ascii=False, indent=2),
            "rules_data": json.dumps(self._rules, ensure_ascii=False, indent=2),
        }
        if any(current.get(key) != value for key, value in desired.items()) or set(current.keys()) != set(desired.keys()):
            self.update_config(desired)
            logger.info("已保存综艺特别篇纠偏插件的结构化规则配置")

    @staticmethod
    def _load_json_data(raw: Any, fallback: Any) -> Any:
        if raw is None:
            return copy.deepcopy(fallback)
        if isinstance(raw, (dict, list)):
            return copy.deepcopy(raw)
        try:
            return json.loads(raw)
        except Exception:
            return copy.deepcopy(fallback)

    def _looks_like_interactive_form_submit(self, config: Dict[str, Any]) -> bool:
        return any(
            key.startswith("common_type_") or key.startswith("rule_") or key.startswith("new_rule_")
            for key in config.keys()
        )

    def _parse_interactive_form_config(self, config: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, List[str]]], List[Dict[str, Any]]]:
        current_rules = self._normalize_rules(self._rules or self._default_rules_data())
        common_types: Dict[str, Dict[str, List[str]]] = {}
        type_keys = self._get_all_type_keys(self._common_types or self._default_common_types(), current_rules)

        for type_key in type_keys:
            common_types[type_key] = {
                "source_keywords": self._split_multiline(config.get(f"common_type_{type_key}_source_keywords_text")),
                "tmdb_keywords": self._split_multiline(config.get(f"common_type_{type_key}_tmdb_keywords_text")),
            }

        rules: List[Dict[str, Any]] = []
        for rule_index in range(len(current_rules)):
            name = str(config.get(f"rule_{rule_index}_name") or "").strip()
            tmdbid = self._to_int(config.get(f"rule_{rule_index}_tmdbid"))
            if not name or not tmdbid:
                continue
            if bool(config.get(f"rule_{rule_index}_delete")):
                continue

            seasons: List[Dict[str, Any]] = []
            season_count = len(current_rules[rule_index].get("seasons") or [])
            for season_index in range(season_count):
                source_season = self._to_int(config.get(f"rule_{rule_index}_season_{season_index}_number"))
                if not source_season:
                    continue
                if bool(config.get(f"rule_{rule_index}_season_{season_index}_delete")):
                    continue

                season_types: Dict[str, Dict[str, List[str]]] = {}
                for type_key in type_keys:
                    source_keywords = self._split_multiline(
                        config.get(f"rule_{rule_index}_season_{season_index}_type_{type_key}_source_keywords_text")
                    )
                    tmdb_keywords = self._split_multiline(
                        config.get(f"rule_{rule_index}_season_{season_index}_type_{type_key}_tmdb_keywords_text")
                    )
                    if source_keywords or tmdb_keywords:
                        season_types[type_key] = {
                            "source_keywords": source_keywords,
                            "tmdb_keywords": tmdb_keywords,
                        }

                seasons.append(
                    {
                        "source_season": source_season,
                        "types": season_types,
                        "manual_matches": self._parse_manual_matches_text(
                            config.get(f"rule_{rule_index}_season_{season_index}_manual_matches_text")
                        ),
                    }
                )

            add_new_season = bool(config.get(f"rule_{rule_index}_add_new_season"))
            new_season_number = self._to_int(config.get(f"rule_{rule_index}_new_season_number"))
            if add_new_season and new_season_number and new_season_number not in {
                int(item.get("source_season") or 0) for item in seasons
            }:
                seasons.append(
                    {
                        "source_season": new_season_number,
                        "types": {},
                        "manual_matches": [],
                    }
                )

            seasons = sorted(seasons, key=lambda item: int(item.get("source_season") or 0))
            if not seasons:
                seasons = [{"source_season": int(config.get(f"rule_{rule_index}_main_season") or 1), "types": {}, "manual_matches": []}]

            rules.append(
                {
                    "name": name,
                    "tmdbid": tmdbid,
                    "match_titles": self._split_multiline(config.get(f"rule_{rule_index}_match_titles_text")),
                    "main_season": self._to_int(config.get(f"rule_{rule_index}_main_season")) or int(seasons[0]["source_season"]),
                    "specials_season": self._to_int(config.get(f"rule_{rule_index}_specials_season"), 0) or 0,
                    "specials_folder": str(config.get(f"rule_{rule_index}_specials_folder") or self._specials_folder or "Specials").strip() or "Specials",
                    "seasons": seasons,
                }
            )

        create_new_rule = bool(config.get("new_rule_create"))
        new_rule_name = str(config.get("new_rule_name") or "").strip()
        new_rule_tmdbid = self._to_int(config.get("new_rule_tmdbid"))
        if create_new_rule and new_rule_name and new_rule_tmdbid:
            initial_seasons = self._split_multiline(config.get("new_rule_initial_seasons_text"))
            parsed_seasons = [self._to_int(item) for item in initial_seasons]
            parsed_seasons = [item for item in parsed_seasons if item]
            if not parsed_seasons:
                parsed_seasons = [self._to_int(config.get("new_rule_main_season")) or 1]
            rules.append(
                {
                    "name": new_rule_name,
                    "tmdbid": new_rule_tmdbid,
                    "match_titles": self._split_multiline(config.get("new_rule_match_titles_text")),
                    "main_season": self._to_int(config.get("new_rule_main_season")) or parsed_seasons[0],
                    "specials_season": self._to_int(config.get("new_rule_specials_season"), 0) or 0,
                    "specials_folder": str(config.get("new_rule_specials_folder") or self._specials_folder or "Specials").strip() or "Specials",
                    "seasons": [
                        {"source_season": season_number, "types": {}, "manual_matches": []}
                        for season_number in sorted(set(parsed_seasons))
                    ],
                }
            )

        return self._normalize_common_types(common_types), self._normalize_rules(rules)

    def _normalize_common_types(self, common_types: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
        normalized = self._default_common_types()
        for type_key, type_conf in (common_types or {}).items():
            normalized[type_key] = self._normalize_type_conf(type_conf)
        return {key: normalized[key] for key in self._get_all_type_keys(normalized, [])}

    def _normalize_rules(self, rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized_rules: List[Dict[str, Any]] = []
        for raw_rule in rules or []:
            if not isinstance(raw_rule, dict):
                continue

            name = str(raw_rule.get("name") or "").strip()
            tmdbid = self._to_int(raw_rule.get("tmdbid"))
            if not name or not tmdbid:
                continue

            legacy_types = raw_rule.get("types") or {}
            legacy_manual_matches = raw_rule.get("manual_matches") or []
            seasons_raw = raw_rule.get("seasons") or []
            if not seasons_raw:
                seasons_raw = [
                    {
                        "source_season": self._to_int(raw_rule.get("main_season"), 1) or 1,
                        "types": legacy_types,
                        "manual_matches": legacy_manual_matches,
                    }
                ]

            season_map: Dict[int, Dict[str, Any]] = {}
            for season_rule in seasons_raw:
                if not isinstance(season_rule, dict):
                    continue
                source_season = self._to_int(season_rule.get("source_season"), self._to_int(raw_rule.get("main_season"), 1)) or 1
                current = season_map.get(source_season, {"source_season": source_season, "types": {}, "manual_matches": []})
                current["types"].update(self._normalize_types_map(season_rule.get("types") or {}))
                current["manual_matches"] = self._normalize_manual_matches(current.get("manual_matches") or []) + self._normalize_manual_matches(season_rule.get("manual_matches") or [])
                season_map[source_season] = current

            rule = {
                "name": name,
                "tmdbid": 257161 if tmdbid == 257971 and name == "喜人奇妙夜" else tmdbid,
                "match_titles": self._split_multiline(raw_rule.get("match_titles") or []),
                "main_season": self._to_int(raw_rule.get("main_season"), 1) or 1,
                "specials_season": self._to_int(raw_rule.get("specials_season"), 0) or 0,
                "specials_folder": str(raw_rule.get("specials_folder") or self._specials_folder or "Specials").strip() or "Specials",
                "seasons": sorted(season_map.values(), key=lambda item: int(item.get("source_season") or 0)),
            }

            if rule["name"] == "喜人奇妙夜":
                self._patch_amazing_night_rule(rule)

            normalized_rules.append(rule)

        return normalized_rules

    def _patch_amazing_night_rule(self, rule: Dict[str, Any]):
        season_one = self._get_or_create_season_rule(rule, 1)
        party = season_one.setdefault("types", {}).setdefault("party", {"source_keywords": [], "tmdb_keywords": []})
        if "派对" not in party.get("source_keywords", []):
            party["source_keywords"] = self._dedupe_list((party.get("source_keywords") or []) + ["派对"])
        if "派对" not in party.get("tmdb_keywords", []):
            party["tmdb_keywords"] = self._dedupe_list((party.get("tmdb_keywords") or []) + ["派对"])
        bonus = season_one.setdefault("types", {}).setdefault("bonus", {"source_keywords": [], "tmdb_keywords": []})
        if not bonus.get("source_keywords"):
            bonus["source_keywords"] = ["彩蛋", ".Bonus."]
        if not bonus.get("tmdb_keywords"):
            bonus["tmdb_keywords"] = ["特辑"]

    def _get_or_create_season_rule(self, rule: Dict[str, Any], source_season: int) -> Dict[str, Any]:
        for season_rule in rule.get("seasons") or []:
            if int(season_rule.get("source_season") or 0) == int(source_season):
                return season_rule
        season_rule = {"source_season": int(source_season), "types": {}, "manual_matches": []}
        rule.setdefault("seasons", []).append(season_rule)
        rule["seasons"] = sorted(rule.get("seasons") or [], key=lambda item: int(item.get("source_season") or 0))
        return season_rule

    @staticmethod
    def _normalize_type_conf(type_conf: Dict[str, Any]) -> Dict[str, List[str]]:
        type_conf = type_conf or {}
        return {
            "source_keywords": VarietySpecialMapper._split_multiline(type_conf.get("source_keywords") or []),
            "tmdb_keywords": VarietySpecialMapper._split_multiline(type_conf.get("tmdb_keywords") or []),
        }

    def _normalize_types_map(self, types_map: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
        normalized: Dict[str, Dict[str, List[str]]] = {}
        for type_key, type_conf in (types_map or {}).items():
            normalized[type_key] = self._normalize_type_conf(type_conf)
        return normalized

    @staticmethod
    def _normalize_manual_matches(manual_matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in manual_matches or []:
            if not isinstance(item, dict):
                continue
            type_name = str(item.get("type") or "").strip()
            keywords = VarietySpecialMapper._split_multiline(item.get("source_keywords") or [])
            if not type_name or not keywords:
                continue
            normalized.append(
                {
                    "type": type_name,
                    "source_keywords": keywords,
                    "index": VarietySpecialMapper._to_int(item.get("index")),
                    "target_episode": VarietySpecialMapper._to_int(item.get("target_episode")),
                }
            )
        return normalized

    def _match_rule(self, mediainfo: Any, file_path: Path, source_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        tmdbid = getattr(mediainfo, "tmdb_id", None)
        title_candidates = {
            (getattr(mediainfo, "title", None) or "").lower(),
            (getattr(mediainfo, "name", None) or "").lower(),
            file_path.name.lower(),
            str(file_path).lower(),
            (source_name or "").lower(),
        }
        for rule in self._rules:
            rule_tmdbid = rule.get("tmdbid")
            if rule_tmdbid and tmdbid and int(rule_tmdbid) == int(tmdbid):
                return rule
            for alias in rule.get("match_titles", []) or []:
                alias = str(alias).strip().lower()
                if alias and any(alias in candidate for candidate in title_candidates):
                    return rule
        return None

    def _detect_source_kind(
        self,
        file_name: str,
        rule: Dict[str, Any],
        source_season: int,
    ) -> Tuple[Optional[str], Optional[int], Optional[int]]:
        manual_matches = self._get_manual_matches(rule, source_season)
        lowered = file_name.lower()
        for item in manual_matches:
            keywords = [str(word).lower() for word in (item.get("source_keywords") or [])]
            if keywords and any(word in lowered for word in keywords):
                return item.get("type"), item.get("index"), item.get("target_episode")

        season_types = self._get_season_types(rule, source_season)
        return self._detect_kind_from_keywords(lowered=lowered, types_map=season_types, keyword_field="source_keywords")

    def _extract_source_season(self, file_name: str, meta: Any, rule: Dict[str, Any]) -> int:
        match = re.search(r"S(\d{1,2})E\d{1,4}", file_name, re.IGNORECASE)
        if match:
            return int(match.group(1))

        season_match = re.search(r"第\s*(\d{1,2})\s*季", file_name)
        if season_match:
            return int(season_match.group(1))

        season = getattr(meta, "begin_season", None) if meta else None
        if season is not None:
            return int(season)
        return int(rule.get("main_season") or 1)

    def _extract_source_index(self, file_name: str, meta: Any, source_kind: str) -> Optional[int]:
        if source_kind == "pilot":
            return 1

        match = re.search(r"S\d{1,2}E(\d{1,4})", file_name, re.IGNORECASE)
        if match:
            value = int(match.group(1))
            if value == 0:
                return 1
            return value

        cn_match = re.search(r"第\s*(\d{1,3})\s*期", file_name)
        if cn_match:
            return int(cn_match.group(1))

        episode = getattr(meta, "begin_episode", None) if meta else None
        if episode is not None:
            value = int(episode)
            if value == 0:
                return 1
            return value
        return None

    def _resolve_target_episode(
        self,
        rule: Dict[str, Any],
        kind: str,
        issue_index: Optional[int],
        source_season: int,
    ) -> Optional[int]:
        tmdbid = rule.get("tmdbid")
        if not tmdbid or issue_index is None:
            return None
        specials_season = int(rule.get("specials_season", 0))
        cache_key = f"{int(tmdbid)}:{specials_season}"
        mapping = self._tmdb_mapping_cache.get(cache_key)
        if not mapping:
            episodes = TmdbChain().tmdb_episodes(int(tmdbid), specials_season) or []
            if not episodes:
                logger.warning(f"未获取到 TMDB 特别篇数据：tmdbid={tmdbid}, season={specials_season}")
                return None
            mapping = self._build_tmdb_mapping(rule, episodes)
            self._tmdb_mapping_cache[cache_key] = mapping
        target = mapping.get(str(int(source_season)), {}).get(kind, {}).get(int(issue_index))
        if target:
            return int(target)
        return None

    def _build_tmdb_mapping(self, rule: Dict[str, Any], episodes: List[Any]) -> Dict[str, Dict[str, Dict[int, int]]]:
        mapping: Dict[str, Dict[str, Dict[int, int]]] = {}
        fallback_counter: Dict[Tuple[int, str], int] = {}

        for episode in sorted(episodes, key=lambda item: getattr(item, "episode_number", 0) or 0):
            title = getattr(episode, "name", "") or ""
            season_match = re.search(r"第\s*(\d{1,2})\s*季", title)
            mapping_season = int(season_match.group(1)) if season_match else int(rule.get("main_season") or 1)
            season_types = self._get_season_types(rule, mapping_season)
            kind, _, _ = self._detect_kind_from_keywords(
                lowered=title.lower(),
                types_map=season_types,
                keyword_field="tmdb_keywords",
            )
            if not kind:
                continue

            counter_key = (mapping_season, kind)
            issue_match = re.search(r"第\s*(\d{1,3})\s*期", title)
            if issue_match:
                issue_index = int(issue_match.group(1))
                fallback_counter[counter_key] = max(fallback_counter.get(counter_key, 0), issue_index)
            else:
                fallback_counter[counter_key] = fallback_counter.get(counter_key, 0) + 1
                issue_index = fallback_counter[counter_key]

            mapping.setdefault(str(mapping_season), {}).setdefault(kind, {})[issue_index] = int(
                getattr(episode, "episode_number", 0) or 0
            )

        return mapping

    def _get_manual_matches(self, rule: Dict[str, Any], source_season: int) -> List[Dict[str, Any]]:
        season_rule = self._find_season_rule(rule, source_season)
        return self._normalize_manual_matches((season_rule or {}).get("manual_matches") or [])

    def _get_season_types(self, rule: Dict[str, Any], source_season: int) -> Dict[str, Dict[str, List[str]]]:
        season_rule = self._find_season_rule(rule, source_season)
        specific_types = self._normalize_types_map((season_rule or {}).get("types") or {})
        merged: Dict[str, Dict[str, List[str]]] = {}
        all_type_keys = self._get_all_type_keys(self._common_types, [rule])
        for type_key in all_type_keys:
            common_conf = self._normalize_type_conf(self._common_types.get(type_key) or {})
            specific_conf = specific_types.get(type_key) or {}
            merged[type_key] = {
                "source_keywords": specific_conf.get("source_keywords") or common_conf.get("source_keywords") or [],
                "tmdb_keywords": specific_conf.get("tmdb_keywords") or common_conf.get("tmdb_keywords") or [],
            }
        return merged

    def _find_season_rule(self, rule: Dict[str, Any], source_season: int) -> Optional[Dict[str, Any]]:
        for season_rule in rule.get("seasons") or []:
            if int(season_rule.get("source_season") or 0) == int(source_season):
                return season_rule
        main_season = int(rule.get("main_season") or 1)
        for season_rule in rule.get("seasons") or []:
            if int(season_rule.get("source_season") or 0) == main_season:
                return season_rule
        seasons = rule.get("seasons") or []
        return seasons[0] if seasons else None

    def _detect_kind_from_keywords(
        self,
        lowered: str,
        types_map: Dict[str, Dict[str, List[str]]],
        keyword_field: str,
    ) -> Tuple[Optional[str], Optional[int], Optional[int]]:
        for kind in self._get_all_type_keys(self._common_types, self._rules):
            keywords = [str(word).lower() for word in (types_map.get(kind, {}).get(keyword_field) or [])]
            if keywords and any(word in lowered for word in keywords):
                return kind, None, None
        return None, None, None

    @staticmethod
    def _build_new_name(file_name: str, target_season: int, target_episode: int) -> str:
        replacement = f"S{int(target_season):02d}E{int(target_episode):02d}"
        new_name = file_name
        if re.search(r"S\d{1,2}E\d{1,4}", new_name, re.IGNORECASE):
            new_name = re.sub(r"S\d{1,2}E\d{1,4}", replacement, new_name, count=1, flags=re.IGNORECASE)
        else:
            path = Path(file_name)
            new_name = f"{path.stem}.{replacement}{path.suffix}"

        if re.search(r"第\s*\d+\s*集", new_name):
            new_name = re.sub(r"第\s*\d+\s*集", f"第 {int(target_episode)} 集", new_name, count=1)
        return new_name

    @staticmethod
    def _update_transferinfo_paths(transferinfo: Any, old_path: Path, new_path: Path):
        target_item = getattr(transferinfo, "target_item", None)
        if target_item and str(getattr(target_item, "path", "")) == str(old_path):
            target_item.path = str(new_path)
            target_item.name = new_path.name
            target_item.basename = new_path.stem
            target_item.extension = new_path.suffix.lstrip(".")

        file_list_new = list(getattr(transferinfo, "file_list_new", []) or [])
        transferinfo.file_list_new = [str(new_path) if str(item) == str(old_path) else item for item in file_list_new]

    @staticmethod
    def _move_metadata_sidecars(old_path: Path, new_path: Path):
        metadata_suffixes = {".nfo", ".jpg", ".jpeg", ".png", ".webp"}
        for sidecar in old_path.parent.glob(f"{old_path.stem}.*"):
            if sidecar == old_path or sidecar.suffix.lower() not in metadata_suffixes:
                continue
            target_sidecar = new_path.parent / f"{new_path.stem}{sidecar.suffix}"
            if target_sidecar.exists():
                continue
            shutil.move(str(sidecar), str(target_sidecar))

    @staticmethod
    def _rescrape_episode(new_path: Path):
        eventmanager.send_event(
            EventType.MetadataScrape,
            {
                "fileitem": FileItem(
                    storage="local",
                    path=str(new_path),
                    type="file",
                    name=new_path.name,
                    basename=new_path.stem,
                    extension=new_path.suffix.lstrip("."),
                ),
                "overwrite": True,
            },
        )

    @staticmethod
    def _update_transfer_history(
        event_data: Dict[str, Any],
        old_path: Path,
        new_path: Path,
        target_season: int,
        target_episode: int,
    ):
        history_id = event_data.get("transfer_history_id")
        history = TransferHistoryOper().get(history_id) if history_id else None
        if not history:
            history = TransferHistoryOper().get_by_dest(str(old_path))
        if not history:
            return

        dest_fileitem = dict(history.dest_fileitem or {})
        dest_fileitem.update(
            {
                "path": str(new_path),
                "name": new_path.name,
                "basename": new_path.stem,
                "extension": new_path.suffix.lstrip("."),
            }
        )
        history.update(
            TransferHistoryOper()._db,
            {
                "dest": str(new_path),
                "dest_fileitem": dest_fileitem,
                "seasons": f"S{int(target_season):02d}",
                "episodes": f"E{int(target_episode):02d}",
            },
        )

    def _append_history(self, item: Dict[str, Any]):
        history = self.get_data("history") or []
        history.insert(0, item)
        self.save_data("history", history[:30])

    def _build_form_model(self) -> Dict[str, Any]:
        model: Dict[str, Any] = {
            "enabled": self._enabled,
            "notify": self._notify,
            "specials_folder": self._specials_folder,
        }

        type_keys = self._get_all_type_keys(self._common_types, self._rules)
        for type_key in type_keys:
            common_conf = self._common_types.get(type_key) or {}
            model[f"common_type_{type_key}_source_keywords_text"] = self._join_multiline(common_conf.get("source_keywords") or [])
            model[f"common_type_{type_key}_tmdb_keywords_text"] = self._join_multiline(common_conf.get("tmdb_keywords") or [])

        for rule_index, rule in enumerate(self._rules):
            model[f"rule_{rule_index}_name"] = rule.get("name") or ""
            model[f"rule_{rule_index}_tmdbid"] = int(rule.get("tmdbid") or 0)
            model[f"rule_{rule_index}_match_titles_text"] = self._join_multiline(rule.get("match_titles") or [])
            model[f"rule_{rule_index}_main_season"] = int(rule.get("main_season") or 1)
            model[f"rule_{rule_index}_specials_season"] = int(rule.get("specials_season") or 0)
            model[f"rule_{rule_index}_specials_folder"] = rule.get("specials_folder") or self._specials_folder or "Specials"
            model[f"rule_{rule_index}_delete"] = False
            model[f"rule_{rule_index}_add_new_season"] = False
            model[f"rule_{rule_index}_new_season_number"] = ""

            for season_index, season_rule in enumerate(rule.get("seasons") or []):
                model[f"rule_{rule_index}_season_{season_index}_number"] = int(season_rule.get("source_season") or 1)
                model[f"rule_{rule_index}_season_{season_index}_delete"] = False
                model[f"rule_{rule_index}_season_{season_index}_manual_matches_text"] = json.dumps(
                    season_rule.get("manual_matches") or [],
                    ensure_ascii=False,
                    indent=2,
                )
                season_types = season_rule.get("types") or {}
                for type_key in type_keys:
                    type_conf = season_types.get(type_key) or {}
                    model[
                        f"rule_{rule_index}_season_{season_index}_type_{type_key}_source_keywords_text"
                    ] = self._join_multiline(type_conf.get("source_keywords") or [])
                    model[
                        f"rule_{rule_index}_season_{season_index}_type_{type_key}_tmdb_keywords_text"
                    ] = self._join_multiline(type_conf.get("tmdb_keywords") or [])

        model.update(
            {
                "new_rule_create": False,
                "new_rule_name": "",
                "new_rule_tmdbid": "",
                "new_rule_match_titles_text": "",
                "new_rule_main_season": 1,
                "new_rule_specials_season": 0,
                "new_rule_specials_folder": self._specials_folder or "Specials",
                "new_rule_initial_seasons_text": "1",
            }
        )
        return model

    def _build_rule_panel(self, rule_index: int, rule: Dict[str, Any], type_keys: List[str]) -> Dict[str, Any]:
        season_panels = [
            self._build_season_panel(rule_index, season_index, season_rule, type_keys)
            for season_index, season_rule in enumerate(rule.get("seasons") or [])
        ]
        return {
            "component": "VExpansionPanel",
            "content": [
                {
                    "component": "VExpansionPanelTitle",
                    "text": f"{rule.get('name')} (TMDB: {rule.get('tmdbid')})",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_name",
                                                "label": "节目名称",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_tmdbid",
                                                "label": "TMDB ID",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VSwitch",
                                            "props": {
                                                "model": f"rule_{rule_index}_delete",
                                                "label": "保存时删除这个节目",
                                                "color": "error",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_main_season",
                                                "label": "默认主季",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_specials_season",
                                                "label": "TMDB 特别篇季号",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_specials_folder",
                                                "label": "特别篇目录名",
                                                "placeholder": "Specials",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12},
                                    "content": [
                                        {
                                            "component": "VTextarea",
                                            "props": {
                                                "model": f"rule_{rule_index}_match_titles_text",
                                                "label": "匹配标题 / 别名",
                                                "rows": 3,
                                                "autoGrow": True,
                                                "placeholder": "每行一个，如\n喜人奇妙夜\nAmazing Night\nAmazing.Night",
                                            },
                                        }
                                    ],
                                }
                            ],
                        },
                        {
                            "component": "VExpansionPanels",
                            "props": {"multiple": True, "popout": True},
                            "content": season_panels + [self._build_add_season_panel(rule_index)],
                        },
                    ],
                },
            ],
        }

    def _build_season_panel(
        self,
        rule_index: int,
        season_index: int,
        season_rule: Dict[str, Any],
        type_keys: List[str],
    ) -> Dict[str, Any]:
        season_number = int(season_rule.get("source_season") or 1)
        type_panels = [
            self._build_type_panel(
                title=self._type_label(type_key),
                source_model=f"rule_{rule_index}_season_{season_index}_type_{type_key}_source_keywords_text",
                tmdb_model=f"rule_{rule_index}_season_{season_index}_type_{type_key}_tmdb_keywords_text",
            )
            for type_key in type_keys
        ]
        type_panels.append(
            {
                "component": "VExpansionPanel",
                "content": [
                    {
                        "component": "VExpansionPanelTitle",
                        "text": "高级手工匹配（可选）",
                    },
                    {
                        "component": "VExpansionPanelText",
                        "content": [
                            {
                                "component": "VTextarea",
                                "props": {
                                    "model": f"rule_{rule_index}_season_{season_index}_manual_matches_text",
                                    "label": "manual_matches JSON",
                                    "rows": 6,
                                    "autoGrow": True,
                                    "placeholder": "如有极少数非常规命名，再填这里；平时留空即可。",
                                },
                            }
                        ],
                    },
                ],
            }
        )
        return {
            "component": "VExpansionPanel",
            "content": [
                {
                    "component": "VExpansionPanelTitle",
                    "text": f"第 {season_number} 季规则",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_season_{season_index}_number",
                                                "label": "来源季号",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 8},
                                    "content": [
                                        {
                                            "component": "VSwitch",
                                            "props": {
                                                "model": f"rule_{rule_index}_season_{season_index}_delete",
                                                "label": "保存时删除这一季规则",
                                                "color": "error",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VExpansionPanels",
                            "props": {"multiple": True, "popout": True},
                            "content": type_panels,
                        },
                    ],
                },
            ],
        }

    def _build_add_season_panel(self, rule_index: int) -> Dict[str, Any]:
        return {
            "component": "VExpansionPanel",
            "content": [
                {
                    "component": "VExpansionPanelTitle",
                    "text": "新增一个季规则",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_new_season_number",
                                                "label": "新季号",
                                                "type": "number",
                                                "placeholder": "例如 2",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VSwitch",
                                            "props": {
                                                "model": f"rule_{rule_index}_add_new_season",
                                                "label": "保存时新增该季",
                                            },
                                        }
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        }

    def _build_new_rule_panel(self) -> Dict[str, Any]:
        return {
            "component": "VExpansionPanel",
            "content": [
                {
                    "component": "VExpansionPanelTitle",
                    "text": "新增节目规则",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": "new_rule_name",
                                                "label": "节目名称",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": "new_rule_tmdbid",
                                                "label": "TMDB ID",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VSwitch",
                                            "props": {
                                                "model": "new_rule_create",
                                                "label": "保存时新增这个节目",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": "new_rule_main_season",
                                                "label": "默认主季",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": "new_rule_specials_season",
                                                "label": "TMDB 特别篇季号",
                                                "type": "number",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": "new_rule_specials_folder",
                                                "label": "特别篇目录名",
                                                "placeholder": "Specials",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VTextarea",
                                            "props": {
                                                "model": "new_rule_match_titles_text",
                                                "label": "匹配标题 / 别名",
                                                "rows": 3,
                                                "autoGrow": True,
                                                "placeholder": "每行一个",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VTextarea",
                                            "props": {
                                                "model": "new_rule_initial_seasons_text",
                                                "label": "初始化季号",
                                                "rows": 3,
                                                "autoGrow": True,
                                                "placeholder": "每行一个或逗号分隔，如\n1\n2",
                                            },
                                        }
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }

    def _build_type_panel(self, title: str, source_model: str, tmdb_model: str) -> Dict[str, Any]:
        return {
            "component": "VExpansionPanel",
            "content": [
                {
                    "component": "VExpansionPanelTitle",
                    "text": title,
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VTextarea",
                                            "props": {
                                                "model": source_model,
                                                "label": "源文件名关键词",
                                                "rows": 4,
                                                "autoGrow": True,
                                                "placeholder": "每行一个关键词",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        {
                                            "component": "VTextarea",
                                            "props": {
                                                "model": tmdb_model,
                                                "label": "TMDB 标题关键词",
                                                "rows": 4,
                                                "autoGrow": True,
                                                "placeholder": "每行一个关键词",
                                            },
                                        }
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        }

    @classmethod
    def _type_label(cls, type_key: str) -> str:
        labels = {
            "pilot": "先导 / 开放日 / 抢先看",
            "pure": "纯享",
            "watch": "陪看",
            "chat": "夜聊 / 聊天局",
            "punish": "惩罚室",
            "party": "聚会 / 派对 / 游戏",
            "bonus": "彩蛋 / 加更 / 企划 / 特辑",
        }
        return labels.get(type_key, type_key)

    @classmethod
    def _get_all_type_keys(cls, common_types: Dict[str, Any], rules: List[Dict[str, Any]]) -> List[str]:
        ordered: List[str] = []
        for type_key in cls.TYPE_ORDER:
            if type_key not in ordered:
                ordered.append(type_key)
        for type_key in (common_types or {}).keys():
            if type_key not in ordered:
                ordered.append(type_key)
        for rule in rules or []:
            for season_rule in rule.get("seasons") or []:
                for type_key in (season_rule.get("types") or {}).keys():
                    if type_key not in ordered:
                        ordered.append(type_key)
        return ordered

    @staticmethod
    def _split_multiline(value: Any) -> List[str]:
        if isinstance(value, list):
            tokens = value
        else:
            raw = str(value or "")
            tokens = re.split(r"[\n,，]+", raw)
        return VarietySpecialMapper._dedupe_list([str(item).strip() for item in tokens if str(item).strip()])

    @staticmethod
    def _join_multiline(values: List[str]) -> str:
        return "\n".join([str(item).strip() for item in (values or []) if str(item).strip()])

    @staticmethod
    def _dedupe_list(values: List[str]) -> List[str]:
        seen = set()
        result = []
        for value in values or []:
            if value not in seen:
                seen.add(value)
                result.append(value)
        return result

    @staticmethod
    def _to_int(value: Any, default: Optional[int] = None) -> Optional[int]:
        if value is None or value == "":
            return default
        try:
            return int(str(value).strip())
        except Exception:
            return default

    @staticmethod
    def _parse_manual_matches_text(text: Any) -> List[Dict[str, Any]]:
        raw = str(text or "").strip()
        if not raw:
            return []
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return VarietySpecialMapper._normalize_manual_matches(data)
        except Exception as err:
            logger.error(f"解析 manual_matches 失败：{err}")
        return []
