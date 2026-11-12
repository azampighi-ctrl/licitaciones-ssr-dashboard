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
| Equipos e Instrumentación (Welko) | Compra, arriendo, instalación, calibración o servicio de **equipos de medición e instrumentación hídrica y ambiental**: caudalímetros, medidores y transmisores de nivel y presión, sondas multiparamétricas y sensores de calidad de agua (pH, oxígeno disuelto, turbidez, conductividad, cloro), sensores y redes hidrométricas, estaciones meteorológicas o fluviométricas, telemetría y automatización (incluida la de APR/SSR), dataloggers, pluviómetros, **monitoreo de extracciones efectivas (DGA)** y habilitación de pozos con equipamiento. Oportunidades para Welko SpA (welko.cl) |

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
- impulsión
- bombeo
- acuífero
- recarga artificial
- infiltración
- sondaje
- hidrología
- escasez hídrica
- seguridad hídrica
- factibilidad
- prefactibilidad
- fuente de agua
- fluviométrica
- red de monitoreo
- estudio de riego

### Equipos e instrumentación (Welko)

Palabras para detectar compras y servicios de equipos de medición, según las líneas de
producto de welko.cl (nivel, temperatura y presión; calidad de agua; caudal; telemetría y
automatización; meteorología) y su oferta para la normativa DGA de Monitoreo de Extracciones
Efectivas. Evaluadas contra ~31.000 licitaciones de 60 días: solo se dejaron las que no traen
equipamiento médico u otro ruido (se descartaron «equipos de monitoreo», «oxímetro», «PLC»,
«monitoreo en línea», «drenaje» y «riles»).

- hidrométrica
- multiparamétrica
- estación meteorológica
- telemetría
- datalogger
- registrador de datos
- sensor de nivel
- sonda de nivel
- medidor de nivel
- caudalímetro
- flujómetro
- medidor de caudal
- macromedidor
- medidor de agua
- limnímetro
- limnígrafo
- pluviómetro
- correntómetro
- turbidímetro
- conductivímetro
- extracciones efectivas
- extracción efectiva
- monitoreo de extracciones
- control de extracciones
- medición de caudal
- habilitación de pozo
- oxígeno disuelto
- turbidez
- cloro residual
- analizador de cloro
- transmisor de nivel
- transmisor de presión
- sonda de presión
- medición de nivel
- nivel freático
- humedad de suelo
- lorawan

## Exclusión automática: construcción, mantención e inspección de obras

Antes de proponer candidatas, el barrido por API deja fuera las licitaciones cuyo **nombre**
contiene alguna de estas palabras. No llegan a Claude ni al dashboard.

- construcción
- constr
- const
- mantención
- mantenimiento
- conservación
- conserv
- reparación
- ejecución de obras
- obras civiles
- AIF
- asesoría a la inspección fiscal
- inspección fiscal

**Excepciones.** Si el nombre contiene además alguna de las siguientes palabras, la licitación
no se excluye y Claude la revisa (por ejemplo «Construcción de piezómetros y estudio geofísico»
o «Diseño construcción servicio APR»):

- diseño
- estudio
- diagnóstico
- consultoría
- ingeniería
- piezómetro
- sondaje
- catastro
- factibilidad
- prefactibilidad

## Qué se descarta

- Construcción o ejecución de obras, aunque mencionen SSR/APR (excepto pozos o piezómetros
  que formen parte de un estudio hidrogeológico). La mayoría ya se excluye automáticamente por
  nombre (sección anterior); Claude descarta las que el nombre no delata, como «Mejoramiento
  sistema APR…» cuando la descripción muestra que es obra.
- Asesoría a la Inspección Fiscal (AIF) de obras.
- Suministro, operación o mantención: entrega de agua en camión aljibe, compra de insumos,
  análisis de laboratorio rutinarios, operación de plantas. **Excepción:** la compra, arriendo,
  instalación o calibración de equipos de medición e instrumentación hídrica, meteorológica o
  de calidad de agua se incluye en la categoría «Equipos e Instrumentación (Welko)».
- Telemetría, automatización o equipos de medición de APR/SSR van a Welko aunque los traiga una
  palabra de Hidrogestión (por ejemplo «Telemetría APR Los Maitenes»). Un diseño o estudio que
  incluye telemetría como parte del proyecto sigue siendo de Hidrogestión.
- Para Welko se descarta el equipamiento médico, de laboratorio clínico o de uso general
  (oxímetros de pulso, monitores de pacientes, termómetros de bodega, etc.) y los reactivos.
- Licitaciones ya cerradas al momento de detectarlas.

Las descartadas se anotan en el archivo del barrido con su motivo, para revisar el criterio.

## Regiones

Todas las regiones se incluyen. Biobío y Coquimbo están fuera del foco prioritario solo para
licitaciones de la Dirección de Obras Hidráulicas (DOH): el dashboard resalta en rojo esas, sin
excluirlas. Las de otros mandantes (municipios, DGA, GORE, etc.) en esas regiones se muestran
normal.

## Campo «interés»

Valores: Alto, Medio-Alto, Medio, Bajo-Medio, Bajo. Lo propone la tarea según el ajuste con
la experiencia de Hidrogestión SpA (diseños SSR/APR e hidrogeología: Alto o Medio-Alto) y el
equipo lo puede corregir. No se muestra en el dashboard.
