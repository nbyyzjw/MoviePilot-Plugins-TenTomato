<template>
  <v-app>
    <div class="plugin-app">
      <component
        :is="currentComponent"
        :api="api"
        @switch="switchComponent"
        @close="closeModal"
      />
    </div>
  </v-app>
</template>

<script>
import { defineComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import Page from './components/Page.vue'
import Config from './components/Config.vue'

export default defineComponent({
  name: 'VarietySpecialMapperApp',
  setup() {
    const currentComponent = shallowRef(Page)
    const api = ref(null)

    const handleMessage = (event) => {
      if (event.data?.type === 'api') {
        api.value = event.data.data
      }
      if (event.data?.type === 'showConfig') {
        currentComponent.value = Config
      }
    }

    const switchComponent = () => {
      currentComponent.value = currentComponent.value === Page ? Config : Page
    }

    const closeModal = () => {
      if (window.parent?.postMessage) {
        window.parent.postMessage({ type: 'close' }, '*')
      }
    }

    onMounted(() => {
      window.addEventListener('message', handleMessage)
      if (window.parent?.postMessage) {
        window.parent.postMessage({ type: 'ready' }, '*')
      }
    })

    onBeforeUnmount(() => {
      window.removeEventListener('message', handleMessage)
    })

    return {
      currentComponent,
      api,
      switchComponent,
      closeModal,
    }
  },
})
</script>

<style>
.plugin-app {
  width: 100%;
  min-height: 100%;
}
</style>
