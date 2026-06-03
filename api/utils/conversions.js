// Supported dimensions and their respective units
export const UNIT_DIMENSIONS = {
  g: 'Weight',
  kg: 'Weight',
  mL: 'Volume',
  L: 'Volume',
  items: 'Count'
};

export const UNIT_LABELS = {
  g: 'Grams (g)',
  kg: 'Kilograms (kg)',
  mL: 'Milliliters (mL)',
  L: 'Liters (L)',
  items: 'Items (count)'
};

/**
 * Check if two units belong to the same dimension and are compatible for conversion.
 */
export const areUnitsCompatible = (unit1, unit2) => {
  const dim1 = UNIT_DIMENSIONS[unit1];
  const dim2 = UNIT_DIMENSIONS[unit2];
  return dim1 && dim2 && dim1 === dim2;
};

/**
 * Returns the conversion factor to multiply a quantity of fromUnit to get the quantity in toUnit.
 * Example: if fromUnit = 'g' and toUnit = 'kg', returns 0.001 (1g = 0.001kg)
 */
export const getConversionFactor = (fromUnit, toUnit) => {
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(`Incompatible units: cannot convert from '${fromUnit}' to '${toUnit}'`);
  }

  if (fromUnit === toUnit) return 1.0;

  // Weight dimension: g <-> kg
  if (fromUnit === 'g' && toUnit === 'kg') return 0.001;
  if (fromUnit === 'kg' && toUnit === 'g') return 1000.0;

  // Volume dimension: mL <-> L
  if (fromUnit === 'mL' && toUnit === 'L') return 0.001;
  if (fromUnit === 'L' && toUnit === 'mL') return 1000.0;

  return 1.0;
};

/**
 * Converts a quantity from fromUnit to toUnit.
 * Returns a high-precision rounded float (up to 8 decimal places).
 */
export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const qVal = parseFloat(quantity);
  if (isNaN(qVal)) return 0;
  
  const factor = getConversionFactor(fromUnit, toUnit);
  const converted = qVal * factor;
  
  // Round to 8 decimal places to avoid standard JS floating point issues
  return Math.round(converted * 1e8) / 1e8;
};

/**
 * Calculates item price based on order quantity, order unit, base unit, and base price.
 * Formula: (quantity * conversion_factor) * base_price
 * Returns rounded to 2 decimal places (INR Paisa precision).
 */
export const calculateItemTotal = (quantity, orderUnit, baseUnit, basePrice) => {
  const qVal = parseFloat(quantity);
  const priceVal = parseFloat(basePrice);
  if (isNaN(qVal) || isNaN(priceVal)) return 0;

  const factor = getConversionFactor(orderUnit, baseUnit);
  const baseQty = qVal * factor;
  const total = baseQty * priceVal;

  return Math.round(total * 100) / 100;
};
