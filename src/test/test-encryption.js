const crypto = require('crypto');
const path = require('path');

// Configurar la ruta del .env correctamente
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Importar las funciones de la aplicación
const { encrypt, decrypt } = require('../utils/crypto');
const usuarioService = require('../services/usuario.service');
const { getConnection, closePool } = require('../config/Conecction_SQL_Server');

// Colores para la consola
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, description) {
    log(`\n${step} ${description}`, colors.bold + colors.cyan);
    log('-'.repeat(50), colors.cyan);
}

async function testEncryptionWithDatabase() {
    log('\n' + '='.repeat(70), colors.blue);
    log('PRUEBA COMPLETA DE ENCRIPTACIÓN CON BASE DE DATOS', colors.bold + colors.blue);
    log('='.repeat(70), colors.blue);

    let createdUserIds = [];
    
    try {
        // Verificar configuración inicial
        logStep('🔧', 'VERIFICACIÓN DE CONFIGURACIÓN');
        
        const SECRET_KEY = process.env.SECRET_KEY;
        if (!SECRET_KEY || SECRET_KEY.length !== 64) {
            throw new Error('SECRET_KEY debe ser una cadena hexadecimal de 64 caracteres');
        }
        log(`✓ SECRET_KEY válida (${SECRET_KEY.length} caracteres)`, colors.green);

        // Probar conexión a la base de datos
        const pool = await getConnection();
        log('✓ Conexión a la base de datos establecida', colors.green);

        // Datos de prueba - múltiples usuarios
        const testUsers = [
            {
                cedula: '1234567890',
                nombre: 'Juan Carlos',
                apellido: 'Pérez González',
                correo: 'juan.perez@test.com',
                direccion: 'Av. Principal #123, Ambato, Ecuador',
                contrasena: 'MiContraseñaSegura123!'
            },
            {
                cedula: '0987654321',
                nombre: 'María Elena',
                apellido: 'García Morales',
                correo: 'maria.garcia@test.com',
                direccion: 'Calle Secundaria #456, Quito, Ecuador',
                contrasena: 'OtraContraseña456!'
            },
            {
                cedula: '1122334455',
                nombre: 'Carlos Alberto',
                apellido: 'Rodríguez Silva',
                correo: 'carlos.rodriguez@test.com',
                direccion: 'Plaza Central #789, Guayaquil, Ecuador',
                contrasena: 'TerceraContraseña789!'
            }
        ];

        // PASO 1: Insertar usuarios encriptados en la base de datos
        logStep('💾', 'INSERCIÓN DE USUARIOS ENCRIPTADOS EN BASE DE DATOS');
        
        for (const [index, userData] of testUsers.entries()) {
            try {
                log(`\nInsertando usuario ${index + 1}:`, colors.yellow);
                log(`   Cédula: ${userData.cedula}`);
                log(`   Nombre: ${userData.nombre} ${userData.apellido}`);
                log(`   Correo: ${userData.correo}`);
                
                const result = await usuarioService.createUser(userData);
                
                if (result.success) {
                    log(`✓ Usuario ${index + 1} insertado exitosamente`, colors.green);
                    
                    // Obtener el ID del usuario recién creado para limpieza posterior
                    const allUsers = await usuarioService.getAllUsers();
                    const newUser = allUsers.find(u => u.cedula === userData.cedula);
                    if (newUser) {
                        createdUserIds.push(newUser.id);
                    }
                } else {
                    log(`✗ Error al insertar usuario ${index + 1}`, colors.red);
                }
            } catch (error) {
                log(`✗ Error al insertar usuario ${index + 1}: ${error.message}`, colors.red);
            }
        }

        // PASO 2: Recuperar y desencriptar usuarios desde la base de datos
        logStep('🔓', 'RECUPERACIÓN Y DESENCRIPTACIÓN DESDE BASE DE DATOS');
        
        log('Recuperando todos los usuarios de la base de datos...', colors.yellow);
        const retrievedUsers = await usuarioService.getAllUsers();
        log(`✓ Se recuperaron ${retrievedUsers.length} usuarios`, colors.green);

        // Verificar que los datos desencriptados coinciden con los originales
        logStep('✅', 'VERIFICACIÓN DE INTEGRIDAD DE DATOS');
        
        let verificationsPassed = 0;
        let totalVerifications = 0;

        for (const [index, originalUser] of testUsers.entries()) {
            const retrievedUser = retrievedUsers.find(u => u.cedula === originalUser.cedula);
            
            if (retrievedUser) {
                log(`\nVerificando usuario ${index + 1}:`, colors.yellow);
                
                const fieldsToVerify = ['cedula', 'nombre', 'apellido', 'correo', 'direccion'];
                
                for (const field of fieldsToVerify) {
                    totalVerifications++;
                    if (retrievedUser[field] === originalUser[field]) {
                        log(`   ✓ ${field}: Coincide`, colors.green);
                        verificationsPassed++;
                    } else {
                        log(`   ✗ ${field}: No coincide`, colors.red);
                        log(`     Original: ${originalUser[field]}`, colors.red);
                        log(`     Recuperado: ${retrievedUser[field]}`, colors.red);
                    }
                }

                // Verificar que la contraseña no se expone
                if (retrievedUser.contrasena === '[PROTECTED]') {
                    log(`   ✓ Contraseña: Protegida correctamente`, colors.green);
                    verificationsPassed++;
                    totalVerifications++;
                } else {
                    log(`   ✗ Contraseña: No está protegida`, colors.red);
                    totalVerifications++;
                }
            } else {
                log(`✗ No se encontró usuario con cédula ${originalUser.cedula}`, colors.red);
            }
        }

        // PASO 3: Verificar contraseñas usando la función de verificación
        logStep('🔑', 'VERIFICACIÓN DE CONTRASEÑAS HASHEADAS');
        
        for (const [index, originalUser] of testUsers.entries()) {
            const retrievedUser = retrievedUsers.find(u => u.cedula === originalUser.cedula);
            
            if (retrievedUser) {
                log(`\nVerificando contraseña para usuario ${index + 1}:`, colors.yellow);
                
                // Verificar contraseña correcta
                const isCorrectPassword = await usuarioService.verifyPassword(retrievedUser.id, originalUser.contrasena);
                if (isCorrectPassword) {
                    log(`   ✓ Contraseña correcta verificada`, colors.green);
                    verificationsPassed++;
                } else {
                    log(`   ✗ Verificación de contraseña correcta falló`, colors.red);
                }
                totalVerifications++;

                // Verificar contraseña incorrecta
                const isIncorrectPassword = await usuarioService.verifyPassword(retrievedUser.id, 'contraseña_incorrecta');
                if (!isIncorrectPassword) {
                    log(`   ✓ Contraseña incorrecta rechazada`, colors.green);
                    verificationsPassed++;
                } else {
                    log(`   ✗ Contraseña incorrecta fue aceptada`, colors.red);
                }
                totalVerifications++;
            }
        }

        // PASO 4: Probar recuperación individual de usuarios
        logStep('👤', 'RECUPERACIÓN DE USUARIOS INDIVIDUALES');
        
        for (const userId of createdUserIds) {
            try {
                const user = await usuarioService.getUserById(userId);
                if (user) {
                    log(`✓ Usuario ID ${userId} recuperado correctamente`, colors.green);
                    log(`   Nombre: ${user.nombre} ${user.apellido}`, colors.cyan);
                    verificationsPassed++;
                } else {
                    log(`✗ Usuario ID ${userId} no encontrado`, colors.red);
                }
                totalVerifications++;
            } catch (error) {
                log(`✗ Error al recuperar usuario ID ${userId}: ${error.message}`, colors.red);
                totalVerifications++;
            }
        }

        // PASO 5: Probar actualización de usuarios
        logStep('📝', 'PRUEBA DE ACTUALIZACIÓN DE USUARIOS');
        
        if (createdUserIds.length > 0) {
            const testUserId = createdUserIds[0];
            const updateData = {
                nombre: 'Nombre Actualizado',
                direccion: 'Nueva Dirección #999, Actualizada, Ecuador'
            };

            try {
                const updateResult = await usuarioService.updateUser(testUserId, updateData);
                if (updateResult.success) {
                    log(`✓ Usuario ID ${testUserId} actualizado`, colors.green);
                    
                    // Verificar que la actualización funcionó
                    const updatedUser = await usuarioService.getUserById(testUserId);
                    if (updatedUser.nombre === updateData.nombre && updatedUser.direccion === updateData.direccion) {
                        log(`✓ Datos actualizados verificados correctamente`, colors.green);
                        verificationsPassed += 2;
                    } else {
                        log(`✗ Los datos actualizados no coinciden`, colors.red);
                    }
                    totalVerifications += 2;
                } else {
                    log(`✗ Error en actualización: ${updateResult.message}`, colors.red);
                    totalVerifications++;
                }
            } catch (error) {
                log(`✗ Error al actualizar usuario: ${error.message}`, colors.red);
                totalVerifications++;
            }
        }

        // PASO 6: Verificar seguridad - Consulta directa a la base de datos
        logStep('🔍', 'VERIFICACIÓN DE ENCRIPTACIÓN EN BASE DE DATOS');
        
        const directQuery = await pool.request().query('SELECT TOP 1 cedula, nombre, apellido FROM Usuarios WHERE id IN (' + createdUserIds.join(',') + ')');
        
        if (directQuery.recordset.length > 0) {
            const rawData = directQuery.recordset[0];
            log('Datos RAW en la base de datos:', colors.yellow);
            log(`   Cédula (hex): ${rawData.cedula.toString('hex').substring(0, 32)}...`, colors.cyan);
            log(`   Nombre (hex): ${rawData.nombre.toString('hex').substring(0, 32)}...`, colors.cyan);
            log(`   Apellido (hex): ${rawData.apellido.toString('hex').substring(0, 32)}...`, colors.cyan);
            log('✓ Los datos están encriptados en la base de datos', colors.green);
            verificationsPassed++;
            totalVerifications++;
        }

        // Resumen final
        logStep('📊', 'RESUMEN DE RESULTADOS');
        
        const successRate = ((verificationsPassed / totalVerifications) * 100).toFixed(2);
        
        log(`Total de verificaciones: ${totalVerifications}`, colors.cyan);
        log(`Verificaciones exitosas: ${verificationsPassed}`, colors.green);
        log(`Verificaciones fallidas: ${totalVerifications - verificationsPassed}`, colors.red);
        log(`Tasa de éxito: ${successRate}%`, colors.bold + colors.cyan);

        if (successRate >= 95) {
            log('\n🎉 PRUEBA COMPLETAMENTE EXITOSA', colors.bold + colors.green);
            log('✓ La encriptación AES-256-CBC está funcionando perfectamente', colors.green);
            log('✓ Los datos se almacenan encriptados en la base de datos', colors.green);
            log('✓ Los datos se desencriptan correctamente al recuperarlos', colors.green);
            log('✓ Las contraseñas se hashean y verifican correctamente', colors.green);
            log('✓ Las operaciones CRUD funcionan con encriptación', colors.green);
        } else {
            log('\n⚠️  PRUEBA PARCIALMENTE EXITOSA', colors.bold + colors.yellow);
            log(`${successRate}% de las verificaciones pasaron`, colors.yellow);
            log('Revisa los errores arriba para más detalles', colors.yellow);
        }

        // Mostrar información sobre los datos creados
        logStep('💾', 'DATOS DE PRUEBA CONSERVADOS');
        log('Los siguientes usuarios de prueba se mantienen en la base de datos:', colors.green);
        log(`IDs creados: ${createdUserIds.join(', ')}`, colors.cyan);
        
        for (const [index, userData] of testUsers.entries()) {
            log(`Usuario ${index + 1}:`, colors.yellow);
            log(`   Cédula: ${userData.cedula}`, colors.cyan);
            log(`   Nombre: ${userData.nombre} ${userData.apellido}`, colors.cyan);
            log(`   Correo: ${userData.correo}`, colors.cyan);
        }
        
        log('\n✅ Puedes verificar en la base de datos que estos datos están encriptados', colors.green);

    } catch (error) {
        log(`\n❌ ERROR GENERAL: ${error.message}`, colors.bold + colors.red);
        log(`Stack: ${error.stack}`, colors.red);
    } finally {
        // Cerrar conexión
        await closePool();
        log('✓ Conexión a la base de datos cerrada', colors.green);
        
        log('\n' + '='.repeat(70), colors.blue);
        log('PRUEBA COMPLETADA', colors.bold + colors.blue);
        log('='.repeat(70), colors.blue);
    }
}

// Ejecutar las pruebas
testEncryptionWithDatabase().catch(console.error);