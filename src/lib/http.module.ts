import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpService, HTTP_MODULE_OPTIONS } from './http.service';
import { HttpModuleAsyncOptions, HttpModuleOptions, HttpOptionsFactory } from './interfaces/http.interface';
import { redisStore } from 'cache-manager-redis-store';

/**
 * Módulo HTTP avanzado con características como reintentos, caché y middlewares
 */
@Module({
  imports: [],
  providers: [HttpService],
  exports: [HttpService],
})
export class HttpModule {
  /**
   * Registra el módulo con opciones estáticas
   */
  static register(options: HttpModuleOptions = {}): DynamicModule {
    // Configurar el módulo de caché según las opciones
    const cacheOptions = this.configureCacheModule(options);
    
    return {
      module: HttpModule,
      imports: [cacheOptions],
      providers: [
        {
          provide: HTTP_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  /**
   * Registra el módulo con opciones asíncronas
   */
  static registerAsync(options: HttpModuleAsyncOptions): DynamicModule {
    return {
      module: HttpModule,
      imports: [...(options.imports || []), CacheModule.register()],
      providers: [...this.createAsyncProviders(options)],
    };
  }

  /**
   * Configura el módulo de caché según las opciones proporcionadas
   * @private
   */
  private static configureCacheModule(options: HttpModuleOptions) {
    const cacheConfig = options.cache || {};
    
    // Si se proporciona configuración de Redis, usar Redis como store
    if (cacheConfig.redis) {
      return CacheModule.register({
        store: redisStore,
        host: cacheConfig.redis.host || 'localhost',
        port: cacheConfig.redis.port || 6379,
        password: cacheConfig.redis.password,
        ttl: cacheConfig.ttl || 60000, // Default: 1 minute
        max: cacheConfig.max || 100, // Default: 100 items
      });
    }
    
    // Si no hay configuración de Redis, usar memoria local
    return CacheModule.register({
      ttl: cacheConfig.ttl || 60000,
      max: cacheConfig.max || 100,
    });
  }

  /**
   * Crea los providers para la configuración asíncrona
   */
  private static createAsyncProviders(options: HttpModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  /**
   * Crea el provider para las opciones asíncronas
   */
  private static createAsyncOptionsProvider(options: HttpModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: HTTP_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: HTTP_MODULE_OPTIONS,
      useFactory: async (optionsFactory: HttpOptionsFactory) =>
        await optionsFactory.createHttpOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}