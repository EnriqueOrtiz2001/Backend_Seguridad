const crypto = require('crypto');

// Constantes AES
const BLOCK_SIZE = 16; // 128 bits
const IV_LENGTH = 16;
const ROUNDS = 14; // 14 rondas para AES-256
const KEY_SCHEDULE_SIZE = 240; // 15 bloques de 16 bytes (14 rondas + clave inicial)

// S-box y Rcon (tablas precalculadas esenciales para AES)
const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

const RCON = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a
];

// Funciones auxiliares
function subWord(word) {
    return [
        SBOX[word[0]],
        SBOX[word[1]],
        SBOX[word[2]],
        SBOX[word[3]]
    ];
}

function rotWord(word) {
    return [word[1], word[2], word[3], word[0]];
}

function expandKey(key) {
    const expandedKey = new Uint8Array(KEY_SCHEDULE_SIZE);
    const keyBytes = new Uint8Array(key);
    
    // Copiar clave original
    for (let i = 0; i < 32; i++) {
        expandedKey[i] = keyBytes[i];
    }
    
    let rconIndex = 0;
    
    for (let i = 32; i < KEY_SCHEDULE_SIZE; i += 4) {
        let temp = expandedKey.slice(i - 4, i);
        
        if ((i % 32) === 0) {
            temp = subWord(rotWord(temp));
            temp[0] ^= RCON[rconIndex++];
        } else if (i > 32 && (i % 32) === 16) {
            temp = subWord(temp);
        }
        
        for (let j = 0; j < 4; j++) {
            expandedKey[i + j] = expandedKey[i - 32 + j] ^ temp[j];
        }
    }
    
    return expandedKey;
}

// Operaciones AES
function addRoundKey(state, roundKey) {
    for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i];
    }
}

function subBytes(state) {
    for (let i = 0; i < 16; i++) {
        state[i] = SBOX[state[i]];
    }
}

function invSubBytes(state) {
    for (let i = 0; i < 16; i++) {
        const index = SBOX.indexOf(state[i]);
        state[i] = index !== -1 ? index : state[i];
    }
}

function shiftRows(state) {
    // Fila 1: no shift
    // Fila 2: shift 1
    let temp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = temp;
    
    // Fila 3: shift 2
    temp = state[2];
    state[2] = state[10];
    state[10] = temp;
    temp = state[6];
    state[6] = state[14];
    state[14] = temp;
    
    // Fila 4: shift 3
    temp = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = temp;
}

function invShiftRows(state) {
    // Fila 1: no shift
    // Fila 2: inv shift 1
    let temp = state[13];
    state[13] = state[9];
    state[9] = state[5];
    state[5] = state[1];
    state[1] = temp;
    
    // Fila 3: inv shift 2
    temp = state[2];
    state[2] = state[10];
    state[10] = temp;
    temp = state[6];
    state[6] = state[14];
    state[14] = temp;
    
    // Fila 4: inv shift 3
    temp = state[3];
    state[3] = state[7];
    state[7] = state[11];
    state[11] = state[15];
    state[15] = temp;
}

function gfMultiply(a, b) {
    let product = 0;
    for (let i = 0; i < 8; i++) {
        if (b & 1) product ^= a;
        const hiBit = a & 0x80;
        a <<= 1;
        if (hiBit) a ^= 0x1b; // Polinomio irreducible
        b >>= 1;
    }
    return product & 0xff;
}

function mixColumns(state) {
    for (let i = 0; i < 4; i++) {
        const col = state.slice(i * 4, i * 4 + 4);
        
        state[i * 4]     = gfMultiply(0x02, col[0]) ^ gfMultiply(0x03, col[1]) ^ col[2] ^ col[3];
        state[i * 4 + 1] = col[0] ^ gfMultiply(0x02, col[1]) ^ gfMultiply(0x03, col[2]) ^ col[3];
        state[i * 4 + 2] = col[0] ^ col[1] ^ gfMultiply(0x02, col[2]) ^ gfMultiply(0x03, col[3]);
        state[i * 4 + 3] = gfMultiply(0x03, col[0]) ^ col[1] ^ col[2] ^ gfMultiply(0x02, col[3]);
    }
}

