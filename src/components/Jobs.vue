<template>
   <n-form
    inline
    :label-width="80"
    >
    <n-form-item>
        <n-checkbox v-model:checked="hideComplete">Hide completed jobs</n-checkbox>
    </n-form-item>
    <n-form-item>
      <n-input v-model:value="jobLimit"/>
    </n-form-item>
    <n-form-item>
      <n-button @click="fetchJobs">Refresh</n-button>
    </n-form-item>
    <n-form-item>
      <n-switch v-model:value="autoRefresh">
        <template #checked>
          Auto-update enabled
        </template>
        <template #unchecked>
          Auto-update disabled
        </template>
      </n-switch>
    </n-form-item>
    <n-form-item>
      <span>Last refresh: {{ lastRefresh }} </span>
    </n-form-item>
  </n-form>
  <n-table striped>
    <thead>
      <tr>
        <th>Owner</th>
        <th>Repository</th>
        <th>Status</th>
        <th>Requested Size</th>
        <th>Requested Profile</th>
        <th>Queued</th>
        <th>In progress</th>
        <th>Completed</th>
        <th>Link to GitHub API</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="j in filteredJobs" v-bind:key="j.jobId">
        <td>{{ j.owner }}</td>
        <td>{{ j.repository }}</td>
        <td>{{ getJobState(j.state) }}</td>
        <td>{{ j.requestedSize }}</td>
        <td>{{ j.requestedProfile }}</td>
        <td><span class="dotted-underline" :title="j.queueTime">{{ getAge(j.queueTime) }}</span></td>
        <td><span class="dotted-underline" :title="j.inProgressTime">{{ getAge(j.inProgressTime) }}</span></td>
        <td><span class="dotted-underline" :title="j.completeTime">{{ getAge(j.completeTime) }}</span></td>
        <td><n-button text tag="a" type="primary" :href="j.jobUrl" target="_blank">{{ j.githubJobId }}</n-button></td>
      </tr>
    </tbody>
  </n-table>
</template>

<script>
import axios from 'axios';
import moment from 'moment';
import {parseJobState} from '../common'
export default {
  name: 'JobsView',
  watch: {
    autoRefresh(newVal) {
      if (newVal) {
        // Start auto-refreshing
        this.interval = setInterval(this.fetchJobs, 2000); // Fetch jobs every 2000 milliseconds (2 seconds)
      } else {
        // Stop auto-refreshing
        clearInterval(this.interval);
      }
    }
  },
  beforeUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  },
  data() {
    return {
      jobs: [],
      hideComplete: false,
      autoRefresh: false,
      lastRefresh: "N/A",
      jobLimit: 100
    };
  },
  mounted() {
    this.fetchJobs()
    
  },
  computed: {
    filteredJobs() {
      return this.jobs
        .filter(job => {
          if(this.hideComplete === true) {
            return job.state !== 3
          } else {
            return true;
          }
        });

    }
  },
  methods: {
    async fetchJobs() {
      console.info("Loading Jobs")
      let jobResp = await axios.get(process.env.VUE_APP_API_URL + '/api/get-jobs?limit=' + this.jobLimit);
      this.jobs = jobResp.data;
      this.lastRefresh = new Date().toLocaleTimeString();

    },
    getJobState(code) {
      return parseJobState(code)
    },
    getAge(ts) {
      if(ts === "0001-01-01T00:00:00") {
        return "N/A";
      } else {
        return moment(ts).fromNow();
      }
    },
  }
}
</script>
