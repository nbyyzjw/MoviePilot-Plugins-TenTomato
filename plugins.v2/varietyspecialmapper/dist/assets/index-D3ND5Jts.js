import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import Page from './__federation_expose_Page-Cuxz2Pfz.js';
import Config from './__federation_expose_Config-m2Zz8pc6.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

true&&(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
}());

const {defineComponent,onBeforeUnmount,onMounted,ref,shallowRef} = await importShared('vue');

const _sfc_main = defineComponent({
  name: 'VarietySpecialMapperApp',
  setup() {
    const currentComponent = shallowRef(Page);
    const api = ref(null);

    const handleMessage = (event) => {
      if (event.data?.type === 'api') {
        api.value = event.data.data;
      }
      if (event.data?.type === 'showConfig') {
        currentComponent.value = Config;
      }
    };

    const switchComponent = () => {
      currentComponent.value = currentComponent.value === Page ? Config : Page;
    };

    const closeModal = () => {
      if (window.parent?.postMessage) {
        window.parent.postMessage({ type: 'close' }, '*');
      }
    };

    onMounted(() => {
      window.addEventListener('message', handleMessage);
      if (window.parent?.postMessage) {
        window.parent.postMessage({ type: 'ready' }, '*');
      }
    });

    onBeforeUnmount(() => {
      window.removeEventListener('message', handleMessage);
    });

    return {
      currentComponent,
      api,
      switchComponent,
      closeModal,
    }
  },
});

const {resolveDynamicComponent:_resolveDynamicComponent,openBlock:_openBlock,createBlock:_createBlock,createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,withCtx:_withCtx} = await importShared('vue');


const _hoisted_1 = { class: "plugin-app" };

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_v_app = _resolveComponent("v-app");

  return (_openBlock(), _createBlock(_component_v_app, null, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        (_openBlock(), _createBlock(_resolveDynamicComponent(_ctx.currentComponent), {
          api: _ctx.api,
          onSwitch: _ctx.switchComponent,
          onClose: _ctx.closeModal
        }, null, 40, ["api", "onSwitch", "onClose"]))
      ])
    ]),
    _: 1
  }))
}
const App = /*#__PURE__*/_export_sfc(_sfc_main, [['render',_sfc_render]]);

const {createApp} = await importShared('vue');

createApp(App).mount('#app');
