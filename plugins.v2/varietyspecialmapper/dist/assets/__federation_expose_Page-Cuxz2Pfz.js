import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {computed,defineComponent,onMounted,ref,watch} = await importShared('vue');


const PLUGIN_ID = 'VarietySpecialMapper';

const _sfc_main = defineComponent({
  name: 'VarietySpecialMapperPage',
  props: {
    api: {
      type: Object,
      default: null,
    },
  },
  emits: ['switch'],
  setup(props) {
    const loading = ref(false);
    const error = ref('');
    const history = ref([]);
    const rawState = ref({ common_types: {}, rules: [] });

    const stats = computed(() => ({
      ruleCount: (rawState.value.rules || []).length,
      typeCount: Object.keys(rawState.value.common_types || {}).length,
    }));

    const formatTarget = (item) => {
      const season = Number(item?.target_season || 0);
      const episode = Number(item?.target_episode || 0);
      return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    };

    const loadState = async () => {
      if (!props.api?.get) return
      loading.value = true;
      error.value = '';
      try {
        const result = await props.api.get(`plugin/${PLUGIN_ID}/state`);
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '加载状态失败')
        }
        rawState.value = result.data || { common_types: {}, rules: [] };
        history.value = Array.isArray(result.data?.history) ? result.data.history : [];
      } catch (err) {
        error.value = err?.message || '加载记录失败';
      } finally {
        loading.value = false;
      }
    };

    watch(
      () => props.api,
      (api) => {
        if (api) loadState();
      },
      { immediate: true }
    );

    onMounted(() => {
      if (props.api) loadState();
    });

    return {
      loading,
      error,
      history,
      stats,
      formatTarget,
    }
  },
});

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createElementVNode:_createElementVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementBlock:_createElementBlock,renderList:_renderList,Fragment:_Fragment} = await importShared('vue');


