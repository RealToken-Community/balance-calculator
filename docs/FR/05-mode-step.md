# Mode "priceRangeMode: step"

Lorsque le paramètre `priceRangeMode` est défini sur `"step"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système utilise une approche par paliers pour le calcul du boost. Au lieu d'une variation continue (linéaire ou exponentielle), ce mode divise la plage de prix en zones distinctes avec des niveaux de boost prédéfinis.

## Fonctionnement "boostMode: centered"

Dans ce mode, le calcul du boost est basé sur la distance au centre de la plage (variable `centeredness`), avec des valeurs de boost spécifiques attribuées à différents niveaux de centrage.

### Principes clés du mode "step":

1. **Paliers de centrage**: Le paramètre `steps` définit des paires `[threshold, boostValue]` où:

   - `threshold` est un seuil de centrage entre 0 et 1 (0 = extrémités, 1 = centre parfait)
   - `boostValue` est le multiplicateur de boost appliqué lorsque le centrage est supérieur ou égal à ce seuil

2. **Application des paliers**: Le système trouve le palier le plus élevé dont le seuil est inférieur ou égal au centrage actuel de la position

3. **Facteur de largeur**: Si `rangeWidthFactor` est défini, il est appliqué comme multiplicateur au boost déterminé par les paliers

### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "step",
        boostMode: "centered",
        inactiveBoost: 1,
        minBoost: 1, // Boost minimal par défaut
        steps: [
          [0.2, 1.5], // Si centrage ≥ 20%, boost = 1.5
          [0.5, 3.0], // Si centrage ≥ 50%, boost = 3.0
          [0.8, 4.0], // Si centrage ≥ 80%, boost = 4.0
          [1.0, 5.0], // Si centrage = 100%, boost = 5.0
        ],
    }
  }
}
```

### Exemples détaillés de calcul de boost pour positions Uniswap V3 avec mode step 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` comme indiqué ci-dessus.

### Scénario 1 : 50% USDC / 50% REG, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.0$
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.0 - 0.5) / 1.0 = 0.5
3. **Centrage (centeredness)** = 1 - |0.5 - 0.5| × 2 = 1.0 (position parfaitement centrée)
4. **Palier applicable** = 1.0 ≥ 1.0 → boost = 5.0
5. **Boost final** = 5.0

#### Pouvoir de vote :

- REG: 500 × 5.0 (boost) × (4/4) = 2500
- USDC: 500 × 5.0 (boost) × (2/4) = 1250
- **Total : 3750**

