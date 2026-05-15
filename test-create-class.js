const axios = require('axios');
async function test() {
  try {
    const login = await axios.post('http://localhost:8080/api/auth/login', {
      email: 'teacher@deutschflow.com',
      password: 'password123'
    });
    const token = login.data.accessToken;
    console.log("Logged in, token:", token.substring(0, 20) + "...");
    
    const res = await axios.post('http://localhost:8080/api/v2/teacher/classes', {
      name: "Test Class from Script"
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Success:", res.data);
  } catch (e) {
    console.error("Error:", e.response?.status, e.response?.data);
  }
}
test();
