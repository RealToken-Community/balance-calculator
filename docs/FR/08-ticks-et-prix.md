# Calcul des Ticks et Prix dans Uniswap V3

## Introduction

Ce document explique comment sont calculés les ticks et prix dans les pools Uniswap V3 dans notre application. Comprendre ces mécanismes est essentiel pour appréhender le fonctionnement des différents modes de boost présentés dans les chapitres précédents, notamment lorsque le paramètre `sourceValue` est défini sur `"tick"`.

## Relation entre Ticks et Prix

Dans Uniswap V3, les ticks et les prix sont liés par la formule suivante:

```
prixBrut = 1.0001^tick
prixAjusté = prixBrut / 10^(token1Decimals - token0Decimals)
```

Où:

- `tick` est une valeur entière qui représente la position sur l'échelle logarithmique des prix
- `1.0001` est la base (chaque tick représente une variation de prix de 0.01%)
- `token0Decimals` et `token1Decimals` sont les nombres de décimales des tokens dans la paire

## Implémentation dans l'Application

Dans notre application, nous utilisons la fonction `tick_to_price` pour convertir un tick en prix brut:

```javascript
const TICK_BASE = 1.0001;
function tick_to_price(tick) {
  return TICK_BASE ** tick;
}
```

Ensuite, nous calculons le prix ajusté en tenant compte de la différence de décimales entre les tokens:

```javascript
const current_price = tick_to_price(currentTick);
const adjusted_current_price = current_price / 10 ** (decimals1 - decimals0);
```

## Calcul des Prix Minimums et Maximums

Pour une position de liquidité, nous calculons le prix minimum et maximum correspondant aux ticks inférieur et supérieur:

```javascript
minPrice: tick_to_price(tick_lower) / 10 ** (decimals1 - decimals0),
maxPrice: tick_to_price(tick_upper) / 10 ** (decimals1 - decimals0),
```

## Exemple: REG/USDC

Pour une position dans la paire REG/USDC comme celle dans notre exemple de données (correspondant au Scénario 1 de `balancesREG_mock_examples.json`):

- REG (token0) a 18 décimales
- USDC (token1) a 6 décimales
- La différence est donc (6 - 18) = -12

Détails de la position:

- `currentTick`: -276324
- `tickLower`: -283256
- `tickUpper`: -272269

### Calcul du prix actuel

```
prixBrut = 1.0001^(-276324) ≈ 0.0000010
prixAjusté = 0.0000010 / 10^(6-18) = 0.0000010 * 10^12 ≈ 1.0
```

Ce qui correspond bien à la valeur "currentPrice": "1.0" dans nos données.

### Calcul du prix minimum (tickLower)

```
prixBrut = 1.0001^(-283256) ≈ 0.0000005
prixAjusté = 0.0000005 / 10^(6-18) = 0.0000005 * 10^12 ≈ 0.5
```

Ce qui correspond à la valeur "minPrice": 0.5 dans nos données.

### Calcul du prix maximum (tickUpper)

```
prixBrut = 1.0001^(-272269) ≈ 0.0000015
prixAjusté = 0.0000015 / 10^(6-18) = 0.0000015 * 10^12 ≈ 1.5
```

Ce qui correspond à la valeur "maxPrice": 1.5 dans nos données.

## Impact sur le calcul des boosts

### Relation avec le paramètre `sourceValue`

Le paramètre `sourceValue` dans la configuration des boosts peut prendre deux valeurs:

- `"tick"`: Les calculs utilisent directement les valeurs de tick
- `"priceDecimals"`: Les calculs utilisent les prix ajustés en décimales

Lors de l'utilisation de `sourceValue: "tick"`, les valeurs utilisées sont beaucoup plus grandes (en valeur absolue) car elles représentent des positions sur l'échelle logarithmique. Par exemple, une plage de prix de 0.5$ à 1.5$ correspond approximativement à une plage de ticks de -283256 à -272269, soit une largeur d'environ 11000 ticks.

### Conséquences sur les paramètres de boost

