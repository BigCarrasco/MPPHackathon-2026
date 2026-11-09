# barra. — Cada taza cuenta

Una PoC compacta con 31 cafés, cócteles y cervezas, venta con un clic, inventario compartido de ingredientes y reposición por envases.

El proyecto está en [`barra/`](./barra). Necesitas Node.js 20.11 o posterior. No hay dependencias que instalar.

```sh
npm run serve
```

Abre **http://localhost:5173**. Consulta [`barra/README.md`](./barra/README.md) para la estructura y el punto de integración con un backend.

Los comandos `npm run serve`, `npm run dev`, `npm start`, `npm test` y `npm run build` funcionan tanto desde la raíz como desde `barra/`. Si el puerto 5173 está ocupado, ejecuta `PORT=5174 npm run serve` y abre http://localhost:5174. Mantén la terminal abierta mientras usas la demo.
