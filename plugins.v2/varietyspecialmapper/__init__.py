import copy
import json
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.chain import ChainBase
from app.chain.tmdb import TmdbChain
from app.core.event import eventmanager, Event
from app.core.meta.metabase import MetaBase
from app.db.transferhistory_oper import TransferHistoryOper
from app.log import logger
from app.plugins import _PluginBase
from app.schemas import FileItem, NotificationType
from app.schemas.types import EventType, MediaType


class VarietySpecialMapper(_PluginBase):
    plugin_name = "综艺特别篇纠偏"
    plugin_desc = "在整理入库后，自动把综艺彩蛋、纯享、陪看、夜聊等内容改到 TMDB 特别篇（S0）对应集数。"
    plugin_icon = "movie.jpg"
    plugin_version = "0.4.5"
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
    _original_recognize_media = None
    _original_async_recognize_media = None

    TYPE_ORDER = ["pilot", "bonus", "program", "plus", "pure", "watch", "chat", "punish", "party"]
    UI_SCHEMA_VERSION = "interactive_v4"

    COMMON_TYPES_TEMPLATE: Dict[str, Dict[str, List[str]]] = {
        "pilot": {
            "source_keywords": ["先导"],
            "tmdb_keywords": ["先导"],
        },
        "bonus": {
            "source_keywords": ["彩蛋"],
            "tmdb_keywords": ["彩蛋"],
        },
        "program": {
            "source_keywords": ["企划"],
            "tmdb_keywords": ["企划"],
        },
        "plus": {
            "source_keywords": ["加更"],
            "tmdb_keywords": ["加更"],
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

    @staticmethod
    def _default_viva_la_romance_rule() -> Dict[str, Any]:
        return {
            "name": "妻子的浪漫旅行",
            "tmdbid": 97199,
            "match_titles": ["妻子的浪漫旅行", "Viva La Romance", "Viva.La.Romance"],
            "main_season": 9,
            "specials_season": 0,
            "specials_folder": "Specials",
            "seasons": [
                {
                    "source_season": 9,
                    "tmdb_season_number": 8,
                    "tmdb_season_matchers": ["2026"],
                    "types": {
                        "program": {
                            "source_keywords": ["特别企划", "企划", ".Program.", "Program"],
                            "tmdb_keywords": ["特别企划", "企划"],
                        },
                        "bonus": {
                            "source_keywords": ["超前彩蛋", ".Egg.", "Egg"],
                            "tmdb_keywords": ["超前彩蛋"],
                        },
                        "plus": {
                            "source_keywords": ["加更", ".Plus.", "Plus"],
                            "tmdb_keywords": ["加更版", "Plus"],
                        },
                    },
                    "manual_matches": [],
                }
            ],
        }

    def init_plugin(self, config: dict = None):
        plugin_instance: "VarietySpecialMapper" = self

        def patched_recognize_media(
            chain_self,
            meta: MetaBase = None,
            mtype: Optional[MediaType] = None,
            tmdbid: Optional[int] = None,
            doubanid: Optional[str] = None,
            bangumiid: Optional[int] = None,
            episode_group: Optional[str] = None,
            cache: bool = True,
        ):
            if plugin_instance._enabled and meta:
                meta = plugin_instance._preprocess_meta_for_special_recognition(meta)
            if not plugin_instance._original_recognize_media:
                return None
            return plugin_instance._original_recognize_media(
                chain_self,
                meta,
                mtype,
                tmdbid,
                doubanid,
                bangumiid,
                episode_group,
                cache,
            )

        async def patched_async_recognize_media(
            chain_self,
            meta: MetaBase = None,
            mtype: Optional[MediaType] = None,
            tmdbid: Optional[int] = None,
            doubanid: Optional[str] = None,
            bangumiid: Optional[int] = None,
            episode_group: Optional[str] = None,
            cache: bool = True,
        ):
            if plugin_instance._enabled and meta:
                meta = plugin_instance._preprocess_meta_for_special_recognition(meta)
            if not plugin_instance._original_async_recognize_media:
                return None
            return await plugin_instance._original_async_recognize_media(
                chain_self,
                meta,
                mtype,
                tmdbid,
                doubanid,
                bangumiid,
                episode_group,
                cache,
            )

        setattr(patched_recognize_media, "_patched_by", id(self))
        if getattr(ChainBase.recognize_media, "_patched_by", object()) != id(self):
            self._original_recognize_media = getattr(ChainBase, "recognize_media", None)

        setattr(patched_async_recognize_media, "_patched_by", id(self))
        if getattr(ChainBase.async_recognize_media, "_patched_by", object()) != id(self):
            self._original_async_recognize_media = getattr(ChainBase, "async_recognize_media", None)

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

        if self._enabled:
            if getattr(ChainBase.recognize_media, "_patched_by", object()) != id(self):
                ChainBase.recognize_media = patched_recognize_media
            if getattr(ChainBase.async_recognize_media, "_patched_by", object()) != id(self):
                ChainBase.async_recognize_media = patched_async_recognize_media
        else:
            self.stop_service()

    def get_state(self) -> bool:
        return self._enabled

    def stop_service(self):
        if getattr(ChainBase.recognize_media, "_patched_by", object()) == id(self) and self._original_recognize_media:
            ChainBase.recognize_media = self._original_recognize_media
        if getattr(ChainBase.async_recognize_media, "_patched_by", object()) == id(self) and self._original_async_recognize_media:
            ChainBase.async_recognize_media = self._original_async_recognize_media

    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        return []

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        model = self._build_form_model()
        common_type_keys = self._get_common_type_keys()
        show_panels = [
            self._build_rule_panel(rule_index, rule, self._get_rule_type_keys(rule))
            for rule_index, rule in enumerate(self._rules)
        ]

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
                                            "text": "不再需要直接改 JSON。现在按 通用关键词库 -> 节目 -> 季 -> 类型 的树状折叠结构管理。关键词支持直接输入后回车新增、点 × 删除；需要改词时删掉重输即可。新增节目和新增季也可以先把内容填完整，最后统一点一次保存。",
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
                                                    for type_key in common_type_keys
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

        if config.get("ui_schema_version") != self.UI_SCHEMA_VERSION:
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
        desired.update(self._build_form_model())
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
        common_type_keys = self._get_common_type_keys(self._common_types or self._default_common_types())

        for type_key in common_type_keys:
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

            rule_type_keys = self._get_rule_type_keys(current_rules[rule_index], common_types)

            seasons: List[Dict[str, Any]] = []
            season_count = len(current_rules[rule_index].get("seasons") or [])
            for season_index in range(season_count):
                source_season = self._to_int(config.get(f"rule_{rule_index}_season_{season_index}_number"))
                if not source_season:
                    continue
                if bool(config.get(f"rule_{rule_index}_season_{season_index}_delete")):
                    continue

                season_types: Dict[str, Dict[str, List[str]]] = {}
                for type_key in rule_type_keys:
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
                        "tmdb_season_number": self._to_int(
                            config.get(f"rule_{rule_index}_season_{season_index}_tmdb_season_number"),
                            source_season,
                        ) or source_season,
                        "tmdb_season_matchers": self._split_multiline(
                            config.get(f"rule_{rule_index}_season_{season_index}_tmdb_season_matchers_text")
                        ),
                        "types": season_types,
                        "manual_matches": self._parse_manual_matches_text(
                            config.get(f"rule_{rule_index}_season_{season_index}_manual_matches_text")
                        ),
                    }
                )

            new_season_number = self._to_int(config.get(f"rule_{rule_index}_new_season_number"))
            if new_season_number:
                new_season_types: Dict[str, Dict[str, List[str]]] = {}
                for type_key in rule_type_keys:
                    source_keywords = self._split_multiline(
                        config.get(f"rule_{rule_index}_new_season_type_{type_key}_source_keywords_text")
                    )
                    tmdb_keywords = self._split_multiline(
                        config.get(f"rule_{rule_index}_new_season_type_{type_key}_tmdb_keywords_text")
                    )
                    if source_keywords or tmdb_keywords:
                        new_season_types[type_key] = {
                            "source_keywords": source_keywords,
                            "tmdb_keywords": tmdb_keywords,
                        }

                self._upsert_season_rule(
                    seasons,
                    {
                        "source_season": new_season_number,
                        "tmdb_season_number": self._to_int(
                            config.get(f"rule_{rule_index}_new_season_tmdb_season_number"),
                            new_season_number,
                        ) or new_season_number,
                        "tmdb_season_matchers": self._split_multiline(
                            config.get(f"rule_{rule_index}_new_season_tmdb_season_matchers_text")
                        ),
                        "types": new_season_types,
                        "manual_matches": self._parse_manual_matches_text(
                            config.get(f"rule_{rule_index}_new_season_manual_matches_text")
                        ),
                    },
                )

            seasons = sorted(seasons, key=lambda item: int(item.get("source_season") or 0))
            if not seasons:
                main_season = int(config.get(f"rule_{rule_index}_main_season") or 1)
                seasons = [{"source_season": main_season, "tmdb_season_number": main_season, "tmdb_season_matchers": [], "types": {}, "manual_matches": []}]

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

        new_rule_name = str(config.get("new_rule_name") or "").strip()
        new_rule_tmdbid = self._to_int(config.get("new_rule_tmdbid"))
        if new_rule_name and new_rule_tmdbid:
            main_season = self._to_int(config.get("new_rule_main_season")) or 1
            first_season_number = self._to_int(config.get("new_rule_first_season_number"), main_season) or main_season
            extra_seasons = self._split_multiline(config.get("new_rule_extra_seasons_text"))
            parsed_seasons = [self._to_int(item) for item in extra_seasons]
            parsed_seasons = [item for item in parsed_seasons if item]
            season_numbers = [first_season_number] + parsed_seasons
            season_numbers = sorted(set(season_numbers))

            first_season_types: Dict[str, Dict[str, List[str]]] = {}
            for type_key in common_type_keys:
                source_keywords = self._split_multiline(config.get(f"new_rule_first_type_{type_key}_source_keywords_text"))
                tmdb_keywords = self._split_multiline(config.get(f"new_rule_first_type_{type_key}_tmdb_keywords_text"))
                if source_keywords or tmdb_keywords:
                    first_season_types[type_key] = {
                        "source_keywords": source_keywords,
                        "tmdb_keywords": tmdb_keywords,
                    }

            seasons = [
                {
                    "source_season": season_number,
                    "tmdb_season_number": season_number,
                    "tmdb_season_matchers": [],
                    "types": {},
                    "manual_matches": [],
                }
                for season_number in season_numbers
            ]
            self._upsert_season_rule(
                seasons,
                {
                    "source_season": first_season_number,
                    "tmdb_season_number": self._to_int(config.get("new_rule_first_tmdb_season_number"), first_season_number)
                    or first_season_number,
                    "tmdb_season_matchers": self._split_multiline(config.get("new_rule_first_tmdb_season_matchers_text")),
                    "types": first_season_types,
                    "manual_matches": self._parse_manual_matches_text(config.get("new_rule_first_manual_matches_text")),
                },
            )
            rules.append(
                {
                    "name": new_rule_name,
                    "tmdbid": new_rule_tmdbid,
                    "match_titles": self._split_multiline(config.get("new_rule_match_titles_text")),
                    "main_season": main_season,
                    "specials_season": self._to_int(config.get("new_rule_specials_season"), 0) or 0,
                    "specials_folder": str(config.get("new_rule_specials_folder") or self._specials_folder or "Specials").strip() or "Specials",
                    "seasons": seasons,
                }
            )

        return self._normalize_common_types(common_types), self._normalize_rules(rules)

    @staticmethod
    def _upsert_season_rule(seasons: List[Dict[str, Any]], season_rule: Dict[str, Any]):
        source_season = VarietySpecialMapper._to_int(season_rule.get("source_season"))
        if not source_season:
            return

        for current in seasons:
            if int(current.get("source_season") or 0) != int(source_season):
                continue
            current["tmdb_season_number"] = VarietySpecialMapper._to_int(
                season_rule.get("tmdb_season_number"),
                current.get("tmdb_season_number") or source_season,
            ) or source_season

            matchers = VarietySpecialMapper._split_multiline(season_rule.get("tmdb_season_matchers") or [])
            if matchers:
                current["tmdb_season_matchers"] = matchers

            types_map = season_rule.get("types") or {}
            if types_map:
                current.setdefault("types", {}).update(types_map)

            manual_matches = VarietySpecialMapper._normalize_manual_matches(season_rule.get("manual_matches") or [])
            if manual_matches:
                current["manual_matches"] = manual_matches
            return

        seasons.append(
            {
                "source_season": int(source_season),
                "tmdb_season_number": VarietySpecialMapper._to_int(
                    season_rule.get("tmdb_season_number"),
                    source_season,
                ) or int(source_season),
                "tmdb_season_matchers": VarietySpecialMapper._split_multiline(
                    season_rule.get("tmdb_season_matchers") or []
                ),
                "types": season_rule.get("types") or {},
                "manual_matches": VarietySpecialMapper._normalize_manual_matches(
                    season_rule.get("manual_matches") or []
                ),
            }
        )

    def _normalize_common_types(self, common_types: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
        normalized = self._default_common_types()
        for type_key, type_conf in (common_types or {}).items():
            normalized[type_key] = self._normalize_type_conf(type_conf)
        return {key: normalized[key] for key in self._get_common_type_keys(normalized)}

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
                        "tmdb_season_number": self._to_int(raw_rule.get("main_season"), 1) or 1,
                        "tmdb_season_matchers": [],
                        "types": legacy_types,
                        "manual_matches": legacy_manual_matches,
                    }
                ]

            season_map: Dict[int, Dict[str, Any]] = {}
            for season_rule in seasons_raw:
                if not isinstance(season_rule, dict):
                    continue
                source_season = self._to_int(season_rule.get("source_season"), self._to_int(raw_rule.get("main_season"), 1)) or 1
                current = season_map.get(
                    source_season,
                    {
                        "source_season": source_season,
                        "tmdb_season_number": source_season,
                        "tmdb_season_matchers": [],
                        "types": {},
                        "manual_matches": [],
                    },
                )
                current["tmdb_season_number"] = self._to_int(season_rule.get("tmdb_season_number"), source_season) or source_season
                current["tmdb_season_matchers"] = self._dedupe_list(
                    (current.get("tmdb_season_matchers") or [])
                    + self._split_multiline(season_rule.get("tmdb_season_matchers") or [])
                )
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

        normalized_rules = self._ensure_builtin_rules(normalized_rules)

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
        season_rule = {"source_season": int(source_season), "tmdb_season_number": int(source_season), "tmdb_season_matchers": [], "types": {}, "manual_matches": []}
        rule.setdefault("seasons", []).append(season_rule)
        rule["seasons"] = sorted(rule.get("seasons") or [], key=lambda item: int(item.get("source_season") or 0))
        return season_rule

    def _ensure_builtin_rules(self, rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        has_viva = False
        for rule in rules:
            if rule.get("name") == "妻子的浪漫旅行" or int(rule.get("tmdbid") or 0) == 97199:
                self._patch_viva_la_romance_rule(rule)
                has_viva = True
                break
        if not has_viva:
            rules.append(self._normalize_rules([self._default_viva_la_romance_rule()])[0])
        return rules

    def _patch_viva_la_romance_rule(self, rule: Dict[str, Any]):
        season_nine = self._get_or_create_season_rule(rule, 9)
        season_nine["tmdb_season_number"] = 8
        season_nine["tmdb_season_matchers"] = self._dedupe_list((season_nine.get("tmdb_season_matchers") or []) + ["2026"])

        season_types = season_nine.setdefault("types", {})
        bonus = season_types.setdefault("bonus", {"source_keywords": [], "tmdb_keywords": []})
        legacy_egg = season_types.pop("egg", None)
        if legacy_egg:
            bonus["source_keywords"] = self._dedupe_list((bonus.get("source_keywords") or []) + (legacy_egg.get("source_keywords") or []))
            bonus["tmdb_keywords"] = self._dedupe_list((bonus.get("tmdb_keywords") or []) + (legacy_egg.get("tmdb_keywords") or []))
        bonus["source_keywords"] = self._dedupe_list((bonus.get("source_keywords") or []) + ["超前彩蛋", ".Egg.", "Egg"])
        bonus["tmdb_keywords"] = self._dedupe_list((bonus.get("tmdb_keywords") or []) + ["超前彩蛋"])

        program = season_types.setdefault("program", {"source_keywords": [], "tmdb_keywords": []})
        program["source_keywords"] = self._dedupe_list((program.get("source_keywords") or []) + ["特别企划", "企划", ".Program.", "Program"])
        program["tmdb_keywords"] = self._dedupe_list((program.get("tmdb_keywords") or []) + ["特别企划", "企划"])

        plus = season_types.setdefault("plus", {"source_keywords": [], "tmdb_keywords": []})
        plus["source_keywords"] = self._dedupe_list((plus.get("source_keywords") or []) + ["加更", ".Plus.", "Plus"])
        plus["tmdb_keywords"] = self._dedupe_list((plus.get("tmdb_keywords") or []) + ["加更版", "Plus"])

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
        return self._match_rule_by_candidates(title_candidates=title_candidates, tmdbid=tmdbid)

    def _match_rule_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        title_candidates = {(title or "").lower()}
        return self._match_rule_by_candidates(title_candidates=title_candidates, tmdbid=None)

    def _match_rule_by_candidates(self, title_candidates: set, tmdbid: Optional[int] = None) -> Optional[Dict[str, Any]]:
        for rule in self._rules:
            rule_tmdbid = rule.get("tmdbid")
            if rule_tmdbid and tmdbid and int(rule_tmdbid) == int(tmdbid):
                return rule
            for alias in rule.get("match_titles", []) or []:
                alias = str(alias).strip().lower()
                if alias and any(alias in candidate for candidate in title_candidates):
                    return rule
        return None

    def _preprocess_meta_for_special_recognition(self, meta: MetaBase) -> MetaBase:
        raw_title = (getattr(meta, "org_string", None) or getattr(meta, "title", None) or getattr(meta, "name", None) or "").strip()
        if not raw_title:
            return meta

        rule = self._match_rule_by_title(raw_title)
        if not rule:
            return meta

        source_season = self._extract_source_season(raw_title, meta, rule)
        source_kind, override_index, override_target_episode = self._detect_source_kind(raw_title, rule, source_season)
        if not source_kind:
            return meta

        issue_index = override_index if override_index is not None else self._extract_source_index(raw_title, meta, source_kind)
        if issue_index is None and override_target_episode is None:
            return meta

        target_episode = override_target_episode
        specials_season = int(rule.get("specials_season", 0))
        if target_episode is None:
            target_episode = self._resolve_target_episode(rule, source_kind, issue_index, source_season)
        if not target_episode:
            return meta

        meta.type = MediaType.TV
        meta.tmdbid = int(rule.get("tmdbid") or 0) or None
        meta.begin_season = specials_season
        meta.end_season = None
        meta.total_season = 1
        meta.begin_episode = int(target_episode)
        meta.end_episode = None
        meta.total_episode = 1
        logger.info(
            f"综艺特别篇识别预纠偏：{raw_title} -> tmdbid={meta.tmdbid}, S{specials_season:02d}E{int(target_episode):02d}"
        )
        return meta

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

        season_match = re.search(r"第\s*([0-9一二三四五六七八九十两零〇]{1,4})\s*季", file_name)
        if season_match:
            return self._parse_int_token(season_match.group(1)) or int(rule.get("main_season") or 1)

        season = getattr(meta, "begin_season", None) if meta else None
        if season is not None:
            return int(season)
        return int(rule.get("main_season") or 1)

    def _resolve_mapping_source_season(self, rule: Dict[str, Any], title: str) -> int:
        lowered = (title or "").lower()
        for season_rule in rule.get("seasons") or []:
            matchers = [str(item).lower() for item in (season_rule.get("tmdb_season_matchers") or [])]
            if matchers and any(item in lowered for item in matchers):
                return int(season_rule.get("source_season") or rule.get("main_season") or 1)

        season_match = re.search(r"第\s*([0-9一二三四五六七八九十两零〇]{1,4})\s*季", title)
        if season_match:
            tmdb_season_number = self._parse_int_token(season_match.group(1))
            if tmdb_season_number is not None:
                for season_rule in rule.get("seasons") or []:
                    if int(season_rule.get("tmdb_season_number") or season_rule.get("source_season") or 0) == tmdb_season_number:
                        return int(season_rule.get("source_season") or tmdb_season_number)
                return tmdb_season_number

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

        cn_match = re.search(r"第\s*([0-9一二三四五六七八九十两零〇]{1,4})\s*期", file_name)
        if cn_match:
            parsed = self._parse_int_token(cn_match.group(1))
            if parsed is not None:
                return parsed

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
            mapping_season = self._resolve_mapping_source_season(rule, title)
            season_types = self._get_season_types(rule, mapping_season)
            kind, _, _ = self._detect_kind_from_keywords(
                lowered=title.lower(),
                types_map=season_types,
                keyword_field="tmdb_keywords",
            )
            if not kind:
                continue

            counter_key = (mapping_season, kind)
            issue_match = re.search(r"第\s*([0-9一二三四五六七八九十两零〇]{1,4})\s*期", title)
            if issue_match:
                issue_index = self._parse_int_token(issue_match.group(1)) or 1
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
            if type_key in specific_types:
                specific_conf = specific_types.get(type_key) or {}
                merged[type_key] = {
                    "source_keywords": specific_conf.get("source_keywords") or [],
                    "tmdb_keywords": specific_conf.get("tmdb_keywords") or [],
                }
            else:
                merged[type_key] = {
                    "source_keywords": common_conf.get("source_keywords") or [],
                    "tmdb_keywords": common_conf.get("tmdb_keywords") or [],
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

        common_type_keys = self._get_common_type_keys()
        for type_key in common_type_keys:
            common_conf = self._common_types.get(type_key) or {}
            model[f"common_type_{type_key}_source_keywords_text"] = list(common_conf.get("source_keywords") or [])
            model[f"common_type_{type_key}_tmdb_keywords_text"] = list(common_conf.get("tmdb_keywords") or [])

        for rule_index, rule in enumerate(self._rules):
            rule_type_keys = self._get_rule_type_keys(rule)
            model[f"rule_{rule_index}_name"] = rule.get("name") or ""
            model[f"rule_{rule_index}_tmdbid"] = int(rule.get("tmdbid") or 0)
            model[f"rule_{rule_index}_match_titles_text"] = list(rule.get("match_titles") or [])
            model[f"rule_{rule_index}_main_season"] = int(rule.get("main_season") or 1)
            model[f"rule_{rule_index}_specials_season"] = int(rule.get("specials_season") or 0)
            model[f"rule_{rule_index}_specials_folder"] = rule.get("specials_folder") or self._specials_folder or "Specials"
            model[f"rule_{rule_index}_delete"] = False
            model[f"rule_{rule_index}_new_season_number"] = ""
            model[f"rule_{rule_index}_new_season_tmdb_season_number"] = ""
            model[f"rule_{rule_index}_new_season_tmdb_season_matchers_text"] = []
            model[f"rule_{rule_index}_new_season_manual_matches_text"] = ""

            for type_key in rule_type_keys:
                model[f"rule_{rule_index}_new_season_type_{type_key}_source_keywords_text"] = []
                model[f"rule_{rule_index}_new_season_type_{type_key}_tmdb_keywords_text"] = []

            for season_index, season_rule in enumerate(rule.get("seasons") or []):
                model[f"rule_{rule_index}_season_{season_index}_number"] = int(season_rule.get("source_season") or 1)
                model[f"rule_{rule_index}_season_{season_index}_tmdb_season_number"] = int(
                    season_rule.get("tmdb_season_number") or season_rule.get("source_season") or 1
                )
                model[f"rule_{rule_index}_season_{season_index}_tmdb_season_matchers_text"] = list(
                    season_rule.get("tmdb_season_matchers") or []
                )
                model[f"rule_{rule_index}_season_{season_index}_delete"] = False
                model[f"rule_{rule_index}_season_{season_index}_manual_matches_text"] = json.dumps(
                    season_rule.get("manual_matches") or [],
                    ensure_ascii=False,
                    indent=2,
                )
                season_types = season_rule.get("types") or {}
                for type_key in rule_type_keys:
                    type_conf = season_types.get(type_key) or {}
                    model[
                        f"rule_{rule_index}_season_{season_index}_type_{type_key}_source_keywords_text"
                    ] = list(type_conf.get("source_keywords") or [])
                    model[
                        f"rule_{rule_index}_season_{season_index}_type_{type_key}_tmdb_keywords_text"
                    ] = list(type_conf.get("tmdb_keywords") or [])

        model.update(
            {
                "new_rule_name": "",
                "new_rule_tmdbid": "",
                "new_rule_match_titles_text": [],
                "new_rule_main_season": 1,
                "new_rule_specials_season": 0,
                "new_rule_specials_folder": self._specials_folder or "Specials",
                "new_rule_first_season_number": 1,
                "new_rule_first_tmdb_season_number": "",
                "new_rule_first_tmdb_season_matchers_text": [],
                "new_rule_first_manual_matches_text": "",
                "new_rule_extra_seasons_text": [],
            }
        )
        for type_key in common_type_keys:
            model[f"new_rule_first_type_{type_key}_source_keywords_text"] = []
            model[f"new_rule_first_type_{type_key}_tmdb_keywords_text"] = []
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
                                        self._build_keyword_combobox(
                                            model=f"rule_{rule_index}_match_titles_text",
                                            label="匹配标题 / 别名",
                                            placeholder="输入一个别名后按回车，例如：喜人奇妙夜 / Amazing Night",
                                            hint="支持直接新增、删除别名。",
                                        )
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
                                "component": "VAlert",
                                "props": {
                                    "type": "info",
                                    "variant": "tonal",
                                    "title": "JSON 模板",
                                    "text": "仅在极少数特殊命名时使用。示例：[{\"type\":\"bonus\",\"source_keywords\":[\"超前彩蛋\"],\"index\":1,\"target_episode\":3}]\n含义：当文件名包含超前彩蛋，且识别到是第 1 期时，强制映射到特别篇第 3 集。",
                                },
                            },
                            {
                                "component": "VTextarea",
                                "props": {
                                    "model": f"rule_{rule_index}_season_{season_index}_manual_matches_text",
                                    "label": "manual_matches JSON",
                                    "rows": 6,
                                    "autoGrow": True,
                                    "placeholder": "[\n  {\n    \"type\": \"bonus\",\n    \"source_keywords\": [\"超前彩蛋\"],\n    \"index\": 1,\n    \"target_episode\": 3\n  }\n]",
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
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_season_{season_index}_tmdb_season_number",
                                                "label": "TMDB 正片季号",
                                                "type": "number",
                                                "hint": "源文件季号和 TMDB 实际季号不一致时，在这里填 TMDB 的正片季号。",
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
                            "component": "VRow",
                            "content": [
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12},
                                    "content": [
                                        self._build_keyword_combobox(
                                            model=f"rule_{rule_index}_season_{season_index}_tmdb_season_matchers_text",
                                            label="TMDB 季识别关键词（可选）",
                                            placeholder="输入后回车，例如：2026 / 春游篇 / 第八季",
                                            hint="TMDB 特别篇标题不写第几季时，可以用年份或固定文案把它归到这个来源季。",
                                        )
                                    ],
                                }
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
        rule = self._rules[rule_index] if rule_index < len(self._rules) else {}
        type_keys = self._get_rule_type_keys(rule)
        new_season_type_panels = [
            self._build_type_panel(
                title=self._type_label(type_key),
                source_model=f"rule_{rule_index}_new_season_type_{type_key}_source_keywords_text",
                tmdb_model=f"rule_{rule_index}_new_season_type_{type_key}_tmdb_keywords_text",
            )
            for type_key in type_keys
        ]
        new_season_type_panels.append(
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
                                "component": "VAlert",
                                "props": {
                                    "type": "info",
                                    "variant": "tonal",
                                    "title": "JSON 模板",
                                    "text": "示例：[{\"type\":\"bonus\",\"source_keywords\":[\"超前彩蛋\"],\"index\":1,\"target_episode\":3}]",
                                },
                            },
                            {
                                "component": "VTextarea",
                                "props": {
                                    "model": f"rule_{rule_index}_new_season_manual_matches_text",
                                    "label": "manual_matches JSON",
                                    "rows": 6,
                                    "autoGrow": True,
                                    "placeholder": "[\n  {\n    \"type\": \"bonus\",\n    \"source_keywords\": [\"超前彩蛋\"],\n    \"index\": 1,\n    \"target_episode\": 3\n  }\n]",
                                },
                            },
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
                    "text": "新增一个季规则（填完后统一保存）",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VAlert",
                            "props": {
                                "type": "info",
                                "variant": "tonal",
                                "text": "这里不用先点一次保存再回来改内容了。把季号、识别词、关键词都填好，最后统一保存一次就行。",
                            },
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
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VTextField",
                                            "props": {
                                                "model": f"rule_{rule_index}_new_season_tmdb_season_number",
                                                "label": "TMDB 正片季号",
                                                "type": "number",
                                                "placeholder": "留空则等于新季号",
                                            },
                                        }
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 4},
                                    "content": [
                                        {
                                            "component": "VAlert",
                                            "props": {
                                                "type": "warning",
                                                "variant": "tonal",
                                                "text": "只要新季号有值，保存时就会自动创建这季。",
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
                                        self._build_keyword_combobox(
                                            model=f"rule_{rule_index}_new_season_tmdb_season_matchers_text",
                                            label="TMDB 季识别关键词（可选）",
                                            placeholder="输入后回车，例如：2026 / 春游篇 / 第八季",
                                            hint="用于把 TMDB 特别篇标题归到这个来源季。",
                                        )
                                    ],
                                }
                            ],
                        },
                        {
                            "component": "VExpansionPanels",
                            "props": {"multiple": True, "popout": True},
                            "content": new_season_type_panels,
                        },
                    ],
                },
            ],
        }

    def _build_new_rule_panel(self) -> Dict[str, Any]:
        type_keys = self._get_common_type_keys()
        first_season_type_panels = [
            self._build_type_panel(
                title=self._type_label(type_key),
                source_model=f"new_rule_first_type_{type_key}_source_keywords_text",
                tmdb_model=f"new_rule_first_type_{type_key}_tmdb_keywords_text",
            )
            for type_key in type_keys
        ]
        first_season_type_panels.append(
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
                                "component": "VAlert",
                                "props": {
                                    "type": "info",
                                    "variant": "tonal",
                                    "title": "JSON 模板",
                                    "text": "示例：[{\"type\":\"bonus\",\"source_keywords\":[\"超前彩蛋\"],\"index\":1,\"target_episode\":3}]",
                                },
                            },
                            {
                                "component": "VTextarea",
                                "props": {
                                    "model": "new_rule_first_manual_matches_text",
                                    "label": "manual_matches JSON",
                                    "rows": 6,
                                    "autoGrow": True,
                                    "placeholder": "[\n  {\n    \"type\": \"bonus\",\n    \"source_keywords\": [\"超前彩蛋\"],\n    \"index\": 1,\n    \"target_episode\": 3\n  }\n]",
                                },
                            },
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
                    "text": "新增节目规则（填完后统一保存）",
                },
                {
                    "component": "VExpansionPanelText",
                    "content": [
                        {
                            "component": "VAlert",
                            "props": {
                                "type": "info",
                                "variant": "tonal",
                                "text": "这里可以一次把节目基础信息和首个季规则一起填完。只要节目名称和 TMDB ID 有值，保存时就会自动创建。",
                            },
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
                                            "component": "VAlert",
                                            "props": {
                                                "type": "warning",
                                                "variant": "tonal",
                                                "text": "保存时自动创建，无需再勾选。",
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
                                        self._build_keyword_combobox(
                                            model="new_rule_match_titles_text",
                                            label="匹配标题 / 别名",
                                            placeholder="输入一个别名后按回车",
                                            hint="可留空，默认也会按节目名称匹配。",
                                        )
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        self._build_keyword_combobox(
                                            model="new_rule_extra_seasons_text",
                                            label="额外初始化季号（可选）",
                                            placeholder="输入后回车，例如：2 / 3",
                                            hint="首个季规则在下面单独配置；这里填的是额外先建出来的空季。",
                                        )
                                    ],
                                },
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
                                            "text": "首个季规则",
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
                                                                        "model": "new_rule_first_season_number",
                                                                        "label": "首个季号",
                                                                        "type": "number",
                                                                    },
                                                                }
                                                            ],
                                                        },
                                                        {
                                                            "component": "VCol",
                                                            "props": {"cols": 12, "md": 6},
                                                            "content": [
                                                                {
                                                                    "component": "VTextField",
                                                                    "props": {
                                                                        "model": "new_rule_first_tmdb_season_number",
                                                                        "label": "TMDB 正片季号",
                                                                        "type": "number",
                                                                        "placeholder": "留空则等于首个季号",
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
                                                                self._build_keyword_combobox(
                                                                    model="new_rule_first_tmdb_season_matchers_text",
                                                                    label="TMDB 季识别关键词（可选）",
                                                                    placeholder="输入后回车，例如：2026 / 春游篇 / 第八季",
                                                                    hint="TMDB 标题不直接写第几季时，用这里补充识别词。",
                                                                )
                                                            ],
                                                        }
                                                    ],
                                                },
                                                {
                                                    "component": "VExpansionPanels",
                                                    "props": {"multiple": True, "popout": True},
                                                    "content": first_season_type_panels,
                                                },
                                            ],
                                        },
                                    ],
                                }
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
                                        self._build_keyword_combobox(
                                            model=source_model,
                                            label="源文件名关键词",
                                            placeholder="输入一个关键词后按回车",
                                        )
                                    ],
                                },
                                {
                                    "component": "VCol",
                                    "props": {"cols": 12, "md": 6},
                                    "content": [
                                        self._build_keyword_combobox(
                                            model=tmdb_model,
                                            label="TMDB 标题关键词",
                                            placeholder="输入一个关键词后按回车",
                                        )
                                    ],
                                },
                            ],
                        },
                        {
                            "component": "VAlert",
                            "props": {
                                "type": "info",
                                "variant": "tonal",
                                "text": "输入关键词后按回车即可新增，点关键词右侧 × 可删除；要改词时删掉后重新输入。",
                            },
                        },
                    ],
                },
            ],
        }

    @staticmethod
    def _build_keyword_combobox(model: str, label: str, placeholder: str, hint: Optional[str] = None) -> Dict[str, Any]:
        props: Dict[str, Any] = {
            "model": model,
            "label": label,
            "placeholder": placeholder,
            "multiple": True,
            "chips": True,
            "closableChips": True,
            "clearable": True,
            "hideSelected": True,
        }
        if hint:
            props["hint"] = hint
            props["persistentHint"] = True
        return {
            "component": "VCombobox",
            "props": props,
        }

    @classmethod
    def _type_label(cls, type_key: str) -> str:
        labels = {
            "pilot": "先导",
            "bonus": "彩蛋",
            "program": "企划",
            "plus": "加更",
            "pure": "纯享",
            "watch": "陪看",
            "chat": "夜聊",
            "punish": "惩罚室",
            "party": "聚会",
        }
        return labels.get(type_key, type_key)

    @classmethod
    def _get_common_type_keys(cls, common_types: Optional[Dict[str, Any]] = None) -> List[str]:
        target = common_types or cls.COMMON_TYPES_TEMPLATE
        ordered: List[str] = []
        for type_key in cls.TYPE_ORDER:
            if type_key in target and type_key not in ordered:
                ordered.append(type_key)
        for type_key in target.keys():
            if type_key not in ordered:
                ordered.append(type_key)
        return ordered

    @classmethod
    def _get_rule_type_keys(cls, rule: Dict[str, Any], common_types: Optional[Dict[str, Any]] = None) -> List[str]:
        ordered = cls._get_common_type_keys(common_types)
        for season_rule in rule.get("seasons") or []:
            for type_key in (season_rule.get("types") or {}).keys():
                if type_key not in ordered:
                    ordered.append(type_key)
        return ordered

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
    def _parse_int_token(value: Any) -> Optional[int]:
        raw = str(value or "").strip()
        if not raw:
            return None
        if raw.isdigit():
            return int(raw)

        mapping = {
            "零": 0,
            "〇": 0,
            "一": 1,
            "二": 2,
            "两": 2,
            "三": 3,
            "四": 4,
            "五": 5,
            "六": 6,
            "七": 7,
            "八": 8,
            "九": 9,
        }

        if raw == "十":
            return 10
        if raw.startswith("十") and len(raw) == 2:
            return 10 + mapping.get(raw[1], 0)
        if raw.endswith("十") and len(raw) == 2:
            return mapping.get(raw[0], 0) * 10
        if "十" in raw and len(raw) == 3:
            return mapping.get(raw[0], 0) * 10 + mapping.get(raw[2], 0)
        if raw in mapping:
            return mapping[raw]
        return None

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
