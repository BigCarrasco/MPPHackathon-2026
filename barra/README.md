# barra.

Simulador de reabastecimiento de un bar. El flujo principal es **inventario → necesidad detectada → pedido propuesto → revisión humana → solicitud simulada**.

## Ejecutar

Necesitas Node.js 22 o posterior. Ejecuta `npm ci` desde la raíz del repositorio y `npm run setup:testnet` para preparar el faucet.

```sh
npm run dev
npm test
npm run build
```

Abre http://localhost:5173. El build genera el dashboard en `dist/`; las cotizaciones MPP necesitan el servidor Node. No abras `index.html` como `file://`: los módulos necesitan HTTP.

## Abastecimiento automático

La pantalla inicial muestra lo que hay que pedir, antes que las ventas o el consumo.

| Insumo | Stock inicial | Objetivo | Mínimo | Pedido inicial |
| --- | ---: | ---: | ---: | ---: |
| Cerveza lager | 5 botellas | 24 | 8 | 19 botellas |
| Cerveza IPA | 9 botellas | 12 | 10 | 3 botellas |
| Cerveza negra | 12 botellas | 24 | 6 | 12 botellas |
| Cerveza sin alcohol | 18 botellas | 24 | 6 | 6 botellas |

El pedido inicial suma **40 botellas de cuatro productos**. Vender una lager deja cuatro y actualiza su propuesta a **20 botellas**. Vender una cerveza sin alcohol deja 17 y aumenta su pedido de 6 a **7 botellas**; el total pasa de 40 a **41 unidades de compra**. Las cantidades salen del inventario: no son filas de ejemplo hardcodeadas en la pantalla.

Un insumo entra en el cierre siempre que `stock < targetStock`, aunque todavía tenga stock por encima del mínimo. `reorderAt` indica urgencia y ordena los insumos prioritarios; no oculta el resto del consumo. La cantidad de compra es `Math.ceil((targetStock - stock) / packSize)`. La nota distingue el **total de unidades de compra** del **número de productos diferentes**. Las cantidades de ml o g se convierten a envases completos antes de sumarse. Para cervezas, un envase es una botella; para café, una bolsa; para leche de coco, un envase de un litro.

Las cuatro cervezas se suman a 12 cócteles, 9 cafés y 6 bebidas sin alcohol: **31 bebidas y 14 insumos**. Los tequilas comienzan con 7,5 litros cada uno, la leche de coco con 12 litros, café con 3600 g y matcha con 400 g. Las cervezas lager e IPA empiezan por debajo del mínimo para demostrar el abastecimiento desde el primer momento.

## Cajero de cierre

1. Revisa el pedido generado automáticamente en **Abastecimiento**.
2. Pulsa **Revisar y cerrar pedido**.
3. Revisa las líneas y escribe la clave de demostración **BARRA-DEMO**. No uses una contraseña real.
4. Confirma el pedido simulado. Aparece una referencia y queda registrado localmente.

La clave solo representa el paso de aprobación de la UX. No autentica personas, no se almacena y se limpia al cerrar el diálogo. La solicitud no envía datos, no paga y no incrementa existencias: una futura recepción de mercancía será otro evento.

El historial diferencia solicitudes simuladas. Las ventas y el consumo se consultan en un panel desplegable para conservar el foco en la compra. Esos resultados acumulan desde el último reinicio; el contador de solicitudes usa la fecha local del navegador.

## My Autopilot

Los controles funcionan dentro de la simulación:

- Proponer con aprobación humana o solo observar.
- Pausar y reanudar solicitudes.
- Ingredientes autorizados.
- Máximo de envases por pedido (por defecto 50).
- Máximo de solicitudes diarias (por defecto 5).
- Caducidad de borradores (por defecto 15 minutos).
- Vista de agentes y sus permisos previstos.
- Registro local de reglas, bloqueos y solicitudes.

Las reglas se vuelven a evaluar al confirmar el borrador. Una misma referencia no puede registrarse dos veces. Si conservas reglas de una versión previa, autoriza los nuevos ingredientes y ajusta el límite desde esta vista: no se amplían permisos guardados silenciosamente.

**Los pedidos siguen siendo una simulación local.** El botón **Generar presupuesto** añade una ruta independiente: el backend Node valida las reglas enviadas y aplica límites propios antes de pagar 0,01 pathUSD de prueba mediante MPP/Tempo Moderato. El proveedor devuelve precios simulados y recibo; nunca compra inventario. [Guía de arquitectura, pruebas, depuración y defensa](docs/MPP-MVP.md).

## Persistencia

- `barra:simulation:ingredients:v3`: existencias, ventas, objetivos personalizados (`targets`) y ajustes de stock por rellenos (`stockAdjustments`). Los insumos añadidos se inicializan sin perder ventas antiguas. Los datos guardados antes de añadir objetivos se cargan con los valores originales y sin ajustes.
- `barra:operations:v1`: reglas, solicitudes y registro de la demo.
- `barra:navigation-collapsed`: preferencia del menú.

En **Ingredientes**, escribe la cantidad en **Objetivo habitual** y pulsa **Guardar objetivo**. Se guarda como valor predeterminado para la reposición; guardar no cambia las existencias. **Rellenar hasta objetivo** añade exactamente lo que falta a ese ingrediente, conserva las ventas y nunca reduce un stock superior al objetivo. Los pedidos siguen redondeando a envases completos; el relleno manual de la simulación usa la cantidad exacta.

**Reiniciar demo**, en Ingredientes o en el menú, llena el inventario hasta los objetivos guardados, pone a cero ventas, solicitudes y abastecimiento, y limpia el registro. Conserva los objetivos personalizados y las reglas de gobernanza. El inventario lleno y los contadores en cero se mantienen al recargar. La siguiente venta vuelve a generar la reposición correspondiente. Todo se guarda en `localStorage`, no en una base de datos ni en la caché HTTP. Borrar los datos del sitio elimina la persistencia. No hay sincronización entre navegadores, pestañas o dispositivos; cada puerto de localhost tiene su propio almacenamiento.

## Código

```text
index.html
src/
  main.js                    Carta, ventas, navegación e integración de vistas
  features/operations.js     Abastecimiento, confirmación y gobernanza local
  data/products.js           Bebidas y recetas
  data/ingredients.js        Stock, objetivos, umbrales y envases
  lib/inventory.js           Consumos, disponibilidad y propuesta de pedido
  lib/order-policy.js        Reglas de autorización de la demo
  lib/icons.js               Iconos SVG
  services/storage.js        Persistencia del inventario y migración del catálogo
  styles/main.css            Estilos por bloques de interfaz
public/images/               Atlas de imágenes y prompts
scripts/                     Servidor local y build estático
tests/                       Inventario, persistencia y reglas
```

El evento `barra:sale` conserva producto vendido, cantidades consumidas, inventario y reposición. `getReplenishment(state)` devuelve el pedido con `productId`, `product`, `quantity` y `unit`. Las reglas están en funciones puras para poder trasladar su validación a un backend.

Las fotografías son ilustrativas y están guardadas localmente. Las marcas y cantidades pertenecen a las recetas de la demo. Consulta [public/images/README.md](./public/images/README.md) para los recursos generados con ImageGen y los prompts.

