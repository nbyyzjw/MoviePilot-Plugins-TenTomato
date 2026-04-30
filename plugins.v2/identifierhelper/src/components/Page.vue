<template>
  <div class="plugin-page">
    <v-card flat class="rounded border">
      <v-card-title class="text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5">
        <v-icon icon="mdi-tag-text" class="mr-2" color="primary" size="small" />
        <span>自定义识别词管理</span>
        <v-spacer></v-spacer>
        <v-chip size="small" variant="tonal" :color="saveStateColor" class="mr-2">
          {{ saveStateText }}
        </v-chip>
        <v-btn color="primary" size="small" variant="text" @click="switchToConfig">
          <v-icon icon="mdi-cog" size="small" class="mr-1" />
          配置
        </v-btn>
      </v-card-title>

      <v-card-text class="px-3 py-2">
        <v-alert v-if="error" type="error" density="compact" class="mb-2 text-caption" variant="tonal" closable>{{ error }}</v-alert>
        <v-alert v-if="successMessage" type="success" density="compact" class="mb-2 text-caption" variant="tonal" closable>{{ successMessage }}</v-alert>

        <v-card flat class="rounded mb-3 border">
          <v-card-title class="text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5">
            <v-icon icon="mdi-lightning-bolt" class="mr-2" color="primary" size="small" />
            <span>即时操作</span>
            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">操作后会自动同步到后端</span>
          </v-card-title>
          <v-card-text class="px-3 py-2">
            <v-row>
              <v-col cols="12" md="3">
                <v-btn color="primary" block @click="loadIdentifiers()" :loading="loading">
                  <v-icon icon="mdi-refresh" class="mr-1" />
                  重新加载
                </v-btn>
              </v-col>
              <v-col cols="12" md="3">
                <v-btn color="info" block @click="showAddCategoryDialog = true" :disabled="saving">
                  <v-icon icon="mdi-folder-plus" class="mr-1" />
                  添加分类
                </v-btn>
              </v-col>
              <v-col cols="12" md="3">
                <v-btn color="warning" block @click="openQuickAddDialog()" :disabled="saving">
                  <v-icon icon="mdi-plus-circle" class="mr-1" />
                  快速添加
                </v-btn>
              </v-col>
              <v-col cols="12" md="3">
                <v-btn color="success" block variant="tonal" @click="manualSync" :loading="saving">
                  <v-icon icon="mdi-cloud-sync" class="mr-1" />
                  手动同步
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card flat class="rounded mb-3 border">
          <v-card-text class="px-3 py-2">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="searchKeyword"
                  density="compact"
                  variant="outlined"
                  hide-details
                  placeholder="搜索识别词或分类..."
                  prepend-inner-icon="mdi-magnify"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="selectedTag"
                  :items="tagOptions"
                  density="compact"
                  variant="outlined"
                  hide-details
                  placeholder="按分类或子分类过滤..."
                  prepend-inner-icon="mdi-tag"
                  clearable
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card flat class="rounded border">
          <v-card-title class="text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5">
            <v-icon icon="mdi-file-tree" class="mr-2" color="primary" size="small" />
            <span>识别词树形管理</span>
            <v-spacer></v-spacer>
            <span class="text-caption">共 {{ displayedIdentifierCount }} 条</span>
          </v-card-title>
          <v-card-text class="px-0 py-0">
            <v-progress-linear v-if="loading" indeterminate color="primary" />

            <div v-if="displayTree.length > 0" class="tree-container pa-3">
              <div v-for="category in displayTree" :key="category.id" class="category-node mb-3">
                <v-card class="mb-2">
                  <v-card-title class="py-2 px-3 category-header" @click="toggleCategory(category)">
                    <div class="d-flex align-center w-100">
                      <v-icon :icon="category.expanded ? 'mdi-folder-open' : 'mdi-folder'" class="mr-2" size="small" color="primary" />
                      <span class="font-weight-medium text-subtitle-2">{{ category.name }}</span>
                      <v-spacer />
                      <v-chip size="x-small" color="primary" class="mr-2">{{ getTotalCount(category) }}</v-chip>
                      <v-btn icon size="x-small" variant="text" @click.stop="openAddSubCategoryDialog(category)">
                        <v-icon icon="mdi-folder-plus" size="small" />
                      </v-btn>
                      <v-btn icon size="x-small" variant="text" @click.stop="addIdentifierToCategory(category)">
                        <v-icon icon="mdi-plus" size="small" />
                      </v-btn>
                      <v-btn
                        v-if="category.name !== '未分类'"
                        icon
                        size="x-small"
                        variant="text"
                        color="error"
                        @click.stop="deleteCategory(category)"
                      >
                        <v-icon icon="mdi-delete" size="small" />
                      </v-btn>
                    </div>
                  </v-card-title>

                  <v-expand-transition>
                    <div v-show="category.expanded">
                      <v-card-text class="px-3 py-2">
                        <div v-if="category.subCategories.length > 0" class="mb-3">
                          <div v-for="subCategory in category.subCategories" :key="subCategory.id" class="sub-category-node mb-2 ml-4">
                            <v-card variant="outlined" class="sub-category-card">
                              <v-card-title class="py-1 px-2 text-caption" @click="toggleSubCategory(subCategory)">
                                <div class="d-flex align-center w-100">
                                  <v-icon
                                    :icon="subCategory.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline'"
                                    class="mr-2"
                                    size="small"
                                    color="info"
                                  />
                                  <span class="font-weight-medium">{{ subCategory.name }}</span>
                                  <v-spacer />
                                  <v-chip size="x-small" color="info" class="mr-2">{{ subCategory.identifiers.length }}</v-chip>
                                  <v-btn icon size="x-small" variant="text" @click.stop="addIdentifierToSubCategory(subCategory)">
                                    <v-icon icon="mdi-plus" size="small" />
                                  </v-btn>
                                  <v-btn icon size="x-small" variant="text" color="error" @click.stop="deleteSubCategory(category, subCategory)">
                                    <v-icon icon="mdi-delete" size="small" />
                                  </v-btn>
                                </div>
                              </v-card-title>

                              <v-expand-transition>
                                <div v-show="subCategory.expanded">
                                  <v-card-text class="px-2 py-1">
                                    <div
                                      v-for="identifier in subCategory.identifiers"
                                      :key="identifierKey(identifier)"
                                      class="identifier-item d-flex align-center py-1 px-2 mb-1 rounded"
                                    >
                                      <v-icon :icon="getTypeIcon(identifier.type)" :color="getTypeColor(identifier.type)" size="small" class="mr-2" />
                                      <v-chip size="x-small" :color="getTypeColor(identifier.type)" class="mr-2">{{ identifier.type }}</v-chip>
                                      <span class="text-caption flex-grow-1">{{ getDisplayContent(identifier) }}</span>
                                      <div class="action-buttons">
                                        <v-btn icon size="x-small" variant="text" @click="editIdentifierAdvanced(identifier, category, subCategory)">
                                          <v-icon icon="mdi-pencil" size="small" />
                                        </v-btn>
                                        <v-btn icon size="x-small" variant="text" color="error" @click="deleteIdentifierAdvanced(identifier)">
                                          <v-icon icon="mdi-delete" size="small" />
                                        </v-btn>
                                      </div>
                                    </div>
                                    <div v-if="subCategory.identifiers.length === 0" class="text-caption text-medium-emphasis px-2 py-1">
                                      暂无识别词，点右上角 + 直接添加。
                                    </div>
                                  </v-card-text>
                                </div>
                              </v-expand-transition>
                            </v-card>
                          </div>
                        </div>

                        <div v-if="category.identifiers.length > 0">
                          <div
                            v-for="identifier in category.identifiers"
                            :key="identifierKey(identifier)"
                            class="identifier-item d-flex align-center py-2 px-2 mb-1 rounded border"
                          >
                            <v-icon :icon="getTypeIcon(identifier.type)" :color="getTypeColor(identifier.type)" size="small" class="mr-3" />
                            <v-chip size="x-small" :color="getTypeColor(identifier.type)" class="mr-2">{{ identifier.type }}</v-chip>
                            <span class="text-subtitle-2 flex-grow-1">{{ getDisplayContent(identifier) }}</span>
                            <div class="action-buttons">
                              <v-btn icon size="small" variant="text" @click="editIdentifierAdvanced(identifier, category)">
                                <v-icon icon="mdi-pencil" size="small" />
                              </v-btn>
                              <v-btn icon size="small" variant="text" color="error" @click="deleteIdentifierAdvanced(identifier)">
                                <v-icon icon="mdi-delete" size="small" />
                              </v-btn>
                            </div>
                          </div>
                        </div>

                        <div
                          v-if="category.identifiers.length === 0 && category.subCategories.every(sub => sub.identifiers.length === 0)"
                          class="text-caption text-medium-emphasis"
                        >
                          这是个空分类，已经会被保存下来，不会因为没点总保存而丢掉。
                        </div>
                      </v-card-text>
                    </div>
                  </v-expand-transition>
                </v-card>
              </div>
            </div>

            <div v-else class="text-center py-8">
              <v-icon icon="mdi-emoticon-sad" size="large" color="grey" class="mb-2" />
              <div class="text-subtitle-2 text-grey">暂无识别词</div>
              <div class="text-caption text-grey">点击“快速添加”或“添加分类”开始使用</div>
            </div>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>

    <v-dialog v-model="showAddCategoryDialog" max-width="500">
      <v-card>
        <v-card-title class="text-subtitle-1">添加新分类</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newCategoryName"
            label="分类名称"
            variant="outlined"
            density="compact"
            placeholder="输入分类名称"
            :rules="[v => !!v || '分类名称不能为空']"
            @keyup.enter="addNewCategory"
          />
          <div class="text-caption text-medium-emphasis">确认后立即保存，不需要再点顶部保存。</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" @click="showAddCategoryDialog = false">取消</v-btn>
          <v-btn color="primary" @click="addNewCategory" :loading="saving">添加并保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showAddSubCategoryDialog" max-width="500">
      <v-card>
        <v-card-title class="text-subtitle-1">添加子分类到 {{ currentParentCategory?.name }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newSubCategoryName"
            label="子分类名称"
            variant="outlined"
            density="compact"
            placeholder="输入子分类名称"
            :rules="[v => !!v || '子分类名称不能为空']"
            @keyup.enter="addNewSubCategory"
          />
          <div class="text-caption text-medium-emphasis">确认后立即保存，不需要额外同步。</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" @click="showAddSubCategoryDialog = false">取消</v-btn>
          <v-btn color="primary" @click="addNewSubCategory" :loading="saving">添加并保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showQuickAddDialog" max-width="700">
      <v-card>
        <v-card-title class="text-subtitle-1">快速添加识别词</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="quickAddForm.category"
                :items="categorySelectOptions"
                label="选择分类（可选）"
                variant="outlined"
                density="compact"
                class="mb-3"
                clearable
                hint="留空将自动分配到“未分类”"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="quickAddForm.subCategory"
                :items="quickAddSubCategoryOptions"
                label="选择子分类（可选）"
                variant="outlined"
                density="compact"
                class="mb-3"
                :disabled="!quickAddForm.category"
                clearable
              />
            </v-col>
          </v-row>

          <v-select
            v-model="quickAddForm.type"
            :items="typeOptions"
            label="识别词类型"
            variant="outlined"
            density="compact"
            class="mb-3"
          />

          <div v-if="quickAddForm.type === '屏蔽'">
            <v-text-field v-model="quickAddForm.blockWord" label="屏蔽词" variant="outlined" density="compact" placeholder="输入要屏蔽的词语" />
          </div>

          <div v-else-if="quickAddForm.type === '替换'">
            <v-text-field v-model="quickAddForm.originalWord" label="原词" variant="outlined" density="compact" placeholder="输入原词" class="mb-3" />
            <v-text-field v-model="quickAddForm.replacementWord" label="替换词" variant="outlined" density="compact" placeholder="输入替换词" />
          </div>

          <div v-else-if="quickAddForm.type === '集偏移'">
            <v-text-field v-model="quickAddForm.frontLocator" label="前定位词" variant="outlined" density="compact" placeholder="输入前定位词" class="mb-3" />
            <v-text-field v-model="quickAddForm.backLocator" label="后定位词" variant="outlined" density="compact" placeholder="输入后定位词" class="mb-3" />
            <v-text-field v-model="quickAddForm.offset" label="偏移量" variant="outlined" density="compact" placeholder="例如：EP+1、EP-2" />
          </div>

          <div v-else-if="quickAddForm.type === '替换和集偏移'">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="quickAddForm.originalWord" label="原词" variant="outlined" density="compact" placeholder="输入原词" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="quickAddForm.replacementWord" label="替换词" variant="outlined" density="compact" placeholder="输入替换词" />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="quickAddForm.frontLocator" label="前定位词" variant="outlined" density="compact" placeholder="前定位词" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="quickAddForm.backLocator" label="后定位词" variant="outlined" density="compact" placeholder="后定位词" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="quickAddForm.offset" label="偏移量" variant="outlined" density="compact" placeholder="EP+1" />
              </v-col>
            </v-row>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" @click="showQuickAddDialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveQuickAdd" :disabled="!isQuickAddValid" :loading="saving">添加并保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showAdvancedEditDialog" max-width="700">
      <v-card>
        <v-card-title class="text-subtitle-1">编辑识别词</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="editForm.category"
                :items="categorySelectOptions"
                label="选择分类（可选）"
                variant="outlined"
                density="compact"
                class="mb-3"
                clearable
                hint="留空将自动分配到“未分类”"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="editForm.subCategory"
                :items="editSubCategoryOptions"
                label="选择子分类（可选）"
                variant="outlined"
                density="compact"
                class="mb-3"
                :disabled="!editForm.category"
                clearable
              />
            </v-col>
          </v-row>

          <v-select v-model="editForm.type" :items="typeOptions" label="识别词类型" variant="outlined" density="compact" class="mb-3" />

          <div v-if="editForm.type === '屏蔽'">
            <v-text-field v-model="editForm.blockWord" label="屏蔽词" variant="outlined" density="compact" placeholder="输入要屏蔽的词语" />
          </div>

          <div v-else-if="editForm.type === '替换'">
            <v-text-field v-model="editForm.originalWord" label="原词" variant="outlined" density="compact" placeholder="输入原词" class="mb-3" />
            <v-text-field v-model="editForm.replacementWord" label="替换词" variant="outlined" density="compact" placeholder="输入替换词" />
          </div>

          <div v-else-if="editForm.type === '集偏移'">
            <v-text-field v-model="editForm.frontLocator" label="前定位词" variant="outlined" density="compact" placeholder="输入前定位词" class="mb-3" />
            <v-text-field v-model="editForm.backLocator" label="后定位词" variant="outlined" density="compact" placeholder="输入后定位词" class="mb-3" />
            <v-text-field v-model="editForm.offset" label="偏移量" variant="outlined" density="compact" placeholder="例如：EP+1、EP-2" />
          </div>

          <div v-else-if="editForm.type === '替换和集偏移'">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="editForm.originalWord" label="原词" variant="outlined" density="compact" placeholder="输入原词" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="editForm.replacementWord" label="替换词" variant="outlined" density="compact" placeholder="输入替换词" />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="editForm.frontLocator" label="前定位词" variant="outlined" density="compact" placeholder="前定位词" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="editForm.backLocator" label="后定位词" variant="outlined" density="compact" placeholder="后定位词" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="editForm.offset" label="偏移量" variant="outlined" density="compact" placeholder="EP+1" />
              </v-col>
            </v-row>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" @click="showAdvancedEditDialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveAdvancedEdit" :disabled="!isEditFormValid" :loading="saving">保存并应用</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

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
const saveState = ref('idle');

const identifiers = ref([]);
const hierarchicalData = ref([]);
const searchKeyword = ref('');
const selectedTag = ref('');

const showAddCategoryDialog = ref(false);
const showAddSubCategoryDialog = ref(false);
const showQuickAddDialog = ref(false);
const showAdvancedEditDialog = ref(false);

const newCategoryName = ref('');
const newSubCategoryName = ref('');
const currentParentCategory = ref(null);

const quickAddForm = ref(createEmptyForm());
const editForm = ref({
  ...createEmptyForm(),
  originalIdentifier: null,
});

const typeOptions = [
  { title: '屏蔽词', value: '屏蔽' },
  { title: '替换词', value: '替换' },
  { title: '集偏移', value: '集偏移' },
  { title: '替换和集偏移', value: '替换和集偏移' }
];

function createEmptyForm() {
  return {
    category: '',
    subCategory: '',
    type: '屏蔽',
    blockWord: '',
    originalWord: '',
    replacementWord: '',
    frontLocator: '',
    backLocator: '',
    offset: ''
  };
}

const saveStateText = computed(() => {
  const mapping = {
    idle: '自动同步已开启',
    saving: '同步中…',
    saved: '已同步',
    error: '同步失败'
  };
  return mapping[saveState.value] || '自动同步已开启';
});

const saveStateColor = computed(() => {
  const mapping = {
    idle: 'info',
    saving: 'warning',
    saved: 'success',
    error: 'error'
  };
  return mapping[saveState.value] || 'info';
});

const categorySelectOptions = computed(() => (
  hierarchicalData.value.map(cat => ({ title: cat.name, value: cat.id }))
));

const quickAddSubCategoryOptions = computed(() => getSubCategoryOptions(quickAddForm.value.category));
const editSubCategoryOptions = computed(() => getSubCategoryOptions(editForm.value.category));

const tagOptions = computed(() => {
  const items = [];
  hierarchicalData.value.forEach(category => {
    items.push({ title: category.name, value: category.id });
    category.subCategories.forEach(subCategory => {
      items.push({ title: `${category.name} / ${subCategory.name}`, value: subCategory.id });
    });
  });
  return items;
});

const displayedIdentifierCount = computed(() => {
  return displayTree.value.reduce((sum, category) => {
    const subCount = category.subCategories.reduce((subSum, subCategory) => subSum + subCategory.identifiers.length, 0);
    return sum + category.identifiers.length + subCount;
  }, 0);
});

const displayTree = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  const selected = selectedTag.value;

  if (!keyword && !selected) {
    return hierarchicalData.value;
  }

  return hierarchicalData.value
    .map(category => {
      const matchedCategoryIdentifiers = category.identifiers.filter(item => matchesFilter(item, keyword, selected));
      const matchedSubCategories = category.subCategories
        .map(subCategory => ({
          ...subCategory,
          identifiers: subCategory.identifiers.filter(item => matchesFilter(item, keyword, selected))
        }))
        .filter(subCategory => subCategory.identifiers.length > 0 || matchesSelectedTag(subCategory.id, selected) || categoryNameMatches(subCategory.name, keyword));

      const categoryMatchedByName = categoryNameMatches(category.name, keyword) || matchesSelectedTag(category.id, selected);

      if (categoryMatchedByName) {
        return {
          ...category,
          identifiers: matchedCategoryIdentifiers.length > 0 || !keyword ? category.identifiers : matchedCategoryIdentifiers,
          subCategories: matchedSubCategories.length > 0 || !keyword ? category.subCategories : matchedSubCategories
        };
      }

      if (matchedCategoryIdentifiers.length > 0 || matchedSubCategories.length > 0) {
        return {
          ...category,
          identifiers: matchedCategoryIdentifiers,
          subCategories: matchedSubCategories
        };
      }

      return null;
    })
    .filter(Boolean);
});

