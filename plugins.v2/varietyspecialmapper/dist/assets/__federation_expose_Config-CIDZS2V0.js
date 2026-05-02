import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {computed,defineComponent,onBeforeUnmount,onMounted,reactive,ref,watch} = await importShared('vue');


const PLUGIN_ID = 'VarietySpecialMapper';
const TYPE_ORDER = ['pilot', 'bonus', 'program', 'plus', 'pure', 'watch', 'chat', 'punish', 'party'];
const BUILTIN_LABELS = {
  pilot: '先导',
  bonus: '彩蛋',
  program: '企划',
  plus: '加更',
  pure: '纯享',
  watch: '陪看',
  chat: '夜聊',
  punish: '惩罚室',
  party: '聚会',
};

const createEmptyState = () => ({
  enabled: false,
  notify: false,
  specials_folder: 'Specials',
  subscription_enabled: true,
  subscription_urls: [],
  subscription_last_sync: {},
  commonTypes: [],
  rules: [],
  history: [],
});

const uid = (prefix = 'uid') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const toPositiveInt = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback
};
const normalizeStringArray = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item);
      return true
    })
};
const formatManualMatches = (value) => {
  if (!Array.isArray(value) || !value.length) return ''
  return JSON.stringify(value, null, 2)
};
const safeParseManualMatches = (text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error('manual_matches 必须是 JSON 数组')
  }
  return parsed
};

