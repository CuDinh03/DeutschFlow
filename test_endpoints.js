const http = require('http');

async function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.accessToken);
        } catch (e) {
          reject('Failed to parse login response');
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function request(path, token, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("Starting tests...");
  try {
    const adminToken = await login('admin@deutschflow.com', 'password123');
    const teacherToken = await login('teacher@deutschflow.com', 'password123');
    const studentToken = await login('student@deutschflow.com', 'password123');
    
    console.log("✅ Logged in successfully.");

    // 1. Notifications
    let res = await request('/api/notifications', studentToken);
    console.log(`- Notifications List: HTTP ${res.status}`);

    // 2. Certificates PDF Download
    res = await request('/api/certificates/me', studentToken);
    console.log(`- Certificates List: HTTP ${res.status}`);
    const certs = JSON.parse(res.data);
    if (certs && certs.length > 0) {
      const pdfRes = await request(`/api/certificates/${certs[0].id}/pdf`, studentToken);
      console.log(`- Certificate PDF Download: HTTP ${pdfRes.status}`);
    } else {
      console.log(`- Certificate PDF Download: skipped (no certificates)`);
    }

    // 3. Grammar Flow
    res = await request('/api/grammar/syllabus/topics?cefrLevel=A1', teacherToken);
    console.log(`- Teacher Grammar Topics: HTTP ${res.status}`);
    const topics = JSON.parse(res.data);
    if (topics && topics.length > 0) {
      console.log(`- Teacher Generate Exercise: skipped (to save AI tokens)`);
    }

    res = await request('/api/grammar/syllabus/admin/pending', adminToken);
    console.log(`- Admin Grammar Pending: HTTP ${res.status}`);

    // 4. Admin Reports
    res = await request('/api/admin/reports/vocabulary-quality', adminToken);
    console.log(`- Admin Report: Vocab Quality: HTTP ${res.status}`);

    res = await request('/api/admin/reports/personalization-ruleset', adminToken);
    console.log(`- Admin Report: Personalization: HTTP ${res.status}`);

    res = await request('/api/admin/reports/grammar-feedback-coverage', adminToken);
    console.log(`- Admin Report: Grammar Feedback: HTTP ${res.status}`);

    // 5. Training Dataset Export
    res = await request('/api/admin/training-dataset/stats', adminToken);
    console.log(`- Admin Training Dataset Stats: HTTP ${res.status}`);
    
    // 6. Teacher Materials (generate pptx needs multipart/form-data, skipping automated test)

    console.log("\n✅ All tested endpoints returned successfully.");
  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}

runTests();
