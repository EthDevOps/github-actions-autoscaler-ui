<template>
   <n-form
    inline
    :label-width="80"
    >
    <n-form-item>
        <n-checkbox v-model:checked="hideComplete">Hide completed jobs</n-checkbox>
    </n-form-item>
    <n-form-item>
      <n-button @click="fetchJobs">Refresh</n-button>
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
      </tr>
    </thead>
    <tbody>
      <tr v-for="j in filteredJobs" v-bind:key="j.jobId">
        <td>{{ j.owner }}</td>
        <td>{{ j.repository }}</td>
        <td>{{ getJobState(j.state) }}</td>
        <td>{{ j.requestedSize }}</td>
        <td>{{ j.requestedProfile }}</td>
        <td>{{ j.queueTime }}</td>
        <td>{{ j.inProgressTime }}</td>
        <td>{{ j.completeTime }}</td>
      </tr>
    </tbody>
  </n-table>
</template>

<script>
import axios from 'axios';
import {parseJobState} from '../common'
export default {
  name: 'RunnersView',
  data() {
    return {
      jobs: [],
      hideComplete: false
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
      let jobResp = await axios.get(process.env.VUE_APP_API_URL + '/api/get-jobs');
      this.jobs = jobResp.data;

    },
    getJobState(code) {
      return parseJobState(code)
    },
  }
}
</script>