const isQuickAddValid = computed(() => isFormValid(quickAddForm.value));
const isEditFormValid = computed(() => isFormValid(editForm.value));

watch(() => quickAddForm.value.category, () => {
  quickAddForm.value.subCategory = '';
});

watch(() => editForm.value.category, () => {
  editForm.value.subCategory = '';
});

function matchesFilter(item, keyword, selected) {
  const tagMatch = !selected || matchesSelectedTag(item.tag, selected);
  const keywordMatch = !keyword || item.content.toLowerCase().includes(keyword) || item.tag.toLowerCase().includes(keyword);
  return tagMatch && keywordMatch;
}

function matchesSelectedTag(tag, selected) {
  if (!selected) return true;
  return tag === selected || tag.startsWith(`${selected}/`);
}

function categoryNameMatches(name, keyword) {
  if (!keyword) return false;
  return String(name || '').toLowerCase().includes(keyword);
}

function isFormValid(form) {
  if (!form.type) return false;
  switch (form.type) {
    case '屏蔽':
      return !!form.blockWord;
    case '替换':
      return !!form.originalWord && !!form.replacementWord;
    case '集偏移':
      return !!form.frontLocator && !!form.backLocator && !!form.offset;
    case '替换和集偏移':
      return !!form.originalWord && !!form.replacementWord && !!form.frontLocator && !!form.backLocator && !!form.offset;
    default:
      return false;
  }
}

