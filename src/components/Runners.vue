<template>
  <div>
    <h1>Runners Overview</h1>
    <div>
      <p>Search for runner: <input type="text" v-model="searchRunner" placeholder="runner name" /></p>
      <p><input type="checkbox" v-model.lazy="searchOnlyOnline" id="online"/><label for="online">Show only online runners</label></p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Hostname</th>
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
          <td>{{ getRunnerJobState(runner)}}</td>
          <td><a :href="'https://github.com/' + runner.owner" target="_blank">{{ runner.owner }}</a></td>
          <td>{{ runner.size }}</td>
          <td><code>{{ runner.iPv4 }}</code></td>
          <td>{{ runner.cloud }}</td>
          <td>{{ runner.profile }}</td>
          <td>{{ getRunnerState(runner.lastState) }}</td>
          <td>
            <button @click="toggleDetails(runner.runnerId, runner.jobId)">Toggle Details</button>
          </td>
        </tr>
        <!-- Job details -->
        <!-- Timeline details -->
        <tr v-if="visibleRunners.includes(runner.runnerId)">
          <td colSpan="4" style="vertical-align: top;">
            <div>
              <h4>Runner Timeline</h4>
              <table>
                <thead>
                  <tr>
                    <th>Event Time</th>
                    <th>Status</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="event in runner.lifecycle" :key="event.runnerLifecycleId">
                    <td>{{ event.eventTimeUtc }}</td>
                    <td>{{ getRunnerState(event.status)}}</td>
                    <td>{{ event.event }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
          <td colSpan="5" style="vertical-align: top;">
            <div>
              <h4>Job Details</h4>
              <div v-if="runner.job">
                <table>
                  <tr>
                    <th>Repository</th><td><a :href="'https://github.com/' + runner.job.db.repository" target="_blank">{{ runner.job.db.repository}}</a></td>
                    <th>Status</th><td>{{ getJobState(runner.job.db.state)}}</td>
                  </tr>
                  <tr>
                    <th>GitHub Workflow</th><td><a :href="runner.job.gh.html_url" target="_blank">{{ runner.job.gh.workflow_name}} => {{ runner.job.gh.name }}</a></td>
                    <th>GitHub Status</th><td>{{ runner.job.gh.status }} [{{ runner.job.gh.conclusion}}]</td>
                  </tr>
                  <tr>
                    <th>Labels</th><td>
                      <ul v-for="l in runner.job.gh.labels" v-bind:key="l">
                        <li>{{ l }}</li>
                      </ul>
                    </td>
                    <th>Branch/Ref</th><td>{{ runner.job.gh.head_branch }} [<a :href="getCommitUrl(runner.job.gh.head_sha, runner.job.db.repository)" target="_blank"><code>{{ runner.job.gh.head_sha}}</code></a>]</td>
                  </tr>
                </table>
              </div>
              <div v-else>
                No Job assigned jet.
              </div>
            </div>
          </td>
        </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'RunnersView',
  data() {
    return {
      runners: [],
      visibleRunners: [],
      jobs: [],
      searchRunner: "",
      searchOnlyOnline: false
    };
  },
  mounted() {
    this.fetchRunners();
    setInterval(this.fetchRunners, 10000);
  },
  computed: {
    sortedRunners() {
      console.log("Triggered compute")
      return this.runners
        .filter(runner => {
          if(this.searchOnlyOnline === true) {
            return runner.isOnline && runner.hostname.includes(this.searchRunner)
          } else {
            return runner.hostname.includes(this.searchRunner)
          }
        })
        .map(runner => ({
        ...runner,
        lifecycle: runner.lifecycle.slice().sort((a, b) => new Date(a.eventTimeUtc) - new Date(b.eventTimeUtc)),
        job: this.jobs.find(j => j.runnerId === runner.runnerId)
      }));
    }
  },
  methods: {
    getRunnerJobState(runner) {
      if(runner.jobId) {
        if(runner.job) {
          return this.getJobState(runner.job.db.state); 
        }
        else {
          return "welp"
        }
      }
      else {
        return "🔎 No job assigned";
      }
    },
    getCommitUrl(sha, repo) {
      return "https://github.com/" + repo + "/commit/" + sha
    },
    getStatusIcon(isOnline) {
      return isOnline ? "🟢" : "🔴";
    },
    getRunnerState(statusCode) {
      const RunnerStatus = {
        0: "Unknown",
        1: "🏗️ Creation queued",
        2: "🏗️ Created",
        3: "✅ Provisioned",
        4: "⏳ Processing",
        5: "💣 Deletion queued",
        6: "🪦  Deleted",
        7: "⚠️  Failure",
        8: "VanishedOnCloud",
        9: "🧹 Cleanup"
      };
      if (Object.prototype.hasOwnProperty.call(RunnerStatus, statusCode)) {
        return RunnerStatus[statusCode];
      }
      return "Unknown";  // Default case if status code is not found

    },
    getJobState(statusCode) {
      const JobState = {
        0: "Unknown",
        1: "⏸️  Queued",
        2: "▶️  In Progress",
        3: "✅ Completed"
      };
      if (Object.prototype.hasOwnProperty.call(JobState, statusCode)) {
        return JobState[statusCode];
      }
      return "Unknown";  // Default case if status code is not found

    },
    async fetchRunners() {
      let runnerResp = await axios.get(process.env.VUE_APP_API_URL + '/api/get-runners');
      this.runners = runnerResp.data;

      // Fetch job infos
      for(var r of this.runners) {
        if(r.jobId) {
          let loadGh = this.visibleRunners.includes(r.runnerId)
          await this.fetchJob(r.jobId, r.runnerId, loadGh)
        }
      }
          
    },
    async fetchJob(jobid,runnerid, withGithub) {
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

      if(withGithub)  {
        try {
        let resp = await axios.get(jobDb.data.jobUrl);
        let j = this.jobs.find(j => j.runnerId === runnerid);
        j['gh'] = resp.data;
        }
        catch {
          console.log("unable to query github")
        }
      }
          

    },
    toggleDetails(id,jobid) {
      const index = this.visibleRunners.indexOf(id);
      if (index > -1) {
        this.visibleRunners.splice(index, 1);
      } else {
        this.fetchJob(jobid,id,true)
        this.visibleRunners.push(id);
      }
    }
  }
}
</script>

<style>
table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border: 1px solid #6EACDA;
  padding: 8px;
  text-align: left;
}

button {
  margin: 10px 0;
}
</style>

