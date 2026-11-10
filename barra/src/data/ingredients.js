// Inventario de ejemplo. Las recetas consumen ml o g y la reposición pide envases.
export const ingredients = [
  { id: "tequila-don-juan", name: "Don Juan tequila", shortName: "Don Juan", unit: "ml", initialStock: 7500, targetStock: 7500, reorderAt: 750, packSize: 750, packUnit: "bottle", packPlural: "bottles" },
  { id: "tequila-don-pepe", name: "Don Pepe tequila", shortName: "Don Pepe", unit: "ml", initialStock: 7500, targetStock: 7500, reorderAt: 750, packSize: 750, packUnit: "bottle", packPlural: "bottles" },
  { id: "coconut-milk", name: "Coconut milk", shortName: "Coconut milk", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "carton", packPlural: "cartons" },
  { id: "lime-juice", name: "Lime juice", shortName: "Lime", unit: "ml", initialStock: 6000, targetStock: 6000, reorderAt: 600, packSize: 1000, packUnit: "bottle", packPlural: "bottles" },
  { id: "orange-liqueur", name: "Orange liqueur", shortName: "Orange liqueur", unit: "ml", initialStock: 3500, targetStock: 3500, reorderAt: 350, packSize: 700, packUnit: "bottle", packPlural: "bottles" },
  { id: "grapefruit-juice", name: "Grapefruit juice", shortName: "Grapefruit", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "bottle", packPlural: "bottles" },
  { id: "orange-juice", name: "Orange juice", shortName: "Orange", unit: "ml", initialStock: 12000, targetStock: 12000, reorderAt: 1200, packSize: 1000, packUnit: "bottle", packPlural: "bottles" },
  { id: "grenadine", name: "Grenadine", shortName: "Grenadine", unit: "ml", initialStock: 2000, targetStock: 2000, reorderAt: 200, packSize: 500, packUnit: "bottle", packPlural: "bottles" },
  { id: "coffee", name: "Ground coffee", shortName: "Coffee", unit: "g", initialStock: 3600, targetStock: 3600, reorderAt: 360, packSize: 250, packUnit: "bag", packPlural: "bags" },
  { id: "matcha", name: "Matcha", shortName: "Matcha", unit: "g", initialStock: 400, targetStock: 400, reorderAt: 40, packSize: 100, packUnit: "bag", packPlural: "bags" },
  { id: "beer-lager", name: "Lager beer", shortName: "Lager", unit: "bottles", initialStock: 5, targetStock: 24, reorderAt: 8, packSize: 1, packUnit: "bottle", packPlural: "bottles" },
  { id: "beer-ipa", name: "IPA beer", shortName: "IPA", unit: "bottles", initialStock: 9, targetStock: 12, reorderAt: 10, packSize: 1, packUnit: "bottle", packPlural: "bottles" },
  { id: "beer-stout", name: "Stout beer", shortName: "Stout", unit: "bottles", initialStock: 12, targetStock: 24, reorderAt: 6, packSize: 1, packUnit: "bottle", packPlural: "bottles" },
  { id: "beer-zero", name: "Alcohol-free beer", shortName: "Alcohol-free", unit: "bottles", initialStock: 18, targetStock: 24, reorderAt: 6, packSize: 1, packUnit: "bottle", packPlural: "bottles" },
];