const _sfc_main = defineComponent({
  name: 'VarietySpecialMapperConfig',
  props: {
    api: {
      type: Object,
      default: null,
    },
  },
  emits: ['switch'],
  setup(props) {
    const state = ref(createEmptyState());
    const loading = ref(false);
    const saving = ref(false);
    const syncingSubscription = ref(false);
    const saveError = ref('');
    const saveStatus = ref('idle');
    const dirty = ref(false);
    const lastSavedAt = ref('');
    const suspendAutosave = ref(false);
    let saveTimer = null;

    const dialogs = reactive({ type: false, rule: false, season: false });
    const drafts = reactive({
      type: { label: '', source_keywords: [], tmdb_keywords: [] },
      rule: { name: '', tmdbid: '', match_titles: [], main_season: 1, specials_season: 0, specials_folder: 'Specials' },
      season: { ruleUid: '', source_season: '', tmdb_season_number: '', tmdb_season_matchers: [] },
    });

    const createEmptyTypeBinding = () => ({ source_keywords: [], tmdb_keywords: [] });

    const hydrateState = (raw) => {
      const commonTypes = Object.entries(raw?.common_types || {}).map(([key, value]) => ({
        _uid: uid('type'),
        key,
        label: String(value?.label || BUILTIN_LABELS[key] || key).trim(),
        source_keywords: normalizeStringArray(value?.source_keywords || []),
        tmdb_keywords: normalizeStringArray(value?.tmdb_keywords || []),
      }));

      const orderIndex = (key) => {
        const idx = TYPE_ORDER.indexOf(key);
        return idx === -1 ? 999 : idx
      };
      commonTypes.sort((a, b) => orderIndex(a.key) - orderIndex(b.key) || a.label.localeCompare(b.label, 'zh-Hans-CN'));
      const commonTypeKeys = commonTypes.map((item) => item.key);

      const rules = (raw?.rules || []).map((rule) => ({
        _uid: uid('rule'),
        name: String(rule?.name || ''),
        tmdbid: rule?.tmdbid == null ? '' : String(rule.tmdbid),
        match_titles: normalizeStringArray(rule?.match_titles || []),
        main_season: rule?.main_season ?? 1,
        specials_season: rule?.specials_season ?? 0,
        specials_folder: String(rule?.specials_folder || raw?.specials_folder || 'Specials'),
        seasons: (rule?.seasons || []).map((season) => {
          const types = Object.fromEntries(
            Object.entries(season?.types || {}).map(([typeKey, conf]) => [
              typeKey,
              {
                source_keywords: normalizeStringArray(conf?.source_keywords || []),
                tmdb_keywords: normalizeStringArray(conf?.tmdb_keywords || []),
              },
            ])
          );
          commonTypeKeys.forEach((typeKey) => {
            if (!types[typeKey]) {
              types[typeKey] = createEmptyTypeBinding();
            }
          });
          return {
            _uid: uid('season'),
            source_season: season?.source_season ?? 1,
            tmdb_season_number: season?.tmdb_season_number ?? season?.source_season ?? 1,
            tmdb_season_matchers: normalizeStringArray(season?.tmdb_season_matchers || []),
            manual_matches_text: formatManualMatches(season?.manual_matches),
            types,
          }
        }),
      }));

      return {
        enabled: !!raw?.enabled,
        notify: !!raw?.notify,
        specials_folder: String(raw?.specials_folder || 'Specials'),
        subscription_enabled: raw?.subscription_enabled !== false,
        subscription_urls: normalizeStringArray(raw?.subscription_urls || []),
        subscription_last_sync: raw?.subscription_last_sync && typeof raw.subscription_last_sync === 'object'
          ? raw.subscription_last_sync
          : {},
        commonTypes,
        rules,
        history: Array.isArray(raw?.history) ? raw.history : [],
      }
    };

    const statusText = computed(() => {
      if (loading.value) return '正在加载'
      if (syncingSubscription.value) return '正在同步订阅'
      if (saving.value) return '正在保存'
      if (saveStatus.value === 'invalid') return '待补全后保存'
      if (dirty.value) return '有未保存更改'
      if (saveStatus.value === 'saved') return '已自动保存'
      if (saveStatus.value === 'error') return '保存失败'
      return '已就绪'
    });

    const statusColor = computed(() => {
      if (loading.value) return 'info'
      if (syncingSubscription.value) return 'primary'
      if (saving.value) return 'primary'
      if (saveStatus.value === 'invalid') return 'warning'
      if (saveStatus.value === 'error') return 'error'
      if (saveStatus.value === 'saved') return 'success'
      if (dirty.value) return 'orange'
      return 'grey'
    });

    const lastSavedLabel = computed(() => (lastSavedAt.value ? `上次保存：${lastSavedAt.value}` : ''));
    const subscriptionStatusLabel = computed(() => {
      const info = state.value.subscription_last_sync || {};
      if (!info?.message && !info?.synced_at) return ''
      const source = info?.source ? ` · ${info.source}` : '';
      const time = info?.synced_at ? ` · ${info.synced_at}` : '';
      return `${info.message || '订阅状态未知'}${source}${time}`
    });

    const orderedSeasons = (rule) => {
      return [...(rule?.seasons || [])].sort((a, b) => Number(a.source_season || 0) - Number(b.source_season || 0))
    };

    const getTypeLabel = (typeKey) => {
      return state.value.commonTypes.find((item) => item.key === typeKey)?.label || BUILTIN_LABELS[typeKey] || typeKey
    };

    const getRuleTypeKeys = (rule) => {
      const keys = new Set(state.value.commonTypes.map((item) => item.key))
      ;(rule?.seasons || []).forEach((season) => {
        Object.keys(season?.types || {}).forEach((typeKey) => keys.add(typeKey));
      });
      return [...keys].sort((a, b) => {
        const aIndex = TYPE_ORDER.indexOf(a);
        const bIndex = TYPE_ORDER.indexOf(b);
        const normalizedA = aIndex === -1 ? 999 : aIndex;
        const normalizedB = bIndex === -1 ? 999 : bIndex;
        return normalizedA - normalizedB || getTypeLabel(a).localeCompare(getTypeLabel(b), 'zh-Hans-CN')
      })
    };

    const ensureTypeBinding = (season, typeKey) => season.types[typeKey] || createEmptyTypeBinding();

    const validationIssues = computed(() => {
      const issues = [];
      state.value.commonTypes.forEach((type, index) => {
        if (!String(type.label || '').trim()) {
          issues.push(`通用分类 #${index + 1} 还没有名称`);
        }
      });

      state.value.rules.forEach((rule, ruleIndex) => {
        if (!String(rule.name || '').trim()) {
          issues.push(`节目规则 #${ruleIndex + 1} 还没有节目名称`);
        }
        if (!toPositiveInt(rule.tmdbid)) {
          issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」的 TMDB ID 还没填对`);
        }
        const seasonNumbers = new Set();
        rule.seasons.forEach((season, seasonIndex) => {
          const sourceSeason = toPositiveInt(season.source_season);
          if (!sourceSeason) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里第 ${seasonIndex + 1} 个季规则缺少来源季号`);
          } else if (seasonNumbers.has(sourceSeason)) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里来源第 ${sourceSeason} 季重复了`);
          } else {
            seasonNumbers.add(sourceSeason);
          }
          if (!toPositiveInt(season.tmdb_season_number, sourceSeason || 1)) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里来源第 ${sourceSeason || '?'} 季缺少 TMDB 正片季号`);
          }
          try {
            safeParseManualMatches(season.manual_matches_text);
          } catch (error) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」来源第 ${sourceSeason || '?'} 季的 manual_matches JSON 不合法`);
          }
        });
      });

      return issues
    });

    const serializeState = () => {
      const common_types = {};
      state.value.commonTypes.forEach((type) => {
        const label = String(type.label || '').trim();
        if (!label) return
        common_types[type.key] = {
          label,
          source_keywords: normalizeStringArray(type.source_keywords),
          tmdb_keywords: normalizeStringArray(type.tmdb_keywords),
        };
      });

      const rules = state.value.rules.map((rule) => ({
        name: String(rule.name || '').trim(),
        tmdbid: toPositiveInt(rule.tmdbid),
        match_titles: normalizeStringArray(rule.match_titles),
        main_season: toPositiveInt(rule.main_season, 1) || 1,
        specials_season: toPositiveInt(rule.specials_season, 0) ?? 0,
        specials_folder: String(rule.specials_folder || state.value.specials_folder || 'Specials').trim() || 'Specials',
        seasons: orderedSeasons(rule).map((season) => {
          const typePayload = {};
          Object.entries(season.types || {}).forEach(([typeKey, conf]) => {
            const source_keywords = normalizeStringArray(conf?.source_keywords || []);
            const tmdb_keywords = normalizeStringArray(conf?.tmdb_keywords || []);
            if (source_keywords.length || tmdb_keywords.length) {
              typePayload[typeKey] = { source_keywords, tmdb_keywords };
            }
          });
          return {
            source_season: toPositiveInt(season.source_season, 1) || 1,
            tmdb_season_number: toPositiveInt(season.tmdb_season_number, toPositiveInt(season.source_season, 1) || 1) || 1,
            tmdb_season_matchers: normalizeStringArray(season.tmdb_season_matchers),
            manual_matches: safeParseManualMatches(season.manual_matches_text),
            types: typePayload,
          }
        }),
      }));

      return {
        enabled: !!state.value.enabled,
        notify: !!state.value.notify,
        specials_folder: String(state.value.specials_folder || 'Specials').trim() || 'Specials',
        subscription_enabled: !!state.value.subscription_enabled,
        subscription_urls: normalizeStringArray(state.value.subscription_urls),
        common_types,
        rules,
      }
    };

    const clearSaveTimer = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    };

    const updateStateSilently = (updater) => {
      suspendAutosave.value = true;
      try {
        updater();
      } finally {
        setTimeout(() => {
          suspendAutosave.value = false;
        }, 0);
      }
    };

    const scheduleSave = (delay = 700) => {
      if (suspendAutosave.value) return
      clearSaveTimer();
      if (validationIssues.value.length) {
        saveStatus.value = 'invalid';
        return
      }
      saveStatus.value = 'pending';
      saveTimer = setTimeout(() => {
        saveNow({ silent: true });
      }, delay);
    };

    const loadState = async () => {
      if (!props.api?.get) return
      loading.value = true;
      saveError.value = '';
      clearSaveTimer();
      try {
        const result = await props.api.get(`plugin/${PLUGIN_ID}/state`);
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '加载配置失败')
        }
        updateStateSilently(() => {
          state.value = hydrateState(result.data || {});
        });
        dirty.value = false;
        saveStatus.value = 'idle';
      } catch (error) {
        saveError.value = error?.message || '加载配置失败';
      } finally {
        loading.value = false;
      }
    };

    const saveNow = async ({ silent = false } = {}) => {
      if (!props.api?.post) return false
      clearSaveTimer();
      if (validationIssues.value.length) {
        saveStatus.value = 'invalid';
        if (!silent) {
          saveError.value = validationIssues.value[0];
        }
        return false
      }
      saving.value = true;
      saveError.value = '';
      try {
        const payload = serializeState();
        const result = await props.api.post(`plugin/${PLUGIN_ID}/save_state`, payload);
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '保存失败')
        }
        updateStateSilently(() => {
          state.value = hydrateState(result.data || {});
        });
        dirty.value = false;
        saveStatus.value = 'saved';
        lastSavedAt.value = new Date().toLocaleString('zh-CN', { hour12: false });
        return true
      } catch (error) {
        saveStatus.value = 'error';
        saveError.value = error?.message || '保存失败';
        return false
      } finally {
        saving.value = false;
      }
    };

    const syncSubscription = async () => {
      if (!props.api?.post) return false
      const saved = await saveNow({ silent: false });
      if (!saved) return false
      syncingSubscription.value = true;
      saveError.value = '';
      try {
        const result = await props.api.post(`plugin/${PLUGIN_ID}/pull_subscription`, { mode: 'merge' });
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '同步订阅失败')
        }
        updateStateSilently(() => {
          state.value = hydrateState(result.data || {});
        });
        dirty.value = false;
        saveStatus.value = 'saved';
        lastSavedAt.value = new Date().toLocaleString('zh-CN', { hour12: false });
        return true
      } catch (error) {
        saveStatus.value = 'error';
        saveError.value = error?.message || '同步订阅失败';
        return false
      } finally {
        syncingSubscription.value = false;
      }
    };

    const openTypeDialog = () => {
      drafts.type = { label: '', source_keywords: [], tmdb_keywords: [] };
      dialogs.type = true;
    };

    const confirmAddType = () => {
      const label = String(drafts.type.label || '').trim();
      if (!label) {
        saveError.value = '新分类名称不能为空';
        return
      }
      let baseKey = label
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!baseKey) baseKey = `type_${state.value.commonTypes.length + 1}`;
      let key = baseKey;
      let index = 2;
      while (state.value.commonTypes.some((item) => item.key === key)) {
        key = `${baseKey}_${index++}`;
      }
      state.value.commonTypes.push({
        _uid: uid('type'),
        key,
        label,
        source_keywords: normalizeStringArray(drafts.type.source_keywords),
        tmdb_keywords: normalizeStringArray(drafts.type.tmdb_keywords),
      });
      state.value.rules.forEach((rule) => {
        rule.seasons.forEach((season) => {
          if (!season.types[key]) {
            season.types[key] = createEmptyTypeBinding();
          }
        });
      });
      dialogs.type = false;
    };

    const removeCommonType = (typeUid) => {
      const target = state.value.commonTypes.find((item) => item._uid === typeUid);
      if (!target) return
      if (!window.confirm(`确认删除分类「${target.label}」吗？这会同步移除各节目规则里对应的类型关键词。`)) return
      state.value.commonTypes = state.value.commonTypes.filter((item) => item._uid !== typeUid);
      state.value.rules.forEach((rule) => {
        rule.seasons.forEach((season) => {
          if (season.types?.[target.key]) {
            delete season.types[target.key];
          }
        });
      });
    };

    const openRuleDialog = () => {
      drafts.rule = {
        name: '',
        tmdbid: '',
        match_titles: [],
        main_season: 1,
        specials_season: 0,
        specials_folder: state.value.specials_folder || 'Specials',
      };
      dialogs.rule = true;
    };

    const confirmAddRule = () => {
      const name = String(drafts.rule.name || '').trim();
      const tmdbid = toPositiveInt(drafts.rule.tmdbid);
      if (!name || !tmdbid) {
        saveError.value = '新增节目至少要填节目名称和 TMDB ID';
        return
      }
      const mainSeason = toPositiveInt(drafts.rule.main_season, 1) || 1;
      const season = {
        _uid: uid('season'),
        source_season: mainSeason,
        tmdb_season_number: mainSeason,
        tmdb_season_matchers: [],
        manual_matches_text: '',
        types: Object.fromEntries(state.value.commonTypes.map((type) => [type.key, createEmptyTypeBinding()])),
      };
      state.value.rules.push({
        _uid: uid('rule'),
        name,
        tmdbid: String(tmdbid),
        match_titles: normalizeStringArray(drafts.rule.match_titles),
        main_season: mainSeason,
        specials_season: toPositiveInt(drafts.rule.specials_season, 0) ?? 0,
        specials_folder: String(drafts.rule.specials_folder || state.value.specials_folder || 'Specials').trim() || 'Specials',
        seasons: [season],
      });
      dialogs.rule = false;
    };

    const removeRule = (ruleUid) => {
      const target = state.value.rules.find((item) => item._uid === ruleUid);
      if (!target) return
      if (!window.confirm(`确认删除节目「${target.name || '未命名节目'}」吗？`)) return
      state.value.rules = state.value.rules.filter((item) => item._uid !== ruleUid);
    };

    const openSeasonDialog = (rule) => {
      const existing = rule.seasons.map((season) => Number(season.source_season || 0)).filter(Boolean);
      const nextSeason = existing.length ? Math.max(...existing) + 1 : 1;
      drafts.season = {
        ruleUid: rule._uid,
        source_season: String(nextSeason),
        tmdb_season_number: String(nextSeason),
        tmdb_season_matchers: [],
      };
      dialogs.season = true;
    };

    const confirmAddSeason = () => {
      const rule = state.value.rules.find((item) => item._uid === drafts.season.ruleUid);
      if (!rule) return
      const sourceSeason = toPositiveInt(drafts.season.source_season);
      if (!sourceSeason) {
        saveError.value = '新季规则至少要填来源季号';
        return
      }
      if (rule.seasons.some((season) => Number(season.source_season) === sourceSeason)) {
        saveError.value = `来源第 ${sourceSeason} 季已经存在了`;
        return
      }
      rule.seasons.push({
        _uid: uid('season'),
        source_season: sourceSeason,
        tmdb_season_number: toPositiveInt(drafts.season.tmdb_season_number, sourceSeason) || sourceSeason,
        tmdb_season_matchers: normalizeStringArray(drafts.season.tmdb_season_matchers),
        manual_matches_text: '',
        types: Object.fromEntries(state.value.commonTypes.map((type) => [type.key, createEmptyTypeBinding()])),
      });
      dialogs.season = false;
    };

    const removeSeason = (ruleUid, seasonUid) => {
      const rule = state.value.rules.find((item) => item._uid === ruleUid);
      if (!rule) return
      const target = rule.seasons.find((season) => season._uid === seasonUid);
      if (!target) return
      if (!window.confirm(`确认删除来源第 ${target.source_season} 季规则吗？`)) return
      rule.seasons = rule.seasons.filter((season) => season._uid !== seasonUid);
    };

    watch(
      state,
      () => {
        if (suspendAutosave.value) return
        dirty.value = true;
        saveError.value = '';
        scheduleSave();
      },
      { deep: true }
    );

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

    onBeforeUnmount(() => {
      clearSaveTimer();
    });

    return {
      state,
      dialogs,
      drafts,
      loading,
      saving,
      syncingSubscription,
      saveError,
      statusText,
      statusColor,
      lastSavedLabel,
      subscriptionStatusLabel,
      validationIssues,
      loadState,
      saveNow,
      syncSubscription,
      openTypeDialog,
      confirmAddType,
      removeCommonType,
      openRuleDialog,
      confirmAddRule,
      removeRule,
      openSeasonDialog,
      confirmAddSeason,
      removeSeason,
      orderedSeasons,
      getTypeLabel,
      getRuleTypeKeys,
      ensureTypeBinding,
    }
  },
});

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createElementVNode:_createElementVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementBlock:_createElementBlock,renderList:_renderList,Fragment:_Fragment} = await importShared('vue');


const _hoisted_1 = { class: "plugin-config" };
const _hoisted_2 = { key: 0 };
const _hoisted_3 = { class: "d-flex flex-wrap align-center gap-2 mb-3" };
const _hoisted_4 = {
  key: 0,
  class: "text-caption text-medium-emphasis"
};
const _hoisted_5 = { class: "d-flex flex-wrap align-center gap-2" };
const _hoisted_6 = {
  key: 0,
  class: "text-caption text-medium-emphasis"
};
const _hoisted_7 = { class: "d-flex align-center flex-wrap w-100 gap-2 pr-2" };
const _hoisted_8 = { class: "d-flex justify-end mb-2" };
const _hoisted_9 = { class: "d-flex align-center flex-wrap w-100 gap-2 pr-2" };
const _hoisted_10 = { class: "d-flex justify-end mb-2" };
const _hoisted_11 = { class: "d-flex justify-space-between align-center mb-2 flex-wrap gap-2" };
const _hoisted_12 = { class: "d-flex align-center flex-wrap w-100 gap-2 pr-2" };
const _hoisted_13 = { class: "d-flex justify-end mb-2" };
const _hoisted_14 = {
  key: 1,
  class: "text-medium-emphasis"
};

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_v_icon = _resolveComponent("v-icon");
  const _component_v_spacer = _resolveComponent("v-spacer");
  const _component_v_chip = _resolveComponent("v-chip");
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_card_title = _resolveComponent("v-card-title");
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_switch = _resolveComponent("v-switch");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_text_field = _resolveComponent("v-text-field");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_card_text = _resolveComponent("v-card-text");
  const _component_v_card = _resolveComponent("v-card");
  const _component_v_combobox = _resolveComponent("v-combobox");
  const _component_v_expansion_panel_title = _resolveComponent("v-expansion-panel-title");
  const _component_v_expansion_panel_text = _resolveComponent("v-expansion-panel-text");
  const _component_v_expansion_panel = _resolveComponent("v-expansion-panel");
  const _component_v_expansion_panels = _resolveComponent("v-expansion-panels");
  const _component_v_textarea = _resolveComponent("v-textarea");
  const _component_v_list_item_title = _resolveComponent("v-list-item-title");
  const _component_v_list_item_subtitle = _resolveComponent("v-list-item-subtitle");
  const _component_v_list_item = _resolveComponent("v-list-item");
  const _component_v_list = _resolveComponent("v-list");
  const _component_v_card_actions = _resolveComponent("v-card-actions");
  const _component_v_dialog = _resolveComponent("v-dialog");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_v_card, {
      flat: "",
      class: "rounded border mb-3"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card_title, { class: "text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5" }, {
          default: _withCtx(() => [
            _createVNode(_component_v_icon, {
              icon: "mdi-tune-variant",
              class: "mr-2",
              color: "primary",
              size: "small"
            }),
            _cache[25] || (_cache[25] = _createElementVNode("span", null, "综艺特别篇纠偏规则", -1)),
            _createVNode(_component_v_spacer),
            _createVNode(_component_v_chip, {
              size: "small",
              color: _ctx.statusColor,
              variant: "tonal"
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(_ctx.statusText), 1)
              ]),
              _: 1
            }, 8, ["color"]),
            _createVNode(_component_v_btn, {
              size: "small",
              variant: "text",
              color: "primary",
              class: "ml-2",
              onClick: _cache[0] || (_cache[0] = $event => (_ctx.$emit('switch')))
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, {
                  icon: "mdi-history",
                  size: "small",
                  class: "mr-1"
                }),
                _cache[24] || (_cache[24] = _createTextVNode(" 记录 ", -1))
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        _createVNode(_component_v_card_text, { class: "px-3 py-3" }, {
          default: _withCtx(() => [
            (_ctx.saveError)
              ? (_openBlock(), _createBlock(_component_v_alert, {
                  key: 0,
                  type: "error",
                  density: "compact",
                  variant: "tonal",
                  class: "mb-3",
                  closable: ""
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(_ctx.saveError), 1)
                  ]),
                  _: 1
                }))
              : (_ctx.validationIssues.length)
                ? (_openBlock(), _createBlock(_component_v_alert, {
                    key: 1,
                    type: "warning",
                    density: "compact",
                    variant: "tonal",
                    class: "mb-3"
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(_ctx.validationIssues[0]), 1),
                      (_ctx.validationIssues.length > 1)
                        ? (_openBlock(), _createElementBlock("span", _hoisted_2, "，另外还有 " + _toDisplayString(_ctx.validationIssues.length - 1) + " 项待补。", 1))
                        : _createCommentVNode("", true)
                    ]),
                    _: 1
                  }))
                : _createCommentVNode("", true),
            _createVNode(_component_v_alert, {
              type: "info",
              density: "compact",
              variant: "tonal",
              class: "mb-3"
            }, {
              default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                _createTextVNode(" 现在默认是", -1),
                _createElementVNode("strong", null, "自动保存", -1),
                _createTextVNode("：改关键词、加规则、删季规则都先在本页完成，我会在你停手后自动落库。只有内容不完整或 JSON 不合法时才暂缓保存，不会再频繁打断。 ", -1)
              ]))]),
              _: 1
            }),
            _createElementVNode("div", _hoisted_3, [
              _createVNode(_component_v_btn, {
                color: "primary",
                size: "small",
                loading: _ctx.saving,
                onClick: _ctx.saveNow
              }, {
                default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                  _createTextVNode("立即保存", -1)
                ]))]),
                _: 1
              }, 8, ["loading", "onClick"]),
              _createVNode(_component_v_btn, {
                size: "small",
                variant: "text",
                disabled: _ctx.loading || _ctx.saving,
                onClick: _ctx.loadState
              }, {
                default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                  _createTextVNode("从服务器刷新", -1)
                ]))]),
                _: 1
              }, 8, ["disabled", "onClick"]),
              (_ctx.lastSavedLabel)
                ? (_openBlock(), _createElementBlock("span", _hoisted_4, _toDisplayString(_ctx.lastSavedLabel), 1))
                : _createCommentVNode("", true)
            ]),
            _createVNode(_component_v_card, {
              variant: "text",
              class: "border rounded mb-4"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-body-2 px-3 py-2" }, {
                  default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                    _createTextVNode("基础设置", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_row, null, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_switch, {
                              modelValue: _ctx.state.enabled,
                              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((_ctx.state.enabled) = $event)),
                              label: "启用插件",
                              inset: "",
                              "hide-details": ""
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_switch, {
                              modelValue: _ctx.state.notify,
                              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((_ctx.state.notify) = $event)),
                              label: "发送纠偏通知",
                              inset: "",
                              "hide-details": ""
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_text_field, {
                              modelValue: _ctx.state.specials_folder,
                              "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((_ctx.state.specials_folder) = $event)),
                              label: "默认特别篇目录名",
                              placeholder: "Specials",
                              density: "comfortable",
                              "hide-details": ""
                            }, null, 8, ["modelValue"])
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
            _createVNode(_component_v_card, {
              variant: "text",
              class: "border rounded mb-4"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-body-2 px-3 py-2" }, {
                  default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                    _createTextVNode("配置订阅", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_alert, {
                      type: "info",
                      density: "compact",
                      variant: "tonal",
                      class: "mb-3"
                    }, {
                      default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                        _createTextVNode(" 默认会订阅这个 GitHub 仓库里的规则 JSON。首次安装会拿它做初始化，后面你也可以手动“同步订阅”，把远端默认规则安全补到本地，不会直接覆盖你已经手改过的内容。 ", -1)
                      ]))]),
                      _: 1
                    }),
                    _createVNode(_component_v_row, { class: "align-center" }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_switch, {
                              modelValue: _ctx.state.subscription_enabled,
                              "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((_ctx.state.subscription_enabled) = $event)),
                              label: "启用订阅规则",
                              inset: "",
                              "hide-details": ""
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "8"
                        }, {
                          default: _withCtx(() => [
                            _createElementVNode("div", _hoisted_5, [
                              _createVNode(_component_v_btn, {
                                size: "small",
                                color: "primary",
                                variant: "tonal",
                                loading: _ctx.syncingSubscription,
                                disabled: _ctx.loading || _ctx.saving,
                                onClick: _ctx.syncSubscription
                              }, {
                                default: _withCtx(() => [...(_cache[32] || (_cache[32] = [
                                  _createTextVNode(" 立即同步订阅 ", -1)
                                ]))]),
                                _: 1
                              }, 8, ["loading", "disabled", "onClick"]),
                              (_ctx.subscriptionStatusLabel)
                                ? (_openBlock(), _createElementBlock("span", _hoisted_6, _toDisplayString(_ctx.subscriptionStatusLabel), 1))
                                : _createCommentVNode("", true)
                            ])
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_combobox, {
                      modelValue: _ctx.state.subscription_urls,
                      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((_ctx.state.subscription_urls) = $event)),
                      label: "订阅地址",
                      placeholder: "输入 JSON 地址后回车，可配多个，按顺序尝试",
                      multiple: "",
                      chips: "",
                      "closable-chips": "",
                      clearable: "",
                      "hide-selected": "",
                      class: "mt-3"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card, {
              variant: "text",
              class: "border rounded mb-4"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-body-2 d-flex align-center px-3 py-2" }, {
                  default: _withCtx(() => [
                    _cache[34] || (_cache[34] = _createElementVNode("span", null, "通用关键词库", -1)),
                    _createVNode(_component_v_spacer),
                    _createVNode(_component_v_btn, {
                      size: "small",
                      color: "primary",
                      variant: "tonal",
                      onClick: _ctx.openTypeDialog
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_icon, {
                          icon: "mdi-plus",
                          size: "small",
                          class: "mr-1"
                        }),
                        _cache[33] || (_cache[33] = _createTextVNode(" 新增分类 ", -1))
                      ]),
                      _: 1
                    }, 8, ["onClick"])
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_alert, {
                      type: "info",
                      density: "compact",
                      variant: "tonal",
                      class: "mb-3"
                    }, {
                      default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
                        _createTextVNode(" 这里负责维护“先导 / 彩蛋 / 企划 / 加更 / 纯享”这一层。删除分类会同步从各节目规则里移除对应类型，不再需要先勾删除再统一保存。 ", -1)
                      ]))]),
                      _: 1
                    }),
                    (_ctx.state.commonTypes.length)
                      ? (_openBlock(), _createBlock(_component_v_expansion_panels, {
                          key: 0,
                          multiple: "",
                          variant: "accordion"
                        }, {
                          default: _withCtx(() => [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.state.commonTypes, (type) => {
                              return (_openBlock(), _createBlock(_component_v_expansion_panel, {
                                key: type._uid
                              }, {
                                default: _withCtx(() => [
                                  _createVNode(_component_v_expansion_panel_title, null, {
                                    default: _withCtx(() => [
                                      _createElementVNode("div", _hoisted_7, [
                                        _createElementVNode("span", null, _toDisplayString(type.label || '未命名分类'), 1),
                                        _createVNode(_component_v_chip, {
                                          size: "x-small",
                                          variant: "tonal"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(type.key), 1)
                                          ]),
                                          _: 2
                                        }, 1024),
                                        _createVNode(_component_v_chip, {
                                          size: "x-small",
                                          variant: "tonal",
                                          color: "primary"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString((type.source_keywords?.length || 0) + (type.tmdb_keywords?.length || 0)) + " 个关键词 ", 1)
                                          ]),
                                          _: 2
                                        }, 1024)
                                      ])
                                    ]),
                                    _: 2
                                  }, 1024),
                                  _createVNode(_component_v_expansion_panel_text, null, {
                                    default: _withCtx(() => [
                                      _createElementVNode("div", _hoisted_8, [
                                        _createVNode(_component_v_btn, {
                                          size: "small",
                                          color: "error",
                                          variant: "text",
                                          onClick: $event => (_ctx.removeCommonType(type._uid))
                                        }, {
                                          default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                                            _createTextVNode(" 删除分类 ", -1)
                                          ]))]),
                                          _: 1
                                        }, 8, ["onClick"])
                                      ]),
                                      _createVNode(_component_v_row, null, {
                                        default: _withCtx(() => [
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "5"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: type.label,
                                                "onUpdate:modelValue": $event => ((type.label) = $event),
                                                label: "分类名称",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "7"
                                          }, {
                                            default: _withCtx(() => [...(_cache[37] || (_cache[37] = [
                                              _createElementVNode("div", { class: "text-caption text-medium-emphasis pt-3" }, " 分类 key 会保持稳定，改的是展示名称；这样已有节目规则不会乱掉。 ", -1)
                                            ]))]),
                                            _: 1
                                          })
                                        ]),
                                        _: 2
                                      }, 1024),
                                      _createVNode(_component_v_row, null, {
                                        default: _withCtx(() => [
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "6"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_combobox, {
                                                modelValue: type.source_keywords,
                                                "onUpdate:modelValue": $event => ((type.source_keywords) = $event),
                                                label: "源文件名关键词",
                                                placeholder: "输入后回车",
                                                multiple: "",
                                                chips: "",
                                                "closable-chips": "",
                                                clearable: "",
                                                "hide-selected": ""
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "6"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_combobox, {
                                                modelValue: type.tmdb_keywords,
                                                "onUpdate:modelValue": $event => ((type.tmdb_keywords) = $event),
                                                label: "TMDB 标题关键词",
                                                placeholder: "输入后回车",
                                                multiple: "",
                                                chips: "",
                                                "closable-chips": "",
                                                clearable: "",
                                                "hide-selected": ""
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024)
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
                      : (_openBlock(), _createBlock(_component_v_card, {
                          key: 1,
                          variant: "tonal",
                          color: "grey-lighten-4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_card_text, { class: "text-medium-emphasis" }, {
                              default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                                _createTextVNode("还没有通用分类，先加一个“先导 / 彩蛋 / 纯享”之类的基础类别吧。", -1)
                              ]))]),
                              _: 1
                            })
                          ]),
                          _: 1
                        }))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card, {
              variant: "text",
              class: "border rounded mb-4"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-body-2 d-flex align-center px-3 py-2" }, {
                  default: _withCtx(() => [
                    _cache[40] || (_cache[40] = _createElementVNode("span", null, "节目规则", -1)),
                    _createVNode(_component_v_spacer),
                    _createVNode(_component_v_btn, {
                      size: "small",
                      color: "primary",
                      variant: "tonal",
                      onClick: _ctx.openRuleDialog
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_icon, {
                          icon: "mdi-plus",
                          size: "small",
                          class: "mr-1"
                        }),
                        _cache[39] || (_cache[39] = _createTextVNode(" 新增节目 ", -1))
                      ]),
                      _: 1
                    }, 8, ["onClick"])
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_alert, {
                      type: "info",
                      density: "compact",
                      variant: "tonal",
                      class: "mb-3"
                    }, {
                      default: _withCtx(() => [...(_cache[41] || (_cache[41] = [
                        _createTextVNode(" 节目、季规则、关键词现在都可以连续改。新增节目会先建一个默认首季，后续再慢慢补关键词也行。 ", -1)
                      ]))]),
                      _: 1
                    }),
                    (_ctx.state.rules.length)
                      ? (_openBlock(), _createBlock(_component_v_expansion_panels, {
                          key: 0,
                          multiple: "",
                          variant: "accordion"
                        }, {
                          default: _withCtx(() => [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.state.rules, (rule) => {
                              return (_openBlock(), _createBlock(_component_v_expansion_panel, {
                                key: rule._uid
                              }, {
                                default: _withCtx(() => [
                                  _createVNode(_component_v_expansion_panel_title, null, {
                                    default: _withCtx(() => [
                                      _createElementVNode("div", _hoisted_9, [
                                        _createElementVNode("span", null, _toDisplayString(rule.name || '未命名节目'), 1),
                                        _createVNode(_component_v_chip, {
                                          size: "x-small",
                                          variant: "tonal"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode("TMDB " + _toDisplayString(rule.tmdbid || '未填'), 1)
                                          ]),
                                          _: 2
                                        }, 1024),
                                        _createVNode(_component_v_chip, {
                                          size: "x-small",
                                          variant: "tonal",
                                          color: "primary"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(rule.seasons.length) + " 季规则", 1)
                                          ]),
                                          _: 2
                                        }, 1024)
                                      ])
                                    ]),
                                    _: 2
                                  }, 1024),
                                  _createVNode(_component_v_expansion_panel_text, null, {
                                    default: _withCtx(() => [
                                      _createElementVNode("div", _hoisted_10, [
                                        _createVNode(_component_v_btn, {
                                          size: "small",
                                          color: "error",
                                          variant: "text",
                                          onClick: $event => (_ctx.removeRule(rule._uid))
                                        }, {
                                          default: _withCtx(() => [...(_cache[42] || (_cache[42] = [
                                            _createTextVNode("删除节目", -1)
                                          ]))]),
                                          _: 1
                                        }, 8, ["onClick"])
                                      ]),
                                      _createVNode(_component_v_row, null, {
                                        default: _withCtx(() => [
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: rule.name,
                                                "onUpdate:modelValue": $event => ((rule.name) = $event),
                                                label: "节目名称",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: rule.tmdbid,
                                                "onUpdate:modelValue": $event => ((rule.tmdbid) = $event),
                                                label: "TMDB ID",
                                                type: "number",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: rule.specials_folder,
                                                "onUpdate:modelValue": $event => ((rule.specials_folder) = $event),
                                                label: "特别篇目录名",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024)
                                        ]),
                                        _: 2
                                      }, 1024),
                                      _createVNode(_component_v_row, null, {
                                        default: _withCtx(() => [
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: rule.main_season,
                                                "onUpdate:modelValue": $event => ((rule.main_season) = $event),
                                                label: "默认主季",
                                                type: "number",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_text_field, {
                                                modelValue: rule.specials_season,
                                                "onUpdate:modelValue": $event => ((rule.specials_season) = $event),
                                                label: "TMDB 特别篇季号",
                                                type: "number",
                                                density: "comfortable"
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                            ]),
                                            _: 2
                                          }, 1024),
                                          _createVNode(_component_v_col, {
                                            cols: "12",
                                            md: "4"
                                          }, {
                                            default: _withCtx(() => [...(_cache[43] || (_cache[43] = [
                                              _createElementVNode("div", { class: "text-caption text-medium-emphasis pt-3" }, " 支持源文件季号和 TMDB 实际季号错位，不用为了保存顺序来回切页面。 ", -1)
                                            ]))]),
                                            _: 1
                                          })
                                        ]),
                                        _: 2
                                      }, 1024),
                                      _createVNode(_component_v_combobox, {
                                        modelValue: rule.match_titles,
                                        "onUpdate:modelValue": $event => ((rule.match_titles) = $event),
                                        label: "匹配标题 / 别名",
                                        placeholder: "输入一个别名后回车",
                                        multiple: "",
                                        chips: "",
                                        "closable-chips": "",
                                        clearable: "",
                                        "hide-selected": "",
                                        class: "mb-3"
                                      }, null, 8, ["modelValue", "onUpdate:modelValue"]),
                                      _createElementVNode("div", _hoisted_11, [
                                        _cache[45] || (_cache[45] = _createElementVNode("div", { class: "text-body-2 font-weight-medium" }, "季规则", -1)),
                                        _createVNode(_component_v_btn, {
                                          size: "small",
                                          color: "primary",
                                          variant: "text",
                                          onClick: $event => (_ctx.openSeasonDialog(rule))
                                        }, {
                                          default: _withCtx(() => [
                                            _createVNode(_component_v_icon, {
                                              icon: "mdi-plus",
                                              size: "small",
                                              class: "mr-1"
                                            }),
                                            _cache[44] || (_cache[44] = _createTextVNode(" 新增季规则 ", -1))
                                          ]),
                                          _: 1
                                        }, 8, ["onClick"])
                                      ]),
                                      (rule.seasons.length)
                                        ? (_openBlock(), _createBlock(_component_v_expansion_panels, {
                                            key: 0,
                                            multiple: "",
                                            variant: "accordion"
                                          }, {
                                            default: _withCtx(() => [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.orderedSeasons(rule), (season) => {
                                                return (_openBlock(), _createBlock(_component_v_expansion_panel, {
                                                  key: season._uid
                                                }, {
                                                  default: _withCtx(() => [
                                                    _createVNode(_component_v_expansion_panel_title, null, {
                                                      default: _withCtx(() => [
                                                        _createElementVNode("div", _hoisted_12, [
                                                          _createElementVNode("span", null, "来源第 " + _toDisplayString(season.source_season || '?') + " 季", 1),
                                                          _createVNode(_component_v_chip, {
                                                            size: "x-small",
                                                            variant: "tonal"
                                                          }, {
                                                            default: _withCtx(() => [
                                                              _createTextVNode("TMDB 正片季 " + _toDisplayString(season.tmdb_season_number || '?'), 1)
                                                            ]),
                                                            _: 2
                                                          }, 1024),
                                                          _createVNode(_component_v_chip, {
                                                            size: "x-small",
                                                            variant: "tonal",
                                                            color: "primary"
                                                          }, {
                                                            default: _withCtx(() => [
                                                              _createTextVNode(_toDisplayString(_ctx.getRuleTypeKeys(rule).length) + " 类", 1)
                                                            ]),
                                                            _: 2
                                                          }, 1024)
                                                        ])
                                                      ]),
                                                      _: 2
                                                    }, 1024),
                                                    _createVNode(_component_v_expansion_panel_text, null, {
                                                      default: _withCtx(() => [
                                                        _createElementVNode("div", _hoisted_13, [
                                                          _createVNode(_component_v_btn, {
                                                            size: "small",
                                                            color: "error",
                                                            variant: "text",
                                                            onClick: $event => (_ctx.removeSeason(rule._uid, season._uid))
                                                          }, {
                                                            default: _withCtx(() => [...(_cache[46] || (_cache[46] = [
                                                              _createTextVNode("删除这一季", -1)
                                                            ]))]),
                                                            _: 1
                                                          }, 8, ["onClick"])
                                                        ]),
                                                        _createVNode(_component_v_row, null, {
                                                          default: _withCtx(() => [
                                                            _createVNode(_component_v_col, {
                                                              cols: "12",
                                                              md: "4"
                                                            }, {
                                                              default: _withCtx(() => [
                                                                _createVNode(_component_v_text_field, {
                                                                  modelValue: season.source_season,
                                                                  "onUpdate:modelValue": $event => ((season.source_season) = $event),
                                                                  label: "来源季号",
                                                                  type: "number",
                                                                  density: "comfortable"
                                                                }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                                              ]),
                                                              _: 2
                                                            }, 1024),
                                                            _createVNode(_component_v_col, {
                                                              cols: "12",
                                                              md: "4"
                                                            }, {
                                                              default: _withCtx(() => [
                                                                _createVNode(_component_v_text_field, {
                                                                  modelValue: season.tmdb_season_number,
                                                                  "onUpdate:modelValue": $event => ((season.tmdb_season_number) = $event),
                                                                  label: "TMDB 正片季号",
                                                                  type: "number",
                                                                  density: "comfortable"
                                                                }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                                              ]),
                                                              _: 2
                                                            }, 1024),
                                                            _createVNode(_component_v_col, {
                                                              cols: "12",
                                                              md: "4"
                                                            }, {
                                                              default: _withCtx(() => [...(_cache[47] || (_cache[47] = [
                                                                _createElementVNode("div", { class: "text-caption text-medium-emphasis pt-3" }, " 如果源文件写第 9 季、TMDB 实际是第 8 季，就在这里分开填。 ", -1)
                                                              ]))]),
                                                              _: 1
                                                            })
                                                          ]),
                                                          _: 2
                                                        }, 1024),
                                                        _createVNode(_component_v_combobox, {
                                                          modelValue: season.tmdb_season_matchers,
                                                          "onUpdate:modelValue": $event => ((season.tmdb_season_matchers) = $event),
                                                          label: "TMDB 季识别关键词（可选）",
                                                          placeholder: "输入后回车，例如 2026 / 第八季",
                                                          multiple: "",
                                                          chips: "",
                                                          "closable-chips": "",
                                                          clearable: "",
                                                          "hide-selected": "",
                                                          class: "mb-3"
                                                        }, null, 8, ["modelValue", "onUpdate:modelValue"]),
                                                        _createVNode(_component_v_expansion_panels, {
                                                          multiple: "",
                                                          variant: "accordion",
                                                          class: "mb-3"
                                                        }, {
                                                          default: _withCtx(() => [
                                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.getRuleTypeKeys(rule), (typeKey) => {
                                                              return (_openBlock(), _createBlock(_component_v_expansion_panel, {
                                                                key: `${season._uid}-${typeKey}`
                                                              }, {
                                                                default: _withCtx(() => [
                                                                  _createVNode(_component_v_expansion_panel_title, null, {
                                                                    default: _withCtx(() => [
                                                                      _createTextVNode(_toDisplayString(_ctx.getTypeLabel(typeKey)), 1)
                                                                    ]),
                                                                    _: 2
                                                                  }, 1024),
                                                                  _createVNode(_component_v_expansion_panel_text, null, {
                                                                    default: _withCtx(() => [
                                                                      _createVNode(_component_v_row, null, {
                                                                        default: _withCtx(() => [
                                                                          _createVNode(_component_v_col, {
                                                                            cols: "12",
                                                                            md: "6"
                                                                          }, {
                                                                            default: _withCtx(() => [
                                                                              _createVNode(_component_v_combobox, {
                                                                                modelValue: _ctx.ensureTypeBinding(season, typeKey).source_keywords,
                                                                                "onUpdate:modelValue": $event => ((_ctx.ensureTypeBinding(season, typeKey).source_keywords) = $event),
                                                                                label: "源文件名关键词",
                                                                                placeholder: "输入后回车",
                                                                                multiple: "",
                                                                                chips: "",
                                                                                "closable-chips": "",
                                                                                clearable: "",
                                                                                "hide-selected": ""
                                                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                                                            ]),
                                                                            _: 2
                                                                          }, 1024),
                                                                          _createVNode(_component_v_col, {
                                                                            cols: "12",
                                                                            md: "6"
                                                                          }, {
                                                                            default: _withCtx(() => [
                                                                              _createVNode(_component_v_combobox, {
                                                                                modelValue: _ctx.ensureTypeBinding(season, typeKey).tmdb_keywords,
                                                                                "onUpdate:modelValue": $event => ((_ctx.ensureTypeBinding(season, typeKey).tmdb_keywords) = $event),
                                                                                label: "TMDB 标题关键词",
                                                                                placeholder: "输入后回车",
                                                                                multiple: "",
                                                                                chips: "",
                                                                                "closable-chips": "",
                                                                                clearable: "",
                                                                                "hide-selected": ""
                                                                              }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                                                            ]),
                                                                            _: 2
                                                                          }, 1024)
                                                                        ]),
                                                                        _: 2
                                                                      }, 1024)
                                                                    ]),
                                                                    _: 2
                                                                  }, 1024)
                                                                ]),
                                                                _: 2
                                                              }, 1024))
                                                            }), 128)),
                                                            _createVNode(_component_v_expansion_panel, null, {
                                                              default: _withCtx(() => [
                                                                _createVNode(_component_v_expansion_panel_title, null, {
                                                                  default: _withCtx(() => [...(_cache[48] || (_cache[48] = [
                                                                    _createTextVNode("高级手工匹配（可选）", -1)
                                                                  ]))]),
                                                                  _: 1
                                                                }),
                                                                _createVNode(_component_v_expansion_panel_text, null, {
                                                                  default: _withCtx(() => [
                                                                    _createVNode(_component_v_alert, {
                                                                      type: "info",
                                                                      density: "compact",
                                                                      variant: "tonal",
                                                                      class: "mb-3"
                                                                    }, {
                                                                      default: _withCtx(() => [...(_cache[49] || (_cache[49] = [
                                                                        _createTextVNode(" 只在非常特殊的命名下再用 JSON。保存前会自动校验格式，不合法时只会暂缓保存，不会把现有规则冲掉。 ", -1)
                                                                      ]))]),
                                                                      _: 1
                                                                    }),
                                                                    _createVNode(_component_v_textarea, {
                                                                      modelValue: season.manual_matches_text,
                                                                      "onUpdate:modelValue": $event => ((season.manual_matches_text) = $event),
                                                                      label: "manual_matches JSON",
                                                                      rows: "6",
                                                                      "auto-grow": "",
                                                                      placeholder: "[\n  {\n    \"type\": \"bonus\",\n    \"source_keywords\": [\"超前彩蛋\"],\n    \"index\": 1,\n    \"target_episode\": 3\n  }\n]"
                                                                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                                                                  ]),
                                                                  _: 2
                                                                }, 1024)
                                                              ]),
                                                              _: 2
                                                            }, 1024)
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
                                            _: 2
                                          }, 1024))
                                        : (_openBlock(), _createBlock(_component_v_card, {
                                            key: 1,
                                            variant: "tonal",
                                            color: "grey-lighten-4"
                                          }, {
                                            default: _withCtx(() => [
                                              _createVNode(_component_v_card_text, { class: "text-medium-emphasis" }, {
                                                default: _withCtx(() => [...(_cache[50] || (_cache[50] = [
                                                  _createTextVNode("这档节目还没有季规则，先补一个。", -1)
                                                ]))]),
                                                _: 1
                                              })
                                            ]),
                                            _: 1
                                          }))
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
                      : (_openBlock(), _createBlock(_component_v_card, {
                          key: 1,
                          variant: "tonal",
                          color: "grey-lighten-4"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_card_text, { class: "text-medium-emphasis" }, {
                              default: _withCtx(() => [...(_cache[51] || (_cache[51] = [
                                _createTextVNode("还没有节目规则，先新增一档节目吧。", -1)
                              ]))]),
                              _: 1
                            })
                          ]),
                          _: 1
                        }))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card, {
              variant: "text",
              class: "border rounded"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-body-2 px-3 py-2" }, {
                  default: _withCtx(() => [...(_cache[52] || (_cache[52] = [
                    _createTextVNode("最近纠偏记录", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    (_ctx.state.history.length)
                      ? (_openBlock(), _createBlock(_component_v_list, {
                          key: 0,
                          density: "compact"
                        }, {
                          default: _withCtx(() => [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.state.history.slice(0, 5), (item, index) => {
                              return (_openBlock(), _createBlock(_component_v_list_item, {
                                key: `${item.new_path || index}-${index}`
                              }, {
                                prepend: _withCtx(() => [
                                  _createVNode(_component_v_icon, {
                                    icon: "mdi-arrow-right-bold-circle-outline",
                                    color: "primary",
                                    size: "small"
                                  })
                                ]),
                                default: _withCtx(() => [
                                  _createVNode(_component_v_list_item_title, null, {
                                    default: _withCtx(() => [
                                      _createTextVNode(_toDisplayString(item.show || '未知节目') + " · " + _toDisplayString(item.kind || '未识别'), 1)
                                    ]),
                                    _: 2
                                  }, 1024),
                                  _createVNode(_component_v_list_item_subtitle, { class: "break-all" }, {
                                    default: _withCtx(() => [
                                      _createTextVNode(_toDisplayString(item.old_path) + " → " + _toDisplayString(item.new_path), 1)
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
                      : (_openBlock(), _createElementBlock("div", _hoisted_14, "还没有纠偏记录。"))
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
    _createVNode(_component_v_dialog, {
      modelValue: _ctx.dialogs.type,
      "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((_ctx.dialogs.type) = $event)),
      "max-width": "720"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, null, {
              default: _withCtx(() => [...(_cache[53] || (_cache[53] = [
                _createTextVNode("新增关键词分类", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_text_field, {
                  modelValue: _ctx.drafts.type.label,
                  "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((_ctx.drafts.type.label) = $event)),
                  label: "分类名称",
                  placeholder: "例如：纯享 / 夜聊 / 聚会",
                  class: "mb-3"
                }, null, 8, ["modelValue"]),
                _createVNode(_component_v_row, null, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_combobox, {
                          modelValue: _ctx.drafts.type.source_keywords,
                          "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((_ctx.drafts.type.source_keywords) = $event)),
                          label: "源文件名关键词",
                          placeholder: "输入后回车",
                          multiple: "",
                          chips: "",
                          "closable-chips": "",
                          clearable: "",
                          "hide-selected": ""
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_combobox, {
                          modelValue: _ctx.drafts.type.tmdb_keywords,
                          "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((_ctx.drafts.type.tmdb_keywords) = $event)),
                          label: "TMDB 标题关键词",
                          placeholder: "输入后回车",
                          multiple: "",
                          chips: "",
                          "closable-chips": "",
                          clearable: "",
                          "hide-selected": ""
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  variant: "text",
                  onClick: _cache[9] || (_cache[9] = $event => (_ctx.dialogs.type = false))
                }, {
                  default: _withCtx(() => [...(_cache[54] || (_cache[54] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: _ctx.confirmAddType
                }, {
                  default: _withCtx(() => [...(_cache[55] || (_cache[55] = [
                    _createTextVNode("添加", -1)
                  ]))]),
                  _: 1
                }, 8, ["onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"]),
    _createVNode(_component_v_dialog, {
      modelValue: _ctx.dialogs.rule,
      "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((_ctx.dialogs.rule) = $event)),
      "max-width": "820"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, null, {
              default: _withCtx(() => [...(_cache[56] || (_cache[56] = [
                _createTextVNode("新增节目规则", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_row, null, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.rule.name,
                          "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((_ctx.drafts.rule.name) = $event)),
                          label: "节目名称"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.rule.tmdbid,
                          "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((_ctx.drafts.rule.tmdbid) = $event)),
                          label: "TMDB ID",
                          type: "number"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_row, null, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "4"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.rule.main_season,
                          "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((_ctx.drafts.rule.main_season) = $event)),
                          label: "默认主季",
                          type: "number"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "4"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.rule.specials_season,
                          "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((_ctx.drafts.rule.specials_season) = $event)),
                          label: "TMDB 特别篇季号",
                          type: "number"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "4"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.rule.specials_folder,
                          "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((_ctx.drafts.rule.specials_folder) = $event)),
                          label: "特别篇目录名"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_combobox, {
                  modelValue: _ctx.drafts.rule.match_titles,
                  "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((_ctx.drafts.rule.match_titles) = $event)),
                  label: "匹配标题 / 别名",
                  placeholder: "输入后回车",
                  multiple: "",
                  chips: "",
                  "closable-chips": "",
                  clearable: "",
                  "hide-selected": ""
                }, null, 8, ["modelValue"]),
                _createVNode(_component_v_alert, {
                  type: "info",
                  density: "compact",
                  variant: "tonal",
                  class: "mt-3"
                }, {
                  default: _withCtx(() => [...(_cache[57] || (_cache[57] = [
                    _createTextVNode(" 确认后会自动创建一个默认首季，你可以继续在主界面里慢慢补全每个类型的关键词。 ", -1)
                  ]))]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  variant: "text",
                  onClick: _cache[17] || (_cache[17] = $event => (_ctx.dialogs.rule = false))
                }, {
                  default: _withCtx(() => [...(_cache[58] || (_cache[58] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: _ctx.confirmAddRule
                }, {
                  default: _withCtx(() => [...(_cache[59] || (_cache[59] = [
                    _createTextVNode("添加", -1)
                  ]))]),
                  _: 1
                }, 8, ["onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"]),
    _createVNode(_component_v_dialog, {
      modelValue: _ctx.dialogs.season,
      "onUpdate:modelValue": _cache[23] || (_cache[23] = $event => ((_ctx.dialogs.season) = $event)),
      "max-width": "680"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, null, {
              default: _withCtx(() => [...(_cache[60] || (_cache[60] = [
                _createTextVNode("新增季规则", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_row, null, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.season.source_season,
                          "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((_ctx.drafts.season.source_season) = $event)),
                          label: "来源季号",
                          type: "number"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_text_field, {
                          modelValue: _ctx.drafts.season.tmdb_season_number,
                          "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => ((_ctx.drafts.season.tmdb_season_number) = $event)),
                          label: "TMDB 正片季号",
                          type: "number"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_combobox, {
                  modelValue: _ctx.drafts.season.tmdb_season_matchers,
                  "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => ((_ctx.drafts.season.tmdb_season_matchers) = $event)),
                  label: "TMDB 季识别关键词（可选）",
                  placeholder: "输入后回车",
                  multiple: "",
                  chips: "",
                  "closable-chips": "",
                  clearable: "",
                  "hide-selected": ""
                }, null, 8, ["modelValue"]),
                _createVNode(_component_v_alert, {
                  type: "info",
                  density: "compact",
                  variant: "tonal",
                  class: "mt-3"
                }, {
                  default: _withCtx(() => [...(_cache[61] || (_cache[61] = [
                    _createTextVNode(" 先建季，再在主界面继续填各类型关键词；自动保存会在你停下来后自己处理。 ", -1)
                  ]))]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  variant: "text",
                  onClick: _cache[22] || (_cache[22] = $event => (_ctx.dialogs.season = false))
                }, {
                  default: _withCtx(() => [...(_cache[62] || (_cache[62] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: _ctx.confirmAddSeason
                }, {
                  default: _withCtx(() => [...(_cache[63] || (_cache[63] = [
                    _createTextVNode("添加", -1)
                  ]))]),
                  _: 1
                }, 8, ["onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"])
  ]))
}
const Config = /*#__PURE__*/_export_sfc(_sfc_main, [['render',_sfc_render],['__scopeId',"data-v-9ba87264"]]);

export { Config as default };
