# 🎰 RIFA Admin - Sistema de Gestión de Rifas

Sistema web para gestionar rifas con inicio de sesión con Google, base de datos SQLite y compatibilidad con Render.

## 🚀 Características

- ✅ **Inicio de sesión con Google** mediante OAuth
- ✅ **Registro local** opcional para cuentas manuales
- ✅ **Base de datos SQLite** (funciona localmente)
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

### 3. Configurar Google OAuth

Define estas variables de entorno:

```bash
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```

En Google Cloud Console, autoriza este redirect URI:

```bash
http://localhost:8080/auth/google/callback
```

### 4. Ejecutar el servidor

```bash
python app_auth.py
```

El servidor estará disponible en: **http://localhost:8080**

### 5. Acceder a la aplicación

- **URL:** http://localhost:8080
- **Acceso:** botón "Continuar con Google"

## 🔐 Acceso

- El acceso principal es con Google.
- Si usas registro local, las cuentas se crean con usuario, email y contraseña.

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

Para cambiar la contraseña del admin local, ejecuta:

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
DATABASE_URL=******host/database
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```

### 3. Conectar con GitHub y desplegar

Render se conectará automáticamente a tu repositorio GitHub y desplegará cuando hagas push.

### 4. Comando de inicio en Render

```bash
python app_auth.py
```

## 🔄 Flujo de Seguridad

1. **Login:** el usuario hace clic en Google
2. **OAuth:** Google devuelve el perfil verificado
3. **Cuenta:** se crea o vincula un usuario local
4. **Sesión:** Flask-Login mantiene la sesión segura
5. **CSRF Protection:** Protección contra ataques CSRF

## 📝 Variables de Entorno

### Desarrollo (.env)
```
FLASK_ENV=development
FLASK_DEBUG=False
SECRET_KEY=tu-clave-temporal
DATABASE_URL=sqlite:///rifa.db
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```

### Producción (Render)
```
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=clave-muy-segura-aqui
DATABASE_URL=******host/db
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```

## 🆘 Solución de Problemas

### Error: "ModuleNotFoundError: No module named 'authlib'"

Instala las dependencias:
```bash
pip install -r requirements.txt
```

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
- [ ] Configurar HTTPS en Render
- [ ] Implementar rate limiting para login
- [ ] Agregar 2FA (autenticación de dos factores)
- [ ] Usar PostgreSQL en producción (no SQLite)

## 📚 Tecnologías Usadas

- **Flask** - Framework web Python
- **Flask-SQLAlchemy** - ORM para base de datos
- **Flask-Login** - Gestión de sesiones
- **Authlib** - OAuth con Google
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
