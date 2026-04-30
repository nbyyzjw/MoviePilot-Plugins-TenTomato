import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createElementVNode:_createElementVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,withModifiers:_withModifiers,vShow:_vShow,withDirectives:_withDirectives,withKeys:_withKeys} = await importShared('vue');


const _hoisted_1 = { class: "plugin-page" };
const _hoisted_2 = { class: "text-caption" };
const _hoisted_3 = {
  key: 1,
  class: "tree-container pa-3"
};
const _hoisted_4 = { class: "d-flex align-center w-100" };
const _hoisted_5 = { class: "font-weight-medium text-subtitle-2" };
const _hoisted_6 = {
  key: 0,
  class: "mb-3"
};
const _hoisted_7 = { class: "d-flex align-center w-100" };
const _hoisted_8 = { class: "font-weight-medium" };
const _hoisted_9 = { class: "text-caption flex-grow-1" };
const _hoisted_10 = { class: "action-buttons" };
const _hoisted_11 = {
  key: 0,
  class: "text-caption text-medium-emphasis px-2 py-1"
};
const _hoisted_12 = { key: 1 };
const _hoisted_13 = { class: "text-subtitle-2 flex-grow-1" };
const _hoisted_14 = { class: "action-buttons" };
const _hoisted_15 = {
  key: 2,
  class: "text-caption text-medium-emphasis"
};
const _hoisted_16 = {
  key: 2,
  class: "text-center py-8"
};
const _hoisted_17 = { key: 0 };
const _hoisted_18 = { key: 1 };
const _hoisted_19 = { key: 2 };
const _hoisted_20 = { key: 3 };
const _hoisted_21 = { key: 0 };
const _hoisted_22 = { key: 1 };
const _hoisted_23 = { key: 2 };
const _hoisted_24 = { key: 3 };

const {ref,computed,onMounted,watch} = await importShared('vue');



