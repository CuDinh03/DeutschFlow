const crypto = require('crypto');

async function run() {
    const partnerCode = "MOMOLRJZ20181206";
    const accessKey = "mTCKt9W3eU1m39TW";
    const secretKey = "SetA5RDnLHvt51AULf51DyauxUo3kDU6";
    
    const amount = 299000;
    const orderId = "MOMOLRJZ20181206_0077E9A321554B08"; // orderId from subagent

    const extraData = "";
    const message = "Successful";
    const orderInfo = "DeutschFlow PRO subscription";
    const orderType = "momo_wallet";
    const payType = "qr";
    const requestId = orderId;
    const responseTime = Date.now();
    const resultCode = 0;
    const transId = "99887766554433";

    const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');

    const payload = {
        partnerCode, accessKey, requestId, amount, orderId, orderInfo,
        orderType, transId, message, localMessage: "Thành công",
        responseTime, errorCode: 0, payType, extraData, signature, resultCode
    };

    console.log("Sending IPN to production API...");
    const res = await fetch(`https://api.mydeutschflow.com/api/payments/momo/ipn`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    console.log("IPN response status:", res.status);
    if (!res.ok) {
        console.log("Error details:", await res.text());
    }
}
run();
