# Criterios del barrido diario

Este archivo lo lee la tarea diaria antes de buscar. El equipo de estudios puede editarlo
directamente en GitHub: los cambios rigen desde el barrido siguiente.

## Qué buscamos

Licitaciones de **ingeniería y estudios** (no de obra) en cinco categorías. La categoría se
asigna según el objeto principal de la licitación:

| Categoría | Incluye |
|---|---|
| Diseños SSR/APR | Diseños de ingeniería, mejoramiento, ampliación, reposición o conservación de servicios sanitarios rurales (SSR) y sistemas de agua potable rural (APR), incluidos alcantarillado y estanques asociados |
| Diagnósticos Técnicos | Diagnósticos, catastros, inspección técnica de estudios (ITE) y evaluaciones técnicas de SSR/APR |
| Estudio Tarifario | Estudios tarifarios de SSR/APR |
| Estudios Hidrogeológicos | Estudios hidrogeológicos y geofísicos, prospección de aguas subterráneas, construcción de pozos o piezómetros asociada a un estudio, redes de monitoreo |
| Gestión Hídrica | Planes y estrategias de gestión hídrica, estudios de cuencas, balances hídricos, modelación hidrológica e hidráulica |

## Palabras clave de búsqueda

El barrido diario por API revisa el nombre de todas las licitaciones publicadas en Mercado
Público y propone como candidatas las que contienen alguna de estas palabras (sin importar
mayúsculas, tildes, plurales ni siglas con puntos). La tarea de Claude decide luego cuáles
incluir según los criterios de este archivo; las descartadas no se vuelven a proponer.

- agua potable
- agua potable rural
- alcantarillado
- saneamiento sanitario
- APR
- SSR
- servicio sanitario rural
- sistema sanitario rural
- diseño agua potable
- diagnóstico agua potable
- estudio tarifario
- hidrogeológico
- hidrogeología
- geofísico
- aguas subterráneas
- prospección
- piezómetro
- pozo profundo
- gestión hídrica
- plan estratégico de gestión hídrica
- recursos hídricos
- cuenca
- balance hídrico
- modelación hidrológica
- modelación hidráulica
- estudio hidrológico
- estudio hidráulico
- humedal
- derechos de agua

## Qué se descarta

- Construcción o ejecución de obras, aunque mencionen SSR/APR (excepto pozos o piezómetros
  que formen parte de un estudio hidrogeológico).
- Asesoría a la Inspección Fiscal (AIF) de obras.
- Suministro, operación o mantención: entrega de agua en camión aljibe, compra de insumos,
  análisis de laboratorio rutinarios, operación de plantas.
- Licitaciones ya cerradas al momento de detectarlas.

Las descartadas se anotan en el archivo del barrido con su motivo, para revisar el criterio.

## Regiones

Todas las regiones se incluyen. Biobío y Coquimbo están fuera del foco prioritario y el
dashboard las resalta en rojo, pero no se excluyen.

## Campo «interés»

Valores: Alto, Medio-Alto, Medio, Bajo-Medio, Bajo. Lo propone la tarea según el ajuste con
la experiencia de Hidrogestión SpA (diseños SSR/APR e hidrogeología: Alto o Medio-Alto) y el
equipo lo puede corregir. No se muestra en el dashboard.
