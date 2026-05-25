const crypto = require('crypto');

async function run() {
    const baseUrl = 'http://localhost:8080';
    
    // 1. Register a test user
    const email = `testuser_${Date.now()}@example.com`;
    const phoneNumber = `098${Math.floor(1000000 + Math.random() * 9000000)}`;
    console.log("Registering user:", email, phoneNumber);
    let res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            email,
            phoneNumber,
            password: 'Password123!',
            displayName: 'Test User'
        })
    });
    if(!res.ok) {
        console.error("Register failed", await res.text());
        return;
    }
    
    // 2. Login
    console.log("Logging in...");
    res = await fetch(`${baseUrl}/api/auth/login`, {
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
    
    // 3. Create Order
    console.log("Creating Order for PRO...");
    res = await fetch(`${baseUrl}/api/payments/momo/create-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            planCode: 'PRO'
        })
    });
    if(!res.ok) {
        console.error("Create order failed", await res.text());
        return;
    }
    const orderData = await res.json();
    console.log("Order created:", orderData);
    
    const orderId = orderData.orderId;
    const amount = orderData.amount;
    
    // 4. Simulate IPN
    console.log("Simulating IPN...");
    const partnerCode = "MOMO";
    const accessKey = "F8BBA842ECF85";
    const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

    const extraData = "";
    const message = "Successful";
    const orderInfo = "DeutschFlow PRO subscription";
    const orderType = "momo_wallet";
    const payType = "qr";
    const requestId = orderId;
    const responseTime = Date.now();
    const resultCode = 0;
    const transId = "2342342342";

    const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');

    const payload = {
        partnerCode, accessKey, requestId, amount, orderId, orderInfo,
        orderType, transId, message, localMessage: "Thành công",
        responseTime, errorCode: 0, payType, extraData, signature, resultCode
    };

    res = await fetch(`${baseUrl}/api/payments/momo/ipn`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    console.log("IPN response status:", res.status);
    
    // 5. Check if user plan is PRO
    console.log("Checking User Plan...");
    res = await fetch(`${baseUrl}/api/auth/me/plan`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const planData = await res.json();
    console.log("User Plan:", planData);
}
run();
