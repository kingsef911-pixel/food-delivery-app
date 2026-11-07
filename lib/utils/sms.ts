// lib/utils/sms.ts
import axios from 'axios';

interface SmsOptions {
  phone: string;
  message: string;
}

export async function sendSemaphoreSms(
  phoneOrOptions: string | SmsOptions,
  messageText?: string
): Promise<boolean> {
  const phone = typeof phoneOrOptions === 'string' ? phoneOrOptions : phoneOrOptions.phone;
  const message = typeof phoneOrOptions === 'string' ? messageText || '' : phoneOrOptions.message;

  const apiKey = process.env.SEMAPHORE_API_KEY;
  const senderName = process.env.SEMAPHORE_SENDER_NAME || 'FoodDelivery';

  if (!apiKey || apiKey === 'your_semaphore_api_key_here') {
    console.log(`\n=================== [SIMULATED SMS] ===================`);
    console.log(`To: ${phone}`);
    console.log(`Message: ${message}`);
    console.log(`=======================================================\n`);
    return true;
  }

  try {
    await axios.post('https://api.semaphore.co/api/v4/messages', {
      apikey: apiKey,
      number: phone,
      message: message,
      sendername: senderName,
    });
    return true;
  } catch (err: any) {
    console.error('Failed to send Semaphore SMS:', err.response?.data || err.message);
    console.log(`[FALLBACK SMS] To: ${phone} | Message: ${message}`);
    return false;
  }
}