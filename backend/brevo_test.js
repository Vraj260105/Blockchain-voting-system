require('dotenv').config();
const SibApiV3Sdk = require('@sendinblue/client');

async function testBrevo() {
  console.log('🔍 Testing Brevo Email OTP Delivery...');
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ Missing BREVO_API_KEY in .env');
    return;
  }

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject = "Test OTP from Blockchain Voting System";
  sendSmtpEmail.htmlContent = "<html><body><h1>This is a Diagnostics Test</h1><p>Your OTP is: 123456</p></body></html>";
  sendSmtpEmail.sender = { 
    name: "Blockchain Voting System", 
    email: process.env.BREVO_FROM_EMAIL || "vrajshah260105@gmail.com" 
  };
  
  // Send to the same email to test self-delivery
  sendSmtpEmail.to = [{ 
    email: process.env.BREVO_FROM_EMAIL || "vrajshah260105@gmail.com", 
    name: "Test User" 
  }];

  console.log(`📤 Attempting to send from ${sendSmtpEmail.sender.email} to ${sendSmtpEmail.to[0].email}...`);

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Brevo API Response Success! Message ID:', data.messageId);
    console.log('If you still do not see the email, please check your SPAM folder.');
  } catch (error) {
    console.error('❌ Brevo API Error Thrown!');
    if (error.response && error.response.body) {
      console.error(JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testBrevo();
