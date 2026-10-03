import { useWindowDrag } from "../useWindowDrag";

/**
 * Placeholder de la mascota: un círculo menta. Los manejadores de arrastre
 * van en el propio círculo, así que solo se mueve la ventana al presionar
 * sobre él y no sobre el área transparente.
 */
export function Mascot() {
  const drag = useWindowDrag<SVGCircleElement>();

  return (
    <svg
      className="mascot"
      viewBox="0 0 200 200"
      width="200"
      height="200"
      role="img"
      aria-label="Lia"
    >
      <circle
        {...drag}
        cx="100"
        cy="100"
        r="60"
        fill="#9BE3C3"
        stroke="#45B084"
        strokeWidth="6"
      />
    </svg>
  );
}