Cela a des implications importantes pour la configuration des paramètres:

1. **Pour `sliceWidth`**:

   - Avec `sourceValue: "tick"`, une valeur par défaut de 1 signifie que chaque tranche correspond à une variation de prix de 0.01%
   - Avec `sourceValue: "priceDecimals"`, une valeur par défaut de 0.1 représente directement une variation de prix de 0.1$

2. **Pour `decaySlices` et variantes**:

   - Avec `sourceValue: "tick"`, ces valeurs doivent être beaucoup plus grandes pour couvrir la même plage de prix

3. **Pour `rangeWidthFactor`**:
   - Les plages exprimées en ticks sont numériquement beaucoup plus larges, ce qui peut nécessiter des ajustements du facteur de largeur

## Calcul des Montants de Tokens dans une Position

Notre application calcule également les montants de chaque token dans une position en fonction du tick actuel:

- Si le tick actuel est inférieur au tick minimum (`currentTick < tickLower`), la position est entièrement en token0
- Si le tick actuel est supérieur au tick maximum (`currentTick > tickUpper`), la position est entièrement en token1
- Si le tick actuel est entre les deux (`tickLower <= currentTick <= tickUpper`), la position contient les deux tokens

La fonction `getPositionAmount` dans le code implémente ces calculs en utilisant les formules d'Uniswap V3 basées sur les racines carrées des prix.

## Vérification des Calculs

Pour vérifier qu'un prix correspond bien à un tick, ou inversement:

```javascript
// Conversion de tick à prix
const tick = -283600;
const price = 1.0001 ** tick; // ≈ 0.00000048308581099
const adjustedPrice = price * 10 ** 12; // ≈ 0.48308581099

// Conversion de prix à tick
const adjustedPrice = 0.48308581099;
const price = adjustedPrice / 10 ** 12; // ≈ 0.00000048308581099
const tick = Math.log(price) / Math.log(1.0001); // ≈ -283600
```

## Conclusion

La compréhension du mécanisme de conversion entre ticks et prix est cruciale pour configurer efficacement les paramètres de boost, particulièrement si vous utilisez `sourceValue: "tick"`. Les valeurs numériques pour les ticks sont beaucoup plus grandes et fonctionnent sur une échelle logarithmique, ce qui peut rendre leur manipulation moins intuitive que les prix décimaux.

Pour la plupart des cas d'utilisation, il est recommandé d'utiliser `sourceValue: "priceDecimals"` car cela rend la configuration plus intuitive et directement liée aux prix observables sur le marché.

## Exemple de calcul 

