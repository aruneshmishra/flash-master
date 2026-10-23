/** Built-in decks so anyone can try FlashMaster before making a sheet. */
import { hash } from '../lib/hash.js';

// Ids come from the card text, like sheet decks, so cards stay unique when decks are combined.
const make = (rows) => rows.map(([term, definition]) => ({ id: hash(`${term}\u0000${definition}`), term, definition, image: '' }));

export const SAMPLES = [
  {
    id: 'sample-spanish',
    title: 'Spanish: everyday words',
    emoji: '🇪🇸',
    lang: { term: 'es-ES', definition: 'en-US' },
    cards: make([
      ['el gato', 'the cat'], ['el perro', 'the dog'], ['la casa', 'the house'], ['el agua', 'the water'],
      ['la manzana', 'the apple'], ['el libro', 'the book'], ['la escuela', 'the school'], ['el amigo', 'the friend'],
      ['rojo', 'red'], ['azul', 'blue'], ['grande', 'big'], ['pequeño', 'small'],
      ['comer', 'to eat'], ['beber', 'to drink'], ['hablar', 'to speak'], ['dormir', 'to sleep'],
      ['hoy', 'today'], ['mañana', 'tomorrow'], ['gracias', 'thank you'], ['por favor', 'please'],
    ]),
  },
  {
    id: 'sample-space',
    title: 'Our solar system',
    emoji: '🪐',
    cards: make([
      ['Mercury', 'Smallest planet and the closest to the Sun'],
      ['Venus', 'Hottest planet, wrapped in thick clouds of carbon dioxide'],
      ['Earth', 'The only planet known to support life'],
      ['Mars', 'The red planet, home of Olympus Mons'],
      ['Jupiter', 'Largest planet, with the Great Red Spot storm'],
      ['Saturn', 'Gas giant famous for its bright ring system'],
      ['Uranus', 'Ice giant that spins on its side'],
      ['Neptune', 'Windiest planet and the farthest from the Sun'],
      ['Asteroid belt', 'Ring of rocky bodies between Mars and Jupiter'],
      ['Light-year', 'The distance light travels in one year'],
      ['The Sun', 'The star at the centre of our solar system'],
      ['The Moon', "Earth's only natural satellite"],
    ]),
  },
  {
    id: 'sample-elements',
    title: 'Chemistry: element symbols',
    emoji: '⚗️',
    cards: make([
      ['H', 'Hydrogen'], ['He', 'Helium'], ['C', 'Carbon'], ['N', 'Nitrogen'], ['O', 'Oxygen'],
      ['Na', 'Sodium'], ['Mg', 'Magnesium'], ['Al', 'Aluminium / Aluminum'], ['Si', 'Silicon'], ['Cl', 'Chlorine'],
      ['K', 'Potassium'], ['Ca', 'Calcium'], ['Fe', 'Iron'], ['Cu', 'Copper'], ['Ag', 'Silver'], ['Au', 'Gold'],
    ]),
  },
];

export const findSample = (id) => SAMPLES.find((s) => s.id === id);