const _hoisted_1 = { class: "plugin-page" };
const _hoisted_2 = { class: "text-h6" };
const _hoisted_3 = { class: "text-h6" };
const _hoisted_4 = { class: "text-h6" };
const _hoisted_5 = {
  key: 1,
  class: "py-8 text-center text-medium-emphasis"
};
const _hoisted_6 = { class: "text-caption text-medium-emphasis" };
const _hoisted_7 = { class: "d-flex align-center flex-wrap gap-2 mb-1" };
const _hoisted_8 = { class: "text-caption text-medium-emphasis break-all" };
const _hoisted_9 = { class: "text-caption text-medium-emphasis break-all" };

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_v_icon = _resolveComponent("v-icon");
  const _component_v_spacer = _resolveComponent("v-spacer");
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_card_title = _resolveComponent("v-card-title");
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_card_text = _resolveComponent("v-card-text");
  const _component_v_card = _resolveComponent("v-card");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_chip = _resolveComponent("v-chip");
  const _component_v_timeline_item = _resolveComponent("v-timeline-item");
  const _component_v_timeline = _resolveComponent("v-timeline");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_v_card, {
      flat: "",
      class: "rounded border mb-3"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card_title, { class: "text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5" }, {
          default: _withCtx(() => [
            _createVNode(_component_v_icon, {
              icon: "mdi-television-classic",
              class: "mr-2",
              color: "primary",
              size: "small"
            }),
            _cache[2] || (_cache[2] = _createElementVNode("span", null, "综艺特别篇纠偏", -1)),
            _createVNode(_component_v_spacer),
            _createVNode(_component_v_btn, {
              color: "primary",
              size: "small",
              variant: "text",
              onClick: _cache[0] || (_cache[0] = $event => (_ctx.$emit('switch')))
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, {
                  icon: "mdi-cog",
                  size: "small",
                  class: "mr-1"
                }),
                _cache[1] || (_cache[1] = _createTextVNode(" 配置规则 ", -1))
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        _createVNode(_component_v_card_text, { class: "px-3 py-3" }, {
          default: _withCtx(() => [
            (_ctx.error)
              ? (_openBlock(), _createBlock(_component_v_alert, {
                  key: 0,
                  type: "error",
                  density: "compact",
                  variant: "tonal",
                  class: "mb-3",
                  closable: ""
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(_ctx.error), 1)
                  ]),
                  _: 1
                }))
              : _createCommentVNode("", true),
            _createVNode(_component_v_alert, {
              type: "info",
              variant: "tonal",
              density: "compact",
              class: "mb-3"
            }, {
              default: _withCtx(() => [...(_cache[3] || (_cache[3] = [
                _createTextVNode(" 这里展示最近 10 条纠偏记录。配置页已经改成更轻量的自动保存模式，不用频繁被“先保存再继续”打断。 ", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_v_row, { class: "mb-1" }, {
              default: _withCtx(() => [
                _createVNode(_component_v_col, {
                  cols: "12",
                  md: "4"
                }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_card, {
                      variant: "tonal",
                      color: "primary"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_card_text, null, {
                          default: _withCtx(() => [
                            _cache[4] || (_cache[4] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "节目规则", -1)),
                            _createElementVNode("div", _hoisted_2, _toDisplayString(_ctx.stats.ruleCount), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_col, {
                  cols: "12",
                  md: "4"
                }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_card, {
                      variant: "tonal",
                      color: "success"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_card_text, null, {
                          default: _withCtx(() => [
                            _cache[5] || (_cache[5] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "通用分类", -1)),
                            _createElementVNode("div", _hoisted_3, _toDisplayString(_ctx.stats.typeCount), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_col, {
                  cols: "12",
                  md: "4"
                }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_card, {
                      variant: "tonal",
                      color: "deep-purple"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_card_text, null, {
                          default: _withCtx(() => [
                            _cache[6] || (_cache[6] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "最近记录", -1)),
                            _createElementVNode("div", _hoisted_4, _toDisplayString(_ctx.history.length), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            (_ctx.loading)
              ? (_openBlock(), _createElementBlock("div", _hoisted_5, " 正在加载最近纠偏记录... "))
              : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                  (!_ctx.history.length)
                    ? (_openBlock(), _createBlock(_component_v_card, {
                        key: 0,
                        variant: "text",
                        class: "border rounded"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_v_card_text, { class: "text-medium-emphasis" }, {
                            default: _withCtx(() => [...(_cache[7] || (_cache[7] = [
                              _createTextVNode("还没有纠偏记录。", -1)
                            ]))]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }))
                    : (_openBlock(), _createBlock(_component_v_timeline, {
                        key: 1,
                        density: "compact",
                        align: "start"
                      }, {
                        default: _withCtx(() => [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.history, (item, index) => {
                            return (_openBlock(), _createBlock(_component_v_timeline_item, {
                              key: `${item.new_path || item.old_path || index}-${index}`,
                              "dot-color": "primary",
                              "fill-dot": "",
                              size: "small"
                            }, {
                              opposite: _withCtx(() => [
                                _createElementVNode("span", _hoisted_6, _toDisplayString(_ctx.formatTarget(item)), 1)
                              ]),
                              default: _withCtx(() => [
                                _createVNode(_component_v_card, {
                                  variant: "text",
                                  class: "border rounded-sm"
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_card_text, null, {
                                      default: _withCtx(() => [
                                        _createElementVNode("div", _hoisted_7, [
                                          _createElementVNode("strong", null, _toDisplayString(item.show || '未知节目'), 1),
                                          _createVNode(_component_v_chip, {
                                            size: "x-small",
                                            color: "primary",
                                            variant: "tonal"
                                          }, {
                                            default: _withCtx(() => [
                                              _createTextVNode(_toDisplayString(item.kind || '未识别'), 1)
                                            ]),
                                            _: 2
                                          }, 1024)
                                        ]),
                                        _createElementVNode("div", _hoisted_8, "原路径：" + _toDisplayString(item.old_path), 1),
                                        _createElementVNode("div", _hoisted_9, "新路径：" + _toDisplayString(item.new_path), 1)
                                      ]),
                                      _: 2
                                    }, 1024)
                                  ]),
                                  _: 2
                                }, 1024)
                              ]),
                              _: 2
                            }, 1024))
                          }), 128))
                        ]),
                        _: 1
                      }))
                ], 64))
          ]),
          _: 1
        })
      ]),
      _: 1
    })
  ]))
}
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['render',_sfc_render],['__scopeId',"data-v-30877ec3"]]);

export { Page as default };
