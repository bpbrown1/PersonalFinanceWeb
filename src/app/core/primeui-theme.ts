import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const personalFinancePrimeTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#edfafa',
      100: '#d7f4f1',
      200: '#afe8e3',
      300: '#7bd7d0',
      400: '#40c3bb',
      500: '#159f9d',
      600: '#087f82',
      700: '#0b6569',
      800: '#105156',
      900: '#124449',
      950: '#03282c',
    },
    formField: {
      paddingX: '0.75rem',
      paddingY: '0.65rem',
      borderRadius: '0.7rem',
      focusRing: {
        width: '3px',
        style: 'solid',
        color: 'var(--color-primary-soft)',
        offset: '0',
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: '0.7rem',
        paddingX: '0.95rem',
        paddingY: '0.62rem',
        label: {
          fontWeight: '800',
        },
      },
    },
    progressbar: {
      root: {
        background: 'var(--color-border)',
        borderRadius: '999px',
      },
    },
  },
});
