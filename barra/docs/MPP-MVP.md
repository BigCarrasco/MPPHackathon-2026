# barra. — Cotizaciones pagadas con MPP, solo Tempo Testnet

## Qué has construido

Antes tenías un **frontend JavaScript**: la página calculaba inventario, ventas y reglas en el navegador y guardaba datos en `localStorage`. El antiguo servidor solo entregaba HTML, CSS e imágenes.

Ahora el mismo proyecto tiene también un **backend JavaScript sobre Node.js**. El backend añade la API del proveedor, el orquestador de cotizaciones y la verificación del gasto. No necesitas migrar el dashboard ni aprender otro lenguaje para seguir este MVP.

| Pieza | Responsabilidad | Dónde se ejecuta |
| --- | --- | --- |
| Dashboard | Inventario simulado, reglas de UX, botón y presupuesto | Navegador |
| Backend / agente | Calcula faltantes, comprueba límites y coordina el pago | Node.js |
| API del proveedor | Cobra por consultar y devuelve precios simulados | Node.js, ruta separada |
| MPP | Desafío 402, credencial y recibo HTTP | SDK `mppx` en cliente y servidor |
| Tempo Moderato | Confirma la transferencia de pathUSD ficticios | Red Testnet 42431 |

El agente del MVP es un orquestador determinista. No requiere un modelo de lenguaje ni decide precios. El proveedor usa un catálogo de prueba en el servidor.

## El recorrido de una solicitud

1. Pulsas **Generar presupuesto** en Abastecimiento.
2. El navegador envía `POST /api/budget` con el inventario simulado, las reglas y un `requestId`.
3. Node calcula los faltantes usando la misma función de inventario que el dashboard. Rechaza productos, cantidades o reglas inválidos.
4. El backend solicita `GET /api/supplier/quote?items=...` mediante HTTP local.
5. El proveedor devuelve **402** con `WWW-Authenticate: Payment`, importe, moneda, destinatario y cadena.
6. El backend inspecciona ese desafío. Comprueba red 42431, pathUSD, destinatario configurado, precio exacto, cesta y límites. Reserva el gasto antes de firmar.
7. El cliente MPP firma una transferencia de **0,01 pathUSD de prueba** y reintenta con `Authorization: Payment ...`.
8. El proveedor verifica la credencial, envía la transacción a Tempo Testnet y espera su confirmación. El SDK verifica el pago y evita reutilizarlo.
9. Devuelve **200**, precios simulados y `Payment-Receipt`. El dashboard muestra el presupuesto en EUR y el coste MPP por separado.

El 402 ocurre **entre backend y proveedor**. En la pestaña Red del navegador verás el `POST /api/budget`; el recorrido interno se ve en la terminal y en **Ver recorrido y recibo**. Puedes inspeccionar el 402 directamente con el comando de abajo.

El inventario inicial necesita 19 lager, 3 IPA, 12 negras y 6 sin alcohol: 40 botellas por **55,20 €**. Ese importe es una estimación comercial simulada. El micropago remunera una consulta completa. Las unidades de pathUSD de prueba no se suman a euros; el gas de Testnet queda aparte. No hay endpoint que compre inventario.

## Ejecutar desde cero

Desde la **raíz del repositorio**, con Node.js 22 o posterior:

```sh
npm ci
npm run setup:testnet
npm run dev
```

Abre http://localhost:5173. Si otra demo ocupa el puerto:

```sh
PORT=5186 npm run dev
```

Abre http://localhost:5186. Cada puerto tiene su propio inventario del navegador.

`setup:testnet` crea una clave desechable del pagador, un destinatario de prueba y el secreto MPP en `barra/.env`. Solicita fondos gratuitos al faucet y verifica que el RPC responde con la cadena 42431. Conserva un `.env` existente. Si el faucet falla, vuelve a ejecutar el comando; no necesitas comprar tokens. Nunca uses una clave que controle fondos reales. La cuenta receptora generada es desechable.

Puedes abrir el dashboard sin ejecutar el setup: ofrece un desafío de prueba, pero no paga consultas hasta configurar la cuenta y reiniciar Node.

`npm run build` genera el frontend estático. Para pagar cotizaciones usa `npm run dev` o `npm start`: la API y las claves pertenecen al servidor.

## Pruebas que puedes hacer tú

### A. Pruebas sin red

```sh
npm test
```

Cubren inventario y reglas existentes, importes en céntimos, bloqueo de mainnet, destinatario y moneda incorrectos, pausa, permisos, límites, persistencia y concurrencia. Las pruebas de orquestación usan un adaptador de pago simulado y están identificadas como tal. El endpoint 402 sí usa el SDK oficial. Ninguna prueba unitaria llama al faucet ni mueve tokens.

