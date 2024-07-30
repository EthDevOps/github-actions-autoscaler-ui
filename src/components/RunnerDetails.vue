<template>
  <h3>Runner Details</h3>
    <n-table>
      <tr>
        <th>Hostname</th><td>{{ getStatusIcon(runner.isOnline) }} {{ runner.hostname }}</td>
        <th>Status</th><td>{{ getRunnerState(runner.lastState) }}</td>
      </tr>
      <tr>
        <th>IPv4 Address</th><td>{{ runner.iPv4 }}</td>
        <th>Cloud Provider</th><td>{{ runner.cloud }}</td>
      </tr>
      <tr>
        <th>Size</th><td>{{ runner.size }}</td>
        <th>Profile</th><td>{{ runner.profile }}</td>
      </tr>
      <tr>
        <th>Created</th><td><span class="dotted-underline" :title="runner.lifecycle[0].eventTimeUtc">{{ getTimeSince(runner.lifecycle[0].eventTimeUtc) }}</span></td>
        <th>Last State Update</th><td><span class="dotted-underline" :title="runner.lifecycle[runner.lifecycle.length-1].eventTimeUtc">{{ getTimeSince(runner.lifecycle[runner.lifecycle.length-1].eventTimeUtc) }}</span></td>
      </tr>
    </n-table>



  <h3>Job Details</h3>
  <div v-if="runner.job">
    <n-table>
      <tr>
        <th>Repository</th><td><n-button text tag="a" type="primary" :href="'https://github.com/' + runner.job.repository" target="_blank">{{ runner.job.repository}}</n-button></td>
        <th>Status</th><td>{{ getJobState(runner.job.state)}}</td>
      </tr>
      <tr v-if="ghLoaded">
        <th>GitHub Workflow</th><td><n-button text tag="a" type="primary" :href="githubJob.html_url" target="_blank">{{ githubJob.workflow_name}} => {{ githubJob.name }}</n-button></td>
        <th>GitHub Status</th><td>{{ githubJob.status }} [{{ githubJob.conclusion}}]</td>
      </tr>
      <tr v-if="ghLoaded">
        <th>Labels</th><td>
          <ul v-for="l in githubJob.labels" v-bind:key="l">
            <li>{{ l }}</li>
          </ul>
        </td>
        <th>Branch/Ref</th><td>{{ githubJob.head_branch }} [<n-button text tag="a" type="primary" :href="getCommitUrl(githubJob.head_sha, runner.job.repository)" target="_blank"><code>{{ githubJob.head_sha}}</code></n-button>]</td>
      </tr>
      <tr v-else>
        <td colSpan=2>Loading GitHub job...</td>
      </tr>
    </n-table>
  </div>
  <div v-else>
    No Job assigned jet.
  </div>
  
  <h3>Runner Timeline</h3>
  <n-table striped>
    <thead>
      <tr>
        <th>Event Time</th>
        <th>Status</th>
        <th>Event</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="event in runner.lifecycle" :key="event.runnerLifecycleId">
        <td><span class="dotted-underline" :title="event.eventTimeUtc" >{{ getEventTime(event.eventTimeUtc) }}</span></td>
        <td>{{ getRunnerState(event.status)}}</td>
        <td>{{ event.event }}</td>
      </tr>
    </tbody>
  </n-table>
</template>
<script>
  import {parseRunnerState, parseJobState} from '../common';
  import moment from 'moment';
  import axios from 'axios'; 
  export default {
    name: 'RunnerDetails',
    data() {
      return {
        ghLoaded: false,
        githubJob: {}
      }
    },
    mounted() {
      if(this.runner.job) {
        this.loadGitHubjob()
      }
    },
    props: {
      runner: Object
    },
    computed: {

    },
    methods: {
      getRunnerState(statusCode) {
        return parseRunnerState(statusCode)
      },
      getTimeSince(timestamp) {
        return moment(timestamp).fromNow();
      },
      getJobState(code) {
        return parseJobState(code)
      },
      getCommitUrl(sha, repo) {
        return "https://github.com/" + repo + "/commit/" + sha
      },
      getStatusIcon(isOnline) {
        return isOnline ? "🟢" : "🔴";
      },
      getEventTime(eventTime) {

        if(eventTime === this.runner.lifecycle[0].eventTimeUtc) {
          return new moment(eventTime).format("HH:mm:ss")
        } else {
          var x = new moment(this.runner.lifecycle[0].eventTimeUtc)
          var y = new moment(eventTime)
          var duration = moment.duration(x.diff(y));
          return duration.humanize();
        }
      },
      async loadGitHubjob() {

        try {
          let resp = await axios.get(this.runner.job.jobUrl);
          this.githubJob = resp.data;
          this.ghLoaded = true;
        }
        catch {
          console.log("unable to query github")
        }
      }
    }
  }

</script>
