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
    plugin_version = "0.1.4"
    plugin_author = "二狗"
    author_url = "https://github.com/nbyyzjw/MoviePilot-Plugins-TenTomato"
    plugin_config_prefix = "varietyspecialmapper_"
    plugin_order = 16
    auth_level = 1

    _enabled = False
    _notify = False
    _specials_folder = "Specials"
    _rules_text = ""
    _rules: List[Dict[str, Any]] = []
    _tmdb_mapping_cache: Dict[str, Dict[str, Dict[int, int]]] = {}

    @staticmethod
    def _default_rules_text() -> str:
        return json.dumps(
            [
                {
                    "name": "喜人奇妙夜",
                    "tmdbid": 257161,
                    "match_titles": ["喜人奇妙夜", "Amazing Night", "Amazing.Night"],
                    "main_season": 1,
                    "specials_season": 0,
                    "specials_folder": "Specials",
                    "types": {
                        "pilot": {
                            "source_keywords": ["先导", "S01E00"],
                            "tmdb_keywords": ["先导", "超前集结"]
                        },
                        "pure": {
                            "source_keywords": ["纯享", ".Pure."],
                            "tmdb_keywords": ["纯享"]
                        },
                        "watch": {
                            "source_keywords": ["陪看", ".Watch."],
                            "tmdb_keywords": ["陪看"]
                        },
                        "chat": {
                            "source_keywords": ["夜聊", ".Chat."],
                            "tmdb_keywords": ["夜聊"]
                        },
                        "punish": {
                            "source_keywords": ["惩罚室", ".Punish."],
                            "tmdb_keywords": ["惩罚室", "不好笑惩罚室"]
                        },
                        "party": {
                            "source_keywords": ["聚会", "派对", ".Party."],
                            "tmdb_keywords": ["聚会", "派对"]
                        },
                        "bonus": {
                            "source_keywords": ["彩蛋", ".Bonus."],
                            "tmdb_keywords": ["特辑"]
                        }
                    },
                    "manual_matches": []
                }
            ],
            ensure_ascii=False,
            indent=2,
        )

    def init_plugin(self, config: dict = None):
        config = config or {}
        self._enabled = bool(config.get("enabled", False))
        self._notify = bool(config.get("notify", False))
        self._specials_folder = (config.get("specials_folder") or "Specials").strip() or "Specials"
        self._rules_text = config.get("rules_text") or self._default_rules_text()
        self._rules_text = self._migrate_rules_text(self._rules_text)
        self._rules = self._parse_rules(self._rules_text)
        self._tmdb_mapping_cache = {}

    def get_state(self) -> bool:
        return self._enabled

    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        return []

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
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
                                            "label": "启用插件"
                                        }
                                    }
                                ]
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "model": "notify",
                                            "label": "发送纠偏通知"
                                        }
                                    }
                                ]
                            }
                        ]
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
                                            "model": "specials_folder",
                                            "label": "特别篇目录名",
                                            "placeholder": "Specials"
                                        }
                                    }
                                ]
                            }
                        ]
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
                                            "text": "插件在整理完成事件触发后，把识别到的综艺彩蛋内容移动到 Specials 目录并改成 S00E??，随后让 MoviePilot 正常按 TMDB 刮削。默认已内置《喜人奇妙夜》示例规则。"
                                        }
                                    }
                                ]
                            }
                        ]
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
                                            "model": "rules_text",
                                            "label": "规则 JSON",
                                            "rows": 18,
                                            "autoGrow": True,
                                            "placeholder": "填写规则 JSON"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ], {
            "enabled": self._enabled,
            "notify": self._notify,
            "specials_folder": self._specials_folder,
            "rules_text": self._rules_text,
        }

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
                    "text": "这里只展示最近 10 条记录，便于排查规则是否命中。"
                }
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
                            "text": "还没有纠偏记录。"
                        }
                    ]
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
                        {"component": "VCardText", "text": f"目标集: S{int(item.get('target_season', 0)):02d}E{int(item.get('target_episode', 0)):02d}"},
                    ]
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

        source_kind, override_index, override_target_episode = self._detect_source_kind(source_name or file_path.name, rule)
        if not source_kind:
            return

        source_season = self._extract_source_season(source_name or file_path.name, meta, rule)
        issue_index = override_index if override_index is not None else self._extract_source_index(source_name or file_path.name, meta, source_kind)
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

    def _parse_rules(self, text: str) -> List[Dict[str, Any]]:
        if not text:
            return []
        try:
            data = json.loads(text)
            return data if isinstance(data, list) else []
        except Exception as err:
            logger.error(f"解析综艺特别篇规则失败：{err}")
            return []

    def _migrate_rules_text(self, text: str) -> str:
        migrated = text
        changed = False
        try:
            data = json.loads(text)
        except Exception:
            return text

        if not isinstance(data, list):
            return text

        for rule in data:
            if not isinstance(rule, dict):
                continue
            if rule.get("name") != "喜人奇妙夜":
                continue
            if int(rule.get("tmdbid") or 0) == 257971:
                rule["tmdbid"] = 257161
                changed = True

            types = rule.setdefault("types", {})
            party = types.setdefault("party", {})
            party_keywords = set(party.get("source_keywords") or [])
            party_tmdb_keywords = set(party.get("tmdb_keywords") or [])
            if "派对" not in party_keywords:
                party_keywords.add("派对")
                changed = True
            if "派对" not in party_tmdb_keywords:
                party_tmdb_keywords.add("派对")
                changed = True
            party["source_keywords"] = list(party_keywords)
            party["tmdb_keywords"] = list(party_tmdb_keywords or {"聚会", "派对"})

            if "bonus" not in types:
                types["bonus"] = {
                    "source_keywords": ["彩蛋", ".Bonus."],
                    "tmdb_keywords": ["特辑"],
                }
                changed = True

        if changed:
            migrated = json.dumps(data, ensure_ascii=False, indent=2)
            self.update_config(
                {
                    "enabled": self._enabled,
                    "notify": self._notify,
                    "specials_folder": self._specials_folder,
                    "rules_text": migrated,
                }
            )
            logger.info("已自动迁移综艺特别篇纠偏插件旧规则到新格式")
        return migrated

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

    def _detect_source_kind(self, file_name: str, rule: Dict[str, Any]) -> Tuple[Optional[str], Optional[int], Optional[int]]:
        manual_matches = rule.get("manual_matches") or []
        lowered = file_name.lower()
        for item in manual_matches:
            keywords = [str(word).lower() for word in (item.get("source_keywords") or [])]
            if keywords and any(word in lowered for word in keywords):
                return item.get("type"), item.get("index"), item.get("target_episode")

        for kind, kind_conf in (rule.get("types") or {}).items():
            for keyword in kind_conf.get("source_keywords") or []:
                if str(keyword).lower() in lowered:
                    return kind, None, None
        return None, None, None

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
        types = rule.get("types") or {}
        mapping: Dict[str, Dict[str, Dict[int, int]]] = {}
        fallback_counter: Dict[Tuple[int, str], int] = {}

        def detect_kind(title: str) -> Optional[str]:
            lowered = (title or "").lower()
            for kind, kind_conf in types.items():
                keywords = [str(word).lower() for word in (kind_conf.get("tmdb_keywords") or [])]
                if keywords and any(word in lowered for word in keywords):
                    return kind
            return None

        for episode in sorted(episodes, key=lambda item: getattr(item, "episode_number", 0) or 0):
            title = getattr(episode, "name", "") or ""
            kind = detect_kind(title)
            if not kind:
                continue

            season_match = re.search(r"第\s*(\d{1,2})\s*季", title)
            mapping_season = int(season_match.group(1)) if season_match else int(rule.get("main_season") or 1)
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
