// Inventario de ejemplo. Las recetas consumen ml o g y la reposición pide envases.
export const ingredients = [
  { id: "tequila-don-juan", name: "Tequila Don Juan", shortName: "Don Juan", unit: "ml", initialStock: 7500, targetStock: 7500, reorderAt: 750, packSize: 750, packUnit: "botella", packPlural: "botellas" },
  { id: "tequila-don-pepe", name: "Tequila Don Pepe", shortName: "Don Pepe", unit: "ml", initialStock: 7500, targetStock: 7500, reorderAt: 750, packSize: 750, packUnit: "botella", packPlural: "botellas" },
  { id: "coconut-milk", name: "Leche de coco", shortName: "Leche de coco", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "envase", packPlural: "envases" },
  { id: "lime-juice", name: "Zumo de lima", shortName: "Lima", unit: "ml", initialStock: 6000, targetStock: 6000, reorderAt: 600, packSize: 1000, packUnit: "botella", packPlural: "botellas" },
  { id: "orange-liqueur", name: "Licor de naranja", shortName: "Licor de naranja", unit: "ml", initialStock: 3500, targetStock: 3500, reorderAt: 350, packSize: 700, packUnit: "botella", packPlural: "botellas" },
  { id: "grapefruit-juice", name: "Zumo de pomelo", shortName: "Pomelo", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "botella", packPlural: "botellas" },
  { id: "orange-juice", name: "Zumo de naranja", shortName: "Naranja", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "botella", packPlural: "botellas" },
  { id: "grenadine", name: "Granadina", shortName: "Granadina", unit: "ml", initialStock: 2000, targetStock: 2000, reorderAt: 200, packSize: 500, packUnit: "botella", packPlural: "botellas" },
  { id: "coffee", name: "Café molido", shortName: "Café", unit: "g", initialStock: 3600, targetStock: 3600, reorderAt: 360, packSize: 250, packUnit: "bolsa", packPlural: "bolsas" },
  { id: "matcha", name: "Matcha", shortName: "Matcha", unit: "g", initialStock: 400, targetStock: 400, reorderAt: 40, packSize: 100, packUnit: "bolsa", packPlural: "bolsas" },
  { id: "beer-lager", name: "Cerveza lager", shortName: "Lager", unit: "botellas", initialStock: 5, targetStock: 24, reorderAt: 8, packSize: 1, packUnit: "botella", packPlural: "botellas" },
  { id: "beer-ipa", name: "Cerveza IPA", shortName: "IPA", unit: "botellas", initialStock: 9, targetStock: 12, reorderAt: 10, packSize: 1, packUnit: "botella", packPlural: "botellas" },
  { id: "beer-stout", name: "Cerveza negra", shortName: "Negra", unit: "botellas", initialStock: 12, targetStock: 24, reorderAt: 6, packSize: 1, packUnit: "botella", packPlural: "botellas" },
  { id: "beer-zero", name: "Cerveza sin alcohol", shortName: "Sin alcohol", unit: "botellas", initialStock: 18, targetStock: 24, reorderAt: 6, packSize: 1, packUnit: "botella", packPlural: "botellas" },
];
