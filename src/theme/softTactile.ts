import { Platform } from 'react-native';

/**
 * WearWise — "Soft Tactile / Cápsula Orgánica" Design System
 * Paleta cálida en tonos lino, arena, terracota suave, salvia y espresso,
 * con bordes orgánicos redondeados (24-28px) y sombras táctiles suaves.
 */
export const SOFT_TACTILE = {
  colors: {
    canvas: '#F6F1E9',        // Fondo principal Lino Cálido
    card: '#FFFDF9',          // Tarjeta Alabastro Suave
    recessed: '#EFE8DC',      // Estudio para recortes PNG sin fondo
    pillBg: '#E7DFD1',        // Fondo táctil de píldoras inactivas
    border: '#E2D9C8',        // Borde cálido sutil
    borderStrong: '#CFC3AF',  // Borde enfatizado

    textPrimary: '#2A231D',   // Espresso profundo
    textSecondary: '#6E6257', // Taupe cálido
    textMuted: '#9A8D80',     // Piedra suave

    terracotta: '#C86D51',    // Acento principal Terracota Táctil
    terracottaSoft: '#F6E3DC',
    sage: '#587E67',          // Verde Salvia (Prenda limpia / Frescura)
    sageSoft: '#DFEDE4',
    ochre: '#C98A32',         // Ocre (1 puesta restante / Clima)
    ochreSoft: '#F8ECD7',
    clayRed: '#BC4B41',       // Arcilla Roja (Necesita lavado)
    clayRedSoft: '#F7DFDC',
    waterBlue: '#4F758E',     // Azul Agua (Clima / Lavandería)
    waterBlueSoft: '#DFECF3',
  },
  radii: {
    card: 28,
    inner: 20,
    pill: 999,
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#3A2E24',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: '#3A2E24',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
  }),
};
