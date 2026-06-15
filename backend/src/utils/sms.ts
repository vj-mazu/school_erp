export interface SmsPayload {
  mobile: string;
  message: string;
}

export async function sendSms(mobile: string, message: string): Promise<boolean> {
  // Integration stub for MSG91
  console.log(`[SMS SEND] to ${mobile}: "${message}"`);
  return true;
}

export async function sendWhatsApp(mobile: string, message: string): Promise<boolean> {
  // Integration stub for WhatsApp business
  console.log(`[WhatsApp SEND] to ${mobile}: "${message}"`);
  return true;
}