**Pour `boostMode: "proximity"`, `priceRangeMode : "Linear"` et `sourceValue: "tick"`**

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "tick",
        priceRangeMode: "linear",
        boostMode: "proximity",
        maxBoost: 5,
        minBoost: 1,
         // Avec `sourceValue: "tick"`, une valeur par défaut de 1 signifie que chaque tranche correspond à une variation de prix de 0.01%
        sliceWidth: 1000, //  chaque tranche représente une variation de 10% du prix
        decaySlicesDown: 10, // Atteint minBoost en 10 tranches vers le bas (0.5$ de variation)
        decaySlicesUp: 10,   // Atteint minBoost en 10 tranches vers le haut (0.5$ de variation)
        outOfRangeEnabled: true
    }
  }
}
```

### cas du Scénario 1 (Position 1001) pour l'utilisateur 0x111...111**:

#### Données d'entrée :

- Pool: REG/USDC (REG est token0, USDC est token1)
- Position active (isActive: true)
- Prix actuel: 1.0$ => "currentTick": -276324,
- Prix min: 0.5$ => "tickLower": -283256,
- Prix max: 1.5$ => "tickUpper": -272269,
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost pour le REG (Token0):

1.  `valueLower` est `null`, `valueUpper` est `-272269` (maxPrice de la position).
2.  Le prix actuel est `currentValue = -276324`.
3.  La borne de référence (`bnEffectiveReferencePoint`) est `-272269`.
4.  Direction: `1` (vers le haut, de `currentValue` vers `bnEffectiveReferencePoint`).
5.  Largeur totale de la liquidité pertinente (`bnTotalLiquidityWidth`): `|-276324 - -272269| = 4055`.
6.  Nombre total de tranches théoriques (`bnTotalSlicesInLiquidity`): `4055 / 1000 = 4.055` tranches.
7.  `decaySlices` pertinent est `decaySlicesUp = 10`.

    - **Tranche 1 (i=0)**: de -276324 à -275324 (portion = 1).
      - `slicesAway = i = 0`.
      - `decayProgress = 0 / 10 = 0`.
      - `sliceBoostNum = 5 - (5 - 1) * 0 = 5`.
    - **Tranche 2 (i=1)**: de -275324 à -274324 (portion = 1).
      - `sliceBoostNum = 4.6`.
    - **Tranche 3 (i=2)**: de -274324 à -273324 (portion = 1).
      - `sliceBoostNum = 4.2`.
    - **Tranche 4 (i=3)**: de -273324 à -272324 (portion = 1).
      - `sliceBoostNum = 3.8`.
    - **Tranche 5 (i=4)**: de -272324 à -272269 (portion = 0.055).
      - `sliceBoostNum = 3.4 * 0.055 = 0.19`.
      
    `bnTotalBoostAccumulated = 5 + 4.6 + 4.2 + 3.8 + 0.19 = 17.79`
      
8.  `averageBoost = 17.79 / 4.055 = 4.3864`.
9.  Boost final pour REG = `4.39 * 1 = 4.39`.

#### Calcul du boost pour l'USDC (Token1):

1.  `valueLower` est `-283256` (minPrice de la position), `valueUpper` est `null`.
2.  Le prix actuel est `currentValue = -276324`.
3.  La borne de référence (`bnEffectiveReferencePoint`) est `-283256`.
4.  Direction: `-1` (vers le bas, de `currentValue` vers `bnEffectiveReferencePoint`).
5.  Largeur totale de la liquidité pertinente (`bnTotalLiquidityWidth`): `|-283256 - -276324| = 6932`.
6.  Nombre total de tranches théoriques (`bnTotalSlicesInLiquidity`): `6932 / 1000 = 6,932` tranches.
7.  `decaySlices` pertinent est `decaySlicesDown = 10`.

    - **Tranche 1 (i=0)**: de -276324 à -277324 (portion = 1).
      - `sliceBoostNum = 5`.
    - **Tranche 2 (i=1)**: de -277324 à -278324 (portion = 1).
      - `sliceBoostNum = 4.6`.
    - **Tranche 3 (i=2)**: de -278324 à -279324 (portion = 1).
      - `sliceBoostNum = 4.2`.
    - **Tranche 4 (i=3)**: de -279324 à -280324 (portion = 1).
      - `sliceBoostNum = 3.8`.
    - **Tranche 5 (i=4)**: de -280324 à -281269 (portion = 1).
      - `sliceBoostNum = 3.4`.
    - **Tranche 6 (i=5)**: de -281324 à -282269 (portion = 1).
      - `sliceBoostNum = 3`.
    - **Tranche 7 (i=6)**: de -282324 à -283256 (portion = 0.932).
      - `sliceBoostNum = 2.6 * 0.932= 2.42`.
      
    `bnTotalBoostAccumulated = 26.42`.

8.  `averageBoost = 26.42 / 6.932 ≈ 3.8117`.
9.  Boost final pour USDC = `3.8117 * 0.5 = 1.91`.

#### Pouvoir de vote pour le Scénario 1 (Position 1001)**:

- REG: `500 tokens × 4,39 = 2193.22`
- USDC: `500 equivalent REG × 1.91 = 952.94`
- **Total: `2193.22 + 952.94 = 3146.16`**

### Résultats pour l'ensemble du jeu de test : 

Calculateur executé pour les 10 wallets [ici](../../outDatas/Test%20linear%20proximity%20tick%20.png)