function getSubCategoryOptions(categoryId) {
  if (!categoryId) return [];
  const category = hierarchicalData.value.find(cat => cat.id === categoryId);
  if (!category) return [];
  return category.subCategories.map(subCategory => ({ title: subCategory.name, value: subCategory.id }));
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
  saveState.value = 'error';
}

function resetQuickAddForm() {
  const category = quickAddForm.value.category;
  const subCategory = quickAddForm.value.subCategory;
  quickAddForm.value = {
    ...createEmptyForm(),
    category,
    subCategory
  };
}

function resetEditForm() {
  editForm.value = {
    ...createEmptyForm(),
    originalIdentifier: null,
  };
}

function switchToConfig() {
  emit('switch');
}

function normalizeCategoryName(value) {
  const name = String(value || '').trim();
  return name || '未分类';
}

function normalizeSubCategoryName(value) {
  return String(value || '').trim();
}

function normalizeTree(baseTree = []) {
  if (!Array.isArray(baseTree)) return [];
  const seen = new Set();
  const normalized = [];

  baseTree.forEach(category => {
    const name = normalizeCategoryName(category?.name || category?.id);
    if (seen.has(name)) return;
    seen.add(name);

    const subSeen = new Set();
    const subCategories = Array.isArray(category?.subCategories)
      ? category.subCategories.reduce((result, subCategory) => {
          const subName = normalizeSubCategoryName(subCategory?.name || subCategory?.id?.split('/').slice(1).join('/'));
          if (!subName || subSeen.has(subName)) {
            return result;
          }
          subSeen.add(subName);
          result.push({
            id: `${name}/${subName}`,
            name: subName,
            identifiers: [],
            expanded: subCategory?.expanded !== false
          });
          return result;
        }, [])
      : [];

    normalized.push({
      id: name,
      name,
      identifiers: [],
      subCategories,
      expanded: category?.expanded !== false
    });
  });

  return normalized;
}

