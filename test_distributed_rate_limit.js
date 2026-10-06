const { fork } = require('child_process');
const http = require('http');
const fs = require('fs');

async function runTest() {
  console.log("Starting test...");
  
  // Configure strict rate limits specifically for this test: 5 requests per 10 seconds
  const env = { 
    ...process.env, 
    REDIS_URL: "redis://127.0.0.1:6379", 
    RATE_LIMIT_MAX: "5", 
    RATE_LIMIT_WINDOW_MS: "10000" 
  };
  
  // Spawn two isolated Node instances, mimicking a distributed load-balanced backend
  const server1 = fork('./server.js', [], { env: { ...env, PORT: 3001 } });
  const server2 = fork('./server.js', [], { env: { ...env, PORT: 3002 } });

  // Wait for Redis connection and Express listening
  await new Promise(r => setTimeout(r, 2000));

  const makeRequest = (port) => new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/api/resource`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          port,
          status: res.statusCode,
          remaining: res.headers['x-ratelimit-remaining'] || 0,
          retryAfter: res.headers['retry-after'] || null,
          body: JSON.parse(data)
        });
      });
    }).on('error', (err) => resolve({ port, error: err.message }));
  });

  const results = [];
  
  console.log("Firing 3 requests at port 3001...");
  for(let i=1; i<=3; i++) {
    const res = await makeRequest(3001);
    res.requestNumber = i;
    results.push(res);
  }

  console.log("Firing 4 requests at port 3002 (total 7. Max is 5. Should block on 6th)...");
  for(let i=4; i<=7; i++) {
    const res = await makeRequest(3002);
    res.requestNumber = i;
    results.push(res);
  }

  // Gracefully terminate the servers
  server1.kill('SIGINT');
  server2.kill('SIGINT');
  
  // Write the results out so Antigravity can format it as an Artifact
  fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
  console.log("Done.");
}

runTest().catch(console.error);
