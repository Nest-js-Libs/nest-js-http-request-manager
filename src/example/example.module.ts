import { Module } from '@nestjs/common';
import { HttpModule } from '../lib/http.module';
import { ConfigModule } from '@nestjs/config';
import { CacheStrategy } from '../lib/interfaces/http.interface';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

/**
 * Módulo de ejemplo que muestra cómo usar el HttpModule avanzado
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    // Configuración avanzada con diferentes estrategias de caché
    HttpModule.register({
      // Configuración base de Axios para PokeAPI
      baseURL: 'https://pokeapi.co/api/v2',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      
      // Configuración de reintentos
      retry: {
        retries: 1,
        statusCodesToRetry: [408, 429, 500, 502, 503, 504],
        methodsToRetry: ['get', 'head', 'options', 'delete', 'put'],
      },
      
      // Configuración avanzada de caché
      cache: {
        ttl: 60000, // 1 minuto por defecto
        // methods: ['get'], // Solo cachear solicitudes GET por defecto
        // strategy: CacheStrategy.CACHE_FIRST, // Estrategia predeterminada
        
        // Configuración de Redis (opcional)
        // Si se omite, se usará memoria local
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        
        // Configuraciones específicas por ruta para PokeAPI
        routes: [
          {
            pattern: '/pokemon/.*', // Expresión regular para rutas de pokemon
            strategy: CacheStrategy.SIDE_CACHE,
            ttl: 3600000, // 1 hora
            methods: ['get']
          },
          {
            pattern: '/pokemon-species/.*',
            strategy: CacheStrategy.CACHE_FIRST,
            ttl: 3600000, // 1 hora
          },
          {
            pattern: '/pokemon\?.*', // Listado de pokemon con parámetros
            strategy: CacheStrategy.CACHE_FIRST,
            ttl: 1800000, // 30 minutos
          },
          {
            pattern: '/type/.*',
            strategy: CacheStrategy.CACHE_FIRST, 
            ttl: 86400000, // 24 horas para tipos de pokemon
          }
        ]
      },
      
      // Interceptores globales
      interceptors: {
        request: [
          {
            onFulfilled: (config) => {
              // Añadir token de autenticación a todas las solicitudes
              config.headers = config.headers || {};
              config.headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
              return config;
            },
          },
        ],
        response: [
          {
            onFulfilled: (response) => {
              // Transformar datos de respuesta si es necesario
              return response;
            },
            onRejected: (error) => {
              // Manejar errores globalmente
              console.error('Error en la solicitud HTTP:', error.message);
              return Promise.reject(error);
            },
          },
        ],
      },
    }),
  ],
  providers: [ExampleService],
  controllers: [ExampleController],
})
export class ExampleModule {}