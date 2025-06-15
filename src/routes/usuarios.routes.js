const express = require('express');
const router = express.Router();
const usuarioService = require('../services/usuario.service');

// Registro de usuario con encriptación AES-256
router.post('/register', async (req, res) => {
    try {
        // Validación básica
        if (!req.body.cedula || !req.body.contrasena) {
            return res.status(400).json({ 
                success: false,
                error: 'Cédula y contraseña son requeridos' 
            });
        }

        const result = await usuarioService.createUser(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Obtener todos los usuarios (desencriptados)
router.get('/', async (req, res) => {
    try {
        const users = await usuarioService.getAllUsers();
        res.json({ 
            success: true,
            count: users.length,
            data: users 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Error al obtener usuarios' 
        });
    }
});

// Obtener un usuario por ID
router.get('/:id', async (req, res) => {
    try {
        const user = await usuarioService.getUserById(parseInt(req.params.id));
        if (user) {
            res.json({ 
                success: true,
                data: user 
            });
        } else {
            res.status(404).json({ 
                success: false,
                error: 'Usuario no encontrado' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Actualizar usuario
router.put('/:id', async (req, res) => {
    try {
        const result = await usuarioService.updateUser(parseInt(req.params.id), req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = router;