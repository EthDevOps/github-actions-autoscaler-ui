<template>
  <div>
    <n-form
      inline
      :label-width="80"
      >
      <n-form-item>
          <n-checkbox v-model:checked="searchOnlyOnline">Show only online Runners</n-checkbox>
      </n-form-item>
      <n-form-item>
          <n-input v-model:value="searchRunner" placeholder="Enter runner name"/>
      </n-form-item>
      <n-form-item>
        <n-button @click="fetchrunners">Refresh</n-button>
      </n-form-item>
    </n-form>
    <n-drawer v-model:show="show" :width="'60%'">
      <n-drawer-content :title="'Runner Details for ' + this.selectedRunner.hostname" closable>
        <RunnerDetails :runner="selectedRunner" />
      </n-drawer-content>
    </n-drawer>
    <n-table striped>
      <thead>
        <tr>
          <th>Hostname</th>
          <th>Created</th>
          <th>Job</th>
          <th>Owner</th>
          <th>Size</th>
          <th>IP Address</th>
          <th>Cloud</th>
          <th>Profile</th>
          <th>Last State</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="runner in sortedRunners" :key="runner.runnerId">
        <tr>
          <td>{{ getStatusIcon(runner.isOnline)}} <a target="_blank" title="Show monitoring" :href="'https://grafana.ethquokkaops.io/d/rYdddlPWk/node-exporter-full?orgId=1&var-DS_PROMETHEUS=default&var-job=integrations%2Fnode_exporter&var-node='+ runner.hostname +':9090'">📈</a> {{ runner.hostname }}</td>
          <td><span class="dotted-underline" :title="runner.lifecycle[0].eventTimeUtc">{{ getAge(runner.lifecycle[0].eventTimeUtc) }}</span></td>
          <td>{{ getRunnerJobState(runner)}}</td>
          <td><n-button text tag="a" type="primary" :href="'https://github.com/' + runner.owner" target="_blank">{{ runner.owner }}</n-button></td>
          <td>{{ runner.size }}</td>
          <td><code>{{ runner.iPv4 }}</code></td>
          <td>{{ runner.cloud }}</td>
          <td>{{ runner.profile }}</td>
          <td>{{ getRunnerState(runner.lastState) }}</td>
          <td>
            <n-button type="primary" @click="toggleDetails(runner.runnerId, runner.jobId)">Show Details</n-button>
          </td>
        </tr>
        </template>
      </tbody>
    </n-table>
  </div>
</template>

<script>
import {parseRunnerState, parseJobState} from '../common'
import RunnerDetails from './RunnerDetails'
import axios from 'axios';
import moment from 'moment';
import { ref } from 'vue';

export default {
  name: 'RunnersView',
  components: {
    RunnerDetails
  },
  data() {
    return {
      runners: [],
      jobs: [],
      searchRunner: "",
      searchOnlyOnline: false,
      selectedRunner: {}
    };
  },
  setup() {
    return {
      show: ref(false)
    }
  },
  mounted() {
    this.fetchRunners();
    setInterval(this.fetchRunners, 10000);
  },
  computed: {
    sortedRunners() {
      return this.runners
        .filter(runner => {
          if(this.searchOnlyOnline === true) {
            return runner.isOnline && runner.hostname.includes(this.searchRunner)
          } else {
            return runner.hostname.includes(this.searchRunner)
          }
        });
    }
  },
  methods: {
    getRunnerJobState(runner) {
      if(runner.job) {
        return this.getJobState(runner.job.state); 
      }
      else {
        return "🔎 No job assigned";
      }
    },
    getAge(timestamp) {
      return moment(timestamp).fromNow();
    },
    getStatusIcon(isOnline) {
      return isOnline ? "🟢" : "🔴";
    },
    getRunnerState(statusCode) {
      return parseRunnerState(statusCode)
    },
    getJobState(code) {
      return parseJobState(code)
    },
    async fetchRunners() {
      let runnerResp = await axios.get(process.env.VUE_APP_API_URL + '/api/get-runners');
      this.runners = runnerResp.data.map(runner => ({
        ...runner,
        lifecycle: runner.lifecycle.slice().sort((a, b) => new Date(a.eventTimeUtc) - new Date(b.eventTimeUtc)),
      }));

    },
    async fetchJob(jobid,runnerid) {
      if(!jobid) { return }
      let jobDb = await axios.get(process.env.VUE_APP_API_URL + '/api/get-job/'+jobid);

      const index = this.jobs.findIndex(job => job.runnerId === runnerid);

      if (index !== -1) {
          this.jobs.splice(index, 1);
      }

      this.jobs.push({
        runnerId: runnerid,
        db: jobDb.data,
        gh: {}
      })
    },
    toggleDetails(id) {
      this.selectedRunner = this.runners.find(x => x.runnerId === id);
      this.show = true
    }
  }
}
</script>

