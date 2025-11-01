#!/bin/bash

# Script de verificación de seguridad pre-despliegue

echo "🔍 VERIFICACIÓN DE SEGURIDAD PRE-DESPLIEGUE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
WARNINGS=0

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# 1. Verificar que .env existe
echo "📋 Verificando archivo .env..."
if [ ! -f ".env" ]; then
    echo "  ❌ Archivo .env no encontrado"
    ((ERRORS++))
else
    echo "  ✅ Archivo .env existe"
fi

# 2. Verificar que API_KEY está configurada
echo ""
echo "🔑 Verificando API_KEY..."
if [ -f ".env" ] && grep -q "^API_KEY=" .env; then
    API_KEY_VALUE=$(grep "^API_KEY=" .env | cut -d '=' -f2)
    if [ "$API_KEY_VALUE" = "your_secure_api_key_here" ] || [ -z "$API_KEY_VALUE" ]; then
        echo "  ❌ API_KEY no está configurada correctamente"
        echo "     Ejecuta: ./scripts/generate-api-key.sh"
        ((ERRORS++))
    else
        echo "  ✅ API_KEY configurada"
    fi
else
    echo "  ❌ API_KEY no encontrada en .env"
    echo "     Ejecuta: ./scripts/generate-api-key.sh"
    ((ERRORS++))
fi

# 3. Verificar ALLOWED_ORIGINS
echo ""
echo "🌐 Verificando ALLOWED_ORIGINS..."
if [ -f ".env" ] && grep -q "^ALLOWED_ORIGINS=" .env; then
    ALLOWED_ORIGINS=$(grep "^ALLOWED_ORIGINS=" .env | cut -d '=' -f2)
    if [[ "$ALLOWED_ORIGINS" == *"localhost"* ]]; then
        echo "  ⚠️  ALLOWED_ORIGINS contiene localhost"
        echo "     Asegúrate de incluir tu dominio de producción"
        ((WARNINGS++))
    else
        echo "  ✅ ALLOWED_ORIGINS configurado para producción"
    fi
else
    echo "  ❌ ALLOWED_ORIGINS no configurado"
    ((ERRORS++))
fi

# 4. Verificar credenciales de Supabase
echo ""
echo "☁️  Verificando credenciales de Supabase..."
if [ -f ".env" ]; then
    if grep -q "your-project.supabase.co" .env || grep -q "your_service_role_key_here" .env; then
        echo "  ❌ Credenciales de Supabase no configuradas"
        ((ERRORS++))
    else
        echo "  ✅ Credenciales de Supabase configuradas"
    fi
fi

# 5. Verificar credenciales de Wompi
echo ""
echo "💳 Verificando credenciales de Wompi..."
if [ -f ".env" ]; then
    if grep -q "your_public_key" .env || grep -q "your_secret" .env; then
        echo "  ❌ Credenciales de Wompi no configuradas"
        ((ERRORS++))
    else
        echo "  ✅ Credenciales de Wompi configuradas"
    fi
fi

# 6. Verificar que .env está en .gitignore
echo ""
echo "🔒 Verificando .gitignore..."
if grep -q "^\.env$" .gitignore; then
    echo "  ✅ .env está en .gitignore"
else
    echo "  ❌ .env NO está en .gitignore"
    ((ERRORS++))
fi

# 7. Verificar que .env no está en Git
echo ""
echo "📦 Verificando historial de Git..."
if git ls-files .env --error-unmatch > /dev/null 2>&1; then
    echo "  ❌ CRÍTICO: .env está trackeado en Git"
    echo "     Ejecuta: git rm --cached .env"
    echo "     Luego: git commit -m 'Remove .env from tracking'"
    ((ERRORS++))
else
    echo "  ✅ .env no está en Git"
fi

# 8. Escanear vulnerabilidades en dependencias
echo ""
echo "🔍 Escaneando vulnerabilidades..."
if command -v npm &> /dev/null; then
    AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1)
    if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
        echo "  ✅ No se encontraron vulnerabilidades críticas"
    else
        CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* critical" | grep -o "[0-9]*")
        HIGH=$(echo "$AUDIT_OUTPUT" | grep -o "[0-9]* high" | grep -o "[0-9]*")
        
        if [ ! -z "$CRITICAL" ] && [ "$CRITICAL" -gt 0 ]; then
            echo "  ❌ Se encontraron $CRITICAL vulnerabilidades CRÍTICAS"
            echo "     Ejecuta: npm audit fix"
            ((ERRORS++))
        elif [ ! -z "$HIGH" ] && [ "$HIGH" -gt 0 ]; then
            echo "  ⚠️  Se encontraron $HIGH vulnerabilidades ALTAS"
            echo "     Ejecuta: npm audit fix"
            ((WARNINGS++))
        fi
    fi
else
    echo "  ⚠️  npm no disponible, saltando escaneo de vulnerabilidades"
    ((WARNINGS++))
fi

# 9. Verificar build
echo ""
echo "🔨 Verificando que el proyecto compila..."
if npm run build > /dev/null 2>&1; then
    echo "  ✅ Build exitoso"
else
    echo "  ❌ Build falló"
    echo "     Ejecuta: npm run build"
    ((ERRORS++))
fi

# 10. Verificar NODE_ENV
echo ""
echo "🌍 Verificando NODE_ENV..."
if [ -f ".env" ]; then
    NODE_ENV=$(grep "^NODE_ENV=" .env | cut -d '=' -f2)
    if [ "$NODE_ENV" = "production" ]; then
        echo "  ✅ NODE_ENV configurado para producción"
    else
        echo "  ⚠️  NODE_ENV no es 'production'"
        echo "     Cambia NODE_ENV=production en .env para producción"
        ((WARNINGS++))
    fi
fi

# Resumen
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 ¡TODO PERFECTO! Listo para desplegar"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS advertencias encontradas"
    echo "   Revisa los warnings antes de desplegar"
    echo ""
    exit 0
else
    echo "❌ $ERRORS errores encontrados"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  $WARNINGS advertencias encontradas"
    fi
    echo ""
    echo "🚫 NO DESPLEGAR hasta corregir los errores"
    echo ""
    exit 1
fi
