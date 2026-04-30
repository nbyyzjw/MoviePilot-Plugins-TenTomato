<template>
  <div class="plugin-config">
    <v-card flat class="rounded border">
      <v-card-title class="text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5">
        <v-icon icon="mdi-cog" class="mr-2" color="primary" size="small" />
        <span>识别词配置</span>
        <v-spacer />
        <v-chip size="small" variant="tonal" :color="autoSaveStateColor" class="mr-2">
          {{ autoSaveStateText }}
        </v-chip>
        <v-btn color="primary" size="small" variant="text" @click="switchToPage">
          <v-icon icon="mdi-arrow-left" size="small" class="mr-1" />
          返回
        </v-btn>
      </v-card-title>

      <v-card-text class="px-3 py-2">
        <v-alert v-if="error" type="error" density="compact" class="mb-2 text-caption" variant="tonal" closable>{{ error }}</v-alert>
        <v-alert v-if="successMessage" type="success" density="compact" class="mb-2 text-caption" variant="tonal" closable>{{ successMessage }}</v-alert>

        <v-card flat class="rounded mb-3 border">
          <v-card-title class="text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5">
            <v-icon icon="mdi-code-tags" class="mr-2" color="primary" size="small" />
            <span>原始数据编辑</span>
            <v-spacer />
            <v-btn color="primary" size="small" variant="text" @click="loadRawData" :loading="loading">
              <v-icon icon="mdi-refresh" size="small" class="mr-1" />
              重新加载
            </v-btn>
          </v-card-title>
          <v-card-text class="px-3 py-2">
            <div class="text-caption text-medium-emphasis mb-2">
              文本修改后会自动保存；失焦时也会立即补一次保存。右下角按钮只是手动兜底。
            </div>
            <v-textarea
              v-model="rawData"
              label="识别词原始数据"
              variant="outlined"
              rows="20"
              density="compact"
              placeholder="输入识别词数据..."
              :loading="loading"
              @blur="flushAutoSave"
            />

            <v-alert type="info" density="compact" variant="tonal" class="mt-3">
              <div class="text-caption">
                <strong>标签格式说明：</strong><br>
                • 使用 <code># 标签名</code> 开始一个新标签<br>
                • 标签下的所有识别词都属于该标签<br>
                • 未在任何标签下的识别词归为“未分类”<br><br>

                <strong>识别词格式：</strong><br>
                • 屏蔽词：<code>要屏蔽的词</code><br>
                • 替换词：<code>原词 => 新词</code><br>
                • 集偏移：<code>前定位词 <> 后定位词 >> 偏移量</code><br>
                • 复合格式：<code>原词 => 新词 && 前定位词 <> 后定位词 >> 偏移量</code>
              </div>
            </v-alert>

            <div class="d-flex flex-wrap gap-2 mt-3">
              <v-btn color="warning" @click="formatData" :disabled="loading || saving">
                <v-icon icon="mdi-format-align-left" class="mr-1" />
                格式化并自动保存
              </v-btn>
              <v-btn color="success" variant="tonal" @click="manualSave" :loading="saving">
                <v-icon icon="mdi-content-save" class="mr-1" />
                立即保存
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card flat class="rounded border">
          <v-card-title class="text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5">
            <v-icon icon="mdi-import" class="mr-2" color="primary" size="small" />
            <span>导入导出</span>
          </v-card-title>
          <v-card-text class="px-3 py-2">
            <v-row>
              <v-col cols="12" md="6">
                <v-file-input
                  v-model="importFile"
                  label="导入文件"
                  variant="outlined"
                  density="compact"
                  accept=".txt,.json"
                  prepend-icon="mdi-file-upload"
                  @update:modelValue="handleFileImport"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-btn color="primary" block @click="exportData">
                  <v-icon icon="mdi-download" class="mr-1" />
                  导出数据
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  api: {
    type: [Object, Function],
    required: true,
  }
});

const emit = defineEmits(['close', 'switch']);

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const successMessage = ref('');

const rawData = ref('');
const importFile = ref(null);
const initialized = ref(false);
const suspendAutoSave = ref(false);
const autoSaveState = ref('idle');
let autoSaveTimer = null;

const autoSaveStateText = computed(() => {
  const mapping = {
    idle: '自动保存已开启',
    pending: '待保存',
    saving: '保存中…',
    saved: '已保存',
    error: '保存失败'
  };
  return mapping[autoSaveState.value] || '自动保存已开启';
});

