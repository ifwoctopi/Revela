// Révéla palette: brown, ginger red and cream. Espresso matches the app icon
// background so branded surfaces and the launcher icon read as one piece.
const palette = {
  espresso: '#3A1700',
  brown: '#6B3A1F',
  cocoa: '#8A5A3C',
  ginger: '#B8461F',
  gingerDark: '#7C2D14',
  gingerSoft: '#F4D6C2',
  copper: '#D0703A',
  cream: '#F7EEDF',
  creamLight: '#FFFAF2',
  creamDeep: '#EFDDC5',
};

export const theme = {
  colors: {
    ...palette,
    background: palette.cream,
    surface: palette.creamLight,
    surfaceAlt: palette.creamDeep,
    text: '#3A1F12',
    mutedText: '#7A5B49',
    primary: palette.ginger,
    primaryDark: palette.gingerDark,
    primarySoft: palette.gingerSoft,
    accent: palette.copper,
    olive: palette.brown,
    border: '#E2CBB0',
    danger: '#9D2B22',
    dangerSoft: '#F8E3DE',
    success: palette.brown,
    onDark: palette.creamLight,
    onDarkMuted: 'rgba(255, 250, 242, 0.72)',
  },
  radius: { sm: 12, md: 16, lg: 22, pill: 999 },
  shadow: {
    shadowColor: '#3A1700',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
};