### Scénario 2 : 75% REG / 25% USDC, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 0.63$ (plus proche de la borne inférieure)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 655.22 tokens
- Balance USDC: 217.18 tokens (équivalent à 344.78 REG au prix de 0.63$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (0.63 - 0.5) / 1.0 = 0.13
3. **Centrage (centeredness)** = 1 - |0.13 - 0.5| × 2 = 1 - 0.74 = 0.26 (plus proche de l'extrémité)
4. **Palier applicable** = 0.26 ≥ 0.2 → boost = 1.5
5. **Boost final** = 1.5

#### Pouvoir de vote :

- REG: 655.22 × 1.5 (boost) × (4/4) = 982.83
- USDC: 344.78 × 1.5 (boost) × (2/4) = 258.59
- **Total : 1241.42** (arrondi à 1241)

### Scénario 3 : 25% REG / 75% USDC, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.22$ (plus proche de la moyenne)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 289.32 tokens
- Balance USDC: 867.44 tokens (équivalent à 710.68 REG au prix de 1.22$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.22 - 0.5) / 1.0 = 0.72
3. **Centrage (centeredness)** = 1 - |0.72 - 0.5| × 2 = 1 - 0.44 = 0.56 (moyennement centré)
4. **Palier applicable** = 0.56 ≥ 0.5 → boost = 3.0
5. **Boost final** = 3.0

#### Pouvoir de vote :

- REG: 289.32 × 3.0 (boost) × (4/4) = 867.96
- USDC: 710.68 × 3.0 (boost) × (2/4) = 1066.02
- **Total : 1933.98**

### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

### Scénario 5 : 100% REG, range 1.01$ à 1.5$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

### Scénario 6 : 100% USDC, range 0.01$ à 0.1$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.01$
- Prix max: 0.1$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

### Scénario 7 : 100% REG, range 100$ à 110$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 100$
- Prix max: 110$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

### Scénario 8 : 2.4% REG / 97.6% USDC, range 1.05$ à 2.75$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 2.7$ (très proche de la borne supérieure)
- Prix min: 1.05$
- Prix max: 2.75$
- Balance REG: 8.772 tokens
- Balance USDC: 976.28 tokens (équivalent à 361.585 REG au prix de 2.7$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 2.75 - 1.05 = 1.7
2. **Position relative du prix** = (2.7 - 1.05) / 1.7 = 0.97 (très proche de la borne supérieure)
3. **Centrage (centeredness)** = 1 - |0.97 - 0.5| × 2 = 1 - 0.94 = 0.06 (très décentré)
4. **Palier applicable** = 0.06 < 0.2 → boost = 1.0 (valeur par défaut minBoost)
5. **Boost final** = 1.0

#### Pouvoir de vote :

- REG: 8.772 × 1.0 (boost) × (4/4) = 8.77
- USDC: 361.585 × 1.0 (boost) × (2/4) = 180.79
- **Total : 189.56**

### Résumé des résultats

| Scénario | Description                          | État    | Prix  | Centrage | Palier | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | -------- | ------ | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | 1.00     | 1.0    | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | 0.26     | 0.2    | 1.50      | 0.75       | 1241            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | 0.56     | 0.5    | 3.00      | 1.50       | 1934            |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 500             |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 1000            |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 500             |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 1000            |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | 0.06     | <0.2   | 1.00      | 0.50       | 190             |

**Notes importantes :**

1. Le mode step crée une courbe de boost en "escalier" avec des transitions brusques entre les paliers, contrairement aux modes linéaire et exponentiel qui ont des transitions progressives.

2. Ce mode est particulièrement utile pour encourager des comportements spécifiques :

   - On peut créer des "zones cibles" où les fournisseurs de liquidité sont fortement récompensés
   - Il permet de définir des politiques de boost plus précises avec des changements de comportement marqués à certains seuils

3. Dans l'exemple ci-dessus, les paliers sont définis comme suit :

   - Centre exact (100% centré) : boost ×5
   - Zone centrale (≥80% centré) : boost ×4
   - Zone intermédiaire (≥50% centré) : boost ×3
   - Zone périphérique (≥20% centré) : boost ×1.5
   - Extrémités (<20% centré) : boost ×1 (valeur par défaut minBoost)

4. Ce mode permet aussi d'implémenter des stratégies "tout ou rien" en définissant des écarts importants entre les paliers.

5. Si un `rangeWidthFactor` est défini, il sera appliqué comme un multiplicateur supplémentaire au boost déterminé par les paliers, permettant de favoriser les plages larges ou étroites selon la valeur choisie.

6. Pour le scénario 8, avec un centrage de seulement 6%, le boost tombe au minimum car aucun palier ne s'applique. Cette approche par paliers peut être plus sévère que l'approche linéaire pour les positions très décentrées.

### Test :

Le fichier json comprenant les 10 wallets des exemples ci-dessus est disponible [ici](../../outDatas/balancesREG_mock_reel_pool_dex.json)

Le calculateur a été appliqué à ce jeu de données, et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus  sont disponibles [ici](../../outDatas/Test%20step%20centered%20decimals.png)
## Fonctionnement "boostMode: proximity"

Dans ce mode, le calcul de boost utilise un système de paliers pour déterminer le boost à appliquer en fonction de la distance au prix actuel.

**Principes clés du mode "proximity" (pour `priceRangeMode: "step"`)**:

1. **Calcul par Tranche (`sliceWidth`)**: Comme pour les autres modes proximity, la liquidité est analysée par tranches définies par `sliceWidth`.
2. **Boost par Paliers**: Au lieu d'utiliser une formule de décroissance continue (linéaire ou exponentielle), ce mode utilise des paliers (`steps`) pour déterminer le boost à appliquer.

   - Chaque palier est défini comme `[threshold, boostValue]` (différent du mode Centered) où:
     - `threshold` représente une proportion de `decaySlices` (valeur entre 0 et 1, typiquement ≤ 1).
     - `boostValue` est le boost à appliquer pour les tranches dont le `decayProgress` est inférieur ou égal à ce seuil.
   - Pour une tranche à distance `slicesAway`, on calcule `decayProgress = slicesAway / decaySlices`.
   - On trouve ensuite le premier palier dont le `threshold` est supérieur ou égal à `decayProgress` et on applique son `boostValue`.
   - Si aucun palier ne correspond, on utilise `minBoost`.

3. **Paramètres de Décroissance (`decaySlices`, `decaySlicesDown`, `decaySlicesUp`)**: Comme pour les autres modes proximity, ces paramètres déterminent la distance maximale (en nombre de tranches) pour atteindre `minBoost`.

4. **Gestion des Bornes (`valueLower`, `valueUpper`)**: Identique aux autres modes proximity.

5. **Positions Hors Plage (`outOfRangeEnabled`)**: Identique aux autres modes proximity.

**Important**: La différence clé entre les `steps` utilisés en mode `"centered"` et en mode `"proximity"` est que:

- En mode `"centered"`, le `threshold` représente un niveau de centrage (0 aux extrémités, 1 au centre parfait).
- En mode `"proximity"`, le `threshold` représente un niveau de `decayProgress` (0 au prix actuel, 1 à la distance `decaySlices`).

**Configuration typique pour `priceRangeMode: "step"` et `boostMode: "proximity"`**:

```typescript
{
  sushiswap: {
    default: {
      REG: 4,
      "*": 2
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "step",
        boostMode: "proximity",
        minBoost: 1,
        sliceWidth: 0.05,
        decaySlicesDown: 20,
        decaySlicesUp: 20,
        // Format: [threshold, boostValue]
        // Si decayProgress ≤ threshold, appliquer boostValue
        steps: [
          [0.25, 5],  // De 0 à 5 tranches (25% de decaySlices) → boost de 5
          [0.5, 3],   // De 6 à 10 tranches (50% de decaySlices) → boost de 3
          [0.75, 2],  // De 11 à 15 tranches (75% de decaySlices) → boost de 2
          [1.0, 1]    // De 16 à 20 tranches (100% de decaySlices) → boost de 1
        ],
        outOfRangeEnabled: true
    }
  }
}
```

### Exemple de calcul pour `boostMode: "proximity"` (Step)

Reprenons le **Scénario 8** de `balancesREG_mock_examples.json` avec la configuration step pour `boostMode: "proximity"` détaillée ci-dessus.

**Données du Scénario 8 et paramètres de boost**:

- Pool: REG/USDC (REG token0, USDC token1)
- Position LP: Range `[1.05$ - 2.75$]`, Prix Actuel: `2.7$`
- Balances: REG 8.772, USDC 976.28 (equiv. 361.585 REG)
- Paramètres: `minBoost: 1`, `sliceWidth: 0.05`, `decaySlicesDown: 20`, `decaySlicesUp: 20`, `steps: [[0.25, 5], [0.5, 3], [0.75, 2], [1.0, 1]]`

**Calcul du boost pour le REG (Token0)**:

1. `valueLower = null`, `valueUpper = 2.75` (maxPrice).
2. `currentValue = 2.7`. `bnEffectiveReferencePoint = 2.75`. Direction = 1 (vers le haut).
3. `bnTotalLiquidityWidth = |2.7 - 2.75| = 0.05`.
4. `bnTotalSlicesInLiquidity = 0.05 / 0.05 = 1` tranche.
5. `decaySlicesRelevant = decaySlicesUp = 20`.

   - **Tranche 1 (i=0)**: de 2.7 à 2.75.
     - `slicesAway = 0`.
     - `decayProgress = 0 / 20 = 0`.
     - Paliers triés par seuil décroissant: `[[1.0, 1], [0.75, 2], [0.5, 3], [0.25, 5]]`.
     - Premier palier où `decayProgress ≤ threshold`: `[0.25, 5]` car `0 ≤ 0.25`.
     - `sliceBoostNum = 5`.
     - `bnTotalBoostAccumulated = 5 * 1 = 5`.

6. `averageBoost = 5 / 1 = 5`.
7. Boost final pour REG = `5 * 1 = 5`.

**Calcul du boost pour l'USDC (Token1)**:

1. `valueLower = 1.05` (minPrice), `valueUpper = null`.
2. `currentValue = 2.7`. `bnEffectiveReferencePoint = 1.05`. Direction = -1 (vers le bas).
3. `bnTotalLiquidityWidth = |2.7 - 1.05| = 1.65`.
4. `bnTotalSlicesInLiquidity = 1.65 / 0.05 = 33` tranches.
5. `decaySlicesRelevant = decaySlicesDown = 20`.

   - **Tranches 0-5 (decayProgress ≤ 0.25)**: 6 premières tranches (de 2.70$ à 2.45$)
     - Pour chacune : `boostValue = 5`
     - Contribution : `6 × 5 = 30`
   - **Tranches 6-10 (0.25 < decayProgress ≤ 0.5)**: 5 tranches suivantes (de 2.45$ à 2.20$)
     - Pour chacune : `boostValue = 3`
     - Contribution : `5 × 3 = 15`
   - **Tranches 11-15 (0.5 < decayProgress ≤ 0.75)**: 5 tranches suivantes (de 2.20$ à 1.95$)
     - Pour chacune : `boostValue = 2`
     - Contribution : `5 × 2 = 10`
   - **Tranches 16-19 (0.75 < decayProgress ≤ 1.0)**: 4 tranches suivantes (de 1.95$ à 1.70$)
     - Pour chacune : `boostValue = 1`
     - Contribution : `4 × 1 = 4`
   - **Tranches 20-32 (decayProgress > 1.0)**: 13 tranches restantes (de 1.70$ à 1.05$)
     - Pour chacune : `boostValue = 1` (minBoost)
     - Contribution : `13 × 1 = 13`

6. `bnTotalBoostAccumulated = 30 + 15 + 10 + 4 + 13 = 72`.
7. `averageBoost = 72 / 33 ≈ 2.18`.
8. Boost final pour USDC = `2.18 * 0.5 = 1.09`.

**Pouvoir de vote pour le Scénario 8 (Step Proximity)**:

- REG: `8.772 tokens × 5 = 43.86`
- USDC: `361.585 equivalent REG × 1.09 = 394.46`
- **Pouvoir de vote total pour la position: `43.86 + 394.46 = 438.31`** (arrondi à 438)

**Analyse détaillée du mode "proximity" step**:

1. Le REG, étant sur la première tranche (`decayProgress = 0`), reçoit le boost du premier palier, soit 5.
2. Pour l'USDC, la distribution est très différente:
   - Les 6 premières tranches: boost de 5 (25% des decaySlices)
   - Les 5 tranches suivantes: boost de 3 (50% des decaySlices)
   - Les 5 tranches suivantes: boost de 2 (75% des decaySlices)
   - Les 4 tranches suivantes: boost de 1 (100% des decaySlices)
   - Les 13 tranches restantes: boost de 1 (minBoost)
3. Comparaison avec les autres modes pour le scénario 8:
   - **Mode "centered"** exponentiel** et step**: 190 pouvoir de vote
   - **Mode "centered" linéaire**: 234 pouvoir de vote
   - **Mode "proximity" linéaire**: environ 345 pouvoir de vote
   - **Mode "proximity" exponentiel**: environ 309 pouvoir de vote
   - **Mode "proximity" step**: 438 pouvoir de vote
4. Le mode step permet une personnalisation précise des seuils de récompense, ce qui peut créer des avantages stratégiques pour certaines positions. Dans notre exemple, il est le plus généreux pour ce scénario particulier.
5. Les avantages du mode step par rapport aux autres modes:
   - Contrôle explicite et discret des niveaux de boost
   - Possibilité de créer des "zones cibles" avec des seuils de boost bien définis
   - Permet de définir des stratégies de boost différentes pour différentes sections de la plage de liquidité
   - Plus facile à communiquer aux fournisseurs de liquidité: "Si vous êtes dans les X% du prix actuel, vous obtenez un boost de Y"

### Test :

Le calculateur a été appliqué au jeu de données (des 10 wallets), et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus sont disponibles [ici](../../outDatas/Test%20step%20proximity%20decimals.png)

### Tableau comparatif des modes "centered" et "proximity" pour le mode step

| Scénario | Description                          | Prix  | Mode Centered Step |         | Mode Proximity Step |         |
| -------- | ------------------------------------ | ----- | ------------------ | ------- | ------------------- | ------- |
|          |                                      |       | Boost REG          | Pouvoir | Boost REG           | Pouvoir |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | 1.00$ | 5.00               | 3750    | 5.00                | 3150    |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | 0.63$ | 1.50               | 1241    | 3.60                | 2986    |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | 1.22$ | 3.00               | 1934    | 3.90                | 2725    |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | 2.70$ | 1.00               | 190     | 5.00                | 438     |

Cette comparaison montre clairement que pour des positions ayant une liquidité proche du prix actuel, comme le scénario 8, le mode "proximity" offre un avantage considérable par rapport au mode "centered", particulièrement avec l'approche par paliers (step).