### B. Prueba completa contra Tempo Testnet

Con el setup completado:

```sh
npm run demo:testnet
```

Arranca un servidor temporal en un puerto libre y comprueba:

- Un GET sin pagar recibe 402 y el desafío MPP.
- Autopilot pausado recibe 403 antes de pagar.
- Una consulta autorizada recibe 200, cuatro líneas, 55,20 € y recibo.
- La transacción del recibo existe y tiene estado `success` en Tempo Testnet.
- Repetir el mismo `requestId` devuelve el recibo guardado sin otro micropago.
- El objeto de inventario no cambia.

Cada ejecución nueva de este comando consume **una consulta de prueba**, además del gas. Los reintentos de la misma solicitud no cobran de nuevo.

### C. Mirar el intercambio HTTP

Con el servidor abierto, en otra terminal:

```sh
curl -i http://localhost:5173/api/health
curl -i http://localhost:5173/api/supplier/quote
curl -s http://localhost:5173/openapi.json
```

La segunda llamada debe devolver 402 y `WWW-Authenticate: Payment`. Todavía no entrega precios. El catálogo predeterminado permite inspeccionarlo sin escribir parámetros.

Para probar el orquestador sin la interfaz, desde la raíz:

```sh
curl -i http://localhost:5173/api/budget \
  -H 'Content-Type: application/json' \
  --data-binary @barra/examples/budget-request.json
```

Repite exactamente el comando: `cached` debe cambiar a `true`, con el mismo recibo. Este archivo tiene un ID fijo; si caduca, cambia `requestId` por un UUID nuevo para solicitar otra cotización. Para un bloqueo sin pago cambia `policy.paused` a `true` y usa otro ID. Las claves nunca van en estos archivos ni comandos.

### D. Demostración visual

1. Abre Abastecimiento con el inventario inicial.
2. Pulsa Generar presupuesto y abre Ver recorrido y recibo.
3. Explica 55,20 € estimados y 0,01 pathUSD ficticios de consulta. Muestra el recibo y su transacción en el explorador Testnet.
4. Pulsa otra vez: muestra “Resultado guardado, sin nuevo pago”.
5. En My Autopilot, pausa. Al generar de nuevo, se rechaza antes de pagar.
6. Reanuda. Vende una bebida y vuelve a Abastecimiento: cambia la propuesta y se indica que el presupuesto anterior necesita actualizarse.

La acción existente Revisar y cerrar pedido conserva su solicitud simulada local. Generar presupuesto no la ejecuta y tampoco rellena existencias.

## Dónde depurar

| Lo que quieres entender | Herramienta / lugar | Qué mirar |
| --- | --- | --- |
| El botón no responde | Herramientas de desarrollo → Consola | Error de JavaScript; `src/features/budget.js` |
| Qué envía el navegador | Herramientas de desarrollo → Red → `/api/budget` | JSON, estado HTTP, `requestId`, `quote`, `payment`, `trace` |
| El desafío 402 | Terminal con `curl -i` | Cabecera `WWW-Authenticate` |
| El orden de los pasos | Terminal donde ejecutas Node | Líneas `[budget requestId]`; filtra por ese ID |
| Por qué se bloqueó | Respuesta `error`, reglas y `server/quotes.mjs` | Pausa, permisos, envases, gasto y número diario |
| Firma y verificación | Depurador Node | `server/payments.mjs` y `server/api.mjs` |
| La transferencia | Enlace del recibo al explorador Testnet | Hash, estado y cadena |
| Reintentos o resultado incierto | `barra/.data/testnet.json` | `budget-ledger`, `status`, `transactionHash`, `feeMicros` |

Para poner puntos de interrupción, desde `barra/`:

```sh
node --inspect scripts/serve.mjs
```

En VS Code usa **JavaScript Debug Terminal**, ejecuta ese comando y pon un breakpoint en `server/api.mjs`: recepción del 402, comprobación de políticas, creación de credencial y lectura del recibo. Continúa con rapidez después de firmar: las transacciones firmadas tienen una ventana de validez corta. Evita imprimir claves o la cabecera de autorización completa.

| Síntoma | Acción |
| --- | --- |
| Falta cuenta / 503 | Ejecuta setup:testnet y reinicia Node |
| Faucet o RPC no responde | Comprueba conexión y repite setup; la red está fijada a Moderato |
| No se pudo firmar | Revisa fondos ficticios y RPC; la credencial no se envió |
| Resultado de pago desconocido | Conserva la reserva; usa el hash guardado para consultar el explorador. No repitas el pago con otro ID para “arreglarlo” |
| 403 de política | Ajusta el permiso o límite que corresponda; la API no paga |
| Cotización caducada / 410 | Genera una solicitud nueva; los precios duran 15 minutos |
| Página estática sin API | Ejecuta el servidor Node en lugar de servir solo dist |