function mergeIdentifiersIntoHierarchy(baseTree = [], identifierList = []) {
  const categories = normalizeTree(baseTree);
  const categoryMap = new Map(categories.map(category => [category.name, category]));

  identifierList.forEach(item => {
    const tag = String(item?.tag || '未分类');
    const parts = tag.split('/').filter(Boolean);
    const categoryName = normalizeCategoryName(parts[0]);
    const subCategoryName = normalizeSubCategoryName(parts.slice(1).join('/'));

    if (!categoryMap.has(categoryName)) {
      const category = {
        id: categoryName,
        name: categoryName,
        identifiers: [],
        subCategories: [],
        expanded: true
      };
      categories.push(category);
      categoryMap.set(categoryName, category);
    }

    const category = categoryMap.get(categoryName);

    if (subCategoryName) {
      let subCategory = category.subCategories.find(item => item.name === subCategoryName);
      if (!subCategory) {
        subCategory = {
          id: `${categoryName}/${subCategoryName}`,
          name: subCategoryName,
          identifiers: [],
          expanded: true
        };
        category.subCategories.push(subCategory);
      }
      subCategory.identifiers.push(item);
      return;
    }

    category.identifiers.push(item);
  });

  return categories;
}

function buildHierarchicalData(baseTree = hierarchicalData.value) {
  hierarchicalData.value = mergeIdentifiersIntoHierarchy(baseTree, identifiers.value);
}

