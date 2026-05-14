async function run() {
    const baseUrl = 'http://localhost:8080';
    
    // 1. Register admin user
    const email = `admin_${Date.now()}@example.com`;
    const phoneNumber = `099${Math.floor(1000000 + Math.random() * 9000000)}`;
    console.log("Registering admin user:", email);
    let res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email,
            phoneNumber,
            password: 'Password123!',
            displayName: 'Admin User'
        })
    });
    if(!res.ok) {
        console.error("Register failed", await res.text());
        return;
    }
    
    // Output email for bash script to use
    console.log(`ADMIN_EMAIL=${email}`);
}
run();
