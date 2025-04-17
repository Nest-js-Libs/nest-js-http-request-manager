# Axios HTTP Request Manager

### @nest-js/http-request-manager

[![npm version](https://img.shields.io/npm/v/@nest-js/http-request-manager.svg)](https://www.npmjs.com/package/@nest-js/http-request-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Axios HTTP Manager es un módulo avanzado para NestJS que proporciona una capa de abstracción sobre Axios con características adicionales como reintentos automáticos, caché configurable, y sistema de middlewares para procesar solicitudes y respuestas HTTP.

## Características Principales

- **Sistema de reintentos automáticos**: Configura políticas de reintento para solicitudes fallidas
- **Caché integrada**: Múltiples estrategias de caché con soporte para Redis
- **Middlewares**: Procesa solicitudes, respuestas y errores con middlewares personalizables
- **Configuración flexible**: Opciones estáticas o asíncronas para adaptarse a cualquier proyecto
- **Integración con NestJS**: Diseñado específicamente para trabajar con el ecosistema NestJS

## Instalación

```bash
npm install @nest-js/http-request-manager
```

## Uso Básico

### Configuración del Módulo

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from 'http-request-manager';

@Module({
  imports: [
    HttpModule.register({
      // Opciones básicas de Axios
      baseURL: 'https://api.example.com',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
      
      // Configuración de reintentos
      retry: {
        retries: 3,
        retryDelay: (retryCount) => retryCount * 1000, // Retraso exponencial
        statusCodesToRetry: [408, 429, 500, 502, 503, 504], // Códigos de estado HTTP a reintentar
        methodsToRetry: ['get', 'head', 'options', 'delete', 'put'], // Métodos HTTP a reintentar
        retryCondition: (error) => error.code === 'ECONNABORTED', // Condición personalizada
      },
      
      // Configuración de caché
      cache: {
        ttl: 60000, // 1 minuto en milisegundos
        strategy: 'cache-first', // Estrategia de caché
        max: 100, // Número máximo de elementos en caché
        methods: ['get'], // Métodos HTTP a cachear
        shouldCache: (response) => response.status === 200, // Condición para cachear
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

### Uso en Servicios

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from 'http-request-manager';

@Injectable()
export class ApiService {
  constructor(private readonly httpService: HttpService) {}

  async getData() {
    try {
      const response = await this.httpService.get('/data');
      return response.data;
    } catch (error) {
      // El error ya ha pasado por los middlewares de error
      throw error;
    }
  }

  async postData(data: any) {
    const response = await this.httpService.post('/data', data);
    return response.data;
  }
}
```

## Configuración Avanzada

### Configuración Asíncrona

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from 'http-request-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get('API_BASE_URL'),
        timeout: configService.get('API_TIMEOUT'),
        headers: {
          'Authorization': `Bearer ${configService.get('API_TOKEN')}`,
        },
        retry: {
          retries: configService.get('API_RETRY_COUNT'),
        },
        cache: {
          ttl: configService.get('API_CACHE_TTL'),
          strategy: configService.get('API_CACHE_STRATEGY'),
        },
      }),
    }),
  ],
  // ...
})
export class AppModule {}
```

### Configuración de Caché con Redis

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from 'http-request-manager';
import { CacheStrategy } from 'http-request-manager';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api.example.com',
      cache: {
        ttl: 300000, // 5 minutos
        strategy: CacheStrategy.CACHE_FIRST,
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'password',
          db: 0,
        },
        routes: [
          {
            pattern: '/users/.*', // Expresión regular para rutas
            strategy: CacheStrategy.SIDE_CACHE,
            ttl: 600000, // 10 minutos para rutas específicas
            methods: ['get', 'post'], // Métodos específicos para esta ruta
          },
          {
            pattern: '/products',
            strategy: CacheStrategy.NO_CACHE, // No cachear productos
          },
        ],
      },
    }),
  ],
  // ...
})
export class AppModule {}
```

## Opciones de Configuración

### Opciones de Reintentos (RetryOptions)

| Opción | Tipo | Descripción | Valor por defecto |
|--------|------|-------------|------------------|
| `retries` | `number` | Número máximo de reintentos | `3` |
| `retryDelay` | `number` o `Function` | Tiempo de espera entre reintentos en ms o función que lo calcula | `exponentialDelay` |
| `statusCodesToRetry` | `number[]` | Códigos de estado HTTP que provocarán un reintento | `[408, 429, 500, 502, 503, 504]` |
| `methodsToRetry` | `string[]` | Métodos HTTP que se reintentarán | `['get', 'head', 'options', 'delete', 'put']` |
| `retryCondition` | `Function` | Función personalizada para determinar si se debe reintentar | `axiosRetry.isNetworkError` |

### Opciones de Caché (CacheOptions)

| Opción | Tipo | Descripción | Valor por defecto |
|--------|------|-------------|------------------|
| `ttl` | `number` | Tiempo de vida en milisegundos | `60000` (1 minuto) |
| `max` | `number` | Número máximo de elementos en caché | Sin límite |
| `methods` | `string[]` | Métodos HTTP a cachear | `['get']` |
| `strategy` | `CacheStrategy` | Estrategia de caché a utilizar | `CACHE_FIRST` |
| `redis` | `RedisConfig` | Configuración de Redis | `undefined` (memoria local) |
| `routes` | `CacheRouteConfig[]` | Configuraciones específicas por ruta | `[]` |
| `shouldCache` | `Function` | Función para determinar si una respuesta debe ser cacheada | `undefined` |
| `cacheKey` | `string` o `Function` | Clave de caché personalizada o función para generarla | Generada automáticamente |

### Configuración de Redis (RedisConfig)

| Opción | Tipo | Descripción | Valor por defecto |
|--------|------|-------------|------------------|
| `host` | `string` | Host del servidor Redis | `'localhost'` |
| `port` | `number` | Puerto del servidor Redis | `6379` |
| `password` | `string` | Contraseña del servidor Redis | `undefined` |
| `db` | `number` | Base de datos Redis a utilizar | `0` |

## Estrategias de Caché

El módulo soporta cuatro estrategias de caché:

- **CACHE_FIRST**: Primero intenta obtener datos de la caché, si no están disponibles, realiza la solicitud
- **SIDE_CACHE**: Realiza la solicitud y actualiza la caché, pero devuelve los datos de la caché si están disponibles
- **ONLY_CACHE**: Solo usa la caché, no realiza solicitudes si los datos están en caché
- **NO_CACHE**: No utiliza caché, siempre realiza la solicitud

## Sistema de Middlewares

Los middlewares permiten procesar solicitudes, respuestas y errores en diferentes etapas del ciclo de vida de una solicitud HTTP.

### Middlewares de Solicitud

```typescript
httpService.registerRequestMiddleware({
  priority: 10, // Mayor prioridad se ejecuta primero
  process: (config) => {
    // Añadir encabezados de autenticación
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${getToken()}`;
    return config;
  },
});
```

### Middlewares de Respuesta

```typescript
httpService.registerResponseMiddleware({
  priority: 10,
  process: (response) => {
    // Transformar o validar la respuesta
    if (response.data && response.data.status === 'error') {
      throw new Error('API returned error status');
    }
    return response;
  },
});
```

### Middlewares de Error

```typescript
httpService.registerErrorMiddleware({
  priority: 10,
  process: (error) => {
    // Manejar errores específicos
    if (error.response?.status === 401) {
      // Renovar token y reintentar
      return refreshTokenAndRetry(error);
    }
    return Promise.reject(error);
  },
});
```

### Opciones de Middleware

| Opción | Tipo | Descripción | Valor por defecto |
|--------|------|-------------|------------------|
| `priority` | `number` | Prioridad del middleware (menor número = mayor prioridad) | `0` |
| `process` | `Function` | Función que procesa la solicitud, respuesta o error | Requerido |

## Ejemplos de Uso

### Solicitud GET con Caché

```typescript
// Solicitud GET con configuración específica de caché
const response = await httpService.get('/users', {
  cache: {
    ttl: 120000, // 2 minutos
    strategy: CacheStrategy.CACHE_FIRST,
  },
});
```

### Solicitud POST con Reintentos Personalizados

```typescript
// Solicitud POST con configuración específica de reintentos
const response = await httpService.post('/orders', orderData, {
  retry: {
    retries: 5,
    retryDelay: (retryCount) => retryCount * 2000, // Retraso exponencial personalizado
    statusCodesToRetry: [408, 429, 500, 502, 503, 504],
  },
});
```

### Cancelación de Solicitudes

```typescript
// Crear un token de cancelación
const source = httpService.createCancelToken();

// Realizar solicitud con token de cancelación
const fetchData = httpService.get('/data', {
  cancelToken: source.token,
});

// Cancelar la solicitud si es necesario
source.cancel('Operación cancelada por el usuario');
```

### Configuración por Solicitud

```typescript
// Configuración específica para una solicitud
const response = await httpService.get('/data', {
  // Opciones estándar de Axios
  headers: {
    'X-Custom-Header': 'value',
  },
  timeout: 3000,
  
  // Opciones específicas del módulo
  retry: {
    retries: 2,
  },
  cache: {
    ttl: 30000, // 30 segundos
    strategy: CacheStrategy.SIDE_CACHE,
  },
});
```

## Manejo de Errores

El servicio HttpService proporciona métodos para manejar errores de manera efectiva:

```typescript
try {
  const response = await httpService.get('/data');
  return response.data;
} catch (error) {
  if (httpService.isAxiosError(error)) {
    // Error específico de Axios
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      console.error('Error de respuesta:', error.response.status, error.response.data);
    } else if (error.request) {
      // La solicitud se realizó pero no se recibió respuesta
      console.error('Error de solicitud:', error.request);
    } else {
      // Error al configurar la solicitud
      console.error('Error:', error.message);
    }
  } else {
    // Error no relacionado con Axios
    console.error('Error inesperado:', error);
  }
  throw error;
}
```

## Métodos Disponibles

### Métodos HTTP

- `get(url, config?)`: Realiza una solicitud GET
- `post(url, data?, config?)`: Realiza una solicitud POST
- `put(url, data?, config?)`: Realiza una solicitud PUT
- `patch(url, data?, config?)`: Realiza una solicitud PATCH
- `delete(url, config?)`: Realiza una solicitud DELETE
- `head(url, config?)`: Realiza una solicitud HEAD
- `options(url, config?)`: Realiza una solicitud OPTIONS
- `request(config)`: Realiza una solicitud personalizada

### Métodos de Utilidad

- `getAxiosInstance()`: Obtiene la instancia de Axios subyacente
- `createCancelToken()`: Crea un token para cancelar solicitudes
- `isAxiosError(error)`: Verifica si un error es específico de Axios
- `registerRequestMiddleware(middleware)`: Registra un middleware de solicitud
- `registerResponseMiddleware(middleware)`: Registra un middleware de respuesta
- `registerErrorMiddleware(middleware)`: Registra un middleware de error

## Licencia

MIT