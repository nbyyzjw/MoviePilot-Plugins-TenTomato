from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.plugins import _PluginBase


class SimpleTextBoard(_PluginBase):
    plugin_name = "简单文本面板"
    plugin_desc = "展示一段自定义文本，可作为 MoviePilot V2 插件开发起点。"
    plugin_icon = "Plugins_A.png"
    plugin_version = "1.0.0"
    plugin_author = "二狗"
    author_url = "https://github.com/nbyyzjw/MoviePilot-Plugins-TenTomato"
    plugin_config_prefix = "simpletextboard_"
    plugin_order = 50
    auth_level = 1

    _enabled = False
    _title = "简单文本面板"
    _message = "Hello MoviePilot V2"
    _level = "info"
    _show_dashboard = True
    _updated_at = ""

    def init_plugin(self, config: dict = None):
        config = config or {}
        self._enabled = bool(config.get("enabled", False))
        self._title = (config.get("title") or "简单文本面板").strip()
        self._message = (config.get("message") or "Hello MoviePilot V2").strip()
        self._level = config.get("level") or "info"
        self._show_dashboard = bool(config.get("show_dashboard", True))
        self._updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

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
                                            "model": "show_dashboard",
                                            "label": "显示到仪表板"
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
                                        "component": "VTextField",
                                        "props": {
                                            "model": "title",
                                            "label": "标题",
                                            "placeholder": "例如：下载机今日状态"
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
                                        "component": "VSelect",
                                        "props": {
                                            "model": "level",
                                            "label": "提示样式",
                                            "items": [
                                                {"title": "信息", "value": "info"},
                                                {"title": "成功", "value": "success"},
                                                {"title": "警告", "value": "warning"},
                                                {"title": "错误", "value": "error"}
                                            ]
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
                                            "model": "message",
                                            "label": "正文",
                                            "rows": 5,
                                            "placeholder": "写一段你想在插件页或仪表板展示的内容"
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
            "show_dashboard": self._show_dashboard,
            "title": self._title,
            "message": self._message,
            "level": self._level,
        }

    def get_page(self) -> List[dict]:
        return [
            {
                "component": "VAlert",
                "props": {
                    "type": self._level,
                    "variant": "tonal",
                    "title": self._title,
                    "text": self._message or "暂无内容"
                }
            },
            {
                "component": "VCard",
                "props": {
                    "class": "mt-3"
                },
                "content": [
                    {
                        "component": "VCardText",
                        "text": f"最后加载时间: {self._updated_at}"
                    },
                    {
                        "component": "VCardText",
                        "text": f"仪表板显示: {'开启' if self._show_dashboard else '关闭'}"
                    }
                ]
            }
        ]

    def get_dashboard_meta(self) -> Optional[List[Dict[str, str]]]:
        if not self._show_dashboard:
            return None
        return [{"key": "simple_text_board", "name": self._title or self.plugin_name}]

    def get_dashboard(self, key: str = None, **kwargs) -> Optional[Tuple[Dict[str, Any], Dict[str, Any], List[dict]]]:
        if not self._enabled or not self._show_dashboard:
            return None
        return (
            {"cols": 12, "md": 6},
            {
                "title": self._title,
                "subtitle": "SimpleTextBoard",
                "refresh": 0,
            },
            [
                {
                    "component": "VAlert",
                    "props": {
                        "type": self._level,
                        "variant": "tonal",
                        "text": self._message or "暂无内容"
                    }
                },
                {
                    "component": "div",
                    "props": {
                        "class": "text-caption text-medium-emphasis mt-2"
                    },
                    "text": f"最近载入: {self._updated_at}"
                }
            ]
        )

    def stop_service(self):
        pass