const _sfc_main = {
  __name: 'Page',
  props: {
  api: {
    type: [Object, Function],
    required: true,
  }
},
  emits: ['close', 'switch'],
  setup(__props, { emit: __emit }) {

const props = __props;

const emit = __emit;

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

return (_ctx, _cache) => {
  const _component_v_icon = _resolveComponent("v-icon");
  const _component_v_spacer = _resolveComponent("v-spacer");
  const _component_v_chip = _resolveComponent("v-chip");
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_card_title = _resolveComponent("v-card-title");
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_card_text = _resolveComponent("v-card-text");
  const _component_v_card = _resolveComponent("v-card");
  const _component_v_text_field = _resolveComponent("v-text-field");
  const _component_v_select = _resolveComponent("v-select");
  const _component_v_progress_linear = _resolveComponent("v-progress-linear");
  const _component_v_expand_transition = _resolveComponent("v-expand-transition");
  const _component_v_card_actions = _resolveComponent("v-card-actions");
  const _component_v_dialog = _resolveComponent("v-dialog");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_v_card, {
      flat: "",
      class: "rounded border"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card_title, { class: "text-subtitle-1 d-flex align-center px-3 py-2 bg-primary-lighten-5" }, {
          default: _withCtx(() => [
            _createVNode(_component_v_icon, {
              icon: "mdi-tag-text",
              class: "mr-2",
              color: "primary",
              size: "small"
            }),
            _cache[44] || (_cache[44] = _createElementVNode("span", null, "自定义识别词管理", -1)),
            _createVNode(_component_v_spacer),
            _createVNode(_component_v_chip, {
              size: "small",
              variant: "tonal",
              color: saveStateColor.value,
              class: "mr-2"
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(saveStateText.value), 1)
              ]),
              _: 1
            }, 8, ["color"]),
            _createVNode(_component_v_btn, {
              color: "primary",
              size: "small",
              variant: "text",
              onClick: switchToConfig
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, {
                  icon: "mdi-cog",
                  size: "small",
                  class: "mr-1"
                }),
                _cache[43] || (_cache[43] = _createTextVNode(" 配置 "))
              ]),
              _: 1,
              __: [43]
            })
          ]),
          _: 1,
          __: [44]
        }),
        _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
          default: _withCtx(() => [
            (error.value)
              ? (_openBlock(), _createBlock(_component_v_alert, {
                  key: 0,
                  type: "error",
                  density: "compact",
                  class: "mb-2 text-caption",
                  variant: "tonal",
                  closable: ""
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(error.value), 1)
                  ]),
                  _: 1
                }))
              : _createCommentVNode("", true),
            (successMessage.value)
              ? (_openBlock(), _createBlock(_component_v_alert, {
                  key: 1,
                  type: "success",
                  density: "compact",
                  class: "mb-2 text-caption",
                  variant: "tonal",
                  closable: ""
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(successMessage.value), 1)
                  ]),
                  _: 1
                }))
              : _createCommentVNode("", true),
            _createVNode(_component_v_card, {
              flat: "",
              class: "rounded mb-3 border"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_icon, {
                      icon: "mdi-lightning-bolt",
                      class: "mr-2",
                      color: "primary",
                      size: "small"
                    }),
                    _cache[45] || (_cache[45] = _createElementVNode("span", null, "即时操作", -1)),
                    _createVNode(_component_v_spacer),
                    _cache[46] || (_cache[46] = _createElementVNode("span", { class: "text-caption text-medium-emphasis" }, "操作后会自动同步到后端", -1))
                  ]),
                  _: 1,
                  __: [45,46]
                }),
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_row, null, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "3"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_btn, {
                              color: "primary",
                              block: "",
                              onClick: _cache[0] || (_cache[0] = $event => (loadIdentifiers())),
                              loading: loading.value
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_icon, {
                                  icon: "mdi-refresh",
                                  class: "mr-1"
                                }),
                                _cache[47] || (_cache[47] = _createTextVNode(" 重新加载 "))
                              ]),
                              _: 1,
                              __: [47]
                            }, 8, ["loading"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "3"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_btn, {
                              color: "info",
                              block: "",
                              onClick: _cache[1] || (_cache[1] = $event => (showAddCategoryDialog.value = true)),
                              disabled: saving.value
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_icon, {
                                  icon: "mdi-folder-plus",
                                  class: "mr-1"
                                }),
                                _cache[48] || (_cache[48] = _createTextVNode(" 添加分类 "))
                              ]),
                              _: 1,
                              __: [48]
                            }, 8, ["disabled"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "3"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_btn, {
                              color: "warning",
                              block: "",
                              onClick: _cache[2] || (_cache[2] = $event => (openQuickAddDialog())),
                              disabled: saving.value
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_icon, {
                                  icon: "mdi-plus-circle",
                                  class: "mr-1"
                                }),
                                _cache[49] || (_cache[49] = _createTextVNode(" 快速添加 "))
                              ]),
                              _: 1,
                              __: [49]
                            }, 8, ["disabled"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "3"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_btn, {
                              color: "success",
                              block: "",
                              variant: "tonal",
                              onClick: manualSync,
                              loading: saving.value
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_icon, {
                                  icon: "mdi-cloud-sync",
                                  class: "mr-1"
                                }),
                                _cache[50] || (_cache[50] = _createTextVNode(" 手动同步 "))
                              ]),
                              _: 1,
                              __: [50]
                            }, 8, ["loading"])
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
              flat: "",
              class: "rounded mb-3 border"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_row, null, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "6"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_text_field, {
                              modelValue: searchKeyword.value,
                              "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((searchKeyword).value = $event)),
                              density: "compact",
                              variant: "outlined",
                              "hide-details": "",
                              placeholder: "搜索识别词或分类...",
                              "prepend-inner-icon": "mdi-magnify",
                              clearable: ""
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }),
                        _createVNode(_component_v_col, {
                          cols: "12",
                          md: "6"
                        }, {
                          default: _withCtx(() => [
                            _createVNode(_component_v_select, {
                              modelValue: selectedTag.value,
                              "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((selectedTag).value = $event)),
                              items: tagOptions.value,
                              density: "compact",
                              variant: "outlined",
                              "hide-details": "",
                              placeholder: "按分类或子分类过滤...",
                              "prepend-inner-icon": "mdi-tag",
                              clearable: ""
                            }, null, 8, ["modelValue", "items"])
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
              flat: "",
              class: "rounded border"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_card_title, { class: "text-caption d-flex align-center px-3 py-2 bg-primary-lighten-5" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_v_icon, {
                      icon: "mdi-file-tree",
                      class: "mr-2",
                      color: "primary",
                      size: "small"
                    }),
                    _cache[51] || (_cache[51] = _createElementVNode("span", null, "识别词树形管理", -1)),
                    _createVNode(_component_v_spacer),
                    _createElementVNode("span", _hoisted_2, "共 " + _toDisplayString(displayedIdentifierCount.value) + " 条", 1)
                  ]),
                  _: 1,
                  __: [51]
                }),
                _createVNode(_component_v_card_text, { class: "px-0 py-0" }, {
                  default: _withCtx(() => [
                    (loading.value)
                      ? (_openBlock(), _createBlock(_component_v_progress_linear, {
                          key: 0,
                          indeterminate: "",
                          color: "primary"
                        }))
                      : _createCommentVNode("", true),
                    (displayTree.value.length > 0)
                      ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(displayTree.value, (category) => {
                            return (_openBlock(), _createElementBlock("div", {
                              key: category.id,
                              class: "category-node mb-3"
                            }, [
                              _createVNode(_component_v_card, { class: "mb-2" }, {
                                default: _withCtx(() => [
                                  _createVNode(_component_v_card_title, {
                                    class: "py-2 px-3 category-header",
                                    onClick: $event => (toggleCategory(category))
                                  }, {
                                    default: _withCtx(() => [
                                      _createElementVNode("div", _hoisted_4, [
                                        _createVNode(_component_v_icon, {
                                          icon: category.expanded ? 'mdi-folder-open' : 'mdi-folder',
                                          class: "mr-2",
                                          size: "small",
                                          color: "primary"
                                        }, null, 8, ["icon"]),
                                        _createElementVNode("span", _hoisted_5, _toDisplayString(category.name), 1),
                                        _createVNode(_component_v_spacer),
                                        _createVNode(_component_v_chip, {
                                          size: "x-small",
                                          color: "primary",
                                          class: "mr-2"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(getTotalCount(category)), 1)
                                          ]),
                                          _: 2
                                        }, 1024),
                                        _createVNode(_component_v_btn, {
                                          icon: "",
                                          size: "x-small",
                                          variant: "text",
                                          onClick: _withModifiers($event => (openAddSubCategoryDialog(category)), ["stop"])
                                        }, {
                                          default: _withCtx(() => [
                                            _createVNode(_component_v_icon, {
                                              icon: "mdi-folder-plus",
                                              size: "small"
                                            })
                                          ]),
                                          _: 2
                                        }, 1032, ["onClick"]),
                                        _createVNode(_component_v_btn, {
                                          icon: "",
                                          size: "x-small",
                                          variant: "text",
                                          onClick: _withModifiers($event => (addIdentifierToCategory(category)), ["stop"])
                                        }, {
                                          default: _withCtx(() => [
                                            _createVNode(_component_v_icon, {
                                              icon: "mdi-plus",
                                              size: "small"
                                            })
                                          ]),
                                          _: 2
                                        }, 1032, ["onClick"]),
                                        (category.name !== '未分类')
                                          ? (_openBlock(), _createBlock(_component_v_btn, {
                                              key: 0,
                                              icon: "",
                                              size: "x-small",
                                              variant: "text",
                                              color: "error",
                                              onClick: _withModifiers($event => (deleteCategory(category)), ["stop"])
                                            }, {
                                              default: _withCtx(() => [
                                                _createVNode(_component_v_icon, {
                                                  icon: "mdi-delete",
                                                  size: "small"
                                                })
                                              ]),
                                              _: 2
                                            }, 1032, ["onClick"]))
                                          : _createCommentVNode("", true)
                                      ])
                                    ]),
                                    _: 2
                                  }, 1032, ["onClick"]),
                                  _createVNode(_component_v_expand_transition, null, {
                                    default: _withCtx(() => [
                                      _withDirectives(_createElementVNode("div", null, [
                                        _createVNode(_component_v_card_text, { class: "px-3 py-2" }, {
                                          default: _withCtx(() => [
                                            (category.subCategories.length > 0)
                                              ? (_openBlock(), _createElementBlock("div", _hoisted_6, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(category.subCategories, (subCategory) => {
                                                    return (_openBlock(), _createElementBlock("div", {
                                                      key: subCategory.id,
                                                      class: "sub-category-node mb-2 ml-4"
                                                    }, [
                                                      _createVNode(_component_v_card, {
                                                        variant: "outlined",
                                                        class: "sub-category-card"
                                                      }, {
                                                        default: _withCtx(() => [
                                                          _createVNode(_component_v_card_title, {
                                                            class: "py-1 px-2 text-caption",
                                                            onClick: $event => (toggleSubCategory(subCategory))
                                                          }, {
                                                            default: _withCtx(() => [
                                                              _createElementVNode("div", _hoisted_7, [
                                                                _createVNode(_component_v_icon, {
                                                                  icon: subCategory.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline',
                                                                  class: "mr-2",
                                                                  size: "small",
                                                                  color: "info"
                                                                }, null, 8, ["icon"]),
                                                                _createElementVNode("span", _hoisted_8, _toDisplayString(subCategory.name), 1),
                                                                _createVNode(_component_v_spacer),
                                                                _createVNode(_component_v_chip, {
                                                                  size: "x-small",
                                                                  color: "info",
                                                                  class: "mr-2"
                                                                }, {
                                                                  default: _withCtx(() => [
                                                                    _createTextVNode(_toDisplayString(subCategory.identifiers.length), 1)
                                                                  ]),
                                                                  _: 2
                                                                }, 1024),
                                                                _createVNode(_component_v_btn, {
                                                                  icon: "",
                                                                  size: "x-small",
                                                                  variant: "text",
                                                                  onClick: _withModifiers($event => (addIdentifierToSubCategory(subCategory)), ["stop"])
                                                                }, {
                                                                  default: _withCtx(() => [
                                                                    _createVNode(_component_v_icon, {
                                                                      icon: "mdi-plus",
                                                                      size: "small"
                                                                    })
                                                                  ]),
                                                                  _: 2
                                                                }, 1032, ["onClick"]),
                                                                _createVNode(_component_v_btn, {
                                                                  icon: "",
                                                                  size: "x-small",
                                                                  variant: "text",
                                                                  color: "error",
                                                                  onClick: _withModifiers($event => (deleteSubCategory(category, subCategory)), ["stop"])
                                                                }, {
                                                                  default: _withCtx(() => [
                                                                    _createVNode(_component_v_icon, {
                                                                      icon: "mdi-delete",
                                                                      size: "small"
                                                                    })
                                                                  ]),
                                                                  _: 2
                                                                }, 1032, ["onClick"])
                                                              ])
                                                            ]),
                                                            _: 2
                                                          }, 1032, ["onClick"]),
                                                          _createVNode(_component_v_expand_transition, null, {
                                                            default: _withCtx(() => [
                                                              _withDirectives(_createElementVNode("div", null, [
                                                                _createVNode(_component_v_card_text, { class: "px-2 py-1" }, {
                                                                  default: _withCtx(() => [
                                                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(subCategory.identifiers, (identifier) => {
                                                                      return (_openBlock(), _createElementBlock("div", {
                                                                        key: identifierKey(identifier),
                                                                        class: "identifier-item d-flex align-center py-1 px-2 mb-1 rounded"
                                                                      }, [
                                                                        _createVNode(_component_v_icon, {
                                                                          icon: getTypeIcon(identifier.type),
                                                                          color: getTypeColor(identifier.type),
                                                                          size: "small",
                                                                          class: "mr-2"
                                                                        }, null, 8, ["icon", "color"]),
                                                                        _createVNode(_component_v_chip, {
                                                                          size: "x-small",
                                                                          color: getTypeColor(identifier.type),
                                                                          class: "mr-2"
                                                                        }, {
                                                                          default: _withCtx(() => [
                                                                            _createTextVNode(_toDisplayString(identifier.type), 1)
                                                                          ]),
                                                                          _: 2
                                                                        }, 1032, ["color"]),
                                                                        _createElementVNode("span", _hoisted_9, _toDisplayString(getDisplayContent(identifier)), 1),
                                                                        _createElementVNode("div", _hoisted_10, [
                                                                          _createVNode(_component_v_btn, {
                                                                            icon: "",
                                                                            size: "x-small",
                                                                            variant: "text",
                                                                            onClick: $event => (editIdentifierAdvanced(identifier, category, subCategory))
                                                                          }, {
                                                                            default: _withCtx(() => [
                                                                              _createVNode(_component_v_icon, {
                                                                                icon: "mdi-pencil",
                                                                                size: "small"
                                                                              })
                                                                            ]),
                                                                            _: 2
                                                                          }, 1032, ["onClick"]),
                                                                          _createVNode(_component_v_btn, {
                                                                            icon: "",
                                                                            size: "x-small",
                                                                            variant: "text",
                                                                            color: "error",
                                                                            onClick: $event => (deleteIdentifierAdvanced(identifier))
                                                                          }, {
                                                                            default: _withCtx(() => [
                                                                              _createVNode(_component_v_icon, {
                                                                                icon: "mdi-delete",
                                                                                size: "small"
                                                                              })
                                                                            ]),
                                                                            _: 2
                                                                          }, 1032, ["onClick"])
                                                                        ])
                                                                      ]))
                                                                    }), 128)),
                                                                    (subCategory.identifiers.length === 0)
                                                                      ? (_openBlock(), _createElementBlock("div", _hoisted_11, " 暂无识别词，点右上角 + 直接添加。 "))
                                                                      : _createCommentVNode("", true)
                                                                  ]),
                                                                  _: 2
                                                                }, 1024)
                                                              ], 512), [
                                                                [_vShow, subCategory.expanded]
                                                              ])
                                                            ]),
                                                            _: 2
                                                          }, 1024)
                                                        ]),
                                                        _: 2
                                                      }, 1024)
                                                    ]))
                                                  }), 128))
                                                ]))
                                              : _createCommentVNode("", true),
                                            (category.identifiers.length > 0)
                                              ? (_openBlock(), _createElementBlock("div", _hoisted_12, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(category.identifiers, (identifier) => {
                                                    return (_openBlock(), _createElementBlock("div", {
                                                      key: identifierKey(identifier),
                                                      class: "identifier-item d-flex align-center py-2 px-2 mb-1 rounded border"
                                                    }, [
                                                      _createVNode(_component_v_icon, {
                                                        icon: getTypeIcon(identifier.type),
                                                        color: getTypeColor(identifier.type),
                                                        size: "small",
                                                        class: "mr-3"
                                                      }, null, 8, ["icon", "color"]),
                                                      _createVNode(_component_v_chip, {
                                                        size: "x-small",
                                                        color: getTypeColor(identifier.type),
                                                        class: "mr-2"
                                                      }, {
                                                        default: _withCtx(() => [
                                                          _createTextVNode(_toDisplayString(identifier.type), 1)
                                                        ]),
                                                        _: 2
                                                      }, 1032, ["color"]),
                                                      _createElementVNode("span", _hoisted_13, _toDisplayString(getDisplayContent(identifier)), 1),
                                                      _createElementVNode("div", _hoisted_14, [
                                                        _createVNode(_component_v_btn, {
                                                          icon: "",
                                                          size: "small",
                                                          variant: "text",
                                                          onClick: $event => (editIdentifierAdvanced(identifier, category))
                                                        }, {
                                                          default: _withCtx(() => [
                                                            _createVNode(_component_v_icon, {
                                                              icon: "mdi-pencil",
                                                              size: "small"
                                                            })
                                                          ]),
                                                          _: 2
                                                        }, 1032, ["onClick"]),
                                                        _createVNode(_component_v_btn, {
                                                          icon: "",
                                                          size: "small",
                                                          variant: "text",
                                                          color: "error",
                                                          onClick: $event => (deleteIdentifierAdvanced(identifier))
                                                        }, {
                                                          default: _withCtx(() => [
                                                            _createVNode(_component_v_icon, {
                                                              icon: "mdi-delete",
                                                              size: "small"
                                                            })
                                                          ]),
                                                          _: 2
                                                        }, 1032, ["onClick"])
                                                      ])
                                                    ]))
                                                  }), 128))
                                                ]))
                                              : _createCommentVNode("", true),
                                            (category.identifiers.length === 0 && category.subCategories.every(sub => sub.identifiers.length === 0))
                                              ? (_openBlock(), _createElementBlock("div", _hoisted_15, " 这是个空分类，已经会被保存下来，不会因为没点总保存而丢掉。 "))
                                              : _createCommentVNode("", true)
                                          ]),
                                          _: 2
                                        }, 1024)
                                      ], 512), [
                                        [_vShow, category.expanded]
                                      ])
                                    ]),
                                    _: 2
                                  }, 1024)
                                ]),
                                _: 2
                              }, 1024)
                            ]))
                          }), 128))
                        ]))
                      : (_openBlock(), _createElementBlock("div", _hoisted_16, [
                          _createVNode(_component_v_icon, {
                            icon: "mdi-emoticon-sad",
                            size: "large",
                            color: "grey",
                            class: "mb-2"
                          }),
                          _cache[52] || (_cache[52] = _createElementVNode("div", { class: "text-subtitle-2 text-grey" }, "暂无识别词", -1)),
                          _cache[53] || (_cache[53] = _createElementVNode("div", { class: "text-caption text-grey" }, "点击“快速添加”或“添加分类”开始使用", -1))
                        ]))
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
      modelValue: showAddCategoryDialog.value,
      "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((showAddCategoryDialog).value = $event)),
      "max-width": "500"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, { class: "text-subtitle-1" }, {
              default: _withCtx(() => _cache[54] || (_cache[54] = [
                _createTextVNode("添加新分类")
              ])),
              _: 1,
              __: [54]
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_text_field, {
                  modelValue: newCategoryName.value,
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((newCategoryName).value = $event)),
                  label: "分类名称",
                  variant: "outlined",
                  density: "compact",
                  placeholder: "输入分类名称",
                  rules: [v => !!v || '分类名称不能为空'],
                  onKeyup: _withKeys(addNewCategory, ["enter"])
                }, null, 8, ["modelValue", "rules"]),
                _cache[55] || (_cache[55] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "确认后立即保存，不需要再点顶部保存。", -1))
              ]),
              _: 1,
              __: [55]
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  color: "grey",
                  onClick: _cache[6] || (_cache[6] = $event => (showAddCategoryDialog.value = false))
                }, {
                  default: _withCtx(() => _cache[56] || (_cache[56] = [
                    _createTextVNode("取消")
                  ])),
                  _: 1,
                  __: [56]
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: addNewCategory,
                  loading: saving.value
                }, {
                  default: _withCtx(() => _cache[57] || (_cache[57] = [
                    _createTextVNode("添加并保存")
                  ])),
                  _: 1,
                  __: [57]
                }, 8, ["loading"])
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
      modelValue: showAddSubCategoryDialog.value,
      "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((showAddSubCategoryDialog).value = $event)),
      "max-width": "500"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, { class: "text-subtitle-1" }, {
              default: _withCtx(() => [
                _createTextVNode("添加子分类到 " + _toDisplayString(currentParentCategory.value?.name), 1)
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_text_field, {
                  modelValue: newSubCategoryName.value,
                  "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((newSubCategoryName).value = $event)),
                  label: "子分类名称",
                  variant: "outlined",
                  density: "compact",
                  placeholder: "输入子分类名称",
                  rules: [v => !!v || '子分类名称不能为空'],
                  onKeyup: _withKeys(addNewSubCategory, ["enter"])
                }, null, 8, ["modelValue", "rules"]),
                _cache[58] || (_cache[58] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "确认后立即保存，不需要额外同步。", -1))
              ]),
              _: 1,
              __: [58]
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  color: "grey",
                  onClick: _cache[9] || (_cache[9] = $event => (showAddSubCategoryDialog.value = false))
                }, {
                  default: _withCtx(() => _cache[59] || (_cache[59] = [
                    _createTextVNode("取消")
                  ])),
                  _: 1,
                  __: [59]
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: addNewSubCategory,
                  loading: saving.value
                }, {
                  default: _withCtx(() => _cache[60] || (_cache[60] = [
                    _createTextVNode("添加并保存")
                  ])),
                  _: 1,
                  __: [60]
                }, 8, ["loading"])
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
      modelValue: showQuickAddDialog.value,
      "onUpdate:modelValue": _cache[26] || (_cache[26] = $event => ((showQuickAddDialog).value = $event)),
      "max-width": "700"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, { class: "text-subtitle-1" }, {
              default: _withCtx(() => _cache[61] || (_cache[61] = [
                _createTextVNode("快速添加识别词")
              ])),
              _: 1,
              __: [61]
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
                        _createVNode(_component_v_select, {
                          modelValue: quickAddForm.value.category,
                          "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((quickAddForm.value.category) = $event)),
                          items: categorySelectOptions.value,
                          label: "选择分类（可选）",
                          variant: "outlined",
                          density: "compact",
                          class: "mb-3",
                          clearable: "",
                          hint: "留空将自动分配到“未分类”",
                          "persistent-hint": ""
                        }, null, 8, ["modelValue", "items"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_select, {
                          modelValue: quickAddForm.value.subCategory,
                          "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((quickAddForm.value.subCategory) = $event)),
                          items: quickAddSubCategoryOptions.value,
                          label: "选择子分类（可选）",
                          variant: "outlined",
                          density: "compact",
                          class: "mb-3",
                          disabled: !quickAddForm.value.category,
                          clearable: ""
                        }, null, 8, ["modelValue", "items", "disabled"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_select, {
                  modelValue: quickAddForm.value.type,
                  "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((quickAddForm.value.type) = $event)),
                  items: typeOptions,
                  label: "识别词类型",
                  variant: "outlined",
                  density: "compact",
                  class: "mb-3"
                }, null, 8, ["modelValue"]),
                (quickAddForm.value.type === '屏蔽')
                  ? (_openBlock(), _createElementBlock("div", _hoisted_17, [
                      _createVNode(_component_v_text_field, {
                        modelValue: quickAddForm.value.blockWord,
                        "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((quickAddForm.value.blockWord) = $event)),
                        label: "屏蔽词",
                        variant: "outlined",
                        density: "compact",
                        placeholder: "输入要屏蔽的词语"
                      }, null, 8, ["modelValue"])
                    ]))
                  : (quickAddForm.value.type === '替换')
                    ? (_openBlock(), _createElementBlock("div", _hoisted_18, [
                        _createVNode(_component_v_text_field, {
                          modelValue: quickAddForm.value.originalWord,
                          "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((quickAddForm.value.originalWord) = $event)),
                          label: "原词",
                          variant: "outlined",
                          density: "compact",
                          placeholder: "输入原词",
                          class: "mb-3"
                        }, null, 8, ["modelValue"]),
                        _createVNode(_component_v_text_field, {
                          modelValue: quickAddForm.value.replacementWord,
                          "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((quickAddForm.value.replacementWord) = $event)),
                          label: "替换词",
                          variant: "outlined",
                          density: "compact",
                          placeholder: "输入替换词"
                        }, null, 8, ["modelValue"])
                      ]))
                    : (quickAddForm.value.type === '集偏移')
                      ? (_openBlock(), _createElementBlock("div", _hoisted_19, [
                          _createVNode(_component_v_text_field, {
                            modelValue: quickAddForm.value.frontLocator,
                            "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((quickAddForm.value.frontLocator) = $event)),
                            label: "前定位词",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "输入前定位词",
                            class: "mb-3"
                          }, null, 8, ["modelValue"]),
                          _createVNode(_component_v_text_field, {
                            modelValue: quickAddForm.value.backLocator,
                            "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((quickAddForm.value.backLocator) = $event)),
                            label: "后定位词",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "输入后定位词",
                            class: "mb-3"
                          }, null, 8, ["modelValue"]),
                          _createVNode(_component_v_text_field, {
                            modelValue: quickAddForm.value.offset,
                            "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((quickAddForm.value.offset) = $event)),
                            label: "偏移量",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "例如：EP+1、EP-2"
                          }, null, 8, ["modelValue"])
                        ]))
                      : (quickAddForm.value.type === '替换和集偏移')
                        ? (_openBlock(), _createElementBlock("div", _hoisted_20, [
                            _createVNode(_component_v_row, null, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_col, {
                                  cols: "12",
                                  md: "6"
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_text_field, {
                                      modelValue: quickAddForm.value.originalWord,
                                      "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => ((quickAddForm.value.originalWord) = $event)),
                                      label: "原词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "输入原词"
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
                                      modelValue: quickAddForm.value.replacementWord,
                                      "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => ((quickAddForm.value.replacementWord) = $event)),
                                      label: "替换词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "输入替换词"
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
                                      modelValue: quickAddForm.value.frontLocator,
                                      "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => ((quickAddForm.value.frontLocator) = $event)),
                                      label: "前定位词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "前定位词"
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
                                      modelValue: quickAddForm.value.backLocator,
                                      "onUpdate:modelValue": _cache[23] || (_cache[23] = $event => ((quickAddForm.value.backLocator) = $event)),
                                      label: "后定位词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "后定位词"
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
                                      modelValue: quickAddForm.value.offset,
                                      "onUpdate:modelValue": _cache[24] || (_cache[24] = $event => ((quickAddForm.value.offset) = $event)),
                                      label: "偏移量",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "EP+1"
                                    }, null, 8, ["modelValue"])
                                  ]),
                                  _: 1
                                })
                              ]),
                              _: 1
                            })
                          ]))
                        : _createCommentVNode("", true)
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  color: "grey",
                  onClick: _cache[25] || (_cache[25] = $event => (showQuickAddDialog.value = false))
                }, {
                  default: _withCtx(() => _cache[62] || (_cache[62] = [
                    _createTextVNode("取消")
                  ])),
                  _: 1,
                  __: [62]
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: saveQuickAdd,
                  disabled: !isQuickAddValid.value,
                  loading: saving.value
                }, {
                  default: _withCtx(() => _cache[63] || (_cache[63] = [
                    _createTextVNode("添加并保存")
                  ])),
                  _: 1,
                  __: [63]
                }, 8, ["disabled", "loading"])
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
      modelValue: showAdvancedEditDialog.value,
      "onUpdate:modelValue": _cache[42] || (_cache[42] = $event => ((showAdvancedEditDialog).value = $event)),
      "max-width": "700"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, { class: "text-subtitle-1" }, {
              default: _withCtx(() => _cache[64] || (_cache[64] = [
                _createTextVNode("编辑识别词")
              ])),
              _: 1,
              __: [64]
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
                        _createVNode(_component_v_select, {
                          modelValue: editForm.value.category,
                          "onUpdate:modelValue": _cache[27] || (_cache[27] = $event => ((editForm.value.category) = $event)),
                          items: categorySelectOptions.value,
                          label: "选择分类（可选）",
                          variant: "outlined",
                          density: "compact",
                          class: "mb-3",
                          clearable: "",
                          hint: "留空将自动分配到“未分类”",
                          "persistent-hint": ""
                        }, null, 8, ["modelValue", "items"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_v_col, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_select, {
                          modelValue: editForm.value.subCategory,
                          "onUpdate:modelValue": _cache[28] || (_cache[28] = $event => ((editForm.value.subCategory) = $event)),
                          items: editSubCategoryOptions.value,
                          label: "选择子分类（可选）",
                          variant: "outlined",
                          density: "compact",
                          class: "mb-3",
                          disabled: !editForm.value.category,
                          clearable: ""
                        }, null, 8, ["modelValue", "items", "disabled"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_v_select, {
                  modelValue: editForm.value.type,
                  "onUpdate:modelValue": _cache[29] || (_cache[29] = $event => ((editForm.value.type) = $event)),
                  items: typeOptions,
                  label: "识别词类型",
                  variant: "outlined",
                  density: "compact",
                  class: "mb-3"
                }, null, 8, ["modelValue"]),
                (editForm.value.type === '屏蔽')
                  ? (_openBlock(), _createElementBlock("div", _hoisted_21, [
                      _createVNode(_component_v_text_field, {
                        modelValue: editForm.value.blockWord,
                        "onUpdate:modelValue": _cache[30] || (_cache[30] = $event => ((editForm.value.blockWord) = $event)),
                        label: "屏蔽词",
                        variant: "outlined",
                        density: "compact",
                        placeholder: "输入要屏蔽的词语"
                      }, null, 8, ["modelValue"])
                    ]))
                  : (editForm.value.type === '替换')
                    ? (_openBlock(), _createElementBlock("div", _hoisted_22, [
                        _createVNode(_component_v_text_field, {
                          modelValue: editForm.value.originalWord,
                          "onUpdate:modelValue": _cache[31] || (_cache[31] = $event => ((editForm.value.originalWord) = $event)),
                          label: "原词",
                          variant: "outlined",
                          density: "compact",
                          placeholder: "输入原词",
                          class: "mb-3"
                        }, null, 8, ["modelValue"]),
                        _createVNode(_component_v_text_field, {
                          modelValue: editForm.value.replacementWord,
                          "onUpdate:modelValue": _cache[32] || (_cache[32] = $event => ((editForm.value.replacementWord) = $event)),
                          label: "替换词",
                          variant: "outlined",
                          density: "compact",
                          placeholder: "输入替换词"
                        }, null, 8, ["modelValue"])
                      ]))
                    : (editForm.value.type === '集偏移')
                      ? (_openBlock(), _createElementBlock("div", _hoisted_23, [
                          _createVNode(_component_v_text_field, {
                            modelValue: editForm.value.frontLocator,
                            "onUpdate:modelValue": _cache[33] || (_cache[33] = $event => ((editForm.value.frontLocator) = $event)),
                            label: "前定位词",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "输入前定位词",
                            class: "mb-3"
                          }, null, 8, ["modelValue"]),
                          _createVNode(_component_v_text_field, {
                            modelValue: editForm.value.backLocator,
                            "onUpdate:modelValue": _cache[34] || (_cache[34] = $event => ((editForm.value.backLocator) = $event)),
                            label: "后定位词",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "输入后定位词",
                            class: "mb-3"
                          }, null, 8, ["modelValue"]),
                          _createVNode(_component_v_text_field, {
                            modelValue: editForm.value.offset,
                            "onUpdate:modelValue": _cache[35] || (_cache[35] = $event => ((editForm.value.offset) = $event)),
                            label: "偏移量",
                            variant: "outlined",
                            density: "compact",
                            placeholder: "例如：EP+1、EP-2"
                          }, null, 8, ["modelValue"])
                        ]))
                      : (editForm.value.type === '替换和集偏移')
                        ? (_openBlock(), _createElementBlock("div", _hoisted_24, [
                            _createVNode(_component_v_row, null, {
                              default: _withCtx(() => [
                                _createVNode(_component_v_col, {
                                  cols: "12",
                                  md: "6"
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_text_field, {
                                      modelValue: editForm.value.originalWord,
                                      "onUpdate:modelValue": _cache[36] || (_cache[36] = $event => ((editForm.value.originalWord) = $event)),
                                      label: "原词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "输入原词"
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
                                      modelValue: editForm.value.replacementWord,
                                      "onUpdate:modelValue": _cache[37] || (_cache[37] = $event => ((editForm.value.replacementWord) = $event)),
                                      label: "替换词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "输入替换词"
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
                                      modelValue: editForm.value.frontLocator,
                                      "onUpdate:modelValue": _cache[38] || (_cache[38] = $event => ((editForm.value.frontLocator) = $event)),
                                      label: "前定位词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "前定位词"
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
                                      modelValue: editForm.value.backLocator,
                                      "onUpdate:modelValue": _cache[39] || (_cache[39] = $event => ((editForm.value.backLocator) = $event)),
                                      label: "后定位词",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "后定位词"
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
                                      modelValue: editForm.value.offset,
                                      "onUpdate:modelValue": _cache[40] || (_cache[40] = $event => ((editForm.value.offset) = $event)),
                                      label: "偏移量",
                                      variant: "outlined",
                                      density: "compact",
                                      placeholder: "EP+1"
                                    }, null, 8, ["modelValue"])
                                  ]),
                                  _: 1
                                })
                              ]),
                              _: 1
                            })
                          ]))
                        : _createCommentVNode("", true)
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  color: "grey",
                  onClick: _cache[41] || (_cache[41] = $event => (showAdvancedEditDialog.value = false))
                }, {
                  default: _withCtx(() => _cache[65] || (_cache[65] = [
                    _createTextVNode("取消")
                  ])),
                  _: 1,
                  __: [65]
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  onClick: saveAdvancedEdit,
                  disabled: !isEditFormValid.value,
                  loading: saving.value
                }, {
                  default: _withCtx(() => _cache[66] || (_cache[66] = [
                    _createTextVNode("保存并应用")
                  ])),
                  _: 1,
                  __: [66]
                }, 8, ["disabled", "loading"])
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
}

};
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-0134f62e"]]);

export { Page as default };
