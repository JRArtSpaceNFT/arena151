'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { POKEMON_DATABASE, searchPokemon, getPokemonSpriteUrl } from '@/lib/pokemon-data';
import { TYPE_COLORS } from '@/lib/constants';
import type { PokemonType } from '@/types';

interface PokemonSelectorProps {
  selectedId: number | null;
  onSelect: (pokemon: { id: number; name: string; types: PokemonType[] }) => void;
}

export default function PokemonSelector({ selectedId, onSelect }: PokemonSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPokemon = useMemo(() => {
    return searchPokemon(searchQuery);
  }, [searchQuery]);

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Pokémon by name, type, or number..."
          className="w-full pl-12 pr-12 py-3 bg-slate-900/50 backdrop-blur-xl border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-white placeholder-slate-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-400 mb-4">
        {filteredPokemon.length} Pokémon {searchQuery && `matching "${searchQuery}"`}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto pr-2">
        {filteredPokemon.map((pokemon) => (
          <motion.button
            key={pokemon.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(pokemon as any)}
            className={`bg-slate-900/50 backdrop-blur-xl p-3 rounded-xl border-2 transition-all text-left ${
              selectedId === pokemon.id
                ? 'border-blue-500 shadow-lg shadow-blue-500/50 bg-blue-950/30'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="aspect-square mb-2 relative">
              <img
                src={getPokemonSpriteUrl(pokemon.id)}
                alt={pokemon.name}
                className="w-full h-full object-contain pixelated"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-slate-500 mb-1">#{pokemon.id.toString().padStart(3, '0')}</p>
            <p className="font-bold text-sm truncate">{pokemon.name}</p>
            <div className="flex gap-1 mt-2">
              {pokemon.types.map((type) => (
                <span
                  key={type}
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{
                    backgroundColor: TYPE_COLORS[type] + '40',
                    color: TYPE_COLORS[type],
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </motion.button>
        ))}
      </div>

      <style jsx>{`
        .pixelated {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}
