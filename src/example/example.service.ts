import { Injectable } from '@nestjs/common';
import { HttpService } from '../lib/http.service';
import { AxiosRequestConfig } from 'axios';

/**
 * Interfaces para los datos de la PokeAPI
 */
export interface PokemonListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Array<{ name: string; url: string }>;
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: Array<{ slot: number; type: { name: string; url: string } }>;
  sprites: {
    front_default: string;
    other?: {
      'official-artwork'?: {
        front_default: string;
      }
    }
  };
  stats: Array<{ base_stat: number; stat: { name: string } }>;
  abilities: Array<{ ability: { name: string; url: string } }>;
  // Otros campos según necesidad
}

/**
 * Servicio de ejemplo que muestra cómo usar el HttpService avanzado
 * para interactuar con la PokeAPI
 */
@Injectable()
export class ExampleService {
  constructor(private readonly httpService: HttpService) {
    // Registrar middlewares personalizados
    this.registerMiddlewares();
  }

  /**
   * Registra middlewares personalizados para procesar solicitudes y respuestas
   */
  private registerMiddlewares(): void {
    // Middleware de solicitud para añadir un timestamp
    this.httpService.registerRequestMiddleware({
      priority: 10,
      process: (config: AxiosRequestConfig) => {
        config.headers = config.headers || {};
        config.headers['X-Request-Time'] = new Date().toISOString();
        return config;
      },
    });

    // Middleware de respuesta para medir el tiempo de respuesta
    this.httpService.registerResponseMiddleware({
      priority: 10,
      process: (response) => {
        const requestTime = response.config.headers?.['X-Request-Time'];
        if (requestTime) {
          const responseTime = new Date().getTime() - new Date(requestTime).getTime();
          console.log(`Request to ${response.config.url} took ${responseTime}ms`);
        }
        return response;
      },
    });

    // Middleware de error para manejar errores específicos de la PokeAPI
    this.httpService.registerErrorMiddleware({
      priority: 10,
      process: (error) => {
        if (error.response?.status === 404) {
          console.error('Pokémon no encontrado:', error.config?.url);
        } else if (error.response?.status === 500) {
          console.error('Error en el servidor de PokeAPI:', error.message);
        } else if (error.code === 'ECONNABORTED') {
          console.error('Tiempo de espera agotado al conectar con PokeAPI');
        }
        return Promise.reject(error);
      },
    });
  }

  /**
   * Obtiene datos de la PokeAPI
   */
  async fetchData<T>(endpoint: string, params?: any): Promise<T> {
    try {
      console.log(`Fetching data from PokeAPI: ${endpoint}`);
      const response = await this.httpService.get<T>(endpoint, { params });
      console.log(`Successfully retrieved data from ${endpoint}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching Pokémon data from ${endpoint}:`, error.message);
      if (error.response?.status === 404) {
        throw new Error(`Pokémon no encontrado en la ruta ${endpoint}`);
      }
      throw error;
    }
  }

  /**
   * Simula el envío de datos a la PokeAPI (demo)
   * Nota: PokeAPI es de solo lectura, esto es solo para demostración
   */
  async postData<T>(endpoint: string, data: any): Promise<T> {
    try {
      // En un caso real, aquí haríamos un POST
      // Como PokeAPI es de solo lectura, simulamos una respuesta
      console.log(`Simulating POST to ${endpoint} with data:`, data);
      
      // Si estamos buscando un Pokémon por nombre, hacemos un GET real
      if (endpoint.includes('/pokemon/') && data.name) {
        const response = await this.httpService.get<T>(`/pokemon/${data.name.toLowerCase()}`);
        return response.data;
      }
      
      // Simulación de respuesta para otros casos
      return { success: true, data, note: 'Esta es una simulación, PokeAPI es de solo lectura' } as unknown as T;
    } catch (error) {
      console.error(`Error in simulated POST to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Simula la actualización de datos en la PokeAPI (demo)
   * Nota: PokeAPI es de solo lectura, esto es solo para demostración
   */
  async updateData<T>(endpoint: string, data: any): Promise<T> {
    try {
      // En un caso real, aquí haríamos un PUT
      // Como PokeAPI es de solo lectura, obtenemos el Pokémon y simulamos su actualización
      console.log(`Simulating PUT to ${endpoint} with data:`, data);
      
      // Obtenemos el Pokémon real
      const pokemonId = endpoint.split('/').pop();
      const response = await this.httpService.get<any>(`/pokemon/${pokemonId}`);
      const pokemon = response.data;
      
      // Simulamos la actualización
      return { 
        ...pokemon, 
        ...data, 
        updated: true, 
        note: 'Esta es una simulación, PokeAPI es de solo lectura' 
      } as unknown as T;
    } catch (error) {
      console.error(`Error in simulated PUT to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Simula la eliminación de datos en la PokeAPI (demo)
   * Nota: PokeAPI es de solo lectura, esto es solo para demostración
   */
  async deleteData(endpoint: string): Promise<any> {
    try {
      // En un caso real, aquí haríamos un DELETE
      // Como PokeAPI es de solo lectura, verificamos que el Pokémon existe y simulamos su eliminación
      console.log(`Simulating DELETE to ${endpoint}`);
      
      // Verificamos que el Pokémon existe
      const pokemonId = endpoint.split('/').pop();
      await this.httpService.get(`/pokemon/${pokemonId}`);
      
      // Simulamos la eliminación
      return { 
        success: true, 
        message: `Pokémon #${pokemonId} eliminado (simulación)`,
        note: 'Esta es una simulación, PokeAPI es de solo lectura'
      };
    } catch (error) {
      console.error(`Error in simulated DELETE to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Realiza una solicitud personalizada a la PokeAPI
   */
  async customRequest<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      console.log('Making custom request to PokeAPI:', config.url);
      const response = await this.httpService.request<T>(config);
      return response.data;
    } catch (error) {
      console.error('Error in custom request to PokeAPI:', error.message);
      throw error;
    }
  }
  
  /**
   * Obtiene información detallada de un Pokémon combinando múltiples endpoints
   */
  async getPokemonDetails(idOrName: string): Promise<any> {
    try {
      // Obtenemos la información básica del Pokémon
      const pokemon = await this.fetchData<Pokemon>(`/pokemon/${idOrName}`);
      
      // Obtenemos información adicional de la especie
      const speciesUrl = `/pokemon-species/${pokemon.id}`;
      const species = await this.fetchData<any>(speciesUrl);
      
      // Combinamos la información
      return {
        id: pokemon.id,
        name: pokemon.name,
        height: pokemon.height / 10, // Convertir a metros
        weight: pokemon.weight / 10, // Convertir a kilogramos
        types: pokemon.types.map(t => t.type.name),
        abilities: pokemon.abilities.map(a => a.ability.name),
        stats: pokemon.stats.reduce((obj, stat) => {
          obj[stat.stat.name] = stat.base_stat;
          return obj;
        }, {}),
        image: pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default,
        species: {
          genus: species.genera?.find(g => g.language.name === 'es')?.genus || 
                 species.genera?.find(g => g.language.name === 'en')?.genus,
          flavor_text: species.flavor_text_entries?.find(f => f.language.name === 'es')?.flavor_text ||
                       species.flavor_text_entries?.find(f => f.language.name === 'en')?.flavor_text,
          habitat: species.habitat?.name,
          is_legendary: species.is_legendary,
          is_mythical: species.is_mythical
        }
      };
    } catch (error) {
      console.error(`Error getting detailed Pokémon info for ${idOrName}:`, error.message);
      throw error;
    }
  }
}