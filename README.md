# barra. — Cada taza cuenta

Una PoC compacta con 31 cafés, cócteles y cervezas, venta con un clic, inventario compartido de ingredientes y reposición por envases.

El proyecto está en [`barra/`](./barra). Necesitas Node.js 22 o posterior. Desde la raíz instala las dependencias con `npm ci`.

```sh
npm ci
npm run setup:testnet   # cuenta desechable + fondos ficticios del faucet
npm run serve
```

Abre **http://localhost:5173**. Consulta [`barra/README.md`](./barra/README.md) para la estructura y el punto de integración con un backend.

Los comandos `npm run serve`, `npm run dev`, `npm start`, `npm test` y `npm run build` funcionan tanto desde la raíz como desde `barra/`. Si el puerto 5173 está ocupado, ejecuta `PORT=5174 npm run serve` y abre http://localhost:5174. Mantén la terminal abierta mientras usas la demo.


## Cotizaciones MPP / Tempo Testnet

En **Abastecimiento → Generar presupuesto**, el backend calcula los faltantes, recibe HTTP 402 del proveedor, valida la política de gasto, firma un micropago de **0,01 pathUSD ficticios** y recibe precios simulados con `Payment-Receipt`. El inventario inicial propone 40 botellas por **55,20 €**. El coste de consulta se muestra aparte, sin convertirlo a euros. No se compran bebidas ni se crean pedidos.

```sh
npm test                 # pruebas sin red ni fondos
npm run demo:testnet     # HTTP 402 → pago Testnet → cotización; requiere setup previo
```

[Guía para aprender, probar, depurar y defender el proyecto](./barra/docs/MPP-MVP.md).

La integración fija Moderato **42431**, pathUSD y el RPC oficial. No existe modo de pagos reales. Las claves quedan en `barra/.env`; recibos, reservas y protección contra reuso en `barra/.data/`, ambos excluidos de Git. La demo escucha solo en localhost y usa un proceso Node. `npm run build` exporta el dashboard; las cotizaciones requieren el backend Node.