function normalizeTreeForSave(tree = hierarchicalData.value) {
  return normalizeTree(tree).map(category => ({
    id: category.id,
    name: category.name,
    subCategories: category.subCategories.map(subCategory => ({
      id: subCategory.id,
      name: subCategory.name
    }))
  }));
}

function generateRawTextFromIdentifiers(identifierList) {
  if (!identifierList || identifierList.length === 0) {
    return '';
  }

  const grouped = {};
  identifierList.forEach(item => {
    const tag = item.tag || '未分类';
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(item);
  });

  const lines = [];

  if (grouped['未分类']) {
    grouped['未分类'].forEach(item => {
      lines.push(item.content);
    });
    lines.push('');
    delete grouped['未分类'];
  }

  Object.entries(grouped).forEach(([tag, items]) => {
    lines.push(`# ${tag}`);
    items.forEach(item => {
      lines.push(item.content);
    });
    lines.push('');
  });

  return lines.join('\n').trim();
}

async function syncCategoryTree(message = '分类结构已同步') {
  if (!props.api) {
    setError('API 对象未初始化');
    return false;
  }

  saveState.value = 'saving';
  saving.value = true;
  error.value = '';

  try {
    const response = await props.api.post('plugin/IdentifierHelper/save_category_tree', {
      categories: normalizeTreeForSave()
    });

    if (response && response.code === 0) {
      saveState.value = 'saved';
      setSuccess(message);
      return true;
    }

    setError(response?.message || '分类结构保存失败');
    return false;
  } catch (err) {
    console.error('保存分类结构失败:', err);
    setError(`保存分类结构失败: ${err.message || '未知错误'}`);
    return false;
  } finally {
    saving.value = false;
  }
}

