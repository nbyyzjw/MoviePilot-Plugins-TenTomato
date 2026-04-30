<template>
  <div class="plugin-page">
    <v-card flat class="rounded border mb-3">
      <v-card-title class="text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5">
        <v-icon icon="mdi-television-classic" class="mr-2" color="primary" size="small" />
        <span>综艺特别篇纠偏</span>
        <v-spacer />
        <v-btn color="primary" size="small" variant="text" @click="$emit('switch')">
          <v-icon icon="mdi-cog" size="small" class="mr-1" />
          配置规则
        </v-btn>
      </v-card-title>

      <v-card-text class="px-3 py-3">
        <v-alert
          v-if="error"
          type="error"
          density="compact"
          variant="tonal"
          class="mb-3"
          closable
        >{{ error }}</v-alert>

        <v-alert type="info" variant="tonal" density="compact" class="mb-3">
          这里展示最近 10 条纠偏记录。配置页已经改成更轻量的自动保存模式，不用频繁被“先保存再继续”打断。
        </v-alert>

        <v-row class="mb-1">
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="primary">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">节目规则</div>
                <div class="text-h6">{{ stats.ruleCount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="success">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">通用分类</div>
                <div class="text-h6">{{ stats.typeCount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="tonal" color="deep-purple">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">最近记录</div>
                <div class="text-h6">{{ history.length }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <div v-if="loading" class="py-8 text-center text-medium-emphasis">
          正在加载最近纠偏记录...
        </div>

        <template v-else>
          <v-card v-if="!history.length" variant="text" class="border rounded">
            <v-card-text class="text-medium-emphasis">还没有纠偏记录。</v-card-text>
          </v-card>

          <v-timeline v-else density="compact" align="start">
            <v-timeline-item
              v-for="(item, index) in history"
              :key="`${item.new_path || item.old_path || index}-${index}`"
              dot-color="primary"
              fill-dot
              size="small"
            >
              <template #opposite>
                <span class="text-caption text-medium-emphasis">{{ formatTarget(item) }}</span>
              </template>
              <v-card variant="text" class="border rounded-sm">
                <v-card-text>
                  <div class="d-flex align-center flex-wrap gap-2 mb-1">
                    <strong>{{ item.show || '未知节目' }}</strong>
                    <v-chip size="x-small" color="primary" variant="tonal">{{ item.kind || '未识别' }}</v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis break-all">原路径：{{ item.old_path }}</div>
                  <div class="text-caption text-medium-emphasis break-all">新路径：{{ item.new_path }}</div>
                </v-card-text>
              </v-card>
            </v-timeline-item>
          </v-timeline>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import { computed, defineComponent, onMounted, ref, watch } from 'vue'

const PLUGIN_ID = 'VarietySpecialMapper'

export default defineComponent({
  name: 'VarietySpecialMapperPage',
  props: {
    api: {
      type: Object,
      default: null,
    },
  },
  emits: ['switch'],
  setup(props) {
    const loading = ref(false)
    const error = ref('')
    const history = ref([])
    const rawState = ref({ common_types: {}, rules: [] })

    const stats = computed(() => ({
      ruleCount: (rawState.value.rules || []).length,
      typeCount: Object.keys(rawState.value.common_types || {}).length,
    }))

    const formatTarget = (item) => {
      const season = Number(item?.target_season || 0)
      const episode = Number(item?.target_episode || 0)
      return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    }

    const loadState = async () => {
      if (!props.api?.get) return
      loading.value = true
      error.value = ''
      try {
        const result = await props.api.get(`plugin/${PLUGIN_ID}/state`)
        if (!result || result.code !== 0) {
          throw new Error(result?.message || '加载状态失败')
        }
        rawState.value = result.data || { common_types: {}, rules: [] }
        history.value = Array.isArray(result.data?.history) ? result.data.history : []
      } catch (err) {
        error.value = err?.message || '加载记录失败'
      } finally {
        loading.value = false
      }
    }

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

    return {
      loading,
      error,
      history,
      stats,
      formatTarget,
    }
  },
})
</script>

<style scoped>
.plugin-page {
  padding: 4px;
}

.break-all {
  word-break: break-all;
}

.gap-2 {
  gap: 8px;
}
</style>
