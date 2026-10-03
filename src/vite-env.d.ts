/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solo desarrollo: estado con el que arranca Lia (para pruebas y medidas). */
  readonly VITE_LIA_ESTADO?: string;
}
