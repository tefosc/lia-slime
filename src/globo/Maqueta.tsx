import { TarjetaAviso } from "../permisos/TarjetaAviso";
import { TarjetaPermiso } from "../permisos/TarjetaPermiso";
import { TarjetaPregunta } from "../permisos/TarjetaPregunta";
import { TarjetaResultado } from "../resultados/TarjetaResultado";
import type { Resultado } from "../resultados/useResultados";

// Solo en desarrollo: galería con todos los globos y datos de ejemplo, para
// revisar el diseño sin Claude Code. Se abre en el navegador con
// http://localhost:1420/?maqueta mientras corre `pnpm dev` o `pnpm tauri dev`.
// No entra en la compilación de producción (ver src/main.tsx).

const ahora = Date.now();
const nada = () => {};

const resultado = (id: number, leido: boolean, minutos: number): Resultado => ({
  id,
  etiqueta: `Conversación ${id}`,
  duracionS: 130 * id,
  herramientas: 7,
  principales: [
    { nombre: "Edit", usos: 4 },
    { nombre: "Read", usos: 2 },
    { nombre: "Bash", usos: 1 },
  ],
  ediciones: 4,
  mensaje:
    "Listo. Cambié la validación del formulario y añadí dos pruebas.\nLas dos pasan; revisa el mensaje de error del campo de correo, por si prefieres otro texto.",
  momento: ahora - minutos * 60_000,
  caduca: ahora + 600_000,
  leido,
});

const solicitud = (id: number, detalle: string) => ({
  id,
  herramienta: "Bash",
  detalle,
  etiqueta: "Conversación 1",
  expira: Date.now() + 42_000,
});

export function Maqueta() {
  const estilo = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    padding: "16px",
    background: "#3b3d47",
    minHeight: "100%",
    alignContent: "flex-start",
  } as const;
  return (
    <div style={estilo}>
      <TarjetaPermiso
        solicitud={solicitud(1, "pnpm test")}
        pendientes={1}
        onResolver={nada}
        onVerTodo={nada}
      />
      <TarjetaPermiso
        solicitud={solicitud(2, "rm -rf ./dist && git push --force origin main")}
        pendientes={3}
        onResolver={nada}
        onVerTodo={nada}
      />
      <TarjetaPregunta
        pregunta={{
          id: 1,
          sesion: "x",
          etiqueta: "Conversación 1",
          texto: "¿Qué base de datos prefieres para el proyecto?",
          total: 2,
        }}
        onCerrar={nada}
      />
      <TarjetaAviso
        aviso={{
          id: 1,
          titulo: "Me voy a descansar un ratito",
          texto:
            "Se nos acabó el límite de Claude por ahora. Voy a echarme una siesta; en cuanto vuelvas a escribirle, aquí estaré.",
          descansa: true,
        }}
        onCerrar={nada}
      />
      <TarjetaResultado
        resultado={resultado(1, true, 0)}
        pendientes={1}
        privado={false}
        onCerrar={nada}
        onPrivado={nada}
        onRegistro={nada}
        onVerMas={nada}
      />
      <div className="escena-izquierda">
        <TarjetaResultado
          resultado={{ ...resultado(3, true, 0), mensaje: null }}
          pendientes={0}
          privado
          onCerrar={nada}
          onPrivado={nada}
          onRegistro={nada}
          onVerMas={nada}
        />
      </div>
    </div>
  );
}