## Políticas y persistencia

Los límites del servidor están en `barra/.env` y requieren reiniciar Node. El navegador puede restringir más las reglas de productos, pausa, modo y envases; nunca puede ampliar los topes monetarios del servidor.

| Variable | Predeterminado | Tope aceptado |
| --- | ---: | ---: |
| `QUOTE_MAX_FEE_MICROS` | 10000 = 0,01 pathUSD | 10000 |
| `QUOTE_DAILY_BUDGET_MICROS` | 50000 = 0,05 pathUSD | 100000 = 0,10 |
| `QUOTE_MAX_DAILY` | 5 cotizaciones | 10 |
| `QUOTE_MAX_PACKAGES` | 50 envases | 200 |
| `QUOTE_PAUSED` | false | true bloquea |

El día del registro del servidor se calcula en **UTC**. El historial antiguo de pedidos del navegador conserva su fecha local. Son contadores separados: pedidos simulados y consultas MPP.

Antes de firmar se escribe una reserva. Si la respuesta se pierde después de enviar la credencial, esa reserva sigue contando. Un mismo ID pendiente no vuelve a pagar. Los resultados completos se guardan para reintentos; usar el ID con otra cesta o reglas devuelve 409. El desafío está vinculado a la cesta mediante `scope` y el SDK protege contra reutilización de credenciales. El gasto y la protección de reuso sobreviven a un reinicio normal.

El botón Reiniciar demo solo reinicia el inventario y las solicitudes del navegador; **no borra el gasto del backend**.

Este almacenamiento de archivos requiere **un solo proceso Node por carpeta de datos**. El MVP escucha en `127.0.0.1`; no ofrece identidad de usuarios ni permisos de producción. El inventario llega del navegador y sigue siendo simulado. Para un servicio público harían falta autenticación del pagador y almacenamiento compartido con operaciones atómicas. No expongas la ruta pagadora cambiando la dirección de escucha.

## Cómo defender el proyecto

Puedes explicarlo así:

> barra. detecta necesidades de reabastecimiento y paga por obtener una cotización de un proveedor. MPP permite que la API declare su precio mediante HTTP 402 y entregue el resultado con un recibo verificable. El agente comprueba políticas antes de firmar el micropago. La demostración utiliza Tempo Testnet y precios simulados. El encargado recibe un presupuesto; la compra de inventario queda fuera del MVP.

Sustenta cada afirmación con una evidencia:

| Afirmación | Evidencia en la demo |
| --- | --- |
| Cobra por un servicio útil | El endpoint entrega precios y disponibilidad por envase |
| Implementa MPP | 402, `WWW-Authenticate`, credencial y `Payment-Receipt` del SDK oficial |
| Usa Tempo | Transacción confirmada en Moderato 42431, con hash verificable |
| Hay gobernanza | Una consulta pausada o fuera del presupuesto se bloquea antes de firmar |
| Controla los reintentos | Mismo ID, mismo recibo, sin segundo micropago |
| Conserva el caso de uso | Faltantes derivados del inventario, presupuesto por línea y total |

Sé preciso con el alcance: catálogo y proveedor simulados, orquestador determinista, inventario local, sin compra automática, sin pagos reales y sin despliegue público en esta entrega. El hackathon pide una API pública para presentar una entrega; esta rama resuelve la fase Testnet solicitada. La guía también describe pagos reales, que este proyecto mantiene deshabilitados por decisión explícita.

## Fuentes consultadas el 10 de noviembre de 2026

- [Guía del hackathon](https://mpp-hackathon.vercel.app/): recorrido HTTP, descubrimiento y requisitos de presentación.
- [Servidor MPP](https://mpp.dev/quickstart/server): desafío, verificación, recibo y Testnet.
- [Cliente MPP](https://mpp.dev/sdk/typescript/client/Mppx.create): preparación manual para inspeccionar políticas antes de firmar.
- [Tempo charge](https://mpp.dev/sdk/typescript/server/Method.tempo.charge): cadena 42431, confirmación y protección de reuso.
- [Descubrimiento](https://mpp.dev/extensions/discovery): `/openapi.json`, `x-payment-info.offers[]` y precio en unidades mínimas.

Se fijan `mppx@0.18.0` y `viem@2.57.1` en el lockfile para reproducir la integración verificada.