async function persistIdentifiers(message = '识别词已同步', showMessage = true) {
  if (!props.api) {
    setError('API 对象未初始化');
    return false;
  }

  saveState.value = 'saving';
  saving.value = true;
  error.value = '';

  try {
    const rawText = generateRawTextFromIdentifiers(identifiers.value.map(item => ({
      tag: item.tag || '未分类',
      type: item.type || '屏蔽',
      content: item.content || ''
    })));

    const response = await props.api.post('plugin/IdentifierHelper/save_raw_data?data=', {
      data: rawText
    });

    if (response && response.code === 0) {
      saveState.value = 'saved';
      if (showMessage) {
        setSuccess(message || response.message || '识别词保存成功');
      }
      return true;
    }

    setError(response?.message || '保存失败');
    return false;
  } catch (err) {
    console.error('保存识别词失败:', err);
    setError(`保存识别词失败: ${err.message || '未知错误'}`);
    return false;
  } finally {
    saving.value = false;
  }
}

async function loadIdentifiers(showToast = true) {
  if (!props.api) {
    setError('API 对象未初始化');
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const [identifierResponse, hierarchyResponse] = await Promise.all([
      props.api.get('plugin/IdentifierHelper/get_identifiers'),
      props.api.get('plugin/IdentifierHelper/get_hierarchical_data')
    ]);

    if (identifierResponse?.code !== 0) {
      throw new Error(identifierResponse?.message || '识别词加载失败');
    }

    if (hierarchyResponse?.code !== 0) {
      throw new Error(hierarchyResponse?.message || '分类结构加载失败');
    }

    identifiers.value = identifierResponse.data || [];
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(hierarchyResponse.data || [], identifiers.value);
    saveState.value = 'idle';

    if (showToast) {
      setSuccess('识别词加载成功');
    }
  } catch (err) {
    console.error('加载识别词失败:', err);
    setError(`加载识别词失败: ${err.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
}

function identifierKey(identifier) {
  return `${identifier.tag}__${identifier.type}__${identifier.content}`;
}

function getTotalCount(category) {
  return category.identifiers.length + category.subCategories.reduce((sum, subCategory) => sum + subCategory.identifiers.length, 0);
}

function getDisplayContent(identifier) {
  return identifier.content;
}

function getTypeIcon(type) {
  const icons = {
    '屏蔽': 'mdi-eye-off',
    '替换': 'mdi-find-replace',
    '集偏移': 'mdi-numeric',
    '替换和集偏移': 'mdi-cog'
  };
  return icons[type] || 'mdi-help';
}

function getTypeColor(type) {
  const colors = {
    '屏蔽': 'error',
    '替换': 'warning',
    '集偏移': 'info',
    '替换和集偏移': 'success'
  };
  return colors[type] || 'grey';
}

function toggleCategory(category) {
  category.expanded = !category.expanded;
}

function toggleSubCategory(subCategory) {
  subCategory.expanded = !subCategory.expanded;
}

function openQuickAddDialog() {
  quickAddForm.value = createEmptyForm();
  showQuickAddDialog.value = true;
}

function openAddSubCategoryDialog(category) {
  currentParentCategory.value = category;
  newSubCategoryName.value = '';
  showAddSubCategoryDialog.value = true;
}

function addIdentifierToCategory(category) {
  quickAddForm.value = {
    ...createEmptyForm(),
    category: category.id,
    subCategory: ''
  };
  showQuickAddDialog.value = true;
}

function addIdentifierToSubCategory(subCategory) {
  const parts = subCategory.id.split('/');
  quickAddForm.value = {
    ...createEmptyForm(),
    category: parts[0],
    subCategory: subCategory.id
  };
  showQuickAddDialog.value = true;
}

async function addNewCategory() {
  const categoryName = normalizeCategoryName(newCategoryName.value);
  if (!categoryName) return;

  if (hierarchicalData.value.some(category => category.name === categoryName)) {
    setError(`分类“${categoryName}”已存在`);
    return;
  }

  const previousTree = normalizeTree(hierarchicalData.value);
  hierarchicalData.value = [
    ...previousTree,
    {
      id: categoryName,
      name: categoryName,
      identifiers: [],
      subCategories: [],
      expanded: true
    }
  ];

  newCategoryName.value = '';
  showAddCategoryDialog.value = false;

  const saved = await syncCategoryTree(`分类“${categoryName}”已创建`);
  if (!saved) {
    hierarchicalData.value = previousTree;
  }
}

async function addNewSubCategory() {
  const subCategoryName = normalizeSubCategoryName(newSubCategoryName.value);
  if (!subCategoryName || !currentParentCategory.value) return;

  const previousTree = normalizeTree(hierarchicalData.value);
  const nextTree = normalizeTree(hierarchicalData.value);
  const parent = nextTree.find(category => category.id === currentParentCategory.value.id);

  if (!parent) {
    setError('未找到父分类');
    return;
  }

  if (parent.subCategories.some(subCategory => subCategory.name === subCategoryName)) {
    setError(`子分类“${subCategoryName}”已存在`);
    return;
  }

  parent.subCategories.push({
    id: `${parent.id}/${subCategoryName}`,
    name: subCategoryName,
    identifiers: [],
    expanded: true
  });

  hierarchicalData.value = mergeIdentifiersIntoHierarchy(nextTree, identifiers.value);
  newSubCategoryName.value = '';
  showAddSubCategoryDialog.value = false;

  const saved = await syncCategoryTree(`子分类“${subCategoryName}”已创建`);
  if (!saved) {
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(previousTree, identifiers.value);
  }
}

function generateContentFromForm(form) {
  switch (form.type) {
    case '屏蔽':
      return form.blockWord || '';
    case '替换':
      return form.originalWord && form.replacementWord ? `${form.originalWord} => ${form.replacementWord}` : '';
    case '集偏移':
      return form.frontLocator && form.backLocator && form.offset
        ? `${form.frontLocator} <> ${form.backLocator} >> ${form.offset}`
        : '';
    case '替换和集偏移':
      return form.originalWord && form.replacementWord && form.frontLocator && form.backLocator && form.offset
        ? `${form.originalWord} => ${form.replacementWord} && ${form.frontLocator} <> ${form.backLocator} >> ${form.offset}`
        : '';
    default:
      return '';
  }
}

async function saveQuickAdd() {
  const content = generateContentFromForm(quickAddForm.value);
  if (!content) return;

  const snapshot = [...identifiers.value];
  identifiers.value = [
    ...identifiers.value,
    {
      tag: quickAddForm.value.subCategory || quickAddForm.value.category || '未分类',
      type: quickAddForm.value.type,
      content
    }
  ];
  buildHierarchicalData();
  showQuickAddDialog.value = false;
  resetQuickAddForm();

  const saved = await persistIdentifiers('识别词已添加');
  if (!saved) {
    identifiers.value = snapshot;
    buildHierarchicalData();
  }
}

function parseContentToForm(content, type, form) {
  form.blockWord = '';
  form.originalWord = '';
  form.replacementWord = '';
  form.frontLocator = '';
  form.backLocator = '';
  form.offset = '';

  switch (type) {
    case '屏蔽':
      form.blockWord = content;
      break;
    case '替换': {
      const parts = content.split(' => ');
      form.originalWord = parts[0] || '';
      form.replacementWord = parts[1] || '';
      break;
    }
    case '集偏移': {
      const match = content.match(/^(.*?)\s*<>\s*(.*?)\s*>>\s*(.*)$/);
      if (match) {
        form.frontLocator = match[1];
        form.backLocator = match[2];
        form.offset = match[3];
      }
      break;
    }
    case '替换和集偏移': {
      const match = content.match(/^(.*?)\s*=>\s*(.*?)\s*&&\s*(.*?)\s*<>\s*(.*?)\s*>>\s*(.*)$/);
      if (match) {
        form.originalWord = match[1];
        form.replacementWord = match[2];
        form.frontLocator = match[3];
        form.backLocator = match[4];
        form.offset = match[5];
      }
      break;
    }
  }
}

function editIdentifierAdvanced(identifier, category, subCategory = null) {
  resetEditForm();
  editForm.value.category = category.id;
  editForm.value.subCategory = subCategory ? subCategory.id : '';
  editForm.value.type = identifier.type;
  editForm.value.originalIdentifier = identifier;
  parseContentToForm(identifier.content, identifier.type, editForm.value);
  showAdvancedEditDialog.value = true;
}

async function saveAdvancedEdit() {
  const newContent = generateContentFromForm(editForm.value);
  if (!newContent || !editForm.value.originalIdentifier) return;

  const snapshot = [...identifiers.value];
  const index = identifiers.value.findIndex(item => item === editForm.value.originalIdentifier);
  if (index < 0) {
    setError('未找到要编辑的识别词');
    return;
  }

  const next = [...identifiers.value];
  next[index] = {
    tag: editForm.value.subCategory || editForm.value.category || '未分类',
    type: editForm.value.type,
    content: newContent
  };

  identifiers.value = next;
  buildHierarchicalData();
  showAdvancedEditDialog.value = false;

  const saved = await persistIdentifiers('识别词已修改');
  if (!saved) {
    identifiers.value = snapshot;
    buildHierarchicalData();
  }
}

async function deleteIdentifierAdvanced(identifier) {
  if (!confirm('确定要删除这个识别词吗？')) {
    return;
  }

  const snapshot = [...identifiers.value];
  identifiers.value = identifiers.value.filter(item => item !== identifier);
  buildHierarchicalData();

  const saved = await persistIdentifiers('识别词已删除');
  if (!saved) {
    identifiers.value = snapshot;
    buildHierarchicalData();
  }
}

function belongsToCategory(tag, categoryName) {
  return tag === categoryName || tag.startsWith(`${categoryName}/`);
}

async function deleteCategory(category) {
  if (!confirm(`确定要删除分类“${category.name}”及其下的所有内容吗？`)) {
    return;
  }

  const identifierSnapshot = [...identifiers.value];
  const treeSnapshot = normalizeTree(hierarchicalData.value);

  identifiers.value = identifiers.value.filter(item => !belongsToCategory(item.tag, category.name));
  hierarchicalData.value = normalizeTree(hierarchicalData.value).filter(item => item.id !== category.id);

  const identifiersSaved = await persistIdentifiers('', false);
  if (!identifiersSaved) {
    identifiers.value = identifierSnapshot;
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(treeSnapshot, identifierSnapshot);
    return;
  }

  const treeSaved = await syncCategoryTree(`分类“${category.name}”已删除`);
  if (!treeSaved) {
    identifiers.value = identifierSnapshot;
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(treeSnapshot, identifierSnapshot);
    await loadIdentifiers(false);
  }
}

async function deleteSubCategory(parentCategory, subCategory) {
  if (!confirm(`确定要删除子分类“${subCategory.name}”及其下的所有识别词吗？`)) {
    return;
  }

  const identifierSnapshot = [...identifiers.value];
  const treeSnapshot = normalizeTree(hierarchicalData.value);

  identifiers.value = identifiers.value.filter(item => item.tag !== subCategory.id);
  const nextTree = normalizeTree(hierarchicalData.value);
  const parent = nextTree.find(category => category.id === parentCategory.id);
  if (parent) {
    parent.subCategories = parent.subCategories.filter(item => item.id !== subCategory.id);
  }
  hierarchicalData.value = mergeIdentifiersIntoHierarchy(nextTree, identifiers.value);

  const identifiersSaved = await persistIdentifiers('', false);
  if (!identifiersSaved) {
    identifiers.value = identifierSnapshot;
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(treeSnapshot, identifierSnapshot);
    return;
  }

  const treeSaved = await syncCategoryTree(`子分类“${subCategory.name}”已删除`);
  if (!treeSaved) {
    identifiers.value = identifierSnapshot;
    hierarchicalData.value = mergeIdentifiersIntoHierarchy(treeSnapshot, identifierSnapshot);
    await loadIdentifiers(false);
  }
}

async function manualSync() {
  const identifiersSaved = await persistIdentifiers('', false);
  if (!identifiersSaved) {
    return;
  }
  await syncCategoryTree('数据已手动同步');
}

onMounted(() => {
  setTimeout(() => {
    loadIdentifiers(false);
  }, 500);
});
</script>

<style scoped>
.plugin-page {
  width: 100%;
  height: 100%;
}

.tree-container {
  max-height: 70vh;
  overflow-y: auto;
}

.category-node {
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.category-node:hover {
  border-left-color: rgba(var(--v-theme-primary), 0.5);
}

.category-header {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.category-header:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.sub-category-node {
  position: relative;
}

.sub-category-node::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: rgba(var(--v-theme-info), 0.3);
}

.sub-category-card {
  background-color: rgba(var(--v-theme-surface), 0.8);
  border-left: 2px solid rgba(var(--v-theme-info), 0.5);
}

.sub-category-card .v-card-title {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.sub-category-card .v-card-title:hover {
  background-color: rgba(var(--v-theme-info), 0.05);
}

.identifier-item {
  background-color: rgba(var(--v-theme-surface), 0.5);
  transition: all 0.2s ease;
  border-left: 2px solid transparent;
}

.identifier-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-left-color: rgba(var(--v-theme-primary), 0.5);
}

.action-buttons {
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.identifier-item:hover .action-buttons {
  opacity: 1;
}
</style>
