import { Controller, Get, Post, Body, Param, Query, Delete, Put } from '@nestjs/common';
import { ExampleService } from './example.service';

/**
 * Controlador de ejemplo que muestra cómo usar el ExampleService con HttpService
 * para interactuar con la PokeAPI
 */
@Controller('pokemon')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  /**
   * Obtiene un Pokémon por su ID o nombre
   */
  @Get(':idOrName')
  async getPokemon(@Param('idOrName') idOrName: string) {
    return this.exampleService.fetchData(`/pokemon/${idOrName}`);
  }

  /**
   * Obtiene una lista de Pokémon con paginación
   */
  @Get()
  async getPokemonList(@Query('limit') limit: number = 20, @Query('offset') offset: number = 0) {
    return this.exampleService.fetchData('/pokemon', { limit, offset });
  }

  /**
   * Obtiene información detallada de la especie de un Pokémon
   */
  @Get('species/:id')
  async getPokemonSpecies(@Param('id') id: string) {
    return this.exampleService.fetchData(`/pokemon-species/${id}`);
  }

  /**
   * Obtiene información sobre un tipo de Pokémon
   */
  @Get('type/:id')
  async getPokemonType(@Param('id') id: string) {
    return this.exampleService.fetchData(`/type/${id}`);
  }

  /**
   * Busca Pokémon por nombre (simulando una operación POST)
   */
  @Post('search')
  async searchPokemon(@Body() data: { name: string }) {
    return this.exampleService.fetchData(`/pokemon/${data.name.toLowerCase()}`);
  }

  /**
   * Simula la actualización de un Pokémon (demo)
   * Nota: PokeAPI es de solo lectura, esto es solo para demostración
   */
  @Put(':id')
  async updatePokemon(@Param('id') id: string, @Body() data: any) {
    // En realidad esto solo devuelve el Pokémon existente, ya que PokeAPI es de solo lectura
    const pokemon: any = await this.exampleService.fetchData(`/pokemon/${id}`);
    return { ...pokemon, ...data, updated: true, note: 'Esta es una simulación, PokeAPI es de solo lectura' } as any;
  }

  /**
   * Simula la eliminación de un Pokémon (demo)
   * Nota: PokeAPI es de solo lectura, esto es solo para demostración
   */
  @Delete(':id')
  async deletePokemon(@Param('id') id: string) {
    // Verificamos que el Pokémon existe antes de simular su eliminación
    await this.exampleService.fetchData(`/pokemon/${id}`);
    return { success: true, message: `Pokémon #${id} eliminado (simulación)`, note: 'Esta es una simulación, PokeAPI es de solo lectura' };
  }
}