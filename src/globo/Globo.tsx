import type { ReactNode } from "react";
import "./globo.css";

interface Props {
  /** Colores: menta (normal), amarillo (ojo, peligro) o rosa (algo falló). */
  variante?: "normal" | "peligro" | "aviso";
  titulo: string;
  /** Pastilla sobre el borde, por ejemplo "y 2 más esperándote". */
  pastilla?: string | null;
  /** Controles pequeños a la derecha del título. */
  acciones?: ReactNode;
  children: ReactNode;
  botones: ReactNode;
  /** Tiempo que queda para responder, de 1 (todo) a 0 (nada). */
  tiempo?: number;
  rol: "dialog" | "status";
  etiqueta?: string;
  /** El usuario movió o pulsó el puntero dentro del globo. */
  onActividad?: () => void;
}

/**
 * Globo de diálogo de Lia: la única tarjeta de la app. Sale de su boca con
 * una colita y usa su mismo trazo y sus colores, para que todo lo que dice
 * (permisos, avisos, resultados y mensajes recientes) se vea igual.
 *
 * Conserva la clase `tarjeta`: `src/zonas.ts` la usa para saber dónde debe
 * recibir el mouse la ventana.
 */
export function Globo({
  variante = "normal",
  titulo,
  pastilla,
  acciones,
  children,
  botones,
  tiempo,
  rol,
  etiqueta,
  onActividad,
}: Props) {
  return (
    <div
      className={`tarjeta globo globo-${variante}`}
      role={rol}
      aria-label={etiqueta}
      onPointerMove={onActividad}
      onPointerDown={onActividad}
    >
      {pastilla && <span className="globo-pastilla">{pastilla}</span>}
      <div className="globo-cabecera">
        <span className="globo-titulo">{titulo}</span>
        {acciones}
      </div>
      <div className="globo-cuerpo">{children}</div>
      {tiempo !== undefined && (
        <div className="globo-tiempo" aria-hidden="true">
          <div style={{ transform: `scaleX(${Math.min(1, Math.max(0, tiempo))})` }} />
        </div>
      )}
      <div className="globo-botones">{botones}</div>
    </div>
  );
}

interface BotonProps {
  tipo: "principal" | "secundario" | "enlace" | "icono";
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Botón que no ocupa todo el ancho. */
  corto?: boolean;
  titulo?: string;
  pulsado?: boolean;
}

/**
 * Botón del globo. Sin foco ni atajos: la ventana es `focusable: false`, así
 * que pulsarlo no le quita el foco al editor.
 */
export function Boton({
  tipo,
  children,
  onClick,
  disabled,
  corto,
  titulo,
  pulsado,
}: BotonProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`boton boton-${tipo}${corto ? " boton-corto" : ""}`}
      disabled={disabled}
      title={titulo}
      aria-pressed={pulsado}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
