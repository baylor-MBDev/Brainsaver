// DOOMTYPE design tokens
// Lilac paper base, ink violet, rot orange for doom states, growth green for wins.
// Archivo Black shouts. Space Mono is for anything typed or counted.

export const colors = {
  paper: '#EFEBFF',
  ink: '#221C3A',
  rot: '#FF5C38',
  growth: '#2FB56B',
  zap: '#FFD23F',
  keyFace: '#FFFFFF',
  keyShadow: '#221C3A',
  faded: '#8B84A8',
};

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

export const space = (n) => n * 4;

export const keycap = {
  borderWidth: 3,
  borderColor: colors.ink,
  borderRadius: 14,
  shadowOffset: 5, // hard offset shadow, no blur. Keys are physical.
};
