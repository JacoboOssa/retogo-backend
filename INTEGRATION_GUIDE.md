# 🔌 GUÍA DE INTEGRACIÓN - RETOGO BACKEND API

## 📋 Tabla de Contenidos

1. [Resumen del Flujo](#resumen-del-flujo)
2. [Configuración Inicial](#configuración-inicial)
3. [Endpoints Disponibles](#endpoints-disponibles)
4. [Integración Paso a Paso](#integración-paso-a-paso)
5. [Manejo de Errores](#manejo-de-errores)
6. [Ejemplos de Código](#ejemplos-de-código)
7. [Seguridad](#seguridad)
8. [FAQ](#faq)

---

## 🎯 Resumen del Flujo

```
┌─────────────┐
│   FRONTEND  │
└──────┬──────┘
       │ 1. POST /payments/process
       │    Header: x-api-key
       │    Body: { deviceId }
       ▼
┌─────────────────┐
│    BACKEND      │ ◄─── 2. Crea registro en DB (PENDING)
└─────┬───────────┘
      │ 3. Responde INMEDIATAMENTE:
      │    { reference, signature, amount, currency, publicKey }
      ▼
┌─────────────┐
│  FRONTEND   │ ◄─── 4. Abre Wompi Widget con los datos recibidos
└──────┬──────┘
       │
       │ 5. Usuario paga en Wompi
       ▼
┌──────────────┐
│    WOMPI     │
└──────┬───────┘
       │ 6. POST /payments/webhook
       │    (❌ Sin API key, usa firma SHA256)
       ▼
┌─────────────────┐
│    BACKEND      │ ◄─── 7. Valida firma y actualiza DB
└─────┬───────────┘
      │ 8. Emite evento por WebSocket
      │    { reference, status, timestamp }
      ▼
┌─────────────┐
│  FRONTEND   │ ◄─── 9. Recibe notificación en tiempo real
└─────────────┘      y actualiza UI
```

---

## ⚙️ Configuración Inicial

### 1. Obtener la API Key del Backend

Contacta al equipo de backend para obtener la **API Key**. Esta key debe ser incluida en todos los requests del frontend.

```bash
# Ejemplo de API Key (no usar esta, es solo ejemplo)
x-api-key: Xk7mP9qR2vF8nW3jL6hT5yB4uN1zC0sA==
```

⚠️ **IMPORTANTE:** 
- Guarda la API key en variables de entorno de tu frontend
- NO la hardcodees en el código
- La API key se puede compartir con el frontend (no es ultra-secreta como passwords)

### 2. URL Base del API

```bash
# Desarrollo
https://tu-backend-dev.railway.app

# Producción
https://api.retogo.com
```

---

## 🔗 Endpoints Disponibles

### 1. **POST /payments/process** 🔒
Crea una nueva referencia de pago para procesar con Wompi.

**Requiere:** API Key ✅

**Request:**
```http
POST /payments/process
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "deviceId": "device-abc-123"
}
```

**Validaciones:**
- `deviceId`: Requerido, string, 1-255 caracteres, solo alfanuméricos, guiones y guiones bajos

**Response 200 (INMEDIATA):**
```json
{
  "reference": "1K3M5N7P-9QRSTVWX",
  "signature": "abc123def456...",
  "amount": 1500000,
  "currency": "COP",
  "publicKey": "pub_test_..."
}
```

✅ **Esta respuesta es inmediata.** No espera a que el usuario pague, solo crea el registro y devuelve los datos para el widget de Wompi.

**Errores:**
- `400 Bad Request`: deviceId inválido o faltante
- `401 Unauthorized`: API key inválida o faltante
- `429 Too Many Requests`: Límite de rate (3 requests/minuto)

**Rate Limit:** 3 requests por minuto por IP

---

### 2. **POST /payments/webhook** (Solo para Wompi) ⚠️
Recibe notificaciones de Wompi sobre cambios de estado de pagos.

**NO requiere:** API Key ❌

**¿Por qué no requiere API Key?**  
Wompi es un servicio externo que envía webhooks automáticos. **No puedes configurar headers personalizados en Wompi**, por lo que no puede enviar tu API key.

**Seguridad:** 
- ✅ Validación de firma SHA256 (Wompi firma cada webhook)
- ✅ Validación de timestamp (rechaza webhooks >5 minutos de antigüedad)

**⚠️ Este endpoint NO debe ser llamado por el frontend.** Solo Wompi lo usa.

---

### 3. **WebSocket /payments** 🔒
Conexión en tiempo real para recibir actualizaciones de pagos.

**Requiere:** API Key ✅

**Eventos:**
- `subscribe`: Suscribirse a una referencia de pago
- `unsubscribe`: Desuscribirse de una referencia
- `payment_update`: Notificación de cambio de estado (del backend al cliente)
- `payment_status_changed`: Broadcast a todos los clientes conectados

---

### 4. **GET /health**
Verifica que el API esté funcionando.

**NO requiere:** API Key ❌

**Response 200:**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  }
}
```

---

## 🚀 Integración Paso a Paso

### Paso 1: Crear Pago (Recibe Respuesta Inmediata)

```typescript
// frontend/src/services/api.ts
const API_URL = process.env.REACT_APP_API_URL; // o NEXT_PUBLIC_API_URL
const API_KEY = process.env.REACT_APP_API_KEY;

async function createPayment(deviceId: string) {
  const response = await fetch(`${API_URL}/payments/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ deviceId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error creating payment');
  }

  // ✅ Respuesta INMEDIATA con los datos para Wompi
  return await response.json();
}
```

**Respuesta esperada (inmediata):**
```typescript
interface PaymentResponse {
  reference: string;      // ID único del pago
  signature: string;      // Firma para Wompi
  amount: number;         // Monto en centavos (1500000 = $15,000 COP)
  currency: string;       // "COP"
  publicKey: string;      // Public key de Wompi
}
```

---

### Paso 2: Conectar WebSocket

```typescript
// frontend/src/services/websocket.ts
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL;
const API_KEY = process.env.REACT_APP_API_KEY;

let socket: Socket | null = null;

export function connectWebSocket() {
  if (socket?.connected) return socket;

  socket = io(`${API_URL}/payments`, {
    extraHeaders: {
      'x-api-key': API_KEY,
    },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
  });

  return socket;
}

export function subscribeToPayment(reference: string, callback: (data: any) => void) {
  if (!socket) {
    throw new Error('WebSocket not connected');
  }

  // Suscribirse a una referencia específica
  socket.emit('subscribe', { reference });

  // Escuchar actualizaciones
  socket.on('payment_update', callback);
}

export function unsubscribeFromPayment(reference: string) {
  if (!socket) return;

  socket.emit('unsubscribe', { reference });
  socket.off('payment_update');
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

---

### Paso 3: Integrar con Wompi Widget

```typescript
// frontend/src/components/PaymentButton.tsx
import { useState } from 'react';
import { createPayment } from '../services/api';
import { connectWebSocket, subscribeToPayment } from '../services/websocket';

export function PaymentButton({ deviceId }: { deviceId: string }) {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const handlePayment = async () => {
    try {
      setLoading(true);

      // 1. Crear pago en el backend (respuesta INMEDIATA)
      const paymentData = await createPayment(deviceId);
      console.log('Payment created:', paymentData);

      // 2. Conectar WebSocket y suscribirse
      const socket = connectWebSocket();
      subscribeToPayment(paymentData.reference, (data) => {
        console.log('Payment update received:', data);
        setPaymentStatus(data.status);
        
        if (data.status === 'APPROVED') {
          alert('✅ Pago aprobado!');
        } else if (data.status === 'DECLINED') {
          alert('❌ Pago rechazado');
        }
      });

      // 3. Abrir Wompi Widget con los datos recibidos
      const checkout = new WidgetCheckout({
        currency: paymentData.currency,
        amountInCents: paymentData.amount,
        reference: paymentData.reference,
        publicKey: paymentData.publicKey,
        signature: {
          integrity: paymentData.signature,
        },
        redirectUrl: window.location.href, // Opcional
      });

      checkout.open((result: any) => {
        const transaction = result.transaction;
        console.log('Wompi widget closed:', transaction);
        
        // ⚠️ Este callback es inmediato, pero el estado final
        // llega por WebSocket cuando Wompi envía el webhook
      });

    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Procesando...' : 'Pagar $15,000'}
      </button>
      
      {paymentStatus && (
        <p>Estado del pago: {paymentStatus}</p>
      )}
    </div>
  );
}
```

---

## ⚠️ Manejo de Errores

### Errores Comunes

#### 1. **401 Unauthorized**
```json
{
  "message": "Invalid or missing API key",
  "statusCode": 401
}
```

**Solución:** Verifica que el header `x-api-key` esté presente y sea correcto.

---

#### 2. **429 Too Many Requests**
```json
{
  "message": "ThrottlerException: Too Many Requests",
  "statusCode": 429
}
```

**Solución:** Estás excediendo el límite de 3 requests por minuto. Espera antes de reintentar.

---

#### 3. **400 Bad Request**
```json
{
  "message": [
    "deviceId should not be empty",
    "deviceId must be a string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Solución:** Verifica que el `deviceId` cumpla con las validaciones.

---

#### 4. **WebSocket Connection Error**
```
Error: Invalid or missing API key
```

**Solución:** Asegúrate de pasar el header `x-api-key` en `extraHeaders` al conectar.

---

## 💻 Ejemplos de Código Completos

### React + TypeScript

```typescript
// src/hooks/usePayment.ts
import { useState, useEffect } from 'react';
import { createPayment } from '../services/api';
import { connectWebSocket, subscribeToPayment, disconnectWebSocket } from '../services/websocket';

interface PaymentStatus {
  reference: string | null;
  status: string | null;
  loading: boolean;
  error: string | null;
}

export function usePayment() {
  const [payment, setPayment] = useState<PaymentStatus>({
    reference: null,
    status: null,
    loading: false,
    error: null,
  });

  const initiatePayment = async (deviceId: string) => {
    try {
      setPayment({ ...payment, loading: true, error: null });

      // Crear pago (respuesta inmediata)
      const paymentData = await createPayment(deviceId);
      
      setPayment({
        reference: paymentData.reference,
        status: 'PENDING',
        loading: false,
        error: null,
      });

      // Conectar WebSocket
      const socket = connectWebSocket();
      subscribeToPayment(paymentData.reference, (data) => {
        setPayment((prev) => ({
          ...prev,
          status: data.status,
        }));
      });

      // Abrir Wompi
      const checkout = new WidgetCheckout({
        currency: paymentData.currency,
        amountInCents: paymentData.amount,
        reference: paymentData.reference,
        publicKey: paymentData.publicKey,
        signature: { integrity: paymentData.signature },
      });

      checkout.open((result: any) => {
        console.log('Wompi closed:', result);
      });

    } catch (error: any) {
      setPayment({
        reference: null,
        status: null,
        loading: false,
        error: error.message,
      });
    }
  };

  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);

  return { payment, initiatePayment };
}
```

---

### Next.js App Router

```typescript
// app/payment/page.tsx
'use client';

import { usePayment } from '@/hooks/usePayment';

export default function PaymentPage() {
  const { payment, initiatePayment } = usePayment();
  const deviceId = 'device-123'; // Obtener del usuario o dispositivo

  return (
    <div>
      <h1>Realizar Pago</h1>
      
      <button onClick={() => initiatePayment(deviceId)}>
        Pagar $15,000 COP
      </button>

      {payment.loading && <p>Procesando...</p>}
      {payment.error && <p>Error: {payment.error}</p>}
      {payment.status && (
        <p>Estado: {payment.status}</p>
      )}
    </div>
  );
}
```

---

### Vue 3 + Composition API

```typescript
// composables/usePayment.ts
import { ref } from 'vue';
import { createPayment } from '@/services/api';
import { connectWebSocket, subscribeToPayment } from '@/services/websocket';

export function usePayment() {
  const reference = ref<string | null>(null);
  const status = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const initiatePayment = async (deviceId: string) => {
    try {
      loading.value = true;
      error.value = null;

      const paymentData = await createPayment(deviceId);
      reference.value = paymentData.reference;
      status.value = 'PENDING';

      const socket = connectWebSocket();
      subscribeToPayment(paymentData.reference, (data) => {
        status.value = data.status;
      });

      // Abrir Wompi Widget
      const checkout = new (window as any).WidgetCheckout({
        currency: paymentData.currency,
        amountInCents: paymentData.amount,
        reference: paymentData.reference,
        publicKey: paymentData.publicKey,
        signature: { integrity: paymentData.signature },
      });

      checkout.open();

    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  return {
    reference,
    status,
    loading,
    error,
    initiatePayment,
  };
}
```

---

## 🔒 Seguridad

### ✅ Endpoints que REQUIEREN API Key

| Endpoint | API Key | Razón |
|----------|---------|-------|
| `POST /payments/process` | ✅ Requerida | Evita creación masiva de pagos por bots |
| `WebSocket /payments` | ✅ Requerida | Solo clientes autenticados pueden conectarse |

**Cómo enviar la API Key:**
```typescript
// HTTP Request
headers: {
  'x-api-key': 'YOUR_API_KEY'
}

// WebSocket
extraHeaders: {
  'x-api-key': 'YOUR_API_KEY'
}
```

---

### ❌ Endpoints que NO REQUIEREN API Key

| Endpoint | API Key | Razón |
|----------|---------|-------|
| `POST /payments/webhook` | ❌ No | Wompi no puede enviar headers personalizados. Usa firma SHA256 |
| `GET /health` | ❌ No | Endpoint público para healthchecks |

---

### 🛡️ Validaciones de Seguridad Implementadas

1. **Validación de firma SHA256 en webhooks** - Wompi firma cada webhook
2. **Validación de timestamp en webhooks** - Rechaza webhooks antiguos (>5 min)
3. **Rate limiting** - 3 requests/minuto en `/payments/process`
4. **CORS restrictivo** - Solo orígenes permitidos
5. **Validación de DTOs** - Datos validados con class-validator
6. **Headers HTTP seguros** - Helmet configurado

---

## ❓ FAQ

### ¿Por qué el webhook NO requiere API key?

Wompi es un servicio externo que envía webhooks a tu backend. **No tienes control sobre los headers que Wompi envía**, por lo que no puede incluir tu API key personalizada.

**Solución:** Wompi incluye una **firma SHA256** en cada webhook que valida:
- ID de transacción
- Estado
- Monto
- Timestamp
- Secret compartido (configurado en tu cuenta Wompi)

Esto garantiza que el webhook proviene realmente de Wompi y no ha sido alterado.

---

### ¿Qué devuelve el endpoint `/payments/process`?

Devuelve **inmediatamente** todos los datos necesarios para abrir el widget de Wompi:

```json
{
  "reference": "1K3M5N7P-9QRSTVWX",  // ID único del pago
  "signature": "abc123...",           // Firma de integridad
  "amount": 1500000,                  // $15,000 COP en centavos
  "currency": "COP",
  "publicKey": "pub_test_..."        // Public key de Wompi
}
```

**Flujo completo:**
1. ✅ Frontend llama `/payments/process` → **Recibe datos inmediatamente**
2. ✅ Frontend abre Wompi widget con esos datos
3. ⏳ Usuario paga en Wompi
4. ⏳ Wompi notifica al backend via webhook
5. ✅ Backend notifica al frontend via WebSocket

**NO espera** a que el usuario pague. La respuesta es instantánea.

---

### ¿Cómo sé cuándo el pago fue aprobado?

Hay **2 formas**:

**1. WebSocket (Recomendado) - Tiempo Real y Confiable**
```typescript
subscribeToPayment(reference, (data) => {
  if (data.status === 'APPROVED') {
    console.log('✅ Pago aprobado!');
  }
});
```

**2. Callback de Wompi Widget - Inmediato pero NO final**
```typescript
checkout.open((result) => {
  // ⚠️ Este resultado es inmediato pero puede cambiar
  // El webhook (y WebSocket) son la fuente de verdad
  console.log(result.transaction.status);
});
```

⚠️ **IMPORTANTE:** Usa el **WebSocket** como fuente de verdad. El callback de Wompi puede no reflejar el estado final si hay problemas de red o procesamiento.

---

### ¿Qué pasa si el usuario cierra el widget antes de pagar?

El pago queda en estado `PENDING` en la base de datos. Puedes:
- Permitir que el usuario reintente con la misma referencia
- Marcar el pago como `CANCELLED` después de un tiempo
- Crear un nuevo pago

---

### ¿Puedo cambiar el monto del pago?

Actualmente está fijo en `$15,000 COP`. Para hacerlo dinámico, necesitarías modificar el backend:

1. Modificar el DTO `CreatePaymentDto` para aceptar `amount`
2. Actualizar el servicio `payments.service.ts`
3. Recalcular la firma con el nuevo monto

---

### ¿Cómo manejo múltiples pagos simultáneos?

Cada pago tiene una `reference` única. Puedes:

```typescript
const payment1 = await createPayment('device-1');
const payment2 = await createPayment('device-2');

subscribeToPayment(payment1.reference, handlePayment1Update);
subscribeToPayment(payment2.reference, handlePayment2Update);
```

El WebSocket maneja múltiples suscripciones sin problema.

---

### ¿Qué hacer si la conexión WebSocket falla?

```typescript
socket.on('connect_error', (error) => {
  console.error('WebSocket error:', error);
  
  // Opción 1: Reintentar automáticamente (socket.io lo hace por defecto)
  // Opción 2: Polling manual al backend
  // Opción 3: Mostrar error al usuario
});
```

Alternativamente, puedes hacer polling a un endpoint `GET /payments/:reference` (necesitarías crearlo en el backend).

---

### ¿Dónde guardo la API Key en el frontend?

**Variables de entorno:**

```bash
# React / Vite
VITE_API_KEY=your_api_key_here
VITE_API_URL=https://api.retogo.com

# Next.js
NEXT_PUBLIC_API_KEY=your_api_key_here
NEXT_PUBLIC_API_URL=https://api.retogo.com

# Create React App
REACT_APP_API_KEY=your_api_key_here
REACT_APP_API_URL=https://api.retogo.com
```

⚠️ **NUNCA hardcodees la API key en el código.**

---

## 📞 Soporte

Si tienes problemas de integración:

1. **Verifica el healthcheck:** `GET /health`
2. **Revisa los logs del navegador** (Console y Network tab)
3. **Verifica que la API key esté configurada** correctamente
4. **Comprueba CORS** - El dominio de tu frontend debe estar en `ALLOWED_ORIGINS`

---

**Documentación mantenida por:** Equipo Retogo  
**Última actualización:** 30 de octubre de 2025
