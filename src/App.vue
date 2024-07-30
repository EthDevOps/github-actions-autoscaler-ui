<template>
<n-config-provider :theme="darkTheme">

  <n-card title="Github Actions Runners UI" style="margin-bottom: 16px">
    <n-tabs type="line" animated>
      <n-tab-pane name="runners" tab="Show Runners">
        <RunnersView/>
      </n-tab-pane>
      <n-tab-pane name="jobs" tab="Show Jobs">
        <JobsView/>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</n-config-provider>
</template>

<script>
  import { darkTheme } from 'naive-ui'
  import RunnersView from './components/Runners.vue'
  import JobsView from './components/Jobs.vue'

  export default {
    name: 'App',
    components: {
      RunnersView,
      JobsView
    },
      setup() {
        return {
          darkTheme
        }
      }
  }
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;


}
</style>