const autoSaveStateColor = computed(() => {
  const mapping = {
    idle: 'info',
    pending: 'warning',
    saving: 'warning',
    saved: 'success',
    error: 'error'
  };
  return mapping[autoSaveState.value] || 'info';
});

watch(rawData, (newValue, oldValue) => {
  if (!initialized.value || suspendAutoSave.value || newValue === oldValue) {
    return;
  }
  scheduleAutoSave();
});

function switchToPage() {
  emit('switch');
}

function setTransientMessage(target, message) {
  target.value = message;
  setTimeout(() => {
    if (target.value === message) {
      target.value = '';
    }
  }, 3000);
}

function setSuccess(message) {
  error.value = '';
  if (message) {
    setTransientMessage(successMessage, message);
  }
}

function setError(message) {
  successMessage.value = '';
  error.value = message;
  autoSaveState.value = 'error';
}

function clearAutoSaveTimer() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function scheduleAutoSave(delay = 900) {
  if (!initialized.value || suspendAutoSave.value) {
    return;
  }

  clearAutoSaveTimer();
  autoSaveState.value = 'pending';
  autoSaveTimer = setTimeout(() => {
    triggerAutoSave();
  }, delay);
}

async function triggerAutoSave() {
  clearAutoSaveTimer();
  if (saving.value || loading.value) {
    scheduleAutoSave(500);
    return;
  }
  await saveRawData({ silentSuccess: true });
}

async function loadRawData(showToast = true) {
  if (!props.api) {
    setError('API 对象未初始化');
    return;
  }

  loading.value = true;
  error.value = '';
  suspendAutoSave.value = true;
  clearAutoSaveTimer();

  try {
    const response = await props.api.get('plugin/IdentifierHelper/get_raw_identifiers');
    if (response && response.code === 0) {
      rawData.value = response.data || '';
      initialized.value = true;
      autoSaveState.value = 'idle';
      if (showToast) {
        setSuccess('原始数据加载成功');
      }
    } else {
      setError(response?.message || '未知错误');
    }
  } catch (err) {
    console.error('加载原始数据失败:', err);
    setError(`加载原始数据失败: ${err.message || '未知错误'}`);
  } finally {
    suspendAutoSave.value = false;
    loading.value = false;
  }
}

async function saveRawData({ silentSuccess = false } = {}) {
  if (!props.api) {
    setError('API 对象未初始化');
    return false;
  }

  clearAutoSaveTimer();
  saving.value = true;
  error.value = '';
  autoSaveState.value = 'saving';

  try {
    const response = await props.api.post('plugin/IdentifierHelper/save_raw_data?data=', {
      data: rawData.value
    });

    if (response && response.code === 0) {
      autoSaveState.value = 'saved';
      if (!silentSuccess) {
        setSuccess(response.message || '数据保存成功');
      }
      return true;
    }

    setError(response?.message || '保存失败');
    return false;
  } catch (err) {
    console.error('保存原始数据失败:', err);
    setError(`保存数据失败: ${err.message || '未知错误'}`);
    return false;
  } finally {
    saving.value = false;
  }
}

async function manualSave() {
  await saveRawData({ silentSuccess: false });
}

async function flushAutoSave() {
  if (autoSaveState.value !== 'pending' || saving.value || loading.value) {
    return;
  }
  await triggerAutoSave();
}

function formatData() {
  if (!rawData.value) return;

  const lines = rawData.value.split('\n');
  const formatted = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      formatted.push('');
      return;
    }

    if (trimmed.startsWith('#')) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
      formatted.push(trimmed);
      formatted.push('');
    } else {
      formatted.push(trimmed);
    }
  });

  rawData.value = formatted.join('\n');
  setSuccess('数据格式化完成，正在自动保存');
  scheduleAutoSave(250);
}

function handleFileImport(value) {
  const file = Array.isArray(value) ? value[0] : value;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    const content = event.target?.result;
    if (typeof content === 'string') {
      rawData.value = content;
      setSuccess('文件导入成功，正在自动保存');
      scheduleAutoSave(250);
    }
  };
  reader.readAsText(file);
}

function exportData() {
  if (!rawData.value) {
    setError('没有数据可导出');
    return;
  }

  const blob = new Blob([rawData.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `identifiers_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setSuccess('数据导出成功');
}

onMounted(() => {
  setTimeout(() => {
    loadRawData(false);
  }, 500);
});

onBeforeUnmount(() => {
  clearAutoSaveTimer();
});
</script>

<style scoped>
.plugin-config {
  width: 100%;
  height: 100%;
}
</style>