function invMixColumns(state) {
    for (let i = 0; i < 4; i++) {
        const col = state.slice(i * 4, i * 4 + 4);
        
        state[i * 4]     = gfMultiply(0x0e, col[0]) ^ gfMultiply(0x0b, col[1]) ^ gfMultiply(0x0d, col[2]) ^ gfMultiply(0x09, col[3]);
        state[i * 4 + 1] = gfMultiply(0x09, col[0]) ^ gfMultiply(0x0e, col[1]) ^ gfMultiply(0x0b, col[2]) ^ gfMultiply(0x0d, col[3]);
        state[i * 4 + 2] = gfMultiply(0x0d, col[0]) ^ gfMultiply(0x09, col[1]) ^ gfMultiply(0x0e, col[2]) ^ gfMultiply(0x0b, col[3]);
        state[i * 4 + 3] = gfMultiply(0x0b, col[0]) ^ gfMultiply(0x0d, col[1]) ^ gfMultiply(0x09, col[2]) ^ gfMultiply(0x0e, col[3]);
    }
}

function aesEncryptBlock(block, keySchedule) {
    const state = new Uint8Array(block);
    
    // Ronda inicial
    addRoundKey(state, keySchedule.slice(0, 16));
    
    // 14 rondas principales
    for (let round = 1; round < ROUNDS; round++) {
        subBytes(state);
        shiftRows(state);
        mixColumns(state);
        addRoundKey(state, keySchedule.slice(round * 16, (round + 1) * 16));
    }
    
    // Ronda final (sin MixColumns)
    subBytes(state);
    shiftRows(state);
    addRoundKey(state, keySchedule.slice(ROUNDS * 16, (ROUNDS + 1) * 16));
    
    return state;
}

function aesDecryptBlock(block, keySchedule) {
    const state = new Uint8Array(block);
    
    // Ronda inicial
    addRoundKey(state, keySchedule.slice(ROUNDS * 16, (ROUNDS + 1) * 16));
    
    // 14 rondas principales
    for (let round = ROUNDS - 1; round >= 1; round--) {
        invShiftRows(state);
        invSubBytes(state);
        addRoundKey(state, keySchedule.slice(round * 16, (round + 1) * 16));
        invMixColumns(state);
    }
    
    // Ronda final (sin InvMixColumns)
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, keySchedule.slice(0, 16));
    
    return state;
}

// Padding PKCS7
function padPKCS7(data) {
    const paddingLength = BLOCK_SIZE - (data.length % BLOCK_SIZE);
    const padded = Buffer.alloc(data.length + paddingLength);
    padded.set(data);
    padded.fill(paddingLength, data.length);
    return padded;
}

function unpadPKCS7(data) {
    const paddingLength = data[data.length - 1];
    return data.slice(0, data.length - paddingLength);
}

// Funciones principales de encriptación/desencriptación
function encrypt(text, secretKey) {
    if (!secretKey || secretKey.length !== 64) {
        throw new Error('La clave secreta debe tener 64 caracteres hex (32 bytes)');
    }
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(secretKey, 'hex');
    const keySchedule = expandKey(key);
    const paddedData = padPKCS7(Buffer.from(text, 'utf8'));
    const encrypted = Buffer.alloc(paddedData.length);
    
    let previousBlock = iv;
    
    for (let i = 0; i < paddedData.length; i += BLOCK_SIZE) {
        const block = paddedData.slice(i, i + BLOCK_SIZE);
        
        // XOR con el bloque anterior (CBC)
        for (let j = 0; j < BLOCK_SIZE; j++) {
            block[j] ^= previousBlock[j];
        }
        
        const encryptedBlock = aesEncryptBlock(block, keySchedule);
        encrypted.set(encryptedBlock, i);
        previousBlock = encryptedBlock;
    }
    
    return {
        iv: iv,
        content: encrypted
    };
}

function decrypt(encryptedData, secretKey) {
    if (!secretKey || secretKey.length !== 64) {
        throw new Error('La clave secreta debe tener 64 caracteres hex (32 bytes)');
    }
    
    const iv = Buffer.isBuffer(encryptedData.iv) ? 
        encryptedData.iv : 
        Buffer.from(encryptedData.iv);
    
    const encrypted = Buffer.isBuffer(encryptedData.content) ? 
        encryptedData.content : 
        Buffer.from(encryptedData.content);
    
    const key = Buffer.from(secretKey, 'hex');
    const keySchedule = expandKey(key);
    const decrypted = Buffer.alloc(encrypted.length);
    
    let previousBlock = iv;
    
    for (let i = 0; i < encrypted.length; i += BLOCK_SIZE) {
        const block = encrypted.slice(i, i + BLOCK_SIZE);
        const decryptedBlock = aesDecryptBlock(block, keySchedule);
        
        // XOR con el bloque anterior (CBC)
        for (let j = 0; j < BLOCK_SIZE; j++) {
            decryptedBlock[j] ^= previousBlock[j];
        }
        
        decrypted.set(decryptedBlock, i);
        previousBlock = block;
    }
    
    const unpadded = unpadPKCS7(decrypted);
    return unpadded.toString('utf8');
}

module.exports = {
    encrypt,
    decrypt
};
