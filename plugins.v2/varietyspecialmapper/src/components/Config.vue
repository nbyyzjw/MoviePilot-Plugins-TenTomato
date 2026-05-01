<template>
  <div class="plugin-config">
    <v-card flat class="rounded border mb-3">
      <v-card-title class="text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5">
        <v-icon icon="mdi-tune-variant" class="mr-2" color="primary" size="small" />
        <span>综艺特别篇纠偏规则</span>
        <v-spacer />
        <v-chip size="small" :color="statusColor" variant="tonal">{{ statusText }}</v-chip>
        <v-btn size="small" variant="text" color="primary" class="ml-2" @click="$emit('switch')">
          <v-icon icon="mdi-history" size="small" class="mr-1" />
          记录
        </v-btn>
      </v-card-title>

      <v-card-text class="px-3 py-3">
        <v-alert
          v-if="saveError"
          type="error"
          density="compact"
          variant="tonal"
          class="mb-3"
          closable
        >{{ saveError }}</v-alert>

        <v-alert
          v-else-if="validationIssues.length"
          type="warning"
          density="compact"
          variant="tonal"
          class="mb-3"
        >
          {{ validationIssues[0] }}<span v-if="validationIssues.length > 1">，另外还有 {{ validationIssues.length - 1 }} 项待补。</span>
        </v-alert>

        <v-alert type="info" density="compact" variant="tonal" class="mb-3">
          现在默认是<strong>自动保存</strong>：改关键词、加规则、删季规则都先在本页完成，我会在你停手后自动落库。只有内容不完整或 JSON 不合法时才暂缓保存，不会再频繁打断。
        </v-alert>

        <div class="d-flex flex-wrap align-center gap-2 mb-3">
          <v-btn color="primary" size="small" :loading="saving" @click="saveNow">立即保存</v-btn>
          <v-btn size="small" variant="text" :disabled="loading || saving" @click="loadState">从服务器刷新</v-btn>
          <span class="text-caption text-medium-emphasis" v-if="lastSavedLabel">{{ lastSavedLabel }}</span>
        </div>

        <v-card variant="text" class="border rounded mb-4">
          <v-card-title class="text-body-2 px-3 py-2">基础设置</v-card-title>
          <v-card-text class="px-3 py-2">
            <v-row>
              <v-col cols="12" md="4">
                <v-switch v-model="state.enabled" label="启用插件" inset hide-details />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch v-model="state.notify" label="发送纠偏通知" inset hide-details />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="state.specials_folder"
                  label="默认特别篇目录名"
                  placeholder="Specials"
                  density="comfortable"
                  hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card variant="text" class="border rounded mb-4">
          <v-card-title class="text-body-2 d-flex align-center px-3 py-2">
            <span>通用关键词库</span>
            <v-spacer />
            <v-btn size="small" color="primary" variant="tonal" @click="openTypeDialog">
              <v-icon icon="mdi-plus" size="small" class="mr-1" />
              新增分类
            </v-btn>
          </v-card-title>
          <v-card-text class="px-3 py-2">
            <v-alert type="info" density="compact" variant="tonal" class="mb-3">
              这里负责维护“先导 / 彩蛋 / 企划 / 加更 / 纯享”这一层。删除分类会同步从各节目规则里移除对应类型，不再需要先勾删除再统一保存。
            </v-alert>

            <v-expansion-panels v-if="state.commonTypes.length" multiple variant="accordion">
              <v-expansion-panel v-for="type in state.commonTypes" :key="type._uid">
                <v-expansion-panel-title>
                  <div class="d-flex align-center flex-wrap w-100 gap-2 pr-2">
                    <span>{{ type.label || '未命名分类' }}</span>
                    <v-chip size="x-small" variant="tonal">{{ type.key }}</v-chip>
                    <v-chip size="x-small" variant="tonal" color="primary">
                      {{ (type.source_keywords?.length || 0) + (type.tmdb_keywords?.length || 0) }} 个关键词
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex justify-end mb-2">
                    <v-btn size="small" color="error" variant="text" @click="removeCommonType(type._uid)">
                      删除分类
                    </v-btn>
                  </div>
                  <v-row>
                    <v-col cols="12" md="5">
                      <v-text-field v-model="type.label" label="分类名称" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="7">
                      <div class="text-caption text-medium-emphasis pt-3">
                        分类 key 会保持稳定，改的是展示名称；这样已有节目规则不会乱掉。
                      </div>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-combobox
                        v-model="type.source_keywords"
                        label="源文件名关键词"
                        placeholder="输入后回车"
                        multiple
                        chips
                        closable-chips
                        clearable
                        hide-selected
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-combobox
                        v-model="type.tmdb_keywords"
                        label="TMDB 标题关键词"
                        placeholder="输入后回车"
                        multiple
                        chips
                        closable-chips
                        clearable
                        hide-selected
                      />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-card v-else variant="tonal" color="grey-lighten-4">
              <v-card-text class="text-medium-emphasis">还没有通用分类，先加一个“先导 / 彩蛋 / 纯享”之类的基础类别吧。</v-card-text>
            </v-card>
          </v-card-text>
        </v-card>

        <v-card variant="text" class="border rounded mb-4">
          <v-card-title class="text-body-2 d-flex align-center px-3 py-2">
            <span>节目规则</span>
            <v-spacer />
            <v-btn size="small" color="primary" variant="tonal" @click="openRuleDialog">
              <v-icon icon="mdi-plus" size="small" class="mr-1" />
              新增节目
            </v-btn>
          </v-card-title>
          <v-card-text class="px-3 py-2">
            <v-alert type="info" density="compact" variant="tonal" class="mb-3">
              节目、季规则、关键词现在都可以连续改。新增节目会先建一个默认首季，后续再慢慢补关键词也行。
            </v-alert>

            <v-expansion-panels v-if="state.rules.length" multiple variant="accordion">
              <v-expansion-panel v-for="rule in state.rules" :key="rule._uid">
                <v-expansion-panel-title>
                  <div class="d-flex align-center flex-wrap w-100 gap-2 pr-2">
                    <span>{{ rule.name || '未命名节目' }}</span>
                    <v-chip size="x-small" variant="tonal">TMDB {{ rule.tmdbid || '未填' }}</v-chip>
                    <v-chip size="x-small" variant="tonal" color="primary">{{ rule.seasons.length }} 季规则</v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex justify-end mb-2">
                    <v-btn size="small" color="error" variant="text" @click="removeRule(rule._uid)">删除节目</v-btn>
                  </div>

                  <v-row>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="rule.name" label="节目名称" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="rule.tmdbid" label="TMDB ID" type="number" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="rule.specials_folder" label="特别篇目录名" density="comfortable" />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="rule.main_season" label="默认主季" type="number" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="rule.specials_season" label="TMDB 特别篇季号" type="number" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="4">
                      <div class="text-caption text-medium-emphasis pt-3">
                        支持源文件季号和 TMDB 实际季号错位，不用为了保存顺序来回切页面。
                      </div>
                    </v-col>
                  </v-row>

                  <v-combobox
                    v-model="rule.match_titles"
                    label="匹配标题 / 别名"
                    placeholder="输入一个别名后回车"
                    multiple
                    chips
                    closable-chips
                    clearable
                    hide-selected
                    class="mb-3"
                  />

                  <div class="d-flex justify-space-between align-center mb-2 flex-wrap gap-2">
                    <div class="text-body-2 font-weight-medium">季规则</div>
                    <v-btn size="small" color="primary" variant="text" @click="openSeasonDialog(rule)">
                      <v-icon icon="mdi-plus" size="small" class="mr-1" />
                      新增季规则
                    </v-btn>
                  </div>

                  <v-expansion-panels v-if="rule.seasons.length" multiple variant="accordion">
                    <v-expansion-panel v-for="season in orderedSeasons(rule)" :key="season._uid">
                      <v-expansion-panel-title>
                        <div class="d-flex align-center flex-wrap w-100 gap-2 pr-2">
                          <span>来源第 {{ season.source_season || '?' }} 季</span>
                          <v-chip size="x-small" variant="tonal">TMDB 正片季 {{ season.tmdb_season_number || '?' }}</v-chip>
                          <v-chip size="x-small" variant="tonal" color="primary">{{ getRuleTypeKeys(rule).length }} 类</v-chip>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <div class="d-flex justify-end mb-2">
                          <v-btn size="small" color="error" variant="text" @click="removeSeason(rule._uid, season._uid)">删除这一季</v-btn>
                        </div>

                        <v-row>
                          <v-col cols="12" md="4">
                            <v-text-field v-model="season.source_season" label="来源季号" type="number" density="comfortable" />
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              v-model="season.tmdb_season_number"
                              label="TMDB 正片季号"
                              type="number"
                              density="comfortable"
                            />
                          </v-col>
                          <v-col cols="12" md="4">
                            <div class="text-caption text-medium-emphasis pt-3">
                              如果源文件写第 9 季、TMDB 实际是第 8 季，就在这里分开填。
                            </div>
                          </v-col>
                        </v-row>

                        <v-combobox
                          v-model="season.tmdb_season_matchers"
                          label="TMDB 季识别关键词（可选）"
                          placeholder="输入后回车，例如 2026 / 第八季"
                          multiple
                          chips
                          closable-chips
                          clearable
                          hide-selected
                          class="mb-3"
                        />

                        <v-expansion-panels multiple variant="accordion" class="mb-3">
                          <v-expansion-panel v-for="typeKey in getRuleTypeKeys(rule)" :key="`${season._uid}-${typeKey}`">
                            <v-expansion-panel-title>
                              {{ getTypeLabel(typeKey) }}
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                              <v-row>
                                <v-col cols="12" md="6">
                                  <v-combobox
                                    v-model="ensureTypeBinding(season, typeKey).source_keywords"
                                    label="源文件名关键词"
                                    placeholder="输入后回车"
                                    multiple
                                    chips
                                    closable-chips
                                    clearable
                                    hide-selected
                                  />
                                </v-col>
                                <v-col cols="12" md="6">
                                  <v-combobox
                                    v-model="ensureTypeBinding(season, typeKey).tmdb_keywords"
                                    label="TMDB 标题关键词"
                                    placeholder="输入后回车"
                                    multiple
                                    chips
                                    closable-chips
                                    clearable
                                    hide-selected
                                  />
                                </v-col>
                              </v-row>
                            </v-expansion-panel-text>
                          </v-expansion-panel>

                          <v-expansion-panel>
                            <v-expansion-panel-title>高级手工匹配（可选）</v-expansion-panel-title>
                            <v-expansion-panel-text>
                              <v-alert type="info" density="compact" variant="tonal" class="mb-3">
                                只在非常特殊的命名下再用 JSON。保存前会自动校验格式，不合法时只会暂缓保存，不会把现有规则冲掉。
                              </v-alert>
                              <v-textarea
                                v-model="season.manual_matches_text"
                                label="manual_matches JSON"
                                rows="6"
                                auto-grow
                                placeholder='[
  {
    "type": "bonus",
    "source_keywords": ["超前彩蛋"],
    "index": 1,
    "target_episode": 3
  }
]'
                              />
                            </v-expansion-panel-text>
                          </v-expansion-panel>
                        </v-expansion-panels>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>

                  <v-card v-else variant="tonal" color="grey-lighten-4">
                    <v-card-text class="text-medium-emphasis">这档节目还没有季规则，先补一个。</v-card-text>
                  </v-card>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-card v-else variant="tonal" color="grey-lighten-4">
              <v-card-text class="text-medium-emphasis">还没有节目规则，先新增一档节目吧。</v-card-text>
            </v-card>
          </v-card-text>
        </v-card>

        <v-card variant="text" class="border rounded">
          <v-card-title class="text-body-2 px-3 py-2">最近纠偏记录</v-card-title>
          <v-card-text class="px-3 py-2">
            <v-list v-if="state.history.length" density="compact">
              <v-list-item v-for="(item, index) in state.history.slice(0, 5)" :key="`${item.new_path || index}-${index}`">
                <template #prepend>
                  <v-icon icon="mdi-arrow-right-bold-circle-outline" color="primary" size="small" />
                </template>
                <v-list-item-title>{{ item.show || '未知节目' }} · {{ item.kind || '未识别' }}</v-list-item-title>
                <v-list-item-subtitle class="break-all">
                  {{ item.old_path }} → {{ item.new_path }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else class="text-medium-emphasis">还没有纠偏记录。</div>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>

    <v-dialog v-model="dialogs.type" max-width="720">
      <v-card>
        <v-card-title>新增关键词分类</v-card-title>
        <v-card-text>
          <v-text-field v-model="drafts.type.label" label="分类名称" placeholder="例如：纯享 / 夜聊 / 聚会" class="mb-3" />
          <v-row>
            <v-col cols="12" md="6">
              <v-combobox
                v-model="drafts.type.source_keywords"
                label="源文件名关键词"
                placeholder="输入后回车"
                multiple
                chips
                closable-chips
                clearable
                hide-selected
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox
                v-model="drafts.type.tmdb_keywords"
                label="TMDB 标题关键词"
                placeholder="输入后回车"
                multiple
                chips
                closable-chips
                clearable
                hide-selected
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogs.type = false">取消</v-btn>
          <v-btn color="primary" @click="confirmAddType">添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialogs.rule" max-width="820">
      <v-card>
        <v-card-title>新增节目规则</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="drafts.rule.name" label="节目名称" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="drafts.rule.tmdbid" label="TMDB ID" type="number" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field v-model="drafts.rule.main_season" label="默认主季" type="number" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="drafts.rule.specials_season" label="TMDB 特别篇季号" type="number" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="drafts.rule.specials_folder" label="特别篇目录名" />
            </v-col>
          </v-row>
          <v-combobox
            v-model="drafts.rule.match_titles"
            label="匹配标题 / 别名"
            placeholder="输入后回车"
            multiple
            chips
            closable-chips
            clearable
            hide-selected
          />
          <v-alert type="info" density="compact" variant="tonal" class="mt-3">
            确认后会自动创建一个默认首季，你可以继续在主界面里慢慢补全每个类型的关键词。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogs.rule = false">取消</v-btn>
          <v-btn color="primary" @click="confirmAddRule">添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialogs.season" max-width="680">
      <v-card>
        <v-card-title>新增季规则</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="drafts.season.source_season" label="来源季号" type="number" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="drafts.season.tmdb_season_number" label="TMDB 正片季号" type="number" />
            </v-col>
          </v-row>
          <v-combobox
            v-model="drafts.season.tmdb_season_matchers"
            label="TMDB 季识别关键词（可选）"
            placeholder="输入后回车"
            multiple
            chips
            closable-chips
            clearable
            hide-selected
          />
          <v-alert type="info" density="compact" variant="tonal" class="mt-3">
            先建季，再在主界面继续填各类型关键词；自动保存会在你停下来后自己处理。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogs.season = false">取消</v-btn>
          <v-btn color="primary" @click="confirmAddSeason">添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { computed, defineComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const PLUGIN_ID = 'VarietySpecialMapper'
const TYPE_ORDER = ['pilot', 'bonus', 'program', 'plus', 'pure', 'watch', 'chat', 'punish', 'party']
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
}

const createEmptyState = () => ({
  enabled: false,
  notify: false,
  specials_folder: 'Specials',
  commonTypes: [],
  rules: [],
  history: [],
})

const uid = (prefix = 'uid') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const deepClone = (value) => JSON.parse(JSON.stringify(value))
const toPositiveInt = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
const normalizeStringArray = (items) => {
  const seen = new Set()
  return (Array.isArray(items) ? items : [])
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}
const formatManualMatches = (value) => {
  if (!Array.isArray(value) || !value.length) return ''
  return JSON.stringify(value, null, 2)
}
const safeParseManualMatches = (text) => {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed)
  if (!Array.isArray(parsed)) {
    throw new Error('manual_matches 必须是 JSON 数组')
  }
  return parsed
}

