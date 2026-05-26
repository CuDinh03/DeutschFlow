const crypto = require('crypto');

const partnerCode = "MOMO";
const accessKey = "F8BBA842ECF85";
const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

const orderId = "MOMO_TEST_" + Date.now();
const amount = 699000;
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
    partnerCode,
    accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    orderType,
    transId,
    message,
    localMessage: "Thành công",
    responseTime,
    errorCode: 0,
    payType,
    extraData,
    signature,
    resultCode
};

console.log(JSON.stringify(payload, null, 2));
