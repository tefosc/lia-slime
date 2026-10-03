/** Paso de tiempo máximo, en segundos, para evitar saltos tras una pausa. */
export const PASO_MAXIMO = 0.033;

export function limitarPaso(dt: number): number {
  return Math.min(Math.max(dt, 0), PASO_MAXIMO);
}

/**
 * Resorte amortiguado: el valor persigue al objetivo con inercia.
 * Usa integración de Euler semi-implícita (primero la velocidad y después la
 * posición), que se mantiene estable con los pasos que da el navegador.
 */
export class Resorte {
  valor: number;
  objetivo: number;
  velocidad = 0;
  readonly rigidez: number;
  readonly amortiguacion: number;

  constructor(valor: number, rigidez: number, amortiguacion: number) {
    this.valor = valor;
    this.objetivo = valor;
    this.rigidez = rigidez;
    this.amortiguacion = amortiguacion;
  }

  /** Avanza la simulación `dt` segundos. */
  paso(dt: number): void {
    const aceleracion =
      -this.rigidez * (this.valor - this.objetivo) -
      this.amortiguacion * this.velocidad;
    this.velocidad += aceleracion * dt;
    this.valor += this.velocidad * dt;
  }

  /** Empujón instantáneo: suma velocidad sin cambiar el objetivo. */
  impulso(velocidad: number): void {
    this.velocidad += velocidad;
  }

  get enReposo(): boolean {
    return (
      Math.abs(this.valor - this.objetivo) < 0.001 &&
      Math.abs(this.velocidad) < 0.01
    );
  }
}

/**
 * Acerca `valor` a `objetivo` de forma exponencial, sin inercia. Sirve para
 * encender y apagar poco a poco los movimientos continuos de cada estado.
 */
export function acercar(
  valor: number,
  objetivo: number,
  dt: number,
  ritmo: number,
): number {
  return objetivo + (valor - objetivo) * Math.exp(-ritmo * dt);
}
