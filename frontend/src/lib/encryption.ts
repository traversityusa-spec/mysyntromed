const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Helper to convert Uint8Array to base64 string safely
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 string to Uint8Array safely
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return uint8ArrayToBase64(new Uint8Array(exported));
}

async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = base64ToUint8Array(keyString);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptMessage(plaintext: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return {
    encrypted: uint8ArrayToBase64(new Uint8Array(encrypted)),
    iv: uint8ArrayToBase64(iv),
  };
}

async function decryptMessage(encrypted: string, iv: string, key: CryptoKey): Promise<string> {
  const encryptedData = base64ToUint8Array(encrypted);
  const ivData = base64ToUint8Array(iv);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivData },
    key,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export const encryption = {
  generateKey,
  exportKey,
  importKey,
  encryptMessage,
  decryptMessage,
  
  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt']
    );
    
    const publicKeyExported = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyExported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    
    return {
      publicKey: uint8ArrayToBase64(new Uint8Array(publicKeyExported)),
      privateKey: uint8ArrayToBase64(new Uint8Array(privateKeyExported)),
    };
  },
  
  async encryptWithPublicKey(plaintext: string, publicKeyString: string): Promise<string> {
    const publicKeyData = base64ToUint8Array(publicKeyString);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyData,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data);
    
    return uint8ArrayToBase64(new Uint8Array(encrypted));
  },
  
  async decryptWithPrivateKey(encrypted: string, privateKeyString: string): Promise<string> {
    const privateKeyData = base64ToUint8Array(privateKeyString);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyData,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
    
    const encryptedData = base64ToUint8Array(encrypted);
    const decrypted = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedData);
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  },
};

