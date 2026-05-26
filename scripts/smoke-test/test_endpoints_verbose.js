const http = require('http');

async function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { resolve(JSON.parse(body).accessToken); });
    });
    req.write(data); req.end();
  });
}

async function request(path, token) {
  return new Promise((resolve) => {
    http.request({
      hostname: 'localhost', port: 8080, path, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).end();
  });
}

async function run() {
  const tAdmin = await login('admin@deutschflow.com', 'password123');
  const res1 = await request('/api/admin/management/reports/vocabulary-quality', tAdmin);
  console.log('Vocab Quality:', res1.status, res1.data.slice(0, 100));
}
run();
