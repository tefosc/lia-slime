/**
 * Placeholder de la mascota: un círculo menta. El atributo
 * `data-tauri-drag-region` va en el propio círculo, así que solo se arrastra
 * la ventana al presionar sobre él y no sobre el área transparente.
 */
export function Mascot() {
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
        data-tauri-drag-region
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
