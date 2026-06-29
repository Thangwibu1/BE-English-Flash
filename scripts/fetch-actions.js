const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/Thangwibu1/Eng-Mobile/actions/runs/28345945195/jobs',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.jobs && json.jobs.length > 0) {
        const job = json.jobs[0];
        console.log(`Job Name: ${job.name}`);
        console.log(`Status: ${job.status}`);
        console.log(`Conclusion: ${job.conclusion}`);
        console.log(`Steps info:`);
        job.steps.forEach(step => {
          console.log(`  Step: "${step.name}" -> Status: ${step.status}, Conclusion: ${step.conclusion}`);
        });
      } else {
        console.log('No jobs found.');
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
