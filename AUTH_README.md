# 🎰 RIFA Admin - Sistema de Gestión de Rifas

Sistema web para gestionar rifas con autenticación de usuarios, base de datos SQLite y compatibilidad con Render.

## 🚀 Características

- ✅ **Autenticación segura** con bcrypt
- ✅ **Registro e inicio de sesión** de usuarios
- ✅ **Base de datos SQLite** (funciona localmente)
- ✅ **Admin predefinido** (usuario: admin, contraseña: admin123)
- ✅ **Sesiones seguras** con Flask-Login
- ✅ **Listo para Render** (PostgreSQL en producción)

## 📋 Requisitos

- Python 3.8+
- pip (gestor de paquetes de Python)

## 🔧 Instalación Local

### 1. Clonar o descargar el proyecto

```bash
cd /Users/maoyyeison/Desktop/RIFA
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Ejecutar el servidor

```bash
python app_auth.py
```

El servidor estará disponible en: **http://localhost:5000**

### 4. Acceder a la aplicación

- **URL:** http://localhost:5000
- **Usuario de demostración:** `admin` / `admin123`

## 🔐 Usuarios y Contraseñas

### Usuario Admin Predefinido

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |
| Email | `admin@rifa.local` |

**⚠️ IMPORTANTE:** Cambia la contraseña del admin en producción.

## 📁 Estructura del Proyecto

```
RIFA/
├── app_auth.py                 # Servidor Flask con autenticación
├── templates/
│   ├── login.html             # Página de inicio de sesión
│   ├── register.html          # Página de registro
│   └── index.html             # Dashboard principal
├── .env                       # Variables de entorno (local)
├── requirements.txt           # Dependencias Python
├── app.js                     # Frontend anterior
└── README.md                  # Este archivo
```

## 🔑 Cambiar Contraseña del Admin

Para cambiar la contraseña del admin, ejecuta:

```python
from app_auth import app, db, User

with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if admin:
        admin.set_password('nueva_contraseña_segura')
        db.session.commit()
        print("✅ Contraseña actualizada")
```

## 🚢 Desplegar en Render

### 1. Preparar el proyecto

- Cambiar `FLASK_DEBUG=False` en `.env`
- Actualizar `SECRET_KEY` con una clave más segura
- Crear una base de datos PostgreSQL en Render

### 2. Configurar variables de entorno en Render

```
FLASK_ENV=production
SECRET_KEY=clave-super-segura-generada-aleatoriamente
DATABASE_URL=postgresql://user:password@host/database
```

### 3. Conectar con GitHub y desplegar

Render se conectará automáticamente a tu repositorio GitHub y desplegará cuando hagas push.

### 4. Comando de inicio en Render

```bash
python app_auth.py
```

## 🔄 Flujo de Seguridad

1. **Registro:** Usuario crea cuenta con email y contraseña
2. **Hash:** Contraseña se encripta con bcrypt (nunca se almacena en texto plano)
3. **Login:** Se verifica la contraseña contra el hash
4. **Sesión:** Flask-Login mantiene la sesión segura
5. **CSRF Protection:** Protección contra ataques CSRF

## 📝 Variables de Entorno

### Desarrollo (.env)
```
FLASK_ENV=development
FLASK_DEBUG=False
SECRET_KEY=tu-clave-temporal
DATABASE_URL=sqlite:///rifa.db
```

### Producción (Render)
```
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=clave-muy-segura-aqui
DATABASE_URL=postgresql://user:pass@host/db
```

## 🆘 Solución de Problemas

### Error: "ModuleNotFoundError: No module named 'flask'"

Instala las dependencias:
```bash
pip install -r requirements.txt
```

### Error: "rifa.db no se crea"

El archivo se crea automáticamente al ejecutar `app_auth.py`. Verifica permisos:
```bash
ls -la /Users/maoyyeison/Desktop/RIFA/rifa.db
```

### Puerto 5000 en uso

Cambia el puerto en `app_auth.py`:
```python
app.run(debug=True, host='0.0.0.0', port=8000)  # Usa 8000 en lugar de 5000
```

## 🔒 Mejoras de Seguridad Recomendadas

- [ ] Cambiar `SECRET_KEY` a una cadena aleatoria segura
- [ ] Cambiar contraseña del admin en producción
- [ ] Configurar HTTPS en Render
- [ ] Implementar rate limiting para login
- [ ] Agregar 2FA (autenticación de dos factores)
- [ ] Usar PostgreSQL en producción (no SQLite)

## 📚 Tecnologías Usadas

- **Flask** - Framework web Python
- **Flask-SQLAlchemy** - ORM para base de datos
- **Flask-Login** - Gestión de sesiones
- **Werkzeug** - Seguridad y encriptación
- **SQLite** - Base de datos local
- **PostgreSQL** - Base de datos en producción (Render)

## 📞 Soporte

Si necesitas ayuda, verifica:
1. Las dependencias en `requirements.txt`
2. El archivo `.env` con las variables correctas
3. Los permisos en la carpeta del proyecto

## 📄 Licencia

Este proyecto es de uso privado.

---

**Última actualización:** Agosto 2026
**Versión:** 1.0.0
