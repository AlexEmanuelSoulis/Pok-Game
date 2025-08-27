// api.js
const BASE_URL = "https://pokeapi.co/api/v2/pokemon/";

export async function getPokemon(name) {
  const res = await fetch(BASE_URL + encodeURIComponent(name.toLowerCase()));
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    sprite: data.sprites.other["official-artwork"].front_default,
    types: data.types.map(t => t.type.name),
  };
}
