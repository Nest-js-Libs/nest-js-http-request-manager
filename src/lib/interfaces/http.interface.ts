import { ModuleMetadata, Type } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';

/**
 * Estrategias de caché disponibles
 */
export enum CacheStrategy {
  /**
   * Primero intenta obtener datos de la caché, si no están disponibles, realiza la solicitud
   */
  CACHE_FIRST = 'cache-first',
  
  /**
   * Realiza la solicitud y actualiza la caché, pero devuelve los datos de la caché si están disponibles
   */
  SIDE_CACHE = 'side-cache',
  
  /**
   * Solo usa la caché, no realiza solicitudes si los datos están en caché
   */
  ONLY_CACHE = 'only-cache',
  
  /**
   * No utiliza caché, siempre realiza la solicitud
   */
  NO_CACHE = 'no-cache'
}

/**
 * Configuración de Redis para caché
 */
export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

/**
 * Configuración de ruta específica para caché
 */
export interface CacheRouteConfig {
  /**
   * Patrón de URL para aplicar esta configuración (soporta expresiones regulares)
   */
  pattern: string | RegExp;
  
  /**
   * Estrategia de caché para esta ruta
   */
  strategy: CacheStrategy;
  
  /**
   * Tiempo de vida en milisegundos para los datos en caché de esta ruta
   */
  ttl?: number;
  
  /**
   * Métodos HTTP a los que aplicar caché para esta ruta
   */
  methods?: string[];
}

/**
 * Opciones de configuración de caché
 */
export interface CacheOptions {
  /**
   * Tiempo de vida predeterminado en milisegundos
   */
  ttl?: number;
  
  /**
   * Número máximo de elementos en caché
   */
  max?: number;
  
  /**
   * Métodos HTTP a los que aplicar caché por defecto
   */
  methods?: string[];
  
  /**
   * Estrategia de caché predeterminada
   */
  strategy?: CacheStrategy;
  
  /**
   * Configuración de Redis (si se omite, se usa memoria local)
   */
  redis?: RedisConfig;
  
  /**
   * Configuraciones específicas por ruta
   */
  routes?: CacheRouteConfig[];

  /**
   * Función para determinar si una respuesta debe ser cacheada
   */
  shouldCache?: (response: any) => boolean;

  /**
   * Clave de caché personalizada o función para generarla
   */
  cacheKey?: string | ((config: any) => string);
}

/**
 * Opciones de configuración de reintentos
 */
export interface RetryOptions {
  retries?: number;
  retryDelay?: number;
  statusCodesToRetry?: number[];
  methodsToRetry?: string[];
  /**
   * Función personalizada para determinar si se debe reintentar una solicitud
   */
  retryCondition?: (error: any) => boolean;
}

/**
 * Interceptor de solicitud
 */
export interface RequestInterceptor {
  onFulfilled?: (config: any) => any | Promise<any>;
  onRejected?: (error: any) => any;
}

/**
 * Interceptor de respuesta
 */
export interface ResponseInterceptor {
  onFulfilled?: (response: any) => any;
  onRejected?: (error: any) => any;
}

/**
 * Configuración de interceptores
 */
export interface InterceptorsConfig {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
}

/**
 * Opciones del módulo HTTP
 */
export interface HttpModuleOptions extends AxiosRequestConfig {
  retry?: RetryOptions;
  cache?: CacheOptions;
  interceptors?: InterceptorsConfig;
}

/**
 * Factory para crear opciones HTTP
 */
export interface HttpOptionsFactory {
  createHttpOptions(): Promise<HttpModuleOptions> | HttpModuleOptions;
}

/**
 * Opciones asíncronas para el módulo HTTP
 */
export interface HttpModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<HttpOptionsFactory>;
  useClass?: Type<HttpOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<HttpModuleOptions> | HttpModuleOptions;
  inject?: any[];
}

/**
 * Middleware para procesar solicitudes HTTP
 */
export interface RequestMiddleware {
  /**
   * Prioridad del middleware (menor número = mayor prioridad)
   */
  priority?: number;
  
  /**
   * Procesa la configuración de la solicitud
   * @param config Configuración de la solicitud
   * @returns Configuración modificada
   */
  process(config: any): Promise<any> | any;
}

/**
 * Middleware para procesar respuestas HTTP
 */
export interface ResponseMiddleware {
  /**
   * Prioridad del middleware (menor número = mayor prioridad)
   */
  priority?: number;
  
  /**
   * Procesa la respuesta
   * @param response Respuesta HTTP
   * @returns Respuesta modificada
   */
  process(response: any): Promise<any> | any;
}

/**
 * Middleware para procesar errores HTTP
 */
export interface ErrorMiddleware {
  /**
   * Prioridad del middleware (menor número = mayor prioridad)
   */
  priority?: number;
  
  /**
   * Procesa el error
   * @param error Error HTTP
   * @returns Error modificado o respuesta resuelta
   */
  process(error: any): Promise<any> | any;
}