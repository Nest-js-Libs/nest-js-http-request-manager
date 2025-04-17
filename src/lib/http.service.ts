import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { StatusCodes } from 'http-status-codes';
import * as qs from 'qs';
import {
  CacheOptions,
  ErrorMiddleware,
  HttpModuleOptions,
  RequestMiddleware,
  ResponseMiddleware,
  RetryOptions,
} from './interfaces/http.interface';

/**
 * Token para inyectar las opciones del módulo HTTP
 */
export const HTTP_MODULE_OPTIONS = 'HTTP_MODULE_OPTIONS';

/**
 * Servicio HTTP avanzado basado en Axios con características adicionales
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly requestMiddlewares: RequestMiddleware[] = [];
  private readonly responseMiddlewares: ResponseMiddleware[] = [];
  private readonly errorMiddlewares: ErrorMiddleware[] = [];

  constructor(
    @Inject(HTTP_MODULE_OPTIONS) private readonly httpModuleOptions: HttpModuleOptions,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.axiosInstance = axios.create(this.getAxiosConfig(httpModuleOptions));
    this.setupRetry(httpModuleOptions.retry);
    this.setupCache(httpModuleOptions.cache);
    this.setupInterceptors(httpModuleOptions);
  }

  /**
   * Configura Axios con las opciones proporcionadas
   */
  private getAxiosConfig(options: HttpModuleOptions): AxiosRequestConfig {
    // Extraer propiedades personalizadas que no son parte de AxiosRequestConfig
    const { retry, cache, interceptors, ...axiosOptions } = options;
    
    // Configuración base de Axios
    const config: AxiosRequestConfig = {
      timeout: options.timeout || 10000,
      paramsSerializer: (params) =>
        qs.stringify(params, { arrayFormat: 'brackets' }),
      ...axiosOptions,
    };

    // Manejar las cabeceras de forma compatible con Axios 1.8.4
    if (options.headers) {
      config.headers = options.headers as any;
    }

    return config;
  }

  /**
   * Configura el sistema de reintentos
   */
  private setupRetry(retryOptions?: boolean | RetryOptions): void {
    if (!retryOptions) return;

    const options: RetryOptions = typeof retryOptions === 'boolean' ? {} : retryOptions;

    axiosRetry(this.axiosInstance, {
      retries: options.retries || 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Condición personalizada si se proporciona
        if (options.retryCondition && typeof options.retryCondition === 'function') {
          return options.retryCondition(error);
        }

        // Verificar códigos de estado
        const statusCodesToRetry = options.statusCodesToRetry || [
          StatusCodes.REQUEST_TIMEOUT,
          StatusCodes.TOO_MANY_REQUESTS,
          StatusCodes.INTERNAL_SERVER_ERROR,
          StatusCodes.BAD_GATEWAY,
          StatusCodes.SERVICE_UNAVAILABLE,
          StatusCodes.GATEWAY_TIMEOUT,
        ];

        // Verificar métodos
        const methodsToRetry = options.methodsToRetry || [
          'get', 'head', 'options', 'delete', 'put',
        ];

        const status = error.response ? error.response.status : null;
        const method = error.config ? error.config.method : null;

        return (
          axiosRetry.isNetworkError(error) ||
          (status !== null && statusCodesToRetry.includes(status) &&
          method !== null && methodsToRetry.includes(method.toLowerCase()))
        );
      },
    });
  }

  /**
   * Configura el sistema de caché
   */
  private setupCache(cacheOptions?: boolean | CacheOptions): void {
    if (!cacheOptions || !this.cacheManager) return;

    const options: CacheOptions = typeof cacheOptions === 'boolean' ? {} : cacheOptions;

    // Interceptor para verificar caché antes de la solicitud
    this.axiosInstance.interceptors.request.use(async (config) => {
      // Solo cachear métodos específicos
      const methods = options.methods || ['get'];
      if (!methods.includes(config.method?.toLowerCase() || '')) {
        return config;
      }

      // Generar clave de caché
      const cacheKey = this.generateCacheKey(config, options);
      
      // Intentar obtener de caché
      const cachedResponse = await this.cacheManager.get(cacheKey);
      if (cachedResponse) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        // Cancelar la solicitud y devolver la respuesta cacheada
        config.adapter = (() => Promise.resolve(cachedResponse)) as any;
      }

      return config;
    });

    // Interceptor para almacenar respuestas en caché
    this.axiosInstance.interceptors.response.use(async (response) => {
      // Solo cachear métodos específicos
      const methods = options.methods || ['get'];
      if (!methods.includes(response.config.method?.toLowerCase() || '')) {
        return response;
      }

      // Verificar si debemos cachear esta respuesta
      if (options.shouldCache && !options.shouldCache(response)) {
        return response;
      }

      // Generar clave de caché
      const cacheKey = this.generateCacheKey(response.config, options);
      
      try {
        // Crear una copia segura de la respuesta para evitar referencias circulares
        const safeResponse = {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          config: {
            url: response.config.url,
            method: response.config.method,
            headers: response.config.headers
            // Omitir propiedades problemáticas como adaptadores, transformadores, etc.
          }
        };
        
        // Almacenar en caché
        const ttl = options.ttl || 60000; // 1 minuto por defecto
        await this.cacheManager.set(cacheKey, safeResponse, ttl);
        this.logger.debug(`Cached response for ${cacheKey} (TTL: ${ttl}ms)`);
      } catch (error) {
        this.logger.warn(`Error al almacenar respuesta en caché: ${error.message}`);
        // Continuar sin almacenar en caché
      }

      return response;
    });
  }

  /**
   * Genera una clave de caché para una solicitud
   */
  private generateCacheKey(config: AxiosRequestConfig, options: CacheOptions): string {
    if (options.cacheKey) {
      if (typeof options.cacheKey === 'function') {
        return options.cacheKey(config);
      }
      return options.cacheKey;
    }

    // Clave predeterminada: método + url + parámetros + cuerpo (para POST/PUT)
    const method = config.method?.toLowerCase() || 'get';
    const url = config.url || '';
    
    // Serializar parámetros y datos de forma segura para evitar estructuras circulares
    let params = '';
    let data = '';
    
    try {
      // Usar una función de reemplazo para eliminar referencias circulares
      const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
          // Si el valor es un objeto y no es null
          if (typeof value === 'object' && value !== null) {
            // Si ya hemos visto este objeto, ignorarlo para evitar ciclos
            if (seen.has(value)) {
              return '[Circular Reference]';
            }
            seen.add(value);
          }
          return value;
        };
      };
      
      params = config.params ? JSON.stringify(config.params, getCircularReplacer()) : '';
      data = config.data ? JSON.stringify(config.data, getCircularReplacer()) : '';
    } catch (error) {
      this.logger.warn(`Error al serializar datos para caché: ${error.message}`);
      // En caso de error, usar valores simplificados
      params = config.params ? 'params-present' : '';
      data = config.data ? 'data-present' : '';
    }

    return `http-cache:${method}:${url}:${params}:${data}`;
  }

  /**
   * Configura los interceptores globales
   */
  private setupInterceptors(options: HttpModuleOptions): void {
    // Interceptores de solicitud
    if (options.interceptors?.request) {
      for (const interceptor of options.interceptors.request) {
        this.axiosInstance.interceptors.request.use(
          interceptor.onFulfilled,
          interceptor.onRejected,
        );
      }
    }

    // Interceptores de respuesta
    if (options.interceptors?.response) {
      for (const interceptor of options.interceptors.response) {
        this.axiosInstance.interceptors.response.use(
          interceptor.onFulfilled,
          interceptor.onRejected,
        );
      }
    }

    // Configurar interceptores para middlewares
    this.axiosInstance.interceptors.request.use(async (config: any) => {
      try {
        let currentConfig: any = { ...config };
        
        // Ordenar middlewares por prioridad
        const sortedMiddlewares = [...this.requestMiddlewares]
          .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        
        // Aplicar middlewares en orden
        for (const middleware of sortedMiddlewares) {
          currentConfig = await middleware.process(currentConfig);
        }
        
        return currentConfig;
      } catch (error) {
        this.logger.error('Error in request middleware', error);
        return Promise.reject(error);
      }
    });

    this.axiosInstance.interceptors.response.use(
      async (response: any) => {
        try {
          let currentResponse: any = { ...response };
          
          // Ordenar middlewares por prioridad
          const sortedMiddlewares = [...this.responseMiddlewares]
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
          
          // Aplicar middlewares en orden
          for (const middleware of sortedMiddlewares) {
            currentResponse = await middleware.process(currentResponse);
          }
          
          return currentResponse;
        } catch (error) {
          this.logger.error('Error in response middleware', error);
          return Promise.reject(error);
        }
      },
      async (error) => {
        try {
          let currentError = error;
          
          // Ordenar middlewares por prioridad
          const sortedMiddlewares = [...this.errorMiddlewares]
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
          
          // Aplicar middlewares en orden
          for (const middleware of sortedMiddlewares) {
            currentError = await middleware.process(currentError);
            // Si un middleware resuelve el error, detener el procesamiento
            if (!(currentError instanceof Error)) {
              return currentError;
            }
          }
          
          return Promise.reject(currentError);
        } catch (processError) {
          this.logger.error('Error in error middleware', processError);
          return Promise.reject(processError);
        }
      }
    );
  }

  /**
   * Registra un middleware de solicitud
   */
  registerRequestMiddleware(middleware: RequestMiddleware): void {
    this.requestMiddlewares.push(middleware);
    this.logger.log(`Registered request middleware with priority ${middleware.priority || 0}`);
  }

  /**
   * Registra un middleware de respuesta
   */
  registerResponseMiddleware(middleware: ResponseMiddleware): void {
    this.responseMiddlewares.push(middleware);
    this.logger.log(`Registered response middleware with priority ${middleware.priority || 0}`);
  }

  /**
   * Registra un middleware de error
   */
  registerErrorMiddleware(middleware: ErrorMiddleware): void {
    this.errorMiddlewares.push(middleware);
    this.logger.log(`Registered error middleware with priority ${middleware.priority || 0}`);
  }

  /**
   * Realiza una solicitud HTTP
   */
  request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.request<T>(config);
  }

  /**
   * Realiza una solicitud GET
   */
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * Realiza una solicitud POST
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * Realiza una solicitud PUT
   */
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * Realiza una solicitud PATCH
   */
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  /**
   * Realiza una solicitud DELETE
   */
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  /**
   * Realiza una solicitud HEAD
   */
  head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.head<T>(url, config);
  }

  /**
   * Realiza una solicitud OPTIONS
   */
  options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.options<T>(url, config);
  }

  /**
   * Obtiene la instancia de Axios subyacente
   */
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}