export default defineComponent({
  name: 'VarietySpecialMapperConfig',
  props: {
    api: {
      type: Object,
      default: null,
    },
  },
  emits: ['switch'],
  setup(props) {
    const state = ref(createEmptyState())
    const loading = ref(false)
    const saving = ref(false)
    const saveError = ref('')
    const saveStatus = ref('idle')
    const dirty = ref(false)
    const lastSavedAt = ref('')
    const suspendAutosave = ref(false)
    let saveTimer = null

    const dialogs = reactive({ type: false, rule: false, season: false })
    const drafts = reactive({
      type: { label: '', source_keywords: [], tmdb_keywords: [] },
      rule: { name: '', tmdbid: '', match_titles: [], main_season: 1, specials_season: 0, specials_folder: 'Specials' },
      season: { ruleUid: '', source_season: '', tmdb_season_number: '', tmdb_season_matchers: [] },
    })

    const createEmptyTypeBinding = () => ({ source_keywords: [], tmdb_keywords: [] })

    const hydrateState = (raw) => {
      const commonTypes = Object.entries(raw?.common_types || {}).map(([key, value]) => ({
        _uid: uid('type'),
        key,
        label: String(value?.label || BUILTIN_LABELS[key] || key).trim(),
        source_keywords: normalizeStringArray(value?.source_keywords || []),
        tmdb_keywords: normalizeStringArray(value?.tmdb_keywords || []),
      }))

      const orderIndex = (key) => {
        const idx = TYPE_ORDER.indexOf(key)
        return idx === -1 ? 999 : idx
      }
      commonTypes.sort((a, b) => orderIndex(a.key) - orderIndex(b.key) || a.label.localeCompare(b.label, 'zh-Hans-CN'))
      const commonTypeKeys = commonTypes.map((item) => item.key)

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
          )
          commonTypeKeys.forEach((typeKey) => {
            if (!types[typeKey]) {
              types[typeKey] = createEmptyTypeBinding()
            }
          })
          return {
            _uid: uid('season'),
            source_season: season?.source_season ?? 1,
            tmdb_season_number: season?.tmdb_season_number ?? season?.source_season ?? 1,
            tmdb_season_matchers: normalizeStringArray(season?.tmdb_season_matchers || []),
            manual_matches_text: formatManualMatches(season?.manual_matches),
            types,
          }
        }),
      }))

      return {
        enabled: !!raw?.enabled,
        notify: !!raw?.notify,
        specials_folder: String(raw?.specials_folder || 'Specials'),
        commonTypes,
        rules,
        history: Array.isArray(raw?.history) ? raw.history : [],
      }
    }

    const statusText = computed(() => {
      if (loading.value) return '正在加载'
      if (saving.value) return '正在保存'
      if (saveStatus.value === 'invalid') return '待补全后保存'
      if (dirty.value) return '有未保存更改'
      if (saveStatus.value === 'saved') return '已自动保存'
      if (saveStatus.value === 'error') return '保存失败'
      return '已就绪'
    })

    const statusColor = computed(() => {
      if (loading.value) return 'info'
      if (saving.value) return 'primary'
      if (saveStatus.value === 'invalid') return 'warning'
      if (saveStatus.value === 'error') return 'error'
      if (saveStatus.value === 'saved') return 'success'
      if (dirty.value) return 'orange'
      return 'grey'
    })

    const lastSavedLabel = computed(() => (lastSavedAt.value ? `上次保存：${lastSavedAt.value}` : ''))

    const orderedSeasons = (rule) => {
      return [...(rule?.seasons || [])].sort((a, b) => Number(a.source_season || 0) - Number(b.source_season || 0))
    }

    const getTypeLabel = (typeKey) => {
      return state.value.commonTypes.find((item) => item.key === typeKey)?.label || BUILTIN_LABELS[typeKey] || typeKey
    }

    const getRuleTypeKeys = (rule) => {
      const keys = new Set(state.value.commonTypes.map((item) => item.key))
      ;(rule?.seasons || []).forEach((season) => {
        Object.keys(season?.types || {}).forEach((typeKey) => keys.add(typeKey))
      })
      return [...keys].sort((a, b) => {
        const aIndex = TYPE_ORDER.indexOf(a)
        const bIndex = TYPE_ORDER.indexOf(b)
        const normalizedA = aIndex === -1 ? 999 : aIndex
        const normalizedB = bIndex === -1 ? 999 : bIndex
        return normalizedA - normalizedB || getTypeLabel(a).localeCompare(getTypeLabel(b), 'zh-Hans-CN')
      })
    }

    const ensureTypeBinding = (season, typeKey) => season.types[typeKey] || createEmptyTypeBinding()

    const validationIssues = computed(() => {
      const issues = []
      state.value.commonTypes.forEach((type, index) => {
        if (!String(type.label || '').trim()) {
          issues.push(`通用分类 #${index + 1} 还没有名称`)
        }
      })

      state.value.rules.forEach((rule, ruleIndex) => {
        if (!String(rule.name || '').trim()) {
          issues.push(`节目规则 #${ruleIndex + 1} 还没有节目名称`)
        }
        if (!toPositiveInt(rule.tmdbid)) {
          issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」的 TMDB ID 还没填对`)
        }
        const seasonNumbers = new Set()
        rule.seasons.forEach((season, seasonIndex) => {
          const sourceSeason = toPositiveInt(season.source_season)
          if (!sourceSeason) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里第 ${seasonIndex + 1} 个季规则缺少来源季号`)
          } else if (seasonNumbers.has(sourceSeason)) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里来源第 ${sourceSeason} 季重复了`)
          } else {
            seasonNumbers.add(sourceSeason)
          }
          if (!toPositiveInt(season.tmdb_season_number, sourceSeason || 1)) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」里来源第 ${sourceSeason || '?'} 季缺少 TMDB 正片季号`)
          }
          try {
            safeParseManualMatches(season.manual_matches_text)
          } catch (error) {
            issues.push(`节目「${rule.name || `#${ruleIndex + 1}`}」来源第 ${sourceSeason || '?'} 季的 manual_matches JSON 不合法`)
          }
        })
      })

      return issues
    })

    const serializeState = () => {
      const common_types = {}
      state.value.commonTypes.forEach((type) => {
        const label = String(type.label || '').trim()
        if (!label) return
        common_types[type.key] = {
          label,
          source_keywords: normalizeStringArray(type.source_keywords),
          tmdb_keywords: normalizeStringArray(type.tmdb_keywords),
        }
      })

      const rules = state.value.rules.map((rule) => ({
        name: String(rule.name || '').trim(),
        tmdbid: toPositiveInt(rule.tmdbid),
        match_titles: normalizeStringArray(rule.match_titles),
        main_season: toPositiveInt(rule.main_season, 1) || 1,
        specials_season: toPositiveInt(rule.specials_season, 0) ?? 0,
        specials_folder: String(rule.specials_folder || state.value.specials_folder || 'Specials').trim() || 'Specials',
        seasons: orderedSeasons(rule).map((season) => {
          const typePayload = {}
          Object.entries(season.types || {}).forEach(([typeKey, conf]) => {
            const source_keywords = normalizeStringArray(conf?.source_keywords || [])
            const tmdb_keywords = normalizeStringArray(conf?.tmdb_keywords || [])
            if (source_keywords.length || tmdb_keywords.length) {
              typePayload[typeKey] = { source_keywords, tmdb_keywords }
            }
          })
          return {
            source_season: toPositiveInt(season.source_season, 1) || 1,
            tmdb_season_number: toPositiveInt(season.tmdb_season_number, toPositiveInt(season.source_season, 1) || 1) || 1,
            tmdb_season_matchers: normalizeStringArray(season.tmdb_season_matchers),
            manual_matches: safeParseManualMatches(season.manual_matches_text),
            types: typePayload,
          }
        }),
      }))

      return {
        enabled: !!state.value.enabled,
        notify: !!state.value.notify,
        specials_folder: String(state.value.specials_folder || 'Specials').trim() || 'Specials',
        common_types,
        rules,
      }
    }

    const clearSaveTimer = () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
    }

    const updateStateSilently = (updater) => {
      suspendAutosave.value = true
      try {
        updater()
      } finally {
        setTimeout(() => {
          suspendAutosave.value = false
        }, 0)
      }
    }

    const scheduleSave = (delay = 700) => {
      if (suspendAutosave.value) return
      clearSaveTimer()
      if (validationIssues.value.length) {
        saveStatus.value = 'invalid'
        return
      }
      saveStatus.value = 'pending'
      saveTimer = setTimeout(() => {
        saveNow({ silent: true })
      }, delay)
    }

    const loadState = async () => {
      if (!props.api?.get) return
      loading.value = true
      saveError.value = ''
      clearSaveTimer()
      try {
        const result = await props.api.get(`plugin/${PLUGIN_ID}/state`)
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '加载配置失败')
        }
        updateStateSilently(() => {
          state.value = hydrateState(result.data || {})
        })
        dirty.value = false
        saveStatus.value = 'idle'
      } catch (error) {
        saveError.value = error?.message || '加载配置失败'
      } finally {
        loading.value = false
      }
    }

    const saveNow = async ({ silent = false } = {}) => {
      if (!props.api?.post) return false
      clearSaveTimer()
      if (validationIssues.value.length) {
        saveStatus.value = 'invalid'
        if (!silent) {
          saveError.value = validationIssues.value[0]
        }
        return false
      }
      saving.value = true
      saveError.value = ''
      try {
        const payload = serializeState()
        const result = await props.api.post(`plugin/${PLUGIN_ID}/save_state`, payload)
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '保存失败')
        }
        updateStateSilently(() => {
          state.value = hydrateState(result.data || {})
        })
        dirty.value = false
        saveStatus.value = 'saved'
        lastSavedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
        return true
      } catch (error) {
        saveStatus.value = 'error'
        saveError.value = error?.message || '保存失败'
        return false
      } finally {
        saving.value = false
      }
    }

    const openTypeDialog = () => {
      drafts.type = { label: '', source_keywords: [], tmdb_keywords: [] }
      dialogs.type = true
    }

    const confirmAddType = () => {
      const label = String(drafts.type.label || '').trim()
      if (!label) {
        saveError.value = '新分类名称不能为空'
        return
      }
      let baseKey = label
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (!baseKey) baseKey = `type_${state.value.commonTypes.length + 1}`
      let key = baseKey
      let index = 2
      while (state.value.commonTypes.some((item) => item.key === key)) {
        key = `${baseKey}_${index++}`
      }
      state.value.commonTypes.push({
        _uid: uid('type'),
        key,
        label,
        source_keywords: normalizeStringArray(drafts.type.source_keywords),
        tmdb_keywords: normalizeStringArray(drafts.type.tmdb_keywords),
      })
      state.value.rules.forEach((rule) => {
        rule.seasons.forEach((season) => {
          if (!season.types[key]) {
            season.types[key] = createEmptyTypeBinding()
          }
        })
      })
      dialogs.type = false
    }

    const removeCommonType = (typeUid) => {
      const target = state.value.commonTypes.find((item) => item._uid === typeUid)
      if (!target) return
      if (!window.confirm(`确认删除分类「${target.label}」吗？这会同步移除各节目规则里对应的类型关键词。`)) return
      state.value.commonTypes = state.value.commonTypes.filter((item) => item._uid !== typeUid)
      state.value.rules.forEach((rule) => {
        rule.seasons.forEach((season) => {
          if (season.types?.[target.key]) {
            delete season.types[target.key]
          }
        })
      })
    }

    const openRuleDialog = () => {
      drafts.rule = {
        name: '',
        tmdbid: '',
        match_titles: [],
        main_season: 1,
        specials_season: 0,
        specials_folder: state.value.specials_folder || 'Specials',
      }
      dialogs.rule = true
    }

    const confirmAddRule = () => {
      const name = String(drafts.rule.name || '').trim()
      const tmdbid = toPositiveInt(drafts.rule.tmdbid)
      if (!name || !tmdbid) {
        saveError.value = '新增节目至少要填节目名称和 TMDB ID'
        return
      }
      const mainSeason = toPositiveInt(drafts.rule.main_season, 1) || 1
      const season = {
        _uid: uid('season'),
        source_season: mainSeason,
        tmdb_season_number: mainSeason,
        tmdb_season_matchers: [],
        manual_matches_text: '',
        types: Object.fromEntries(state.value.commonTypes.map((type) => [type.key, createEmptyTypeBinding()])),
      }
      state.value.rules.push({
        _uid: uid('rule'),
        name,
        tmdbid: String(tmdbid),
        match_titles: normalizeStringArray(drafts.rule.match_titles),
        main_season: mainSeason,
        specials_season: toPositiveInt(drafts.rule.specials_season, 0) ?? 0,
        specials_folder: String(drafts.rule.specials_folder || state.value.specials_folder || 'Specials').trim() || 'Specials',
        seasons: [season],
      })
      dialogs.rule = false
    }

    const removeRule = (ruleUid) => {
      const target = state.value.rules.find((item) => item._uid === ruleUid)
      if (!target) return
      if (!window.confirm(`确认删除节目「${target.name || '未命名节目'}」吗？`)) return
      state.value.rules = state.value.rules.filter((item) => item._uid !== ruleUid)
    }

    const openSeasonDialog = (rule) => {
      const existing = rule.seasons.map((season) => Number(season.source_season || 0)).filter(Boolean)
      const nextSeason = existing.length ? Math.max(...existing) + 1 : 1
      drafts.season = {
        ruleUid: rule._uid,
        source_season: String(nextSeason),
        tmdb_season_number: String(nextSeason),
        tmdb_season_matchers: [],
      }
      dialogs.season = true
    }

    const confirmAddSeason = () => {
      const rule = state.value.rules.find((item) => item._uid === drafts.season.ruleUid)
      if (!rule) return
      const sourceSeason = toPositiveInt(drafts.season.source_season)
      if (!sourceSeason) {
        saveError.value = '新季规则至少要填来源季号'
        return
      }
      if (rule.seasons.some((season) => Number(season.source_season) === sourceSeason)) {
        saveError.value = `来源第 ${sourceSeason} 季已经存在了`
        return
      }
      rule.seasons.push({
        _uid: uid('season'),
        source_season: sourceSeason,
        tmdb_season_number: toPositiveInt(drafts.season.tmdb_season_number, sourceSeason) || sourceSeason,
        tmdb_season_matchers: normalizeStringArray(drafts.season.tmdb_season_matchers),
        manual_matches_text: '',
        types: Object.fromEntries(state.value.commonTypes.map((type) => [type.key, createEmptyTypeBinding()])),
      })
      dialogs.season = false
    }

    const removeSeason = (ruleUid, seasonUid) => {
      const rule = state.value.rules.find((item) => item._uid === ruleUid)
      if (!rule) return
      const target = rule.seasons.find((season) => season._uid === seasonUid)
      if (!target) return
      if (!window.confirm(`确认删除来源第 ${target.source_season} 季规则吗？`)) return
      rule.seasons = rule.seasons.filter((season) => season._uid !== seasonUid)
    }

    watch(
      state,
      () => {
        if (suspendAutosave.value) return
        dirty.value = true
        saveError.value = ''
        scheduleSave()
      },
      { deep: true }
    )

    watch(
      () => props.api,
      (api) => {
        if (api) loadState()
      },
      { immediate: true }
    )

    onMounted(() => {
      if (props.api) loadState()
    })

    onBeforeUnmount(() => {
      clearSaveTimer()
    })

    return {
      state,
      dialogs,
      drafts,
      loading,
      saving,
      saveError,
      statusText,
      statusColor,
      lastSavedLabel,
      validationIssues,
      loadState,
      saveNow,
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
})
</script>

<style scoped>
.plugin-config {
  padding: 4px;
}

.break-all {
  word-break: break-all;
}

.gap-2 {
  gap: 8px;
}

.w-100 {
  width: 100%;
}
</style>
