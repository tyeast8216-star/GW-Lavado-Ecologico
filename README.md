# GW Pagina - Login con Node.js

Instrucciones rápidas:

1. Instalar dependencias:

```
npm install
```

2. Iniciar servidor:

```
npm start
```

El servidor sirve los archivos estáticos del directorio raíz y expone `POST /login`.

Credenciales demo:

- email: user@example.com
- password: password123

Reemplaza el arreglo `users` en `server.js` por una base de datos real en producción.

Registro:

- Puedes crear cuentas mediante `POST /register` desde `register.html`.

Base de datos:

- El proyecto ahora usa SQLite (`users.db`) para guardar usuarios. Ejecuta `npm install` para instalar la dependencia `sqlite3`.

Validaciones:

- El servidor valida formato de email y exige contraseña mínima de 8 caracteres.

Panel administrativo:

- Abre [users.html](users.html) para ver usuarios — solo accesible a administradores.
- Desde la tabla puedes editar `Nombre`, `Contraseña` y `Admin` para cada usuario (el campo contraseña vacío mantiene la contraseña actual).

