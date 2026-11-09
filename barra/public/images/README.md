# Imágenes de bebidas

Ambos atlas se generaron con la herramienta integrada ImageGen para este proyecto. No se utilizó el modo CLI. Son fotografías ilustrativas; los ingredientes y marcas de cada ejemplo se especifican en los datos de la receta.

- `drinks-atlas.png`: cuatro columnas y tres filas; conserva las doce fotografías originales de café y bebidas sin alcohol. Prompt: [generation-prompt.txt](./generation-prompt.txt).
- `cocktails-atlas.png`: cuatro columnas y dos filas; ocho cócteles nuevos. Prompt: [cocktails-generation-prompt.txt](./cocktails-generation-prompt.txt).

Las recetas de `src/data/products.js` indican el atlas y el índice de la celda, de izquierda a derecha y de arriba abajo.

Orden del atlas de cócteles:
1. Margarita Don Juan.
2. Margarita Don Pepe.
3. Paloma Don Juan.
4. Paloma Don Pepe.
5. Coco Don Juan.
6. Coco Don Pepe.
7. Sunrise Don Juan.
8. Coco sunrise Don Pepe.

- `beers-atlas.png`: atlas 2 × 2 de lager, IPA, negra y sin alcohol. Generado con ImageGen integrado (sin CLI). Prompt completo: [beers-generation-prompt.txt](./beers-generation-prompt.txt).
