#!/bin/bash

# Script para generar API Key segura y actualizar .env

echo "🔐 Generando API Key segura..."
echo ""

# Generar API key
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

echo "API Key generada:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$API_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar si el archivo .env existe
if [ ! -f .env ]; then
    echo "⚠️  Archivo .env no encontrado."
    echo "Creando .env desde .env.example..."
    cp .env.example .env
fi

# Verificar si API_KEY ya existe en .env
if grep -q "^API_KEY=" .env; then
    echo "⚠️  API_KEY ya existe en .env"
    read -p "¿Deseas reemplazarla? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Reemplazar API_KEY existente
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^API_KEY=.*|API_KEY=$API_KEY|" .env
        else
            # Linux
            sed -i "s|^API_KEY=.*|API_KEY=$API_KEY|" .env
        fi
        echo "✅ API_KEY actualizada en .env"
    else
        echo "❌ Operación cancelada. API_KEY no fue modificada."
    fi
else
    # Agregar API_KEY al final del archivo
    echo "" >> .env
    echo "# Security - API Key for client authentication" >> .env
    echo "API_KEY=$API_KEY" >> .env
    echo "✅ API_KEY agregada a .env"
fi

echo ""
echo "📝 IMPORTANTE:"
echo "  1. Guarda esta API key en un lugar seguro"
echo "  2. Compártela solo con tu equipo de desarrollo"
echo "  3. Úsala en tus clientes (frontend/mobile) con el header: x-api-key"
echo "  4. NO la subas a Git (ya está en .gitignore)"
echo ""
echo "🚀 Lista para usar!"
