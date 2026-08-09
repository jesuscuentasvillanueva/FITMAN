# Estación Fitness

App local para llevar racha de gym (con días de descanso), peso corporal y peso levantado por ejercicio. Sin servidor, sin instalación, sin dependencias externas.

## Cómo abrirla

Doble clic en `index.html`. Se abre en tu navegador y ya puedes usarla.

Si tu navegador restringe `localStorage` en archivos abiertos con doble clic (poco común, pero pasa a veces en Chrome), sirve la carpeta con un servidor local:

```bash
python -m http.server 5173
```

y abre `http://localhost:5173`.

## Registro rápido

- Botón flotante (+) abajo a la derecha: desde cualquier pestaña, marca "Entrené" o "Descanso" de hoy, registra tu peso o repite tu última serie de ejercicio en un toque.
- En **Inicio**: dos botones grandes para marcar el día, una tira de los últimos 7 días y un calendario donde tocar un día alterna entre entrenado → descanso → sin registro.
- En **Ejercicios**: si ya registraste algo antes, aparece "Repetir última serie" arriba para loguear el mismo peso/reps/series con un toque.

## Días de descanso y racha

La racha ya no se rompe por descansar: un día cuenta como "activo" si lo marcaste como entrenado **o** como descanso. Las estadísticas separan cuántos de esos días fueron entrenamiento real y cuántos descanso, para que la racha refleje constancia, no solo entrenamiento.

## Cómo guarda los datos

Todo se guarda automáticamente en el `localStorage` del navegador (es decir, queda en esa computadora y ese navegador — no se sube a internet). Desde la pestaña **Datos** puedes:

- Exportar todo a un JSON (respaldo completo, sirve para restaurar o pasar a otra compu).
- Exportar por separado la racha, el peso corporal o los ejercicios a CSV (para abrir en Excel/Sheets).
- Importar un JSON para restaurar un respaldo (reemplaza los datos actuales).

## Estructura

- `index.html` — estructura de la app
- `style.css` — estilos (mobile-first, tema oscuro de marca por defecto, variante clara automática)
- `app.js` — toda la lógica (sin frameworks)
- `logo.svg` — logo/favicon de la app
- `marca.jpg` — identidad de marca de referencia (colores y estilo)

Al ser HTML/CSS/JS puro y mobile-first, migrarla a una app móvil real (ej. envolviéndola con Capacitor, o reescribiendo la lógica de `app.js` en algo como React Native) más adelante es directo — la lógica de datos ya está separada del render.
