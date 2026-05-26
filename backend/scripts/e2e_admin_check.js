async function run() {
    const baseUrl = 'http://localhost:8080';
    const email = 'admin_1778738924463@example.com';
    
    console.log("Logging in as admin...");
    let res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email,
            password: 'Password123!'
        })
    });
    if(!res.ok) {
        console.error("Login failed", await res.text());
        return;
    }
    const loginData = await res.json();
    const token = loginData.accessToken;
    
    console.log("Fetching Admin Revenue Analytics...");
    res = await fetch(`${baseUrl}/api/admin/analytics/revenue`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if(!res.ok) {
        console.error("Fetch analytics failed", await res.text());
        return;
    }
    
    const analytics = await res.json();
    console.log("Analytics data:", JSON.stringify(analytics, null, 2));
}
run();
