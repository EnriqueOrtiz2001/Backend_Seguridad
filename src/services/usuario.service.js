const { getConnection, sql } = require('../config/Conecction_SQL_Server');
const { encrypt, decrypt } = require('../utils/crypto');
const crypto = require('crypto');

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY || SECRET_KEY.length !== 64) {
    throw new Error('SECRET_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes)');
}

// Función para hashear contraseñas (más seguro que encriptar)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function createUser(userData) {
    const pool = await getConnection();
    
    // Encriptar cada campo con su propio IV
    const encCedula = encrypt(userData.cedula, SECRET_KEY);
    const encDireccion = encrypt(userData.direccion, SECRET_KEY);
    const encNombre = encrypt(userData.nombre, SECRET_KEY);
    const encApellido = encrypt(userData.apellido, SECRET_KEY);
    const encCorreo = encrypt(userData.correo, SECRET_KEY);
    
    // Para contraseñas es mejor usar hash que encriptación
    const hashedPassword = hashPassword(userData.contrasena);
    
    // Crear un objeto que contenga todos los IVs
    const allIVs = {
        cedulaIV: encCedula.iv,
        direccionIV: encDireccion.iv,
        nombreIV: encNombre.iv,
        apellidoIV: encApellido.iv,
        correoIV: encCorreo.iv
    };
    
    // Serializar los IVs como JSON y luego a Buffer
    const serializedIVs = Buffer.from(JSON.stringify({
        cedulaIV: encCedula.iv.toString('hex'),
        direccionIV: encDireccion.iv.toString('hex'),
        nombreIV: encNombre.iv.toString('hex'),
        apellidoIV: encApellido.iv.toString('hex'),
        correoIV: encCorreo.iv.toString('hex')
    }));

    const query = `
        INSERT INTO Usuarios 
        (cedula, direccion, nombre, apellido, correo, contrasena, iv) 
        VALUES 
        (@cedula, @direccion, @nombre, @apellido, @correo, @contrasena, @iv)
    `;

    const request = pool.request()
        .input('cedula', sql.VarBinary, encCedula.content)
        .input('direccion', sql.VarBinary, encDireccion.content)
        .input('nombre', sql.VarBinary, encNombre.content)
        .input('apellido', sql.VarBinary, encApellido.content)
        .input('correo', sql.VarBinary, encCorreo.content)
        .input('contrasena', sql.VarBinary, Buffer.from(hashedPassword, 'hex'))
        .input('iv', sql.VarBinary, serializedIVs);

    await request.query(query);
    return { success: true, message: 'Usuario registrado con seguridad AES-256' };
}

async function getAllUsers() {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM Usuarios');
    
    return result.recordset.map(user => {
        // Deserializar los IVs
        const ivData = JSON.parse(user.iv.toString());
        
        return {
            id: user.id,
            cedula: decrypt({ 
                content: user.cedula, 
                iv: Buffer.from(ivData.cedulaIV, 'hex') 
            }, SECRET_KEY),
            direccion: decrypt({ 
                content: user.direccion, 
                iv: Buffer.from(ivData.direccionIV, 'hex') 
            }, SECRET_KEY),
            nombre: decrypt({ 
                content: user.nombre, 
                iv: Buffer.from(ivData.nombreIV, 'hex') 
            }, SECRET_KEY),
            apellido: decrypt({ 
                content: user.apellido, 
                iv: Buffer.from(ivData.apellidoIV, 'hex') 
            }, SECRET_KEY),
            correo: decrypt({ 
                content: user.correo, 
                iv: Buffer.from(ivData.correoIV, 'hex') 
            }, SECRET_KEY),
            // No devolvemos la contraseña por seguridad
            contrasena: '[PROTECTED]'
        };
    });
}

async function getUserById(id) {
    const pool = await getConnection();
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Usuarios WHERE id = @id');
    
    if (result.recordset.length === 0) return null;
    
    const user = result.recordset[0];
    const ivData = JSON.parse(user.iv.toString());
    
    return {
        id: user.id,
        cedula: decrypt({ 
            content: user.cedula, 
            iv: Buffer.from(ivData.cedulaIV, 'hex') 
        }, SECRET_KEY),
        direccion: decrypt({ 
            content: user.direccion, 
            iv: Buffer.from(ivData.direccionIV, 'hex') 
        }, SECRET_KEY),
        nombre: decrypt({ 
            content: user.nombre, 
            iv: Buffer.from(ivData.nombreIV, 'hex') 
        }, SECRET_KEY),
        apellido: decrypt({ 
            content: user.apellido, 
            iv: Buffer.from(ivData.apellidoIV, 'hex') 
        }, SECRET_KEY),
        correo: decrypt({ 
            content: user.correo, 
            iv: Buffer.from(ivData.correoIV, 'hex') 
        }, SECRET_KEY),
        contrasena: '[PROTECTED]'
    };
}

// Función para verificar contraseña
async function verifyPassword(userId, inputPassword) {
    const pool = await getConnection();
    const result = await pool.request()
        .input('id', sql.Int, userId)
        .query('SELECT contrasena FROM Usuarios WHERE id = @id');
    
    if (result.recordset.length === 0) return false;
    
    const storedHash = result.recordset[0].contrasena.toString('hex');
    const inputHash = hashPassword(inputPassword);
    
    return storedHash === inputHash;
}

async function updateUser(id, updateData) {
    const pool = await getConnection();
    
    // Obtener los IVs actuales
    const currentUser = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT iv FROM Usuarios WHERE id = @id');
    
    if (currentUser.recordset.length === 0) {
        throw new Error('Usuario no encontrado');
    }
    
    const currentIVs = JSON.parse(currentUser.recordset[0].iv.toString());
    
    const setClauses = [];
    const request = pool.request().input('id', sql.Int, id);
    
    // Encriptar campos actualizados
    for (const [key, value] of Object.entries(updateData)) {
        if (value && typeof value === 'string' && key !== 'contrasena') {
            const encrypted = encrypt(value, SECRET_KEY);
            setClauses.push(`${key} = @${key}`);
            request.input(key, sql.VarBinary, encrypted.content);
            
            // Actualizar el IV correspondiente
            currentIVs[`${key}IV`] = encrypted.iv.toString('hex');
        } else if (key === 'contrasena') {
            const hashedPassword = hashPassword(value);
            setClauses.push('contrasena = @contrasena');
            request.input('contrasena', sql.VarBinary, Buffer.from(hashedPassword, 'hex'));
        }
    }
    
    if (setClauses.length === 0) {
        throw new Error('No se proporcionaron datos para actualizar');
    }
    
    // Actualizar IVs
    setClauses.push('iv = @iv');
    request.input('iv', sql.VarBinary, Buffer.from(JSON.stringify(currentIVs)));

    const query = `UPDATE Usuarios SET ${setClauses.join(', ')} WHERE id = @id`;
    await request.query(query);
    
    return { success: true, message: 'Usuario actualizado con seguridad AES-256' };
}

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    verifyPassword
};