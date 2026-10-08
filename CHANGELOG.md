# Cambios

Este archivo sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [0.1.0] - sin publicar

Primera versión. Solo para Windows. El proyecto y el instalador se llaman
**Lia Slime**; Lia es el nombre del personaje.

### Añadido

- Mascota flotante sin marco, transparente y siempre encima, que no aparece
  en la barra de tareas ni roba el foco. Se arrastra con el mouse y los clics
  fuera de su cuerpo pasan a la ventana de debajo.
- Estados según los eventos de Claude Code: en reposo, trabajando, "te
  necesita" y "terminó", con varias conversaciones a la vez. Mientras
  trabaja, una burbuja muestra con un dibujo qué está haciendo Claude.
- Tarjeta de permisos: muestra el comando, el archivo o la URL y permite o
  deniega solo cuando se pulsa un botón. Marca los comandos que parecen
  peligrosos.
- Resultado al terminar una tarea: burbuja ✓ y tarjeta con el último mensaje
  de Claude, la duración y las herramientas usadas. Modo privado.
- Sin conexión: si el equipo se queda sin red mientras Claude trabaja, Lia
  lo muestra en su burbuja, con cara de preocupación.
- Aviso cuando Claude Code se detiene por un límite de uso u otro error. Con
  el límite agotado, Lia se va a descansar: suena un aviso propio, se duerme
  y se oculta hasta el siguiente evento.
- Preguntas de Claude con opciones: se pueden responder desde el globo de
  Lia, o pasarlas a Claude Code para escribir una respuesta libre.
- Todo lo que dice Lia sale en un mismo globo de diálogo, con su trazo y sus
  colores, y una barra con el tiempo que queda para responder un permiso.
- Isla: panel escondido en el borde superior de la pantalla que baja al
  dejar el cursor ahí, con lo último que pasó (tareas terminadas, permisos y
  avisos) y el mensaje completo de cada tarea, con títulos, listas y código
  bien presentados. "Ver más" y "Ver todo" la abren con el texto entero.
- Interacciones: mirada que sigue al cursor, rebote al tocarla, sorpresa,
  enojo, caricias y mareo.
- Sueño por inactividad: se adormece, se derrite en un charquito y se oculta;
  vuelve con el siguiente evento.
- Sonidos sintetizados, en dos categorías que se pueden silenciar, con
  volumen.
- Apariencia: seis paletas de color (Menta, Celeste, Lila, Durazno, Limón y
  Algodón) y color libre con un control de tono o un color en hexadecimal.
  Se elige en la pestaña "Apariencia" de Ajustes, con vista previa, o desde
  la bandeja, y cambia al instante.
- Disfraces: bruja, calabaza, vampiro, gatito y de gala. Son prendas que Lia
  se pone encima, con movimiento propio (el sombrero se ladea, la hoja de la
  calabaza se mece, la capa ondea, las orejas reaccionan) y una escala de seguridad que evita que
  nada se recorte. Los clics sobre las prendas pasan a la ventana de debajo.
- Al acariciarla un rato, Lia se enamora: ojos de corazón, una ráfaga de
  corazones y se queda flotando.
- Icono en la bandeja: mostrar u ocultar, modo privado, inactividad, sonidos,
  apariencia, iniciar con Windows, Ajustes y salir.
- Ventana de Ajustes con instalación y retirada de los hooks de Claude Code:
  vista previa del cambio, confirmación, respaldo y escritura atómica.
- Receptor local de eventos en `127.0.0.1:47615` con token por arranque.
- Saludo al arrancar con Windows.
- Instalador NSIS por usuario, sin permisos de administrador, en español e
  inglés.

### Seguridad

- Política de seguridad de contenido estricta y permisos mínimos por ventana.
- Sin peticiones de red hacia afuera, telemetría ni actualizaciones
  automáticas.
- El instalador de esta versión no está firmado; se publican sus SHA-256.

[0.1.0]: https://github.com/tefosc/lia-slime/releases/tag/v0.1.0
