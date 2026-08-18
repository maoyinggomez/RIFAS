#!/bin/bash
# Script para instalar y ejecutar RIFA Admin localmente

echo "🎰 RIFA Admin - Setup Local"
echo "================================"

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python no está instalado"
    exit 1
fi

echo "✅ Python encontrado: $(python3 --version)"
echo ""

# Instalar dependencias
echo "📦 Instalando dependencias..."
pip install -r requirements.txt

echo ""
echo "✅ Dependencias instaladas"
echo ""

# Crear base de datos
echo "🗄️  Creando base de datos..."
python3 app_auth.py &
sleep 2
kill $! 2>/dev/null

echo ""
echo "✅ Base de datos creada"
echo ""

# Instrucciones finales
echo "================================"
echo "🚀 Para ejecutar el servidor:"
echo ""
echo "    python3 app_auth.py"
echo ""
echo "📍 Luego abre en tu navegador:"
echo ""
echo "    http://localhost:8080"
echo ""
echo "🔐 Acceso:"
echo "    Inicia sesión con Google"
echo ""
echo "⚙️  Recuerda definir GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET"
echo ""
echo "================================"